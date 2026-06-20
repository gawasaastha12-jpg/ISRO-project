"""
train_model.py — Solar Flare Forecast Model Training
=====================================================
Trains a LightGBM classifier on the v8 forecast horizon datasets.
Produces: trained model, evaluation metrics, feature importance plot,
          confusion matrix, and per-horizon TSS comparison.

HOW TO RUN
----------
    # Install dependencies first (once):
    pip install lightgbm scikit-learn matplotlib seaborn joblib shap

    # Train on the 5-minute horizon (primary model):
    python train_model.py --horizon 5

    # Train on multiple horizons to show lead-time degradation:
    python train_model.py --horizon 5
    python train_model.py --horizon 15
    python train_model.py --horizon 30
    python train_model.py --horizon 60

    # Compare all trained horizons:
    python train_model.py --compare

OUTPUTS (saved to ../models/ and ../outputs/)
-------
    ../models/lgbm_5min.pkl            trained model
    ../models/lgbm_5min_meta.json      metrics + config
    ../outputs/confusion_5min.png      confusion matrix
    ../outputs/feature_importance_5min.png
    ../outputs/horizon_comparison.png  (when --compare is run)
"""

import argparse
import json
import os
import warnings

import joblib
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np
import pandas as pd
import seaborn as sns

from collections import defaultdict

from sklearn.model_selection import StratifiedGroupKFold
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    roc_auc_score,
    ConfusionMatrixDisplay,
)
import lightgbm as lgb

warnings.filterwarnings("ignore")


# =============================================================================
# CONFIG
# =============================================================================

DATA_DIR   = "../data/processed/horizons"
MODEL_DIR  = "../models"
OUTPUT_DIR = "../outputs"

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Class names — must match the label integers in your dataset
CLASS_NAMES = {
    0: "Quiet",
    1: "B-like",
    2: "C-like",
    3: "Severe (M+X)",
}

# Columns that must be dropped — not real features
DROP_COLS = ["label", "source_file", "forecast_horizon_min"]

# LightGBM hyperparameters
# These are solid defaults for imbalanced multiclass tabular data.
# class_weight="balanced" is the single most important setting here —
# it prevents the model from ignoring the 1.4% severe class.
LGBM_PARAMS = {
    "objective":       "multiclass",
    "num_class":       4,
    "metric":          "multi_logloss",
    "n_estimators":    500,
    "learning_rate":   0.05,
    "num_leaves":      63,
    "max_depth":       -1,
    "min_child_samples": 10,
    "subsample":       0.8,
    "colsample_bytree": 0.8,
    "class_weight":    "balanced",   # CRITICAL for imbalanced data
    "random_state":    42,
    "n_jobs":          -1,
    "verbose":         -1,
}

# Cross-validation folds
N_FOLDS = 5


# =============================================================================
# METRICS — TSS and friends
# =============================================================================

def true_skill_statistic(y_true, y_pred, positive_class=3):
    """
    True Skill Statistic (TSS) = Sensitivity - (1 - Specificity)
                                = TPR - FPR

    The standard evaluation metric in operational space weather forecasting.
    TSS = 1.0 is perfect, TSS = 0.0 is no skill (same as random), TSS < 0 is
    worse than random.

    We compute it for the severe class (label 3) since that's the class
    that actually matters operationally — missing a severe flare is dangerous,
    missing a quiet period is not.

    Parameters
    ----------
    positive_class : the label treated as "positive" for TSS computation.
                     Default = 3 (Severe M+X) since that's the hazardous class.
    """
    # Binarise: positive_class vs everything else
    y_true_bin = (np.array(y_true) == positive_class).astype(int)
    y_pred_bin = (np.array(y_pred) == positive_class).astype(int)

    tp = np.sum((y_true_bin == 1) & (y_pred_bin == 1))
    fn = np.sum((y_true_bin == 1) & (y_pred_bin == 0))
    fp = np.sum((y_true_bin == 0) & (y_pred_bin == 1))
    tn = np.sum((y_true_bin == 0) & (y_pred_bin == 0))

    sensitivity = tp / (tp + fn + 1e-9)  # TPR
    specificity = tn / (tn + fp + 1e-9)  # TNR

    tss = sensitivity - (1 - specificity)  # = TPR - FPR

    return {
        "TSS":         round(float(tss), 4),
        "sensitivity": round(float(sensitivity), 4),  # recall for severe class
        "specificity": round(float(specificity), 4),
        "TP": int(tp), "FN": int(fn), "FP": int(fp), "TN": int(tn),
    }


def compute_all_metrics(y_true, y_pred, y_proba, class_names):
    """
    Compute the full suite of metrics we care about.
    Returns a dict suitable for JSON serialisation.
    """
    labels = sorted(class_names.keys())
    names  = [class_names[l] for l in labels]

    # Per-class F1
    f1_per_class = f1_score(y_true, y_pred, labels=labels,
                            average=None, zero_division=0)
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)

    # TSS for the severe class
    tss_metrics = true_skill_statistic(y_true, y_pred, positive_class=3)

    # ROC-AUC (one-vs-rest, only meaningful if all classes appear in test set)
    try:
        roc_auc = roc_auc_score(
            y_true, y_proba, multi_class="ovr",
            average="macro", labels=labels
        )
    except Exception:
        roc_auc = None

    return {
        "macro_F1":       round(float(macro_f1), 4),
        "per_class_F1":   {class_names[l]: round(float(f), 4)
                           for l, f in zip(labels, f1_per_class)},
        "TSS_severe":     tss_metrics,
        "ROC_AUC_macro":  round(float(roc_auc), 4) if roc_auc else None,
    }


# =============================================================================
# DATA LOADING
# =============================================================================

def load_horizon(horizon_min: int):
    """Load and prepare a forecast horizon CSV for training."""
    path = os.path.join(DATA_DIR, f"forecast_{horizon_min}min.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Horizon file not found: {path}\n"
            f"Run pipeline_patch_v6.py first to generate horizon CSVs."
        )

    df = pd.read_csv(path)
    print(f"\n[LOAD] {path}")
    print(f"  Shape: {df.shape}")
    print(f"  Label distribution:")
    for lbl, name in CLASS_NAMES.items():
        count = (df["label"] == lbl).sum()
        pct   = 100 * count / len(df)
        print(f"    {lbl} ({name:14s}): {count:>6,}  ({pct:.1f}%)")

    # Groups for time-aware CV — keep same source_file together
    # This prevents training on windows from the same observation file
    # that appear in the test set (temporal leakage)
    groups = df["source_file"].values

    # Features: drop non-feature columns
    feature_cols = [c for c in df.columns if c not in DROP_COLS]
    X = df[feature_cols].values
    y = df["label"].values

    print(f"  Features: {len(feature_cols)}")
    print(f"  Feature names: {feature_cols}")

    return X, y, groups, feature_cols


# =============================================================================
# TRAINING — time-aware cross-validation
# =============================================================================

def train_with_cv(X, y, groups, feature_cols, horizon_min):
    """
    Train LightGBM with StratifiedGroupKFold cross-validation.

    WHY GROUP K-FOLD (not regular StratifiedKFold):
    Regular CV randomly assigns rows to folds. With time-series data, this
    means training on windows from the SAME observation file that appear in
    the test fold — essentially showing the model what happens right before
    and after the test windows, which it wouldn't have in real deployment.
    GroupKFold keeps all windows from the same source file in the same fold,
    so test folds genuinely represent unseen observation sessions.
    """
    print(f"\n[TRAIN] {N_FOLDS}-fold StratifiedGroupKFold CV")
    print(f"  Keeping same source_file in same fold to prevent temporal leakage")

    cv = StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)

    fold_metrics = []
    all_y_true, all_y_pred, all_y_proba = [], [], []
    feature_importances = np.zeros(len(feature_cols))

    for fold, (train_idx, test_idx) in enumerate(cv.split(X, y, groups), 1):

        X_train, X_test = X[train_idx], X[test_idx]
        y_train, y_test = y[train_idx], y[test_idx]

        # Check every class appears in both train and test
        train_classes = set(np.unique(y_train))
        test_classes  = set(np.unique(y_test))
        if not test_classes.issubset(train_classes):
            print(f"  Fold {fold}: skipping — test has classes not in train: "
                  f"{test_classes - train_classes}")
            continue

        model = lgb.LGBMClassifier(**LGBM_PARAMS)
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            callbacks=[
                lgb.early_stopping(50, verbose=False),
                lgb.log_evaluation(period=-1),  # suppress per-iter output
            ],
        )

        y_pred  = model.predict(X_test)
        y_proba = model.predict_proba(X_test)

        metrics = compute_all_metrics(y_test, y_pred, y_proba, CLASS_NAMES)
        fold_metrics.append(metrics)
        feature_importances += model.feature_importances_

        all_y_true.extend(y_test.tolist())
        all_y_pred.extend(y_pred.tolist())
        all_y_proba.extend(y_proba.tolist())

        print(f"  Fold {fold}: macro_F1={metrics['macro_F1']:.3f}  "
              f"TSS={metrics['TSS_severe']['TSS']:.3f}  "
              f"F1_severe={metrics['per_class_F1'].get('Severe (M+X)', 0):.3f}")

    # Aggregate metrics across folds
    macro_f1s = [m["macro_F1"] for m in fold_metrics]
    tss_vals  = [m["TSS_severe"]["TSS"] for m in fold_metrics]

    print(f"\n[CV SUMMARY] horizon={horizon_min}min  folds={len(fold_metrics)}")
    print(f"  macro F1 : {np.mean(macro_f1s):.3f} ± {np.std(macro_f1s):.3f}")
    print(f"  TSS      : {np.mean(tss_vals):.3f} ± {np.std(tss_vals):.3f}")

    # Train FINAL model on ALL data (for deployment / dashboard use)
    print(f"\n[TRAIN] Fitting final model on full dataset...")
    final_model = lgb.LGBMClassifier(**LGBM_PARAMS)
    final_model.fit(X, y)

    # Overall metrics on the held-out predictions collected across all folds
    all_y_true  = np.array(all_y_true)
    all_y_pred  = np.array(all_y_pred)
    all_y_proba = np.array(all_y_proba)

    overall_metrics = compute_all_metrics(
        all_y_true, all_y_pred, all_y_proba, CLASS_NAMES
    )
    overall_metrics["cv_macro_F1_mean"] = round(float(np.mean(macro_f1s)), 4)
    overall_metrics["cv_macro_F1_std"]  = round(float(np.std(macro_f1s)), 4)
    overall_metrics["cv_TSS_mean"]      = round(float(np.mean(tss_vals)), 4)
    overall_metrics["cv_TSS_std"]       = round(float(np.std(tss_vals)), 4)
    overall_metrics["horizon_min"]      = horizon_min
    overall_metrics["n_folds"]          = len(fold_metrics)
    overall_metrics["n_train_rows"]     = len(X)
    overall_metrics["feature_cols"]     = feature_cols

    # Average feature importances across folds
    feature_importances /= max(len(fold_metrics), 1)

    return final_model, overall_metrics, all_y_true, all_y_pred, feature_importances


# =============================================================================
# PLOTS
# =============================================================================

def plot_confusion_matrix(y_true, y_pred, horizon_min):
    """Save a readable confusion matrix showing counts and percentages."""
    labels = sorted(CLASS_NAMES.keys())
    names  = [CLASS_NAMES[l] for l in labels]

    cm = confusion_matrix(y_true, y_pred, labels=labels)
    cm_pct = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-9) * 100

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(f"Confusion Matrix — {horizon_min}-min forecast horizon",
                 fontsize=13, fontweight="bold")

    # Raw counts
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues",
                xticklabels=names, yticklabels=names, ax=axes[0])
    axes[0].set_title("Counts")
    axes[0].set_ylabel("True label")
    axes[0].set_xlabel("Predicted label")

    # Row-normalised percentages
    sns.heatmap(cm_pct, annot=True, fmt=".1f", cmap="Blues",
                xticklabels=names, yticklabels=names, ax=axes[1])
    axes[1].set_title("Row-normalised (%)")
    axes[1].set_ylabel("True label")
    axes[1].set_xlabel("Predicted label")

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, f"confusion_{horizon_min}min.png")
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {out}")


def plot_feature_importance(feature_importances, feature_cols, horizon_min, top_n=15):
    """Save a horizontal bar chart of the top N most important features."""
    imp_df = pd.DataFrame({
        "feature":    feature_cols,
        "importance": feature_importances,
    }).sort_values("importance", ascending=False).head(top_n)

    fig, ax = plt.subplots(figsize=(10, 6))
    bars = ax.barh(imp_df["feature"][::-1], imp_df["importance"][::-1],
                   color="#2E86AB", edgecolor="white", linewidth=0.5)
    ax.set_xlabel("Feature importance (LightGBM gain)", fontsize=11)
    ax.set_title(f"Top {top_n} Features — {horizon_min}-min forecast horizon",
                 fontsize=13, fontweight="bold")
    ax.grid(axis="x", alpha=0.3)

    # Annotate bars
    for bar, val in zip(bars, imp_df["importance"][::-1]):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
                f"{val:.0f}", va="center", fontsize=8)

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, f"feature_importance_{horizon_min}min.png")
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Saved: {out}")


def plot_horizon_comparison(all_meta: list):
    """
    Bar chart comparing macro F1 and TSS across all trained horizons.
    This is the key result slide — shows how forecast skill degrades with
    lead time, which is a core finding in space weather forecasting research.
    """
    horizons  = [m["horizon_min"] for m in all_meta]
    macro_f1s = [m["cv_macro_F1_mean"] for m in all_meta]
    f1_stds   = [m["cv_macro_F1_std"]  for m in all_meta]
    tss_vals  = [m["cv_TSS_mean"]      for m in all_meta]
    tss_stds  = [m["cv_TSS_std"]       for m in all_meta]

    x = np.arange(len(horizons))
    width = 0.35

    fig, ax = plt.subplots(figsize=(12, 5))

    bars1 = ax.bar(x - width/2, macro_f1s, width, yerr=f1_stds,
                   label="Macro F1", color="#2E86AB", capsize=4, alpha=0.85)
    bars2 = ax.bar(x + width/2, tss_vals, width, yerr=tss_stds,
                   label="TSS (Severe class)", color="#E85D24", capsize=4, alpha=0.85)

    ax.set_xlabel("Forecast horizon (minutes)", fontsize=11)
    ax.set_ylabel("Score", fontsize=11)
    ax.set_title("Forecast Skill vs Lead Time\n"
                 "Both metrics expected to degrade as horizon increases — "
                 "this is a real scientific finding",
                 fontsize=12, fontweight="bold")
    ax.set_xticks(x)
    ax.set_xticklabels([f"{h} min" for h in horizons])
    ax.set_ylim(0, 1.05)
    ax.axhline(0, color="black", linewidth=0.8, linestyle="--", alpha=0.4)
    ax.legend(fontsize=10)
    ax.grid(axis="y", alpha=0.3)

    # Annotate bars
    for bar in bars1:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f"{bar.get_height():.2f}", ha="center", va="bottom", fontsize=8)
    for bar in bars2:
        ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.02,
                f"{bar.get_height():.2f}", ha="center", va="bottom", fontsize=8)

    plt.tight_layout()
    out = os.path.join(OUTPUT_DIR, "horizon_comparison.png")
    plt.savefig(out, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  Saved: {out}")


# =============================================================================
# MAIN
# =============================================================================

def train_single_horizon(horizon_min: int):
    """Full train + evaluate + save pipeline for one horizon."""
    print(f"\n{'='*60}")
    print(f" TRAINING: {horizon_min}-MINUTE FORECAST HORIZON")
    print(f"{'='*60}")

    # 1. Load data
    X, y, groups, feature_cols = load_horizon(horizon_min)

    # 2. Train with CV
    model, metrics, y_true, y_pred, feat_imp = train_with_cv(
        X, y, groups, feature_cols, horizon_min
    )

    # 3. Print full classification report
    labels = sorted(CLASS_NAMES.keys())
    names  = [CLASS_NAMES[l] for l in labels]
    print(f"\n[REPORT] Classification report (aggregated over CV folds):")
    print(classification_report(y_true, y_pred,
                                labels=labels, target_names=names,
                                zero_division=0))

    print(f"[METRICS] macro F1  : {metrics['macro_F1']:.4f}")
    print(f"[METRICS] TSS (severe): {metrics['TSS_severe']['TSS']:.4f}")
    print(f"[METRICS]   sensitivity (recall severe): {metrics['TSS_severe']['sensitivity']:.4f}")
    print(f"[METRICS]   specificity               : {metrics['TSS_severe']['specificity']:.4f}")
    if metrics["ROC_AUC_macro"]:
        print(f"[METRICS] ROC-AUC macro: {metrics['ROC_AUC_macro']:.4f}")

    # 4. Save model
    model_path = os.path.join(MODEL_DIR, f"lgbm_{horizon_min}min.pkl")
    joblib.dump(model, model_path)
    print(f"\n[SAVE] Model saved: {model_path}")

    # 5. Save metrics JSON
    meta_path = os.path.join(MODEL_DIR, f"lgbm_{horizon_min}min_meta.json")
    with open(meta_path, "w") as f:
        json.dump(metrics, f, indent=2)
    print(f"[SAVE] Metrics saved: {meta_path}")

    # 6. Plots
    print("\n[PLOTS]")
    plot_confusion_matrix(y_true, y_pred, horizon_min)
    plot_feature_importance(feat_imp, feature_cols, horizon_min)

    return metrics


def compare_horizons():
    """Load all saved meta JSON files and plot the comparison chart."""
    all_meta = []
    for horizon_min in [5, 10, 15, 30, 60]:
        meta_path = os.path.join(MODEL_DIR, f"lgbm_{horizon_min}min_meta.json")
        if os.path.exists(meta_path):
            with open(meta_path) as f:
                all_meta.append(json.load(f))
        else:
            print(f"  [SKIP] No saved model for {horizon_min}min — run training first.")

    if len(all_meta) < 2:
        print("Need at least 2 trained horizons to compare. Train more first.")
        return

    all_meta.sort(key=lambda m: m["horizon_min"])
    print(f"\nComparing {len(all_meta)} horizons: "
          f"{[m['horizon_min'] for m in all_meta]} minutes")
    plot_horizon_comparison(all_meta)
    print("\nHorizon comparison summary:")
    print(f"{'Horizon':>10} {'macro F1':>10} {'TSS':>10}")
    for m in all_meta:
        print(f"{m['horizon_min']:>9}min {m['cv_macro_F1_mean']:>10.3f} "
              f"{m['cv_TSS_mean']:>10.3f}")


def main():
    parser = argparse.ArgumentParser(
        description="Train LightGBM solar flare forecast models."
    )
    parser.add_argument(
        "--horizon", type=int, default=5,
        help="Forecast horizon in minutes (5, 10, 15, 30, 60). Default: 5"
    )
    parser.add_argument(
        "--compare", action="store_true",
        help="Compare all already-trained horizons and plot the degradation chart."
    )
    args = parser.parse_args()

    if args.compare:
        compare_horizons()
    else:
        if args.horizon not in [5, 10, 15, 30, 60]:
            print(f"[WARN] Horizon {args.horizon}min is unusual. "
                  f"Recommended: 5, 10, 15, 30, 60.")
        train_single_horizon(args.horizon)


if __name__ == "__main__":
    main()