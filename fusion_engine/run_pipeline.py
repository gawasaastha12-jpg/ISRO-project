"""
============================================================
Solar Fusion Pipeline
============================================================

End-to-end pipeline

SOLEXS Forecast
        ↓
HEL1OS Activity
        ↓
Confidence Fusion
        ↓
Alert Engine
        ↓
Visualization

Author:
ISRO Solar Fusion Project
"""

import os
import joblib
import numpy as np
import pandas as pd

from confidence_engine import fuse_prediction
from alert_engine import process_alert
from visualizer import create_dashboard

# ---------------------------------------------------------
# PATHS
# ---------------------------------------------------------

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

# ---------------------------------------------------------
# LOAD MODEL
# ---------------------------------------------------------

print("\nLoading Forecast Model...")

bundle = joblib.load(MODEL_FILE)

model = bundle["model"]
label_encoder = bundle["label_encoder"]

print("Model loaded successfully.")

# ---------------------------------------------------------
# LOAD DATA
# ---------------------------------------------------------

print("\nLoading SOLEXS Features...")

df = pd.read_csv(DATASET)

DROP_COLS = [
    "label",
    "source_file",
    "forecast_horizon_min"
]

feature_cols = [c for c in df.columns if c not in DROP_COLS]

latest = df.iloc[-1]

X = latest[feature_cols].values.reshape(1, -1)

print("Features :", len(feature_cols))

# ---------------------------------------------------------
# FORECAST
# ---------------------------------------------------------

prediction_idx = model.predict(X)[0]

prediction = label_encoder.inverse_transform([prediction_idx])[0]

prob = model.predict_proba(X)[0]

# ---------------------------------------------------------
# CLASS NAMES
# ---------------------------------------------------------

class_names = list(label_encoder.classes_)

probabilities = {}

for i, c in enumerate(class_names):
    probabilities[c] = float(prob[i])

# ---------------------------------------------------------
# HEL1OS
# ---------------------------------------------------------
#
# Replace this later by actual HEL1OS inference
#

activity_score = 84

activity_state = "Highly Active"

# ---------------------------------------------------------
# CONFIDENCE FUSION
# ---------------------------------------------------------

fusion_result = fuse_prediction(
    prediction,
    probabilities,
    activity_score,
    activity_state
)

# ---------------------------------------------------------
# ALERT
# ---------------------------------------------------------

alert = process_alert(fusion_result)

# ---------------------------------------------------------
# DUMMY LIGHTCURVE
#
# Replace later with actual SOLEXS lightcurve
# ---------------------------------------------------------

lightcurve = np.random.normal(
    100,
    10,
    600
)

# ---------------------------------------------------------
# DASHBOARD
# ---------------------------------------------------------

create_dashboard(
    lightcurve,
    fusion_result
)

# ---------------------------------------------------------
# SAVE RESULT
# ---------------------------------------------------------

os.makedirs(
    "outputs",
    exist_ok=True
)

pd.DataFrame([fusion_result]).to_csv(
    "outputs/latest_prediction.csv",
    index=False
)

print("\nPrediction saved.")

# ---------------------------------------------------------
# SUMMARY
# ---------------------------------------------------------

print("\n================================================")

print("Forecast :", prediction)

print("Confidence :",
      round(fusion_result["confidence"]*100,2),
      "%")

print("HEL1OS :", activity_score)

print("Alert :", alert["level"])

print("Dashboard : outputs/dashboard_images/forecast_dashboard.png")

print("================================================")

print("\nPipeline completed successfully.")