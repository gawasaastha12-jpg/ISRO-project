"""
confidence_engine.py
=============================================================
Confidence Fusion Engine

Purpose
-------
Combines:

1. SOLEXS forecasting probabilities
2. HEL1OS activity score

to produce a final confidence score, alert level,
and human-readable explanation.

Author : Aastha
=============================================================
"""

from typing import Dict, List


# ============================================================
# CONFIGURATION
# ============================================================

RF_WEIGHT = 0.70
HEL_WEIGHT = 0.30

STATE_BONUS = {
    "Quiet": 0.00,
    "Elevated": 0.03,
    "Active": 0.06,
    "Highly Active": 0.10,
}


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
# COMPUTE FUSED CONFIDENCE
# ============================================================

def compute_fused_confidence(
    rf_probability: float,
    activity_score: float,
) -> float:
    """
    Weighted fusion of

    RF confidence
    +
    HEL activity score
    """

    hel_norm = normalize_activity_score(activity_score)

    confidence = (
        RF_WEIGHT * rf_probability
        +
        HEL_WEIGHT * hel_norm
    )

    return confidence


# ============================================================
# APPLY BONUS BASED ON ACTIVITY STATE
# ============================================================

def apply_activity_bonus(
    confidence: float,
    activity_state: str,
) -> float:
    """
    Increase confidence if HEL1OS
    reports elevated activity.
    """

    confidence += STATE_BONUS.get(activity_state, 0.0)

    confidence = max(0.0, min(confidence, 1.0))

    return confidence


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

    confidence = compute_fused_confidence(
        rf_probability,
        activity_score,
    )

    confidence = apply_activity_bonus(
        confidence,
        activity_state,
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