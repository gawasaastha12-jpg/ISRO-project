"""
train_binary.py — Binary Solar Flare NOWCASTING
================================================
Task: given features from window[t], predict whether a flare is
      happening RIGHT NOW (label[t] >= 1) or not (label[t] == 0).

This is DETECTION, not forecasting. It's an easier, well-posed
problem that gives the model a fighting chance with the current
single-window features.

We use the BALANCED detection dataset (dataset_balanced_v8.csv),
NOT the horizon-shifted files, because those shift labels into
the future which is exactly what we want to avoid here.

HOW TO RUN
----------
    python train_binary.py

OUTPUTS
-------
    ../models/lgbm_binary_nowcast.pkl
    ../models/lgbm_binary_nowcast_meta.json
    ../outputs/confusion_binary.png
    ../outputs/feature_importance_binary.png
    ../outputs/roc_curve_binary.png
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
    precision_recall_curve,
    average_precision_score,
)
import lightgbm as lgb

warnings.filterwarnings("ignore")


# =============================================================================
# CONFIG
# =============================================================================

DATA_PATH  = "../data/processed/dataset_balanced_v8.csv"
MODEL_DIR  = "../models"
OUTPUT_DIR = "../outputs"

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

DROP_COLS = [
    "label", "source_file",
    # Labeling artifacts — these directly encode the label, remove them
    "peak_count", "peak_ratio", "max_prominence",
    "detection_threshold", "prominence_multiple",
]

# Binary class names
CLASS_NAMES = {0: "Quiet (no flare)", 1: "Flare (any class)"}

# LightGBM — binary this time, not multiclass
# scale_pos_weight compensates for class imbalance.
# We compute it dynamically from the data below.
LGBM_BASE_PARAMS = {
    "objective":         "binary",
    "metric":            "binary_logloss",
    "n_estimators":      600,
    "learning_rate":     0.03,
    "num_leaves":        63,
    "max_depth":         -1,
    "min_child_samples": 5,
    "subsample":         0.8,
    "colsample_bytree":  0.8,
    "random_state":      42,
    "n_jobs":            -1,
    "verbose":           -1,
    # scale_pos_weight set dynamically after loading data
}

N_FOLDS = 5


# =============================================================================
# TSS for binary classification
# =============================================================================

def tss_binary(y_true, y_pred):
    """
    True Skill Statistic for binary prediction.
    TSS = sensitivity - (1 - specificity) = TPR - FPR
    Range: [-1, 1]. Skill > 0 means better than random.
    Standard metric in operational space weather forecasting.
    """
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
        "sensitivity": round(float(sensitivity), 4),  # recall for flare class
        "specificity": round(float(specificity), 4),
        "precision":   round(float(tp / (tp + fp + 1e-9)), 4),
        "TP": int(tp), "FN": int(fn), "FP": int(fp), "TN": int(tn),
    }


# =============================================================================
# LOAD DATA
# =============================================================================

print(f"\n[LOAD] {DATA_PATH}")
df = pd.read_csv(DATA_PATH)
print(f"  Shape: {df.shape}")

# Convert to BINARY labels
# 0 = quiet, 1 = any flare (was labels 1, 2, 3)
df["label_binary"] = (df["label"] >= 1).astype(int)

n_quiet = (df["label_binary"] == 0).sum()
n_flare = (df["label_binary"] == 1).sum()
total   = len(df)

print(f"\n  Binary label distribution:")
print(f"    0 (Quiet)       : {n_quiet:>7,}  ({100*n_quiet/total:.1f}%)")
print(f"    1 (Any flare)   : {n_flare:>7,}  ({100*n_flare/total:.1f}%)")

# scale_pos_weight = n_negative / n_positive
# This tells LightGBM to weight each flare example as if it appeared
# this many times, preventing it from always predicting quiet
spw = round(n_quiet / (n_flare + 1e-9), 2)
print(f"\n  scale_pos_weight (neg/pos ratio): {spw}")

LGBM_PARAMS = {**LGBM_BASE_PARAMS, "scale_pos_weight": spw}

# Features
feature_cols = [c for c in df.columns
                if c not in DROP_COLS + ["label", "label_binary"]]
X      = df[feature_cols].values
y      = df["label_binary"].values
groups = df["source_file"].values

print(f"  Features ({len(feature_cols)}): {feature_cols}")


# =============================================================================
# TRAIN WITH CV
# =============================================================================

print(f"\n[TRAIN] {N_FOLDS}-fold StratifiedGroupKFold")
print(f"  Task: binary nowcasting (flare vs quiet at time t)")
print(f"  Source files kept together per fold to prevent temporal leakage")

cv = StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)

fold_tss, fold_f1, fold_auc = [], [], []
all_y_true, all_y_pred, all_y_proba = [], [], []
feature_importances = np.zeros(len(feature_cols))

for fold, (train_idx, test_idx) in enumerate(
        cv.split(X, y, groups), 1):

    X_train, X_test = X[train_idx], X[test_idx]
    y_train, y_test = y[train_idx], y[test_idx]

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

    tss  = tss_binary(y_test, y_pred_fold)
    f1   = f1_score(y_test, y_pred_fold, zero_division=0)
    auc  = roc_auc_score(y_test, y_proba_fold)

    fold_tss.append(tss["TSS"])
    fold_f1.append(f1)
    fold_auc.append(auc)
    feature_importances += model.feature_importances_

    all_y_true.extend(y_test.tolist())
    all_y_pred.extend(y_pred_fold.tolist())
    all_y_proba.extend(y_proba_fold.tolist())

    print(f"  Fold {fold}: TSS={tss['TSS']:+.3f}  "
          f"F1_flare={f1:.3f}  ROC-AUC={auc:.3f}  "
          f"sensitivity={tss['sensitivity']:.3f}  "
          f"specificity={tss['specificity']:.3f}")

feature_importances /= N_FOLDS

all_y_true  = np.array(all_y_true)
all_y_pred  = np.array(all_y_pred)
all_y_proba = np.array(all_y_proba)

overall_tss = tss_binary(all_y_true, all_y_pred)
overall_f1  = f1_score(all_y_true, all_y_pred, zero_division=0)
overall_auc = roc_auc_score(all_y_true, all_y_proba)
avg_prec    = average_precision_score(all_y_true, all_y_proba)

print(f"\n{'='*55}")
print(f"CV SUMMARY — Binary Nowcasting")
print(f"{'='*55}")
print(f"  TSS        : {np.mean(fold_tss):+.3f} ± {np.std(fold_tss):.3f}")
print(f"  F1 (flare) : {np.mean(fold_f1):.3f} ± {np.std(fold_f1):.3f}")
print(f"  ROC-AUC    : {np.mean(fold_auc):.3f} ± {np.std(fold_auc):.3f}")
print(f"\nOverall (pooled across folds):")
print(f"  TSS              : {overall_tss['TSS']:+.4f}")
print(f"  sensitivity      : {overall_tss['sensitivity']:.4f}  "
      f"(fraction of real flares caught)")
print(f"  specificity      : {overall_tss['specificity']:.4f}  "
      f"(fraction of quiet correctly identified)")
print(f"  precision        : {overall_tss['precision']:.4f}  "
      f"(of predicted flares, how many are real)")
print(f"  ROC-AUC          : {overall_auc:.4f}")
print(f"  Avg Precision    : {avg_prec:.4f}  (area under PR curve)")
print(f"{'='*55}")


# =============================================================================
# FULL CLASSIFICATION REPORT
# =============================================================================

print(f"\n[REPORT]")
print(classification_report(
    all_y_true, all_y_pred,
    target_names=["Quiet", "Flare"],
    zero_division=0
))


# =============================================================================
# FIND OPTIMAL THRESHOLD
# =============================================================================
# The default 0.5 threshold may not be optimal for imbalanced data.
# We scan thresholds and find the one that maximises TSS.

thresholds = np.linspace(0.01, 0.99, 200)
tss_at_thresh = []
for t in thresholds:
    pred_t = (all_y_proba >= t).astype(int)
    tss_at_thresh.append(tss_binary(all_y_true, pred_t)["TSS"])

best_idx   = int(np.argmax(tss_at_thresh))
best_thresh = float(thresholds[best_idx])
best_tss   = float(tss_at_thresh[best_idx])

y_pred_opt = (all_y_proba >= best_thresh).astype(int)
opt_metrics = tss_binary(all_y_true, y_pred_opt)

print(f"[THRESHOLD TUNING]")
print(f"  Default (0.50) TSS : {overall_tss['TSS']:+.4f}")
print(f"  Optimal threshold  : {best_thresh:.3f}")
print(f"  Optimal TSS        : {best_tss:+.4f}")
print(f"  At optimal threshold:")
print(f"    sensitivity : {opt_metrics['sensitivity']:.4f}")
print(f"    specificity : {opt_metrics['specificity']:.4f}")
print(f"    precision   : {opt_metrics['precision']:.4f}")


# =============================================================================
# TRAIN FINAL MODEL ON ALL DATA
# =============================================================================

print(f"\n[TRAIN] Fitting final model on full dataset...")
final_model = lgb.LGBMClassifier(**LGBM_PARAMS)
final_model.fit(X, y)

# Save model + metadata
model_path = os.path.join(MODEL_DIR, "lgbm_binary_nowcast.pkl")
joblib.dump(final_model, model_path)
print(f"[SAVE] Model: {model_path}")

meta = {
    "task":                "binary_nowcasting",
    "data_path":           DATA_PATH,
    "n_samples":           int(total),
    "n_features":          len(feature_cols),
    "feature_cols":        feature_cols,
    "class_balance":       {"quiet": int(n_quiet), "flare": int(n_flare)},
    "scale_pos_weight":    spw,
    "optimal_threshold":   round(best_thresh, 4),
    "cv_TSS_mean":         round(float(np.mean(fold_tss)), 4),
    "cv_TSS_std":          round(float(np.std(fold_tss)), 4),
    "cv_F1_mean":          round(float(np.mean(fold_f1)), 4),
    "cv_AUC_mean":         round(float(np.mean(fold_auc)), 4),
    "overall_TSS":         overall_tss,
    "optimal_TSS_metrics": opt_metrics,
    "overall_ROC_AUC":     round(float(overall_auc), 4),
    "avg_precision":       round(float(avg_prec), 4),
}
meta_path = os.path.join(MODEL_DIR, "lgbm_binary_nowcast_meta.json")
with open(meta_path, "w") as f:
    json.dump(meta, f, indent=2)
print(f"[SAVE] Metadata: {meta_path}")


# =============================================================================
# PLOTS
# =============================================================================

print("\n[PLOTS]")

# 1. Confusion matrix (both thresholds side by side)
fig, axes = plt.subplots(1, 2, figsize=(12, 5))
fig.suptitle("Binary Nowcast — Confusion Matrix", fontsize=13, fontweight="bold")

for ax, (preds, title) in zip(axes, [
    (all_y_pred,  f"Default threshold (0.50)\nTSS={overall_tss['TSS']:+.3f}"),
    (y_pred_opt,  f"Optimal threshold ({best_thresh:.2f})\nTSS={best_tss:+.3f}"),
]):
    cm  = confusion_matrix(all_y_true, preds)
    cm_pct = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-9) * 100
    labels = [f"{CLASS_NAMES[i]}\n({cm_pct[i].sum():.0f}%)" for i in range(2)]
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=["Quiet", "Flare"],
        yticklabels=["Quiet", "Flare"],
        ax=ax,
    )
    # Overlay percentages
    for i in range(2):
        for j in range(2):
            ax.text(j + 0.5, i + 0.7,
                    f"({cm_pct[i,j]:.1f}%)",
                    ha="center", va="center",
                    fontsize=8, color="gray")
    ax.set_title(title, fontsize=11)
    ax.set_ylabel("True label")
    ax.set_xlabel("Predicted label")

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "confusion_binary.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

# 2. ROC curve + TSS vs threshold
fig, axes = plt.subplots(1, 2, figsize=(13, 5))

# ROC curve
fpr, tpr, _ = roc_curve(all_y_true, all_y_proba)
axes[0].plot(fpr, tpr, color="#2E86AB", lw=2,
             label=f"ROC (AUC = {overall_auc:.3f})")
axes[0].plot([0, 1], [0, 1], "k--", lw=1, alpha=0.5, label="Random")
axes[0].set_xlabel("False Positive Rate", fontsize=11)
axes[0].set_ylabel("True Positive Rate", fontsize=11)
axes[0].set_title("ROC Curve — Binary Nowcast", fontsize=12, fontweight="bold")
axes[0].legend(fontsize=10)
axes[0].grid(alpha=0.3)

# TSS vs threshold
axes[1].plot(thresholds, tss_at_thresh, color="#E85D24", lw=2)
axes[1].axvline(best_thresh, color="black", linestyle="--", lw=1.5,
                label=f"Best threshold = {best_thresh:.2f}  (TSS={best_tss:+.3f})")
axes[1].axvline(0.5, color="gray", linestyle=":", lw=1,
                label="Default threshold = 0.50")
axes[1].axhline(0, color="gray", linestyle="-", lw=0.8, alpha=0.5)
axes[1].set_xlabel("Decision threshold", fontsize=11)
axes[1].set_ylabel("TSS", fontsize=11)
axes[1].set_title("TSS vs Decision Threshold\n"
                  "(use this to tune sensitivity/specificity tradeoff)",
                  fontsize=11, fontweight="bold")
axes[1].legend(fontsize=9)
axes[1].grid(alpha=0.3)

plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "roc_curve_binary.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

# 3. Feature importance
imp_df = pd.DataFrame({
    "feature":    feature_cols,
    "importance": feature_importances,
}).sort_values("importance", ascending=False).head(15)

fig, ax = plt.subplots(figsize=(10, 6))
bars = ax.barh(imp_df["feature"][::-1], imp_df["importance"][::-1],
               color="#2E86AB", edgecolor="white")
ax.set_xlabel("Feature importance (LightGBM gain)", fontsize=11)
ax.set_title("Top 15 Features — Binary Flare Nowcasting\n"
             "(features that most distinguish flare vs quiet windows)",
             fontsize=12, fontweight="bold")
ax.grid(axis="x", alpha=0.3)
for bar in bars:
    ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2,
            f"{bar.get_width():.0f}", va="center", fontsize=8)
plt.tight_layout()
out = os.path.join(OUTPUT_DIR, "feature_importance_binary.png")
plt.savefig(out, dpi=150, bbox_inches="tight")
plt.close()
print(f"  Saved: {out}")

print(f"\n{'='*55}")
print(f"DONE. Key numbers to remember:")
print(f"  TSS (optimal threshold) : {best_tss:+.4f}")
print(f"  ROC-AUC                 : {overall_auc:.4f}")
print(f"  Sensitivity             : {opt_metrics['sensitivity']:.4f}  "
      f"← fraction of real flares caught")
print(f"  Optimal threshold       : {best_thresh:.3f}  "
      f"← use this in your dashboard")
print(f"{'='*55}")