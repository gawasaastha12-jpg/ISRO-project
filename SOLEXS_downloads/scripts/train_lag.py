"""
train_lag.py — Solar Flare Forecasting with Lag Features
=========================================================
Trains a binary classifier to predict whether a flare will occur
in the NEXT window (t+1, ~5 minutes ahead) using features from
the current and two previous windows (t, t-1, t-2).

This is the real forecasting problem — the model must learn to
detect the subtle pre-flare rising trend across consecutive windows,
NOT just recognise a flare that is already fully visible.

HOW TO RUN
----------
    # Step 1: generate the lag dataset (run once)
    python build_lag_features.py

    # Step 2: train the forecasting model
    python train_lag.py

OUTPUTS
-------
    ../models/lgbm_lag_forecast.pkl
    ../models/lgbm_lag_forecast_meta.json
    ../outputs/confusion_lag.png
    ../outputs/roc_curve_lag.png
    ../outputs/feature_importance_lag.png
"""

import json
import os
import warnings

import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns

from sklearn.model_selection import StratifiedGroupKFold
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    roc_curve,
    average_precision_score,
)
import lightgbm as lgb

warnings.filterwarnings("ignore")


# =============================================================================
# CONFIG
# =============================================================================

DATA_PATH  = "../data/processed/dataset_lag_features.csv"
MODEL_DIR  = "../models"
OUTPUT_DIR = "../outputs"

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Columns to exclude from features
DROP_COLS = [
    "label",               # original multiclass label at time t
    "label_future",        # future multiclass label (kept for reference)
    "label_binary_future", # this IS the target
    "source_file",
    # Labeling artifacts — directly encode the label, must stay out
    "peak_count", "peak_ratio", "max_prominence",
    "detection_threshold", "prominence_multiple",
    # Same artifacts from lag windows
    "peak_count_lag1", "peak_ratio_lag1", "max_prominence_lag1",
    "detection_threshold_lag1", "prominence_multiple_lag1",
    "peak_count_lag2", "peak_ratio_lag2", "max_prominence_lag2",
    "detection_threshold_lag2", "prominence_multiple_lag2",
]

N_FOLDS = 5

LGBM_BASE_PARAMS = {
    "objective":          "binary",
    "metric":             "binary_logloss",
    "n_estimators":       800,
    "learning_rate":      0.03,
    "num_leaves":         63,
    "max_depth":          -1,
    "min_child_samples":  5,
    "subsample":          0.8,
    "colsample_bytree":   0.8,
    "random_state":       42,
    "n_jobs":             -1,
    "verbose":            -1,
}


# =============================================================================
# TSS (binary)
# =============================================================================

def tss_binary(y_true, y_pred):
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fn = np.sum((y_true == 1) & (y_pred == 0))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    tn = np.sum((y_true == 0) & (y_pred == 0))
    sensitivity = tp / (tp + fn + 1e-9)
    specificity = tn / (tn + fp + 1e-9)
    tss = sensitivity - (1 - specificity)
    return {
        "TSS":         round(float(tss), 4),
        "sensitivity": round(float(sensitivity), 4),
        "specificity": round(float(specificity), 4),
        "precision":   round(float(tp / (tp + fp + 1e-9)), 4),
        "TP": int(tp), "FN": int(fn), "FP": int(fp), "TN": int(tn),
    }


# =============================================================================
# LOAD
# =============================================================================

print(f"\n[LOAD] {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
print(f"  Shape: {df.shape}")

y      = df["label_binary_future"].values
groups = df["source_file"].values

# Drop excluded cols; keep only valid feature columns
feature_cols = [c for c in df.columns if c not in DROP_COLS]
X = df[feature_cols].values

n_quiet = (y == 0).sum()
n_flare = (y == 1).sum()
total   = len(y)
spw     = round(n_quiet / (n_flare + 1e-9), 2)

print(f"\n  Target: label_binary_future")
print(f"    0 (No flare next window): {n_quiet:>6,}  ({100*n_quiet/total:.1f}%)")
print(f"    1 (Flare next window)   : {n_flare:>6,}  ({100*n_flare/total:.1f}%)")
print(f"  scale_pos_weight: {spw}")
print(f"  Features ({len(feature_cols)}):")
for f in feature_cols:
    tag = " [lag]" if "lag" in f else " [current]"
    print(f"    {f}{tag}")

LGBM_PARAMS = {**LGBM_BASE_PARAMS, "scale_pos_weight": spw}


# =============================================================================
# TRAIN
# =============================================================================

print(f"\n[TRAIN] {N_FOLDS}-fold StratifiedGroupKFold")
print(f"  Predicting flare in next ~5 min window from lag features")
print(f"  Source files kept together to prevent temporal leakage\n")

cv = StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)

fold_tss, fold_f1, fold_auc = [], [], []
all_y_true, all_y_pred, all_y_proba = [], [], []
feature_importances = np.zeros(len(feature_cols))

for fold, (train_idx, test_idx) in enumerate(cv.split(X, y, groups), 1):

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

    # Skip fold if test set has only one class (can happen with very few files)
    if len(np.unique(y_test)) < 2:
        print(f"  Fold {fold}: skipped (test set has only one class)")
        continue

    model = lgb.LGBMClassifier(**LGBM_PARAMS)
    model.fit(
        X_train, y_train,
        eval_set=[(X_test, y_test)],
        callbacks=[
            lgb.early_stopping(50, verbose=False),
            lgb.log_evaluation(period=-1),
        ],
    )

    y_proba_fold = model.predict_proba(X_test)[:, 1]
    y_pred_fold  = (y_proba_fold >= 0.5).astype(int)

    tss = tss_binary(y_test, y_pred_fold)
    f1  = f1_score(y_test, y_pred_fold, zero_division=0)
    auc = roc_auc_score(y_test, y_proba_fold)

    fold_tss.append(tss["TSS"])
    fold_f1.append(f1)
    fold_auc.append(auc)
    feature_importances += model.feature_importances_

    all_y_true.extend(y_test.tolist())
    all_y_pred.extend(y_pred_fold.tolist())
    all_y_proba.extend(y_proba_fold.tolist())

    print(f"  Fold {fold}: TSS={tss['TSS']:+.3f}  F1={f1:.3f}  "
          f"AUC={auc:.3f}  sens={tss['sensitivity']:.3f}  "
          f"spec={tss['specificity']:.3f}")

feature_importances /= max(len(fold_tss), 1)
all_y_true  = np.array(all_y_true)
all_y_pred  = np.array(all_y_pred)
all_y_proba = np.array(all_y_proba)

overall_tss = tss_binary(all_y_true, all_y_pred)
overall_f1  = f1_score(all_y_true, all_y_pred, zero_division=0)
overall_auc = roc_auc_score(all_y_true, all_y_proba)
avg_prec    = average_precision_score(all_y_true, all_y_proba)

print(f"\n{'='*55}")
print(f"CV SUMMARY — Lag Forecasting (t+1, ~5 min ahead)")
print(f"{'='*55}")
print(f"  TSS        : {np.mean(fold_tss):+.3f} ± {np.std(fold_tss):.3f}")
print(f"  F1 (flare) : {np.mean(fold_f1):.3f} ± {np.std(fold_f1):.3f}")
print(f"  ROC-AUC    : {np.mean(fold_auc):.3f} ± {np.std(fold_auc):.3f}")
print(f"\nOverall (pooled across folds):")
print(f"  TSS         : {overall_tss['TSS']:+.4f}")
print(f"  sensitivity : {overall_tss['sensitivity']:.4f}  (flares caught)")
print(f"  specificity : {overall_tss['specificity']:.4f}  (quiet correct)")
print(f"  precision   : {overall_tss['precision']:.4f}")
print(f"  ROC-AUC     : {overall_auc:.4f}")
print(f"  Avg Prec    : {avg_prec:.4f}")
print(f"{'='*55}")

# Classification report
print(f"\n[REPORT]")
print(classification_report(all_y_true, all_y_pred,
                             target_names=["No flare (t+1)", "Flare (t+1)"],
                             zero_division=0))

# Optimal threshold scan
thresholds   = np.linspace(0.01, 0.99, 200)
tss_at_t     = [tss_binary(all_y_true, (all_y_proba >= t).astype(int))["TSS"]
                for t in thresholds]
best_idx     = int(np.argmax(tss_at_t))
best_thresh  = float(thresholds[best_idx])
best_tss     = float(tss_at_t[best_idx])
opt_metrics  = tss_binary(all_y_true, (all_y_proba >= best_thresh).astype(int))

print(f"[THRESHOLD] Default 0.50 TSS={overall_tss['TSS']:+.4f} | "
      f"Optimal {best_thresh:.2f} TSS={best_tss:+.4f}")
print(f"  At optimal: sensitivity={opt_metrics['sensitivity']:.4f}  "
      f"specificity={opt_metrics['specificity']:.4f}")


# =============================================================================
# FINAL MODEL + SAVE
# =============================================================================

print(f"\n[TRAIN] Fitting final model on full dataset...")
final_model = lgb.LGBMClassifier(**LGBM_PARAMS)
final_model.fit(X, y)

model_path = os.path.join(MODEL_DIR, "lgbm_lag_forecast.pkl")
joblib.dump(final_model, model_path)
print(f"[SAVE] Model: {model_path}")

meta = {
    "task":               "binary_lag_forecasting",
    "forecast_horizon":   "t+1 window (~5 min)",
    "n_lags":             2,
    "n_samples":          int(total),
    "feature_cols":       feature_cols,
    "n_features":         len(feature_cols),
    "scale_pos_weight":   spw,
    "optimal_threshold":  round(best_thresh, 4),
    "cv_TSS_mean":        round(float(np.mean(fold_tss)), 4),
    "cv_TSS_std":         round(float(np.std(fold_tss)), 4),
    "cv_F1_mean":         round(float(np.mean(fold_f1)), 4),
    "cv_AUC_mean":        round(float(np.mean(fold_auc)), 4),
    "overall_TSS":        overall_tss,
    "optimal_TSS":        opt_metrics,
    "overall_AUC":        round(float(overall_auc), 4),
    "avg_precision":      round(float(avg_prec), 4),
}
meta_path = os.path.join(MODEL_DIR, "lgbm_lag_forecast_meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"[SAVE] Metadata: {meta_path}")


# =============================================================================
# PLOTS
# =============================================================================

print("\n[PLOTS]")

# 1. Confusion matrix — default vs optimal threshold
y_pred_opt = (all_y_proba >= best_thresh).astype(int)
fig, axes = plt.subplots(1, 2, figsize=(13, 5))
fig.suptitle("Lag Forecasting — Predicting Flare at t+1 (~5 min ahead)",
             fontsize=13, fontweight="bold")

for ax, (preds, title) in zip(axes, [
    (all_y_pred, f"Default threshold (0.50)\nTSS={overall_tss['TSS']:+.3f}"),
    (y_pred_opt, f"Optimal threshold ({best_thresh:.2f})\nTSS={best_tss:+.3f}"),
]):
    cm     = confusion_matrix(all_y_true, preds)
    cm_pct = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-9) * 100
    sns.heatmap(cm, annot=True, fmt="d", cmap="YlOrRd",
                xticklabels=["No flare", "Flare"],
                yticklabels=["No flare", "Flare"], ax=ax)
    for i in range(2):
        for j in range(2):
            ax.text(j + 0.5, i + 0.72, f"({cm_pct[i,j]:.1f}%)",
                    ha="center", va="center", fontsize=8, color="gray")
    ax.set_title(title, fontsize=11)
    ax.set_ylabel("True label (at t+1)")
    ax.set_xlabel("Predicted label")

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "confusion_lag.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

# 2. ROC curve + TSS vs threshold
fig, axes = plt.subplots(1, 2, figsize=(13, 5))

fpr, tpr, _ = roc_curve(all_y_true, all_y_proba)
axes[0].plot(fpr, tpr, color="#2E86AB", lw=2,
             label=f"ROC (AUC={overall_auc:.3f})")
axes[0].plot([0, 1], [0, 1], "k--", lw=1, alpha=0.4, label="Random")
axes[0].set_xlabel("False Positive Rate", fontsize=11)
axes[0].set_ylabel("True Positive Rate", fontsize=11)
axes[0].set_title("ROC Curve — 5-min Lag Forecast", fontsize=12, fontweight="bold")
axes[0].legend(fontsize=10)
axes[0].grid(alpha=0.3)

axes[1].plot(thresholds, tss_at_t, color="#E85D24", lw=2)
axes[1].axvline(best_thresh, color="black", linestyle="--",
                label=f"Best = {best_thresh:.2f}  (TSS={best_tss:+.3f})")
axes[1].axvline(0.50, color="gray", linestyle=":",
                label="Default = 0.50")
axes[1].axhline(0, color="gray", lw=0.8, alpha=0.5)
axes[1].set_xlabel("Decision threshold", fontsize=11)
axes[1].set_ylabel("TSS", fontsize=11)
axes[1].set_title("TSS vs Threshold", fontsize=12, fontweight="bold")
axes[1].legend(fontsize=9)
axes[1].grid(alpha=0.3)

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "roc_curve_lag.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

# 3. Feature importance — grouped by window (current / lag-1 / lag-2)
imp_df = pd.DataFrame({
    "feature":    feature_cols,
    "importance": feature_importances,
}).sort_values("importance", ascending=False)

# Colour-code by window
def window_colour(name):
    if "lag2" in name: return "#E85D24"
    if "lag1" in name: return "#F4A261"
    return "#2E86AB"

colours = [window_colour(f) for f in imp_df["feature"][::-1]]

fig, ax = plt.subplots(figsize=(11, max(6, len(imp_df) * 0.35)))
bars = ax.barh(imp_df["feature"][::-1],
               imp_df["importance"][::-1],
               color=colours)
ax.set_xlabel("Feature importance (LightGBM gain)", fontsize=11)
ax.set_title("Feature Importance by Window — 5-min Lag Forecast\n"
             "Blue=current window  Orange=1 window ago  Red=2 windows ago",
             fontsize=11, fontweight="bold")
ax.grid(axis="x", alpha=0.3)

# Legend
from matplotlib.patches import Patch
legend = [
    Patch(color="#2E86AB", label="Current window (t)"),
    Patch(color="#F4A261", label="1 window ago (t-1, ~5 min)"),
    Patch(color="#E85D24", label="2 windows ago (t-2, ~10 min)"),
]
ax.legend(handles=legend, fontsize=9, loc="lower right")
plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "feature_importance_lag.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

print(f"\n{'='*55}")
print(f"DONE")
print(f"  TSS (default 0.50)       : {overall_tss['TSS']:+.4f}")
print(f"  TSS (optimal threshold)  : {best_tss:+.4f}")
print(f"  ROC-AUC                  : {overall_auc:.4f}")
print(f"  Sensitivity              : {opt_metrics['sensitivity']:.4f}")
print(f"  Specificity              : {opt_metrics['specificity']:.4f}")
print(f"  Optimal threshold        : {best_thresh:.3f}")
print(f"{'='*55}")
print(f"\nIf TSS is still suspiciously near 1.0, check feature_importance_lag.png")
print(f"to see which features the model is relying on most. If 'max_lag1' or")
print(f"'mean_lag1' dominate, it may be that lag-1 features still partially")
print(f"encode a flare that started in the previous window.")
print(f"\nIf TSS is between 0.2-0.7, congratulations — that's a real result.")