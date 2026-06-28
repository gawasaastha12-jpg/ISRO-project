"""
============================================================
Solar Fusion Dashboard
============================================================

Creates a scientific dashboard for the fusion pipeline.

Panels
------
1. SOLEXS Lightcurve
2. Forecast Probabilities
3. HEL1OS Activity
4. Confidence Gauge
5. Alert Panel

Author:
ISRO Solar Fusion Project
"""

import os
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Circle


# ----------------------------------------------------------
# Colors
# ----------------------------------------------------------

def confidence_color(conf):

    if conf >= 0.80:
        return "green"

    elif conf >= 0.60:
        return "orange"

    return "red"


# ----------------------------------------------------------
# Dashboard
# ----------------------------------------------------------

def create_dashboard(
    lightcurve,
    fusion_result,
    save_name="forecast_dashboard.png"
):

    output_dir = os.path.join(
        "outputs",
        "dashboard_images"
    )

    os.makedirs(output_dir, exist_ok=True)

    save_path = os.path.join(
        output_dir,
        save_name
    )

    fig = plt.figure(figsize=(16, 10))
    fig.suptitle(
        "Solar Flare Forecast Dashboard",
        fontsize=20,
        fontweight="bold"
    )

    # ======================================================
    # SOLEXS Lightcurve
    # ======================================================

    ax1 = plt.subplot2grid((3, 2), (0, 0), colspan=2)

    ax1.plot(
        lightcurve,
        linewidth=2,
        color="royalblue"
    )

    ax1.set_title("SOLEXS X-Ray Lightcurve")

    ax1.set_xlabel("Time")

    ax1.set_ylabel("Counts")

    ax1.grid(alpha=0.3)

    # ======================================================
    # Probability Bar Chart
    # ======================================================

    ax2 = plt.subplot2grid((3, 2), (1, 0))

    probs = fusion_result["probabilities"]

    labels = list(probs.keys())

    values = list(probs.values())

    colors = [
        "green",
        "lime",
        "gold",
        "orange",
        "red"
    ]

    ax2.bar(
        labels,
        values,
        color=colors
    )

    ax2.set_ylim(0, 1)

    ax2.set_ylabel("Probability")

    ax2.set_title("Forecast Probabilities")

    # ======================================================
    # HEL1OS Activity Gauge
    # ======================================================

    ax3 = plt.subplot2grid((3, 2), (1, 1))

    score = fusion_result["activity_score"]

    ax3.barh(
        [0],
        [score],
        color="darkorange"
    )

    ax3.set_xlim(0, 100)

    ax3.set_yticks([])

    ax3.set_xlabel("Activity Score")

    ax3.set_title(
        f"HEL1OS ({fusion_result['activity_state']})"
    )

    # ======================================================
    # Confidence Gauge
    # ======================================================

    ax4 = plt.subplot2grid((3, 2), (2, 0))

    ax4.set_aspect("equal")

    ax4.axis("off")

    confidence = fusion_result["confidence"]

    circle = Circle(
        (0.5, 0.5),
        0.35,
        color=confidence_color(confidence),
        alpha=0.25
    )

    ax4.add_patch(circle)

    ax4.text(
        0.5,
        0.55,
        f"{confidence*100:.1f}%",
        ha="center",
        va="center",
        fontsize=22,
        fontweight="bold"
    )

    ax4.text(
        0.5,
        0.25,
        "Confidence",
        ha="center",
        fontsize=13
    )

    # ======================================================
    # Alert Panel
    # ======================================================

    ax5 = plt.subplot2grid((3, 2), (2, 1))

    ax5.axis("off")

    prediction = fusion_result["prediction"]

    confidence_pct = confidence * 100

    activity = fusion_result["activity_score"]

    alert = fusion_result["alert"]

    explanation = "\n".join(
        fusion_result["explanation"]
    )

    text = (
        f"Prediction : {prediction}\n\n"
        f"Confidence : {confidence_pct:.1f}%\n\n"
        f"HEL1OS Activity : {activity:.1f}\n\n"
        f"Alert : {alert}\n\n"
        f"{explanation}"
    )

    ax5.text(
        0.02,
        0.98,
        text,
        va="top",
        fontsize=11,
        bbox=dict(
            facecolor="#F2F2F2",
            edgecolor="black"
        )
    )

    plt.tight_layout()

    plt.savefig(
        save_path,
        dpi=200,
        bbox_inches="tight"
    )

    plt.close()

    print("\nSaved visualization")

    print(save_path)


# ----------------------------------------------------------
# Demo
# ----------------------------------------------------------

if __name__ == "__main__":

    fusion = {

        "prediction": "M-like",

        "confidence": 0.82,

        "activity_score": 84,

        "activity_state": "Highly Active",

        "alert": "High",

        "probabilities": {

            "Quiet": 0.01,

            "B-like": 0.08,

            "C-like": 0.14,

            "M-like": 0.62,

            "X-like": 0.15

        },

        "explanation": [

            "SOLEXS predicts M-like flare.",

            "HEL1OS supports elevated activity.",

            "High confidence after fusion."

        ]

    }

    lc = np.random.normal(
        100,
        5,
        600
    )

    create_dashboard(
        lc,
        fusion
    )