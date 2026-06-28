"""
alert_engine.py
======================================================
Automatic Solar Flare Alert Engine

Input
-----
Prediction
Confidence
HEL1OS Activity

Output
------
Alert Level
Priority
Suggested Action
CSV Log

Author : Aastha
======================================================
"""

from pathlib import Path
import pandas as pd
from datetime import datetime

OUTPUT_DIR = Path("outputs")
OUTPUT_DIR.mkdir(exist_ok=True)

ALERT_FILE = OUTPUT_DIR / "alerts.csv"


# -------------------------------------------------------
# Alert Rules
# -------------------------------------------------------

def generate_alert(result):

    prediction = result["prediction"]
    confidence = float(result["confidence"])
    hel_score = float(result["activity_score"])

    alert = "NONE"
    priority = 0
    color = "GREEN"
    action = "Continue monitoring"

    # -------------------------------
    # X-class
    # -------------------------------
    if prediction == "X-like":

        if confidence >= 0.90:
            alert = "CRITICAL"
            priority = 5
            color = "RED"
            action = "Immediate warning"

        elif confidence >= 0.75:
            alert = "VERY HIGH"
            priority = 4
            color = "ORANGE"
            action = "Prepare for severe flare"

        else:
            alert = "HIGH"
            priority = 3
            color = "YELLOW"
            action = "Monitor closely"

    # -------------------------------
    # M-class
    # -------------------------------
    elif prediction == "M-like":

        if confidence >= 0.80:
            alert = "HIGH"
            priority = 3
            color = "ORANGE"
            action = "Possible major flare"

        elif confidence >= 0.60:
            alert = "MEDIUM"
            priority = 2
            color = "YELLOW"
            action = "Increase monitoring"

        else:
            alert = "LOW"
            priority = 1
            color = "BLUE"
            action = "Watch for escalation"

    # -------------------------------
    # C-class
    # -------------------------------
    elif prediction == "C-like":

        if confidence >= 0.70:
            alert = "MEDIUM"
            priority = 2
            color = "YELLOW"
            action = "Minor flare expected"

        else:
            alert = "LOW"
            priority = 1
            color = "BLUE"
            action = "Routine observation"

    # -------------------------------
    # B-class
    # -------------------------------
    elif prediction == "B-like":

        alert = "LOW"
        priority = 1
        color = "BLUE"
        action = "Routine observation"

    else:

        alert = "NONE"
        priority = 0
        color = "GREEN"
        action = "Quiet Sun"

    return {

        "timestamp": datetime.utcnow(),

        "prediction": prediction,

        "confidence": confidence,

        "activity_score": hel_score,

        "activity_state": result["activity_state"],

        "alert": alert,

        "priority": priority,

        "color": color,

        "action": action
    }


# -------------------------------------------------------
# Save Alert
# -------------------------------------------------------

def save_alert(alert):

    df = pd.DataFrame([alert])

    if ALERT_FILE.exists():

        old = pd.read_csv(ALERT_FILE)

        df = pd.concat([old, df], ignore_index=True)

    df.to_csv(ALERT_FILE, index=False)

    return ALERT_FILE


# -------------------------------------------------------
# Pretty Print
# -------------------------------------------------------

def display_alert(alert):

    print("\n")
    print("=" * 45)
    print("SOLAR FLARE ALERT")
    print("=" * 45)

    print(f"Prediction      : {alert['prediction']}")
    print(f"Confidence      : {alert['confidence']:.1%}")
    print(f"HEL Activity    : {alert['activity_score']:.1f}")
    print(f"HEL State       : {alert['activity_state']}")

    print()

    print(f"Alert Level     : {alert['alert']}")
    print(f"Priority        : {alert['priority']}")
    print(f"Color           : {alert['color']}")

    print()

    print("Recommended Action")
    print("-------------------")
    print(alert["action"])

    print("=" * 45)


# -------------------------------------------------------
# Complete Pipeline
# -------------------------------------------------------

def process_alert(fusion_result):

    alert = generate_alert(fusion_result)

    save_alert(alert)

    display_alert(alert)

    return alert


# -------------------------------------------------------
# Example
# -------------------------------------------------------

if __name__ == "__main__":

    sample = {

        "prediction": "M-like",

        "confidence": 0.82,

        "activity_score": 84,

        "activity_state": "Highly Active"

    }

    process_alert(sample)