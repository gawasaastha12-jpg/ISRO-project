"""
confidence_engine.py
=============================================================
Confidence Fusion Engine

Purpose
-------
Combines:

1. SOLEXS forecasting probabilities  (P, M, U)
2. HEL1OS activity score             (H)

Using the Bayesian Fusion Formula:

    C_fusion = 0.80 * [P * (0.65 + 0.35*M) * (1 - 0.25*U)] + 0.20 * H

Where:
    P = Primary model probability for top predicted class
    M = Decision Margin (top prob - 2nd prob)  in [0, 1]
    U = Model Uncertainty (1 - P)              in [0, 1]
    H = Normalized HEL1OS activity score       in [0, 1]

Author : Aastha
=============================================================
"""

from typing import Dict, List


# ============================================================
# CONFIGURATION
import math

# Outer channel weights (must sum to 1.0)
SOLEXS_CHANNEL_WEIGHT = 0.80   # SOLEXS XGBoost forecast channel
HEL1OS_CHANNEL_WEIGHT  = 0.20  # HEL1OS hard X-ray channel

# Inner P-scaling coefficients
MARGIN_BASE   = 0.65   # Baseline margin weight
MARGIN_SCALE  = 0.35   # Sensitivity to decision margin
UNCERT_SCALE  = 0.25   # Penalty factor for model uncertainty


# ============================================================
# NORMALIZE HEL1OS SCORE
# ============================================================

def normalize_activity_score(activity_score: float) -> float:
    """
    Convert HEL1OS activity score (0-100)
    to normalized range (0-1).
    """

    activity_score = max(0.0, min(activity_score, 100.0))
    return activity_score / 100.0


# ============================================================
# COMPUTE SIGMOID ACTIVITY BONUS
# ============================================================

def calculate_sigmoid_bonus(activity_score: float) -> float:
    """
    Smooth Sigmoid Activity Bonus:
    B = 0.10 * sigmoid((score - 50) / 10)
    where sigmoid(x) = 1 / (1 + exp(-x))

    For score = 41.8:
    x = (41.8 - 50) / 10 = -0.82
    sigmoid(-0.82) = 0.3058
    B = 0.10 * 0.3058 ≈ 0.031
    """
    x = (activity_score - 50.0) / 10.0
    sigmoid_val = 1.0 / (1.0 + math.exp(-x))
    return 0.10 * sigmoid_val


# ============================================================
# COMPUTE FUSED CONFIDENCE  (Bayesian Fusion Formula)
# ============================================================

def compute_fused_confidence(
    rf_probability: float,
    activity_score: float,
    margin: float = 0.50,
    uncertainty: float = None,
) -> float:
    """
    Implements the exact Bayesian Fusion Formula:

        C_fusion = 0.80 * [P * (0.65 + 0.35*M) * (1 - 0.25*U)] + 0.20 * H

    Parameters
    ----------
    rf_probability : float
        P — Top class probability from XGBoost SOLEXS model, in [0, 1].
    activity_score : float
        Raw HEL1OS activity score in [0, 100]. Normalized to H in [0, 1].
    margin : float
        M — Decision margin (P_top - P_2nd), in [0, 1].
        Defaults to 0.50 (moderate decisiveness) when unavailable.
    uncertainty : float or None
        U — Model uncertainty. If None, defaults to (1 - rf_probability).

    Returns
    -------
    float
        C_fusion clamped to [0.0, 1.0].
    """
    # --- Inputs ---
    P = max(0.0, min(rf_probability, 1.0))
    H = normalize_activity_score(activity_score)            # [0, 1]
    M = max(0.0, min(margin, 1.0))                         # [0, 1]
    U = max(0.0, min(
        uncertainty if uncertainty is not None else (1.0 - P),
        1.0
    ))                                                      # [0, 1]

    # --- Bayesian Fusion Formula ---
    #   Inner term: P scaled by margin confidence, penalised by uncertainty
    solexs_term = P * (MARGIN_BASE + MARGIN_SCALE * M) * (1.0 - UNCERT_SCALE * U)

    #   Outer weighted sum across SOLEXS channel and HEL1OS channel
    c_fusion = SOLEXS_CHANNEL_WEIGHT * solexs_term + HEL1OS_CHANNEL_WEIGHT * H

    return max(0.0, min(c_fusion, 1.0))


# ============================================================
# ALERT LEVEL
# ============================================================

def get_alert_level(confidence: float) -> str:
    """
    Convert confidence into alert level.
    """

    if confidence >= 0.90:
        return "Critical"

    if confidence >= 0.70:
        return "High"

    if confidence >= 0.40:
        return "Moderate"

    return "Low"


# ============================================================
# EXPLANATION GENERATOR
# ============================================================

def generate_explanation(
    prediction: str,
    rf_probability: float,
    activity_score: float,
    activity_state: str,
    final_confidence: float,
) -> List[str]:

    explanation = []

    explanation.append(
        f"SOLEXS predicts {prediction} flare."
    )

    explanation.append(
        f"Raw model confidence: {rf_probability:.1%}"
    )

    explanation.append(
        f"HEL1OS activity score: {activity_score:.1f}"
    )

    explanation.append(
        f"HEL1OS state: {activity_state}"
    )

    if activity_state == "Highly Active":
        explanation.append(
            "HEL1OS strongly supports elevated solar activity."
        )

    elif activity_state == "Active":
        explanation.append(
            "HEL1OS indicates active solar conditions."
        )

    elif activity_state == "Elevated":
        explanation.append(
            "HEL1OS indicates moderate solar activity."
        )

    else:
        explanation.append(
            "HEL1OS reports quiet background conditions."
        )

    explanation.append(
        f"Final fused confidence: {final_confidence:.1%}"
    )

    return explanation


# ============================================================
# COMPLETE FUSION
# ============================================================

def fuse_prediction(
    prediction: str,
    probabilities: Dict[str, float],
    activity_score: float,
    activity_state: str,
    margin: float = 0.50,
    uncertainty: float = None,
) -> Dict:
    """
    Main entry point.

    Parameters
    ----------
    prediction

    probabilities

    activity_score

    activity_state

    Returns
    -------
    Dictionary ready for dashboard.
    """

    rf_probability = probabilities.get(prediction)
    if rf_probability is None:
        clean_pred = prediction.replace("-like", "").lower()
        for k, v in probabilities.items():
            if k.replace("-like", "").lower() == clean_pred:
                rf_probability = v
                break
        else:
            rf_probability = 0.0

    # Resolve uncertainty from margin if not explicitly provided
    resolved_uncertainty = uncertainty if uncertainty is not None else (1.0 - rf_probability)

    confidence = compute_fused_confidence(
        rf_probability=rf_probability,
        activity_score=activity_score,
        margin=margin,
        uncertainty=resolved_uncertainty,
    )

    alert = get_alert_level(confidence)

    explanation = generate_explanation(
        prediction,
        rf_probability,
        activity_score,
        activity_state,
        confidence,
    )

    result = {

        "prediction": prediction,

        "raw_probability": rf_probability,

        "activity_score": activity_score,

        "activity_state": activity_state,

        "confidence": confidence,

        "alert": alert,

        "probabilities": probabilities,

        "explanation": explanation,

    }

    return result


# ============================================================
# DEMO
# ============================================================

if __name__ == "__main__":

    probabilities = {

        "Quiet": 0.01,

        "B-like": 0.08,

        "C-like": 0.14,

        "M-like": 0.62,

        "X-like": 0.15,

    }

    result = fuse_prediction(

        prediction="M-like",

        probabilities=probabilities,

        activity_score=86,

        activity_state="Highly Active",

    )

    print("\n==============================")

    print("Fusion Result")

    print("==============================")

    for k, v in result.items():

        if k == "explanation":

            print()

            print("Explanation")

            for line in v:
                print(" •", line)

        else:

            print(f"{k:20}: {v}")