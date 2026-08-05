import os
import pandas as pd
import numpy as np
import re
import xgboost as xgb
from sklearn.utils.class_weight import compute_sample_weight

ROOT_DIR = r"c:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project"
DATA_PATH = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data",
                         "processed", "dataset_research_v8.csv")

if not os.path.exists(DATA_PATH):
    print("v8 dataset not found!")
    exit(1)

print("Loading dataset...")
df = pd.read_csv(DATA_PATH)
print(f"Raw dataset shape: {df.shape}")

def extract_month(source_file):
    m = re.search(r"(\d{6})\d{2}", str(source_file))
    return m.group(1) if m else "unknown"

df["month"] = df["source_file"].apply(extract_month)

features_17 = [
    "mean", "median", "std", "iqr", "skew", "kurtosis", "energy", "snr",
    "max", "min", "peak_count", "peak_ratio", "max_prominence",
    "detection_threshold", "prominence_multiple", "largest_width", "trend"
]

# ── Apply 5-minute forecast shift (same as train_and_validate_17.py) ──────
SHIFT = 1  # 1 row = 1 observation step = ~5 minutes
parts = []
for src_file, group in df.groupby("source_file"):
    g = group.reset_index(drop=True)
    if len(g) <= SHIFT:
        continue
    feats = g[features_17].iloc[:-SHIFT].copy()
    feats["label"] = g["label"].iloc[SHIFT:].values
    feats["source_file"] = src_file
    feats["month"] = g["month"].iloc[SHIFT:].values
    parts.append(feats)

df_forecast = pd.concat(parts, ignore_index=True)
print(f"Forecast dataset shape: {df_forecast.shape}")
print(f"Label distribution:\n{df_forecast['label'].value_counts().sort_index()}")
# ──────────────────────────────────────────────────────────────────────────

months = sorted([m for m in df_forecast["month"].unique() if m != "unknown"])
print(f"Unique months: {len(months)}")

xgb_params = {
    "objective": "multi:softprob",
    "num_class": 5,
    "eval_metric": "mlogloss",
    "n_estimators": 100,
    "max_depth": 5,
    "learning_rate": 0.05,
    "subsample": 0.8,
    "colsample_bytree": 0.8,
    "random_state": 42,
    "n_jobs": -1
}

results = []
lomo_tss_scores = []

print("\nRunning strict LOMO CV — 17 features, XGBoost, v8 + forecast shift...")

for idx, test_month in enumerate(months):
    print(f"  [{idx+1}/{len(months)}] Test month: {test_month}", end=" ")

    train_df = df_forecast[df_forecast["month"] != test_month]
    test_df  = df_forecast[df_forecast["month"] == test_month]

    if len(test_df) == 0:
        print("— skipped")
        continue

    X_tr = train_df[features_17].values
    y_tr = train_df["label"].values
    X_te = test_df[features_17].values
    y_te = test_df["label"].values

    sample_weights = compute_sample_weight(class_weight="balanced", y=y_tr)
    model = xgb.XGBClassifier(**xgb_params)
    model.fit(X_tr, y_tr, sample_weight=sample_weights)

    classes = list(model.classes_)
    severe_label = 3 if 3 in classes else classes[-1]
    class_idx = classes.index(severe_label)

    # Threshold tuned ONLY on training fold — zero leakage
    tr_probs = model.predict_proba(X_tr)[:, class_idx]
    y_tr_bin = (y_tr == severe_label).astype(int)
    best_t, best_tss_tr = 0.5, -1.0

    for t in np.linspace(0.01, 0.99, 99):
        p = (tr_probs >= t).astype(int)
        tp_t = np.sum((y_tr_bin == 1) & (p == 1))
        fn_t = np.sum((y_tr_bin == 1) & (p == 0))
        fp_t = np.sum((y_tr_bin == 0) & (p == 1))
        tn_t = np.sum((y_tr_bin == 0) & (p == 0))
        s = tp_t/(tp_t+fn_t) if (tp_t+fn_t) > 0 else 0.0
        f = fp_t/(tn_t+fp_t) if (tn_t+fp_t) > 0 else 0.0
        if (s - f) > best_tss_tr:
            best_tss_tr = s - f
            best_t = t

    # Apply to unseen test month
    te_probs  = model.predict_proba(X_te)[:, class_idx]
    y_te_bin  = (y_te == severe_label).astype(int)
    preds_bin = (te_probs >= best_t).astype(int)

    tp = int(np.sum((y_te_bin == 1) & (preds_bin == 1)))
    fn = int(np.sum((y_te_bin == 1) & (preds_bin == 0)))
    fp = int(np.sum((y_te_bin == 0) & (preds_bin == 1)))
    tn = int(np.sum((y_te_bin == 0) & (preds_bin == 0)))

    sens = tp/(tp+fn) if (tp+fn) > 0 else 0.0
    spec = tn/(tn+fp) if (tn+fp) > 0 else 0.0
    far  = fp/(tn+fp) if (tn+fp) > 0 else 0.0
    tss  = sens - far
    lomo_tss_scores.append(tss)

    print(f"| n_severe={int(np.sum(y_te_bin))} | threshold={best_t:.2f} | TSS={tss:+.4f}")

    results.append({
        "month": test_month, "n_samples": len(test_df),
        "n_severe": int(np.sum(y_te_bin)),
        "tp": tp, "tn": tn, "fp": fp, "fn": fn,
        "threshold": round(best_t, 2),
        "sensitivity": round(sens, 4), "specificity": round(spec, 4),
        "far": round(far, 4), "tss": round(tss, 4)
    })

res_df = pd.DataFrame(results)
print("\n=== Month-by-Month Strict LOMO (17-feature XGBoost, v8 + shift) ===")
print(res_df.to_string(index=False))

total_tp = res_df["tp"].sum()
total_tn = res_df["tn"].sum()
total_fp = res_df["fp"].sum()
total_fn = res_df["fn"].sum()
pooled_sens = total_tp/(total_tp+total_fn) if (total_tp+total_fn) > 0 else 0.0
pooled_spec = total_tn/(total_tn+total_fp) if (total_tn+total_fp) > 0 else 0.0
pooled_far  = total_fp/(total_tn+total_fp) if (total_tn+total_fp) > 0 else 0.0
pooled_tss  = pooled_sens - pooled_far
mean_tss    = float(np.mean(lomo_tss_scores))
std_tss     = float(np.std(lomo_tss_scores))

print("\n=== Pooled Strict LOMO Metrics (17-feature, v8, forecast shift) ===")
print(f"Total Samples : {res_df['n_samples'].sum():,}")
print(f"TP: {total_tp}  TN: {total_tn}  FP: {total_fp}  FN: {total_fn}")
print(f"Sensitivity   : {pooled_sens:.4f}  ({pooled_sens:.2%})")
print(f"Specificity   : {pooled_spec:.4f}  ({pooled_spec:.2%})")
print(f"False Alarm Rate : {pooled_far:.4f}  ({pooled_far:.2%})")
print(f"Pooled TSS    : {pooled_tss:.4f}")
print(f"Mean LOMO TSS : {mean_tss:.4f} ± {std_tss:.4f}")
print("\nNote: forecast shift applied, threshold tuned on training fold only.")