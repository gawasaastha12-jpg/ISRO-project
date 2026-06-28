"""
============================================================
Solar Fusion Utilities
============================================================

Shared helper functions used throughout the pipeline.

Used by:
    run_pipeline.py
    confidence_engine.py
    alert_engine.py
    visualizer.py

Author: ISRO Solar Fusion Project
"""

import os
import joblib
import numpy as np
import pandas as pd


# ============================================================
# Directory Helpers
# ============================================================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODELS = os.path.join(ROOT, "SOLEXS_downloads", "models")
DATA = os.path.join(ROOT, "SOLEXS_downloads", "data")
OUTPUTS = os.path.join(ROOT, "outputs")

os.makedirs(OUTPUTS, exist_ok=True)


# ============================================================
# Model Loader
# ============================================================

def load_model(model_path):
    """
    Loads either a plain model or a saved dictionary bundle.
    """

    bundle = joblib.load(model_path)

    if isinstance(bundle, dict):

        if "model" in bundle:
            return bundle["model"], bundle

        if "base_model" in bundle:
            return bundle["base_model"], bundle

    return bundle, None


# ============================================================
# Latest Sample Loader
# ============================================================

def load_latest_features(csv_path, feature_cols):
    """
    Returns the latest feature vector from dataset.
    """

    df = pd.read_csv(csv_path)

    row = df.iloc[-1]

    X = row[feature_cols].values.reshape(1, -1)

    return X, row


# ============================================================
# Probability → Dictionary
# ============================================================

def probabilities_to_dict(probabilities, labels):

    return {
        labels[i]: float(probabilities[i])
        for i in range(len(labels))
    }


# ============================================================
# Normalize Activity
# ============================================================

def normalize_activity(score):

    score = float(score)

    return max(0.0, min(score / 100.0, 1.0))


# ============================================================
# HEL1OS Activity State
# ============================================================

def activity_state(score):

    if score < 25:
        return "Quiet"

    elif score < 50:
        return "Low Activity"

    elif score < 75:
        return "Moderately Active"

    return "Highly Active"


# ============================================================
# Prediction Color
# ============================================================

def prediction_color(prediction):

    colors = {

        "Quiet": "#4CAF50",

        "B-like": "#8BC34A",

        "C-like": "#FFC107",

        "M-like": "#FF9800",

        "X-like": "#F44336",

        "Severe (M+X)": "#D32F2F"

    }

    return colors.get(prediction, "gray")


# ============================================================
# Confidence Color
# ============================================================

def confidence_color(conf):

    if conf >= 0.80:
        return "green"

    elif conf >= 0.60:
        return "orange"

    return "red"


# ============================================================
# Save CSV
# ============================================================

def save_csv(df, filename):

    path = os.path.join(OUTPUTS, filename)

    df.to_csv(path, index=False)

    print(f"Saved {path}")

    return path


# ============================================================
# Save Dictionary
# ============================================================

def save_dictionary(dictionary, filename):

    path = os.path.join(OUTPUTS, filename)

    pd.DataFrame([dictionary]).to_csv(path, index=False)

    print(f"Saved {path}")

    return path


# ============================================================
# Ensure Directory
# ============================================================

def ensure_dir(folder):

    os.makedirs(folder, exist_ok=True)

    return folder


# ============================================================
# Banner
# ============================================================

def banner(title):

    print("\n" + "=" * 60)
    print(title)
    print("=" * 60)


# ============================================================
# Labels
# ============================================================

CLASS_NAMES = [

    "Quiet",

    "B-like",

    "C-like",

    "M-like",

    "X-like"

]