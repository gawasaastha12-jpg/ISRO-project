import pandas as pd
import numpy as np
import os
import joblib
import time
import re
import xgboost as xgb
from sklearn.isotonic import IsotonicRegression
from sklearn.utils.class_weight import compute_sample_weight
from sklearn.metrics import confusion_matrix

# Config
DATA_PATH = "../data/processed/horizons_74/forecast_5min.csv"
MODEL_DIR = "../models"
os.makedirs(MODEL_DIR, exist_ok=True)

# Class mappings
CLASS_NAMES = {
    0: "Quiet",
    1: "B-like",
    2: "C-like",
    3: "Severe (M+X)"
}

def extract_month(source_file):
    m = re.search(r"(\d{6})\d{2}", str(source_file))
    return m.group(1) if m else "unknown"

def true_skill_statistic(y_true, y_pred, positive_class=3):
    y_true_bin = (np.array(y_true) == positive_class).astype(int)
    y_pred_bin = (np.array(y_pred) == positive_class).astype(int)
    tp = np.sum((y_true_bin == 1) & (y_pred_bin == 1))
    fn = np.sum((y_true_bin == 1) & (y_pred_bin == 0))
    fp = np.sum((y_true_bin == 0) & (y_pred_bin == 1))
    tn = np.sum((y_true_bin == 0) & (y_pred_bin == 0))
    sens = tp / (tp + fn + 1e-9)
    spec = tn / (tn + fp + 1e-9)
    tss = sens - (1.0 - spec)
    return tss, sens, spec

def compute_multiclass_ece(y_true, y_probs, n_bins=10):
    ece_sum = 0
    for c in range(4):
        y_true_bin = (y_true == c).astype(int)
        probs_c = y_probs[:, c]
        bin_edges = np.linspace(0, 1, n_bins + 1)
        bin_ece = 0
        for i in range(n_bins):
            bin_idx = (probs_c >= bin_edges[i]) & (probs_c < bin_edges[i+1])
            if np.sum(bin_idx) > 0:
                acc = np.mean(y_true_bin[bin_idx])
                conf = np.mean(probs_c[bin_idx])
                bin_ece += (np.sum(bin_idx) / len(y_true)) * np.abs(acc - conf)
        ece_sum += bin_ece
    return ece_sum / 4.0

def main():
    print(f"[INFO] Loading dataset from {DATA_PATH}...")
    if not os.path.exists(DATA_PATH):
        print(f"Error: dataset file not found at {DATA_PATH}")
        return
        
    df = pd.read_csv(DATA_PATH)
    print(f"[INFO] Loaded {len(df):,} rows, {df.shape[1]} columns")
    
    # Feature selection
    drop_cols = ["label", "source_file", "forecast_horizon_min"]
    feature_cols = [c for c in df.columns if c not in drop_cols]
    
    # Add month column for LOMO
    df["month"] = df["source_file"].apply(extract_month)
    
    # Filter out synthetic SMOTE for LOMO splits
    df_real = df[df["month"] != "unknown"].copy()
    unique_months = sorted([m for m in df_real["month"].unique() if m != "unknown"])
    
    X_real = df_real[feature_cols].values
    y_real = df_real["label"].values
    months = df_real["month"].values
    
    print(f"[INFO] Total features: {len(feature_cols)}")
    print(f"[INFO] Identified {len(unique_months)} unique months for LOMO CV: {unique_months}")
    
    xgb_params = {
        "objective": "multi:softprob",
        "num_class": 4,
        "eval_metric": "mlogloss",
        "n_estimators": 300,
        "max_depth": 6,
        "learning_rate": 0.05,
        "subsample": 0.8,
        "colsample_bytree": 0.8,
        "random_state": 42,
        "n_jobs": -1
    }
    
    # =============================================================================
    # 1. LEAVE-ONE-MONTH-OUT CROSS-VALIDATION
    # =============================================================================
    print("\n=== Stage 1: Leave-One-Month-Out (LOMO) Cross-Validation ===")
    lomo_tss = []
    
    for m in unique_months:
        train_mask = (months != m)
        test_mask = (months == m)
        
        X_tr, y_tr = X_real[train_mask], y_real[train_mask]
        X_te, y_te = X_real[test_mask], y_real[test_mask]
        
        # Check class presence
        if len(np.unique(y_tr)) < 2 or len(np.unique(y_te)) < 1:
            continue
            
        sample_weights = compute_sample_weight(class_weight="balanced", y=y_tr)
        model = xgb.XGBClassifier(**xgb_params)
        model.fit(X_tr, y_tr, sample_weight=sample_weights)
        
        y_pred = model.predict(X_te)
        
        # Calculate TSS for Severe class
        tss, sens, spec = true_skill_statistic(y_te, y_pred, positive_class=3)
        lomo_tss.append(tss)
        
        print(f"  Month {m}: TSS = {tss:+.4f} (sens={sens:.4f}, spec={spec:.4f}, n_test={len(y_te)})")
        
    print(f"\n[LOMO SUMMARY] Mean TSS across months: {np.mean(lomo_tss):+.4f} ± {np.std(lomo_tss):.4f}")
    
    # =============================================================================
    # 2. MULTICLASS ISOTONIC CALIBRATION
    # =============================================================================
    print("\n=== Stage 2: Multiclass Isotonic Probability Calibration ===")
    # Split timeline: 15 train months, 5 calibration months, 5 test months
    train_months = unique_months[:15]
    calib_months = unique_months[15:20]
    test_months  = unique_months[20:]
    
    print(f"  Train months:       {train_months}")
    print(f"  Calibration months: {calib_months}")
    print(f"  Test months:        {test_months}")
    
    tr_mask = df_real["month"].isin(train_months)
    cal_mask = df_real["month"].isin(calib_months)
    te_mask = df_real["month"].isin(test_months)
    
    X_tr, y_tr = X_real[tr_mask], y_real[tr_mask]
    X_cal, y_cal = X_real[cal_mask], y_real[cal_mask]
    X_te, y_te = X_real[te_mask], y_real[te_mask]
    
    # Fit base model
    sample_weights = compute_sample_weight(class_weight="balanced", y=y_tr)
    base_model = xgb.XGBClassifier(**xgb_params)
    base_model.fit(X_tr, y_tr, sample_weight=sample_weights)
    
    # Predict raw probabilities on calibration set
    cal_probs = base_model.predict_proba(X_cal)
    
    # Fit one-vs-rest Isotonic regressors
    isotonic_models = {}
    for c in range(4):
        iso = IsotonicRegression(out_of_bounds="clip")
        iso.fit(cal_probs[:, c], (y_cal == c).astype(int))
        isotonic_models[c] = iso
        
    # Evaluate calibration on test set
    raw_test_probs = base_model.predict_proba(X_te)
    calibrated_test_probs = np.zeros_like(raw_test_probs)
    
    for c in range(4):
        calibrated_test_probs[:, c] = isotonic_models[c].predict(raw_test_probs[:, c])
        
    # Re-normalize calibrated test probabilities
    row_sums = calibrated_test_probs.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1.0 # prevent division by zero
    calibrated_test_probs /= row_sums
    
    ece_raw = compute_multiclass_ece(y_te, raw_test_probs)
    ece_cal = compute_multiclass_ece(y_te, calibrated_test_probs)
    
    print(f"  Expected Calibration Error (ECE):")
    print(f"    Uncalibrated: {ece_raw:.4f}")
    print(f"    Isotonic:     {ece_cal:.4f}")
    
    # =============================================================================
    # 3. TRAINING FINAL DEPLOYED MODEL
    # =============================================================================
    print("\n=== Stage 3: Fitting Final Deployed Model ===")
    final_weights = compute_sample_weight(class_weight="balanced", y=y_real)
    final_model = xgb.XGBClassifier(**xgb_params)
    final_model.fit(X_real, y_real, sample_weight=final_weights)
    
    # Recalibrate isotonic regressors on full dataset predictions
    final_probs = final_model.predict_proba(X_real)
    final_isotonic_models = {}
    for c in range(4):
        iso = IsotonicRegression(out_of_bounds="clip")
        iso.fit(final_probs[:, c], (y_real == c).astype(int))
        final_isotonic_models[c] = iso
        
    # Save the calibrated bundle
    output_path = os.path.join(MODEL_DIR, "model_forecast_5min_74.pkl")
    bundle = {
        "model": final_model,
        "label_encoder": None,
        "feature_cols": feature_cols,
        "isotonic_models": final_isotonic_models,
        "ece_uncalibrated": ece_raw,
        "ece_calibrated": ece_cal
    }
    joblib.dump(bundle, output_path)
    print(f"[SUCCESS] Calibrated 74-feature model bundle saved -> {output_path}")

if __name__ == "__main__":
    main()
