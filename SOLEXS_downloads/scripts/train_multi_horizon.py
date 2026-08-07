"""
train_multi_horizon.py
----------------------
Aditya-L1 SoLEXS Solar Flare Forecasting Pipeline
Automated training loop for multi-horizon XGBoost models.
Trains and packages models for 5m, 10m, 15m, 30m, 60m, 120m, and 180m forward predictions.
"""

import os
import pandas as pd
import numpy as np
import joblib
from xgboost import XGBClassifier
from sklearn.model_selection import GroupKFold
from sklearn.metrics import confusion_matrix

# ── Paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../data/processed/"))
MODELS_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "../models/"))

# The forecast horizons (in minutes) we want to train models for
HORIZONS = [5, 10, 15, 30, 60, 120, 180]

# ── 17 Engineered Features extracted from raw SoLEXS telemetry ────────
FEATURE_COLS = [
    'mean', 'median', 'std', 'iqr', 'skew', 'kurtosis', 'energy', 'snr', 
    'max', 'min', 'peak_count', 'peak_ratio', 'max_prominence', 
    'detection_threshold', 'prominence_multiple', 'largest_width', 'trend'
]

TARGET_COL = "flare_class" # 0: Quiet, 1: B, 2: C, 3: M, 4: X
GROUP_COL = "source_file"  # For Event-based Cross Validation

def calculate_tss(y_true, y_pred):
    """Calculates True Skill Statistic (TSS)."""
    y_true_bin = np.where(y_true >= 3, 1, 0)
    y_pred_bin = np.where(y_pred >= 3, 1, 0)
    
    tn, fp, fn, tp = confusion_matrix(y_true_bin, y_pred_bin).ravel()
    tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    return tpr - fpr

def train_horizon(horizon_mins):
    """Trains and saves the XGBoost model for a specific forecast horizon."""
    print(f"\n[{horizon_mins} MINUTE HORIZON] ----------------------------------")
    
    # Assuming your naming convention holds for all datasets
    data_file = os.path.join(DATA_DIR, f"lag_12_onset_{horizon_mins}min.csv")
    model_out = os.path.join(MODELS_DIR, f"model_forecast_{horizon_mins}min.pkl")
    
    if not os.path.exists(data_file):
        print(f" [ERROR] Data file not found: {data_file}")
        return

    df = pd.read_csv(data_file)
    X = df[FEATURE_COLS]
    y = df[TARGET_COL]
    
    print(f" Loaded dataset: {X.shape[0]} rows.")

    # Core Architecture
    model = XGBClassifier(
        objective='multi:softprob',
        num_class=5,
        n_estimators=300,
        max_depth=5,
        learning_rate=0.05,
        random_state=42,
        n_jobs=-1,
        enable_categorical=False
    )

    print(f" Training production model for T+{horizon_mins}m...")
    model.fit(X, y)
    
    # Package for plot_trajectory.py and ArchiveModule.tsx
    bundle = {
        'model': model,
        'feature_cols': FEATURE_COLS
    }
    
    joblib.dump(bundle, model_out)
    print(f" [SUCCESS] Saved -> {os.path.basename(model_out)}")

def main():
    print("="*60)
    print(" INITIALIZING MULTI-HORIZON XGBOOST TRAINING PIPELINE")
    print("="*60)
    
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    for h in HORIZONS:
        train_horizon(h)
        
    print("\n="*60)
    print(" ALL HORIZON MODELS TRAINED AND PACKAGED SUCCESSFULLY")
    print("="*60)

if __name__ == "__main__":
    main()