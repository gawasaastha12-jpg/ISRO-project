import os
import joblib
import pandas as pd
import numpy as np

# ----------------- PATHS -----------------
ROOT_DIR = r"c:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project"
MODEL_17_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "models", "model_forecast_5min.pkl")
DATA_17_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data", "processed", "horizons", "forecast_5min.csv")

MODEL_74_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "models", "model_forecast_5min_74.pkl")
DATA_74_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data", "processed", "horizons_74", "forecast_5min.csv")

# ----------------- ECE CALCULATION FUNCTION -----------------
def calculate_ece(y_true, y_prob, n_bins=10):
    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0
    n_samples = len(y_true)
    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i+1]
        in_bin = (y_prob >= bin_lower) & (y_prob < bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(y_true[in_bin])
            avg_confidence_in_bin = np.mean(y_prob[in_bin])
            ece += prop_in_bin * np.abs(avg_confidence_in_bin - accuracy_in_bin)
    return ece

# ----------------- MODEL 1: 17-FEATURE MODEL -----------------
print("=========================================")
print("EVALUATING 17-FEATURE NOWCAST MODEL (v8)")
print("=========================================")
if not os.path.exists(MODEL_17_PATH) or not os.path.exists(DATA_17_PATH):
    print("17-feature model or dataset files not found!")
else:
    # Load 17-feature bundle
    bundle_17 = joblib.load(MODEL_17_PATH)
    model_17 = bundle_17["model"] if isinstance(bundle_17, dict) else bundle_17
    isotonic_17 = bundle_17.get("isotonic_models") if isinstance(bundle_17, dict) else None
    
    # Load dataset
    df_17 = pd.read_csv(DATA_17_PATH)
    features_17 = [
        "mean", "median", "std", "iqr", "skew", "kurtosis", "energy", "snr",
        "max", "min", "peak_count", "peak_ratio", "max_prominence",
        "detection_threshold", "prominence_multiple", "largest_width", "trend"
    ]
    
    # Preprocess
    if "detection_threshold" not in df_17.columns:
        df_17["detection_threshold"] = (3 * df_17["std"]).clip(lower=11)
    if "prominence_multiple" not in df_17.columns:
        df_17["prominence_multiple"] = df_17["max_prominence"] / df_17["detection_threshold"]
        
    X_17 = df_17[features_17].values
    y_17 = df_17["label"].values
    
    # Severe label class index
    classes_17 = list(model_17.classes_)
    # Find label 3 (Severe) class index
    severe_label_17 = 3 if 3 in classes_17 else (4 if 4 in classes_17 else classes_17[-1])
    class_idx_17 = classes_17.index(severe_label_17)
    
    # Predict probabilities
    probs_17 = model_17.predict_proba(X_17)
    
    # Apply Isotonic Calibration
    if isotonic_17:
        cal_probs_17 = np.zeros_like(probs_17)
        for c in range(probs_17.shape[1]):
            if c in isotonic_17:
                cal_probs_17[:, c] = isotonic_17[c].predict(probs_17[:, c])
        probs_17 = cal_probs_17
        
    prob_severe_17 = probs_17[:, class_idx_17]
    y_severe_17 = (y_17 == severe_label_17).astype(int)
    
    # Evaluate at threshold = 0.35
    threshold = 0.35
    preds_17 = (prob_severe_17 >= threshold).astype(int)
    
    tp = np.sum((y_severe_17 == 1) & (preds_17 == 1))
    fn = np.sum((y_severe_17 == 1) & (preds_17 == 0))
    fp = np.sum((y_severe_17 == 0) & (preds_17 == 1))
    tn = np.sum((y_severe_17 == 0) & (preds_17 == 0))
    
    tar = tp / (tp + fn) if (tp + fn) > 0 else 0.0 # True Alarm Rate / Sensitivity / TPR
    far = fp / (tn + fp) if (tn + fp) > 0 else 0.0 # False Alarm Rate / FPR
    tss = tar - far
    ece_17 = calculate_ece(y_severe_17, prob_severe_17)
    
    print(f"Total Samples: {len(df_17)}")
    print(f"True Positives: {tp}, True Negatives: {tn}, False Positives: {fp}, False Negatives: {fn}")
    print(f"True Alarm Rate (TAR / TPR / Sensitivity): {tar:.4f} ({tar:.2%})")
    print(f"False Alarm Rate (FAR / FPR): {far:.4f} ({far:.2%})")
    print(f"True Skill Statistic (TSS): {tss:.4f}")
    print(f"Expected Calibration Error (ECE): {ece_17:.4f}")
    
    # Feature Importance
    print("\nTop 5 Feature Importances (Gain):")
    if hasattr(model_17, "feature_importances_"):
        importances = model_17.feature_importances_
        sorted_indices = np.argsort(importances)[::-1]
        for i in range(min(5, len(features_17))):
            idx = sorted_indices[i]
            print(f"  {i+1}. {features_17[idx]}: {importances[idx]*100:.2f}%")


# ----------------- MODEL 2: 74-FEATURE MODEL -----------------
print("\n=========================================")
print("EVALUATING 74-FEATURE NOWCAST MODEL")
print("=========================================")
if not os.path.exists(MODEL_74_PATH) or not os.path.exists(DATA_74_PATH):
    print("74-feature model or dataset files not found!")
else:
    # Load 74-feature bundle
    bundle_74 = joblib.load(MODEL_74_PATH)
    model_74 = bundle_74["model"] if isinstance(bundle_74, dict) else bundle_74
    isotonic_74 = bundle_74.get("isotonic_models") if isinstance(bundle_74, dict) else None
    
    # Load dataset
    df_74 = pd.read_csv(DATA_74_PATH)
    features_74 = [c for c in df_74.columns if c not in ("label", "source_file", "forecast_horizon_min", "month")]
    
    X_74 = df_74[features_74].values
    y_74 = df_74["label"].values
    
    # Severe label class index
    classes_74 = list(model_74.classes_)
    severe_label_74 = 3 if 3 in classes_74 else (4 if 4 in classes_74 else classes_74[-1])
    class_idx_74 = classes_74.index(severe_label_74)
    
    # Predict probabilities
    probs_74 = model_74.predict_proba(X_74)
    
    # Apply Isotonic Calibration
    if isotonic_74:
        cal_probs_74 = np.zeros_like(probs_74)
        for c in range(probs_74.shape[1]):
            if c in isotonic_74:
                cal_probs_74[:, c] = isotonic_74[c].predict(probs_74[:, c])
        probs_74 = cal_probs_74
        
    prob_severe_74 = probs_74[:, class_idx_74]
    y_severe_74 = (y_74 == severe_label_74).astype(int)
    
    # Evaluate at threshold = 0.35
    preds_74 = (prob_severe_74 >= threshold).astype(int)
    
    tp_74 = np.sum((y_severe_74 == 1) & (preds_74 == 1))
    fn_74 = np.sum((y_severe_74 == 1) & (preds_74 == 0))
    fp_74 = np.sum((y_severe_74 == 0) & (preds_74 == 1))
    tn_74 = np.sum((y_severe_74 == 0) & (preds_74 == 0))
    
    tar_74 = tp_74 / (tp_74 + fn_74) if (tp_74 + fn_74) > 0 else 0.0
    far_74 = fp_74 / (tn_74 + fp_74) if (tn_74 + fp_74) > 0 else 0.0
    tss_74 = tar_74 - far_74
    ece_74 = calculate_ece(y_severe_74, prob_severe_74)
    
    print(f"Total Samples: {len(df_74)}")
    print(f"True Positives: {tp_74}, True Negatives: {tn_74}, False Positives: {fp_74}, False Negatives: {fn_74}")
    print(f"True Alarm Rate (TAR / TPR / Sensitivity): {tar_74:.4f} ({tar_74:.2%})")
    print(f"False Alarm Rate (FAR / FPR): {far_74:.4f} ({far_74:.2%})")
    print(f"True Skill Statistic (TSS): {tss_74:.4f}")
    print(f"Expected Calibration Error (ECE): {ece_74:.4f}")
    
    # Feature Importance
    print("\nTop 5 Feature Importances (Gain):")
    if hasattr(model_74, "feature_importances_"):
        importances_74 = model_74.feature_importances_
        sorted_indices_74 = np.argsort(importances_74)[::-1]
        for i in range(min(5, len(features_74))):
            idx = sorted_indices_74[i]
            print(f"  {i+1}. {features_74[idx]}: {importances_74[idx]*100:.2f}%")
print("=========================================")
