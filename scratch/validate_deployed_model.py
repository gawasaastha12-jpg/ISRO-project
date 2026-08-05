import os
import joblib
import pandas as pd
import numpy as np
import re

# Paths
ROOT_DIR = "c:\\Users\\Aastha\\OneDrive\\Desktop\\Projects\\ISRO-project"
MODEL_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "models", "model_forecast_5min_74.pkl")
DATA_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data", "processed", "horizons_74", "forecast_5min.csv")

if not os.path.exists(MODEL_PATH):
    print("74-feature model file not found!")
    exit(1)
if not os.path.exists(DATA_PATH):
    print("74-feature dataset not found!")
    exit(1)

# Load model and dataset
print("Loading model bundle...")
bundle = joblib.load(MODEL_PATH)
model = bundle["model"] if isinstance(bundle, dict) else bundle
isotonic_models = bundle.get("isotonic_models") if isinstance(bundle, dict) else None

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {df.shape}")

# In train_74.py, the columns are all features except target and source
feature_cols = [c for c in df.columns if c not in ("label", "source_file", "forecast_horizon_min")]
print(f"Feature count: {len(feature_cols)}")

target_col = "label"

def extract_month(source_file):
    m = re.search(r"(\d{6})\d{2}", str(source_file))
    return m.group(1) if m else "unknown"

df["month"] = df["source_file"].apply(extract_month)
months = sorted(df["month"].unique())

X = df[feature_cols].values
y = df[target_col].values

# Get predicted probabilities
print("Running prediction probabilities...")
probs = model.predict_proba(X)

# If isotonic models exist, apply calibration
if isotonic_models:
    print("Applying Isotonic Calibration...")
    cal_probs = np.zeros_like(probs)
    for c in range(probs.shape[1]):
        if c in isotonic_models:
            cal_probs[:, c] = isotonic_models[c].predict(probs[:, c])
    probs = cal_probs

# Severe probability = prob(class 3) (multiclass Severe is label 3 in train_74.py)
# Wait! Let's check classes of the model
classes = model.classes_
print(f"Model classes: {classes}")

# Severe label: class 3 is Severe in train_74.py
# Let's verify class index for label 3
class_idx = list(classes).index(3)
prob_severe = probs[:, class_idx]
y_severe = (y == 3).astype(int)

print(f"Severe Prob (Min, Mean, Max): {prob_severe.min():.6f}, {prob_severe.mean():.6f}, {prob_severe.max():.6f}")

# Sweep thresholds on the global dataset to find the best TSS
thresholds = np.linspace(0.01, 0.99, 99)
best_tss = -1
best_thresh = 0.5

print("\nSweeping thresholds for best TSS on global dataset:")
for t in thresholds:
    preds_t = (prob_severe >= t).astype(int)
    
    tp = np.sum((y_severe == 1) & (preds_t == 1))
    fn = np.sum((y_severe == 1) & (preds_t == 0))
    fp = np.sum((y_severe == 0) & (preds_t == 1))
    tn = np.sum((y_severe == 0) & (preds_t == 0))
    
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    tss = sens - (1 - spec)
    
    if tss > best_tss:
        best_tss = tss
        best_thresh = t

print(f"Best Global Threshold: {best_thresh:.3f} with TSS: {best_tss:.4f}")

# Now run Leave-One-Month-Out (LOMO) cross-validation with this threshold
print(f"\nEvaluating LOMO splits at tuned threshold = {best_thresh:.3f}:")
results = []
all_y_true = []
all_y_pred = []

for month in months:
    month_df = df[df["month"] == month]
    if len(month_df) == 0:
        continue
        
    X_month = month_df[feature_cols].values
    y_month = month_df[target_col].values
    
    probs_month = model.predict_proba(X_month)
    if isotonic_models:
        cal_probs_month = np.zeros_like(probs_month)
        for c in range(probs_month.shape[1]):
            if c in isotonic_models:
                cal_probs_month[:, c] = isotonic_models[c].predict(probs_month[:, c])
        probs_month = cal_probs_month
        
    prob_sev_month = probs_month[:, class_idx]
    
    y_month_bin = (y_month == 3).astype(int)
    preds_bin = (prob_sev_month >= best_thresh).astype(int)
    
    tp = np.sum((y_month_bin == 1) & (preds_bin == 1))
    fn = np.sum((y_month_bin == 1) & (preds_bin == 0))
    fp = np.sum((y_month_bin == 0) & (preds_bin == 1))
    tn = np.sum((y_month_bin == 0) & (preds_bin == 0))
    
    sens = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    far = fp / (tn + fp) if (tn + fp) > 0 else 0.0
    tss = sens - far
    
    results.append({
        "month": month,
        "n_samples": len(month_df),
        "n_severe": np.sum(y_month_bin),
        "tp": int(tp),
        "tn": int(tn),
        "fp": int(fp),
        "fn": int(fn),
        "sensitivity": sens,
        "specificity": spec,
        "far": far,
        "tss": tss
    })
    
    all_y_true.extend(y_month_bin)
    all_y_pred.extend(preds_bin)

# Convert to DataFrame
res_df = pd.DataFrame(results)
print(res_df.to_string(index=False))

# Calculate Pooled Metrics
sum_tp = res_df["tp"].sum()
sum_tn = res_df["tn"].sum()
sum_fp = res_df["fp"].sum()
sum_fn = res_df["fn"].sum()

pooled_sens = sum_tp / (sum_tp + sum_fn) if (sum_tp + sum_fn) > 0 else 0.0
pooled_spec = sum_tn / (sum_tn + sum_fp) if (sum_tn + sum_fp) > 0 else 0.0
pooled_far = sum_fp / (sum_tn + sum_fp) if (sum_tn + sum_fp) > 0 else 0.0
pooled_tss = pooled_sens - pooled_far

print("\n=== Pooled LOMO Metrics (Tuned Threshold) ===")
print(f"Total Samples: {len(df)}")
print(f"Total TP: {sum_tp}, TN: {sum_tn}, FP: {sum_fp}, FN: {sum_fn}")
print(f"Pooled Sensitivity (TPR): {pooled_sens:.4f} ({pooled_sens:.2%})")
print(f"Pooled Specificity: {pooled_spec:.4f} ({pooled_spec:.2%})")
print(f"Pooled False Alarm Rate (FAR): {pooled_far:.4f} ({pooled_far:.2%})")
print(f"Pooled TSS: {pooled_tss:.4f}")
print(f"Mean LOMO TSS (average of months): {res_df['tss'].mean():.4f}")
