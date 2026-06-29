"""
============================================================
Solar Fusion Pipeline
============================================================

SOLEXS Forecast
        ↓
HEL1OS Activity
        ↓
Confidence Fusion
        ↓
Alert Engine
        ↓
Visualization
"""

import os
import joblib
import numpy as np
import pandas as pd

from confidence_engine import fuse_prediction
from alert_engine import process_alert
from visualizer import create_dashboard


# ============================================================
# PATHS
# ============================================================

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MODEL_FILE = os.path.join(
    ROOT,
    "SOLEXS_downloads",
    "models",
    "model_forecast_5min.pkl"
)

DATASET = os.path.join(
    ROOT,
    "SOLEXS_downloads",
    "data",
    "processed",
    "horizons",
    "forecast_5min.csv"
)


# ============================================================
# LOAD MODEL
# ============================================================

print("\nLoading Forecast Model...")

bundle = joblib.load(MODEL_FILE)

model = bundle["model"]

print("Model loaded successfully.")


# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading SOLEXS Features...")

df = pd.read_csv(DATASET)

feature_cols = [
    "mean",
    "median",
    "std",
    "iqr",
    "skew",
    "kurtosis",
    "energy",
    "snr",
    "max",
    "min",
    "peak_count",
    "peak_ratio",
    "max_prominence",
    "detection_threshold",
    "prominence_multiple",
    "largest_width",
    "trend"
]

latest = df.iloc[-1]

X = latest[feature_cols].values.reshape(1, -1)

print("Input shape :", X.shape)
print("Features    :", len(feature_cols))


# ============================================================
# FORECAST
# ============================================================

prediction_idx = int(model.predict(X)[0])

prob = model.predict_proba(X)[0]

CLASS_NAMES = {
    0: "Quiet",
    1: "B-like",
    2: "C-like",
    3: "M-like",
    4: "X-like"
}

prediction = CLASS_NAMES[prediction_idx]

probabilities = {
    CLASS_NAMES[i]: float(prob[i])
    for i in range(len(prob))
}

print("\nPrediction :", prediction)
print("Probabilities :", probabilities)


# ============================================================
# HEL1OS
# ============================================================

# Replace later with actual HEL1OS inference

activity_score = 84
activity_state = "Highly Active"


# ============================================================
# CONFIDENCE FUSION
# ============================================================

fusion_result = fuse_prediction(
    prediction=prediction,
    probabilities=probabilities,
    activity_score=activity_score,
    activity_state=activity_state
)


# ============================================================
# ALERT
# ============================================================

alert = process_alert(fusion_result)

print(alert)
print(alert.keys())

# ============================================================
# DUMMY LIGHTCURVE
# ============================================================

lightcurve = np.random.normal(
    100,
    10,
    600
)


# ============================================================
# DASHBOARD
# ============================================================

create_dashboard(
    lightcurve,
    fusion_result
)


# ============================================================
# SAVE RESULT
# ============================================================

OUTPUT_DIR = os.path.join(ROOT, "outputs")

os.makedirs(OUTPUT_DIR, exist_ok=True)

pd.DataFrame([fusion_result]).to_csv(
    os.path.join(OUTPUT_DIR, "latest_prediction.csv"),
    index=False
)

print("\nPrediction saved.")


# ============================================================
# SUMMARY
# ============================================================

print("\n================================================")
print("Forecast   :", prediction)
print("Confidence :", round(fusion_result["confidence"] * 100, 2), "%")
print("HEL1OS     :", activity_score)

print("Alert      :", alert.get("alert", "UNKNOWN"))

print("Dashboard  : outputs/dashboard_images/forecast_dashboard.png")
print("================================================")

print("\nPipeline completed successfully.")