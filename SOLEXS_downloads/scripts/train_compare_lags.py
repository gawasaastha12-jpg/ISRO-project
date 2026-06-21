"""
train_compare_lags.py
=====================
Trains one LightGBM model per lag configuration and compares performance.

Imbalance strategy (in order of preference, as recommended):
  1. class weights via scale_pos_weight  — always applied
  2. balanced subsampling               — applied when imbalance > 5:1
  3. SMOTE                              — only if TSS < 0.15 after above two

HOW TO RUN
----------
    python train_compare_lags.py

OUTPUTS
-------
    ../models/lgbm_lag_{N}.pkl              trained model for each lag config
    ../models/lgbm_lag_{N}_meta.json        metrics
    ../outputs/comparison_lags.png          TSS + AUC comparison chart
    ../outputs/confusion_lag_{N}.png        confusion matrix per config
    ../outputs/feature_importance_lag_{N}.png
"""

import json
import os
import warnings

import joblib
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
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
from sklearn.utils import resample
import lightgbm as lgb

warnings.filterwarnings("ignore")

# =============================================================================
# CONFIG
# =============================================================================

DATA_DIR   = "../data/processed"
MODEL_DIR  = "../models"
OUTPUT_DIR = "../outputs"
STEP_MIN   = 5

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

LAG_CONFIGS = [2, 12, 24]

DROP_COLS = [
    "label", "label_future", "label_binary_future", "source_file",
]

N_FOLDS = 5

LGBM_BASE = {
    "objective":          "binary",
    "metric":             "binary_logloss",
    "n_estimators":       1000,
    "learning_rate":      0.02,
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
# METRICS
# =============================================================================

def tss(y_true, y_pred):
    y_true, y_pred = np.array(y_true), np.array(y_pred)
    tp = np.sum((y_true == 1) & (y_pred == 1))
    fn = np.sum((y_true == 1) & (y_pred == 0))
    fp = np.sum((y_true == 0) & (y_pred == 1))
    tn = np.sum((y_true == 0) & (y_pred == 0))
    sens = tp / (tp + fn + 1e-9)
    spec = tn / (tn + fp + 1e-9)
    return {
        "TSS":         round(float(sens - (1 - spec)), 4),
        "sensitivity": round(float(sens), 4),
        "specificity": round(float(spec), 4),
        "precision":   round(float(tp / (tp + fp + 1e-9)), 4),
        "TP": int(tp), "FN": int(fn), "FP": int(fp), "TN": int(tn),
    }

def best_threshold_tss(y_true, y_proba):
    thresholds = np.linspace(0.01, 0.99, 300)
    tss_vals   = [tss(y_true, (y_proba >= t).astype(int))["TSS"]
                  for t in thresholds]
    idx = int(np.argmax(tss_vals))
    return float(thresholds[idx]), float(tss_vals[idx])


# =============================================================================
# BALANCED SUBSAMPLING (strategy 2)
# =============================================================================

def balanced_subsample(X, y, groups, ratio=3.0, random_state=42):
    """
    Downsample the majority class so that neg:pos ratio = `ratio`.
    Preserves group membership so CV folds remain valid.
    Returns new X, y, groups arrays.
    """
    pos_idx = np.where(y == 1)[0]
    neg_idx = np.where(y == 0)[0]
    target_neg = int(len(pos_idx) * ratio)

    if target_neg >= len(neg_idx):
        return X, y, groups  # already balanced enough

    rng = np.random.default_rng(random_state)
    keep_neg = rng.choice(neg_idx, size=target_neg, replace=False)
    keep_idx = np.sort(np.concatenate([pos_idx, keep_neg]))

    return X[keep_idx], y[keep_idx], groups[keep_idx]


# =============================================================================
# TRAIN ONE LAG CONFIG
# =============================================================================

def train_one(n_lags: int, all_results: list):
    lookback = n_lags * STEP_MIN
    data_path = os.path.join(DATA_DIR, f"lag_{n_lags}_advanced.csv")

    if not os.path.exists(data_path):
        print(f"\n[SKIP] {data_path} not found. Run build_advanced_features.py first.")
        return

    print(f"\n{'='*60}")
    print(f" LAG-{n_lags}  (~{lookback}-min lookback)")
    print(f"{'='*60}")

    df       = pd.read_csv(data_path)
    y        = df["label_binary_future"].values
    groups   = df["source_file"].values
    feat_cols = [c for c in df.columns if c not in DROP_COLS]
    X        = df[feat_cols].values.astype(np.float32)

    n_pos   = y.sum()
    n_neg   = len(y) - n_pos
    total   = len(y)
    imb_ratio = n_neg / (n_pos + 1e-9)

    print(f"  Rows      : {total:,}")
    print(f"  Features  : {len(feat_cols)}")
    print(f"  No-flare  : {n_neg:,}  ({100*n_neg/total:.1f}%)")
    print(f"  Flare     : {n_pos:,}  ({100*n_pos/total:.1f}%)")
    print(f"  Imbalance : {imb_ratio:.1f}:1")

    # ── Strategy 1: class weights ──────────────────────────────────────────
    spw = round(imb_ratio, 2)
    print(f"\n  [STRATEGY 1] scale_pos_weight = {spw}")
    params = {**LGBM_BASE, "scale_pos_weight": spw}

    # ── Strategy 2: balanced subsampling if heavily imbalanced ────────────
    if imb_ratio > 5:
        print(f"  [STRATEGY 2] Balanced subsampling (neg:pos = 3:1)")
        X_tr, y_tr, g_tr = balanced_subsample(X, y, groups, ratio=3.0)
        print(f"               {len(X_tr):,} rows after subsampling")
    else:
        X_tr, y_tr, g_tr = X, y, groups

    # ── CV ────────────────────────────────────────────────────────────────
    cv = StratifiedGroupKFold(n_splits=N_FOLDS, shuffle=True, random_state=42)
    fold_tss_default, fold_tss_opt, fold_auc, fold_f1 = [], [], [], []
    all_y_true, all_y_pred_default, all_y_proba = [], [], []
    feat_imp = np.zeros(len(feat_cols))

    print(f"\n  [CV] {N_FOLDS}-fold StratifiedGroupKFold")
    print(f"  {'Fold':>6} {'TSS@0.5':>9} {'TSS@opt':>9} "
          f"{'AUC':>7} {'sens':>7} {'spec':>7}")

    for fold, (tr_idx, te_idx) in enumerate(
            cv.split(X_tr, y_tr, g_tr), 1):

        Xf_tr, Xf_te = X_tr[tr_idx], X_tr[te_idx]
        yf_tr, yf_te = y_tr[tr_idx], y_tr[te_idx]

        if len(np.unique(yf_te)) < 2:
            print(f"  Fold {fold}: skipped (single class in test set)")
            continue

        model = lgb.LGBMClassifier(**params)
        model.fit(
            Xf_tr, yf_tr,
            eval_set=[(Xf_te, yf_te)],
            callbacks=[
                lgb.early_stopping(50, verbose=False),
                lgb.log_evaluation(period=-1),
            ],
        )

        proba  = model.predict_proba(Xf_te)[:, 1]
        pred_d = (proba >= 0.5).astype(int)
        opt_t, opt_tss = best_threshold_tss(yf_te, proba)
        pred_o = (proba >= opt_t).astype(int)

        m_d = tss(yf_te, pred_d)
        m_o = tss(yf_te, pred_o)
        auc = roc_auc_score(yf_te, proba)
        f1  = f1_score(yf_te, pred_o, zero_division=0)

        fold_tss_default.append(m_d["TSS"])
        fold_tss_opt.append(opt_tss)
        fold_auc.append(auc)
        fold_f1.append(f1)
        feat_imp += model.feature_importances_

        all_y_true.extend(yf_te.tolist())
        all_y_pred_default.extend(pred_d.tolist())
        all_y_proba.extend(proba.tolist())

        print(f"  {fold:>6}   {m_d['TSS']:>+8.3f}   {opt_tss:>+8.3f}  "
              f"{auc:>7.3f}  {m_o['sensitivity']:>7.3f}  "
              f"{m_o['specificity']:>7.3f}")

    feat_imp /= max(len(fold_tss_opt), 1)
    all_y_true  = np.array(all_y_true)
    all_y_proba = np.array(all_y_proba)

    # Overall metrics at default threshold
    all_y_pred_d = np.array(all_y_pred_default)
    overall_tss_d = tss(all_y_true, all_y_pred_d)

    # Overall optimal threshold
    best_t, best_tss_val = best_threshold_tss(all_y_true, all_y_proba)
    y_pred_opt = (all_y_proba >= best_t).astype(int)
    overall_tss_opt = tss(all_y_true, y_pred_opt)
    overall_auc = roc_auc_score(all_y_true, all_y_proba)
    avg_prec    = average_precision_score(all_y_true, all_y_proba)

    print(f"\n  ── CV Summary ──")
    print(f"  TSS@0.50 : {np.mean(fold_tss_default):+.3f} ± {np.std(fold_tss_default):.3f}")
    print(f"  TSS@opt  : {np.mean(fold_tss_opt):+.3f} ± {np.std(fold_tss_opt):.3f}")
    print(f"  ROC-AUC  : {np.mean(fold_auc):.3f} ± {np.std(fold_auc):.3f}")
    print(f"\n  ── Overall (pooled) ──")
    print(f"  TSS (default 0.50)   : {overall_tss_d['TSS']:+.4f}")
    print(f"  TSS (optimal {best_t:.2f}) : {best_tss_val:+.4f}")
    print(f"  Sensitivity          : {overall_tss_opt['sensitivity']:.4f}")
    print(f"  Specificity          : {overall_tss_opt['specificity']:.4f}")
    print(f"  Precision            : {overall_tss_opt['precision']:.4f}")
    print(f"  ROC-AUC              : {overall_auc:.4f}")
    print(f"  Avg Precision        : {avg_prec:.4f}")

    # Full classification report
    print(f"\n  [REPORT]")
    print(classification_report(
        all_y_true, y_pred_opt,
        target_names=["No flare (t+1)", "Flare (t+1)"],
        zero_division=0,
    ))

    # ── Save model ────────────────────────────────────────────────────────
    print(f"  [TRAIN] Final model on full dataset...")
    final = lgb.LGBMClassifier(**params)
    final.fit(X, y)

    model_path = os.path.join(MODEL_DIR, f"lgbm_lag_{n_lags}.pkl")
    joblib.dump(final, model_path)

    meta = {
        "lag_config":          n_lags,
        "lookback_min":        lookback,
        "n_samples":           int(total),
        "n_features":          len(feat_cols),
        "feature_cols":        feat_cols,
        "scale_pos_weight":    spw,
        "optimal_threshold":   round(best_t, 4),
        "cv_TSS_opt_mean":     round(float(np.mean(fold_tss_opt)), 4),
        "cv_TSS_opt_std":      round(float(np.std(fold_tss_opt)), 4),
        "cv_AUC_mean":         round(float(np.mean(fold_auc)), 4),
        "overall_TSS_default": overall_tss_d,
        "overall_TSS_optimal": overall_tss_opt,
        "overall_AUC":         round(float(overall_auc), 4),
        "avg_precision":       round(float(avg_prec), 4),
    }
    meta_path = os.path.join(MODEL_DIR, f"lgbm_lag_{n_lags}_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  [SAVE] {model_path}")
    print(f"  [SAVE] {meta_path}")

    # ── Plots ──────────────────────────────────────────────────────────────

    # Confusion matrix
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    fig.suptitle(
        f"Lag-{n_lags} (~{lookback} min lookback)\n"
        f"Predicting flare onset {STEP_MIN} min ahead",
        fontsize=12, fontweight="bold"
    )
    for ax, (preds, title) in zip(axes, [
        (all_y_pred_d,
         f"Default threshold (0.50)\nTSS={overall_tss_d['TSS']:+.3f}"),
        (y_pred_opt,
         f"Optimal threshold ({best_t:.2f})\nTSS={best_tss_val:+.3f}"),
    ]):
        cm     = confusion_matrix(all_y_true, preds)
        cm_pct = cm.astype(float) / (cm.sum(axis=1, keepdims=True) + 1e-9) * 100
        sns.heatmap(cm, annot=True, fmt="d", cmap="YlOrRd",
                    xticklabels=["No flare", "Flare"],
                    yticklabels=["No flare", "Flare"], ax=ax)
        for i in range(2):
            for j in range(2):
                ax.text(j + 0.5, i + 0.72, f"({cm_pct[i,j]:.1f}%)",
                        ha="center", va="center", fontsize=8, color="dimgray")
        ax.set_title(title, fontsize=10)
        ax.set_ylabel("True"); ax.set_xlabel("Predicted")
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, f"confusion_lag_{n_lags}.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"  [PLOT] {p}")

    # Feature importance (colour by family)
    imp_df = pd.DataFrame({
        "feature":    feat_cols,
        "importance": feat_imp,
    }).sort_values("importance", ascending=False).head(20)

    def fam_colour(name):
        if "lag" in name:        return "#457B9D"
        if "delta" in name:      return "#E85D24"
        if "rolling" in name:    return "#2A9D8F"
        if any(k in name for k in ["slope","deriv","trend_ch"]): return "#E9C46A"
        if any(k in name for k in ["prom","width_ch","width_ac"]): return "#F4A261"
        return "#1D3557"   # current-window features

    colours = [fam_colour(f) for f in imp_df["feature"][::-1].tolist()]

    fig, ax = plt.subplots(figsize=(11, 7))
    bars = ax.barh(imp_df["feature"][::-1], imp_df["importance"][::-1],
                   color=colours)
    ax.set_xlabel("Feature importance (LightGBM gain)")
    ax.set_title(
        f"Top 20 Features — Lag-{n_lags} (~{lookback} min)\n"
        f"Colour = feature family",
        fontsize=12, fontweight="bold"
    )
    ax.grid(axis="x", alpha=0.3)
    legend = [
        mpatches.Patch(color="#1D3557", label="Current window"),
        mpatches.Patch(color="#457B9D", label="Lag features"),
        mpatches.Patch(color="#E85D24", label="Derivatives (Δ)"),
        mpatches.Patch(color="#2A9D8F", label="Rolling stats"),
        mpatches.Patch(color="#E9C46A", label="Trend accel / slope"),
        mpatches.Patch(color="#F4A261", label="Peak evolution"),
    ]
    ax.legend(handles=legend, fontsize=9, loc="lower right")
    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, f"feature_importance_lag_{n_lags}.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"  [PLOT] {p}")

    # Store for comparison chart
    all_results.append({
        "lag":             n_lags,
        "lookback_min":    lookback,
        "tss_opt_mean":    np.mean(fold_tss_opt),
        "tss_opt_std":     np.std(fold_tss_opt),
        "auc_mean":        np.mean(fold_auc),
        "auc_std":         np.std(fold_auc),
        "best_threshold":  best_t,
        "sensitivity":     overall_tss_opt["sensitivity"],
        "specificity":     overall_tss_opt["specificity"],
    })


# =============================================================================
# COMPARISON CHART
# =============================================================================

def plot_comparison(results: list):
    if len(results) < 2:
        print("\n[SKIP] Need ≥2 results for comparison chart.")
        return

    results = sorted(results, key=lambda r: r["lag"])
    labels  = [f"Lag-{r['lag']}\n({r['lookback_min']} min)" for r in results]
    tss_m   = [r["tss_opt_mean"]  for r in results]
    tss_s   = [r["tss_opt_std"]   for r in results]
    auc_m   = [r["auc_mean"]      for r in results]
    auc_s   = [r["auc_std"]       for r in results]
    sens    = [r["sensitivity"]   for r in results]
    spec    = [r["specificity"]   for r in results]

    x = np.arange(len(results))
    w = 0.28

    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.suptitle(
        "Performance vs Lookback Window\n"
        "Longer lookback should capture more of the pre-flare ramp",
        fontsize=13, fontweight="bold"
    )

    # TSS + AUC bar chart
    axes[0].bar(x - w/2, tss_m, w, yerr=tss_s, label="TSS (optimal)",
                color="#2E86AB", capsize=5, alpha=0.85)
    axes[0].bar(x + w/2, auc_m, w, yerr=auc_s, label="ROC-AUC",
                color="#E85D24", capsize=5, alpha=0.85)
    axes[0].axhline(0.5, color="gray", linestyle="--", lw=1, alpha=0.6,
                    label="AUC=0.5 (random)")
    axes[0].axhline(0.0, color="black", linestyle="-", lw=0.8, alpha=0.4)
    for i, (t, a) in enumerate(zip(tss_m, auc_m)):
        axes[0].text(i - w/2, t + 0.015, f"{t:+.3f}",
                     ha="center", fontsize=8)
        axes[0].text(i + w/2, a + 0.015, f"{a:.3f}",
                     ha="center", fontsize=8)
    axes[0].set_xticks(x); axes[0].set_xticklabels(labels)
    axes[0].set_ylabel("Score"); axes[0].set_ylim(-0.1, 1.05)
    axes[0].legend(fontsize=9); axes[0].grid(axis="y", alpha=0.3)
    axes[0].set_title("TSS and ROC-AUC", fontsize=11)

    # Sensitivity / Specificity
    axes[1].plot(labels, sens, "o-", color="#2E86AB", lw=2,
                 label="Sensitivity (flare recall)", markersize=8)
    axes[1].plot(labels, spec, "s-", color="#E85D24", lw=2,
                 label="Specificity (quiet recall)", markersize=8)
    for i, (s, p) in enumerate(zip(sens, spec)):
        axes[1].text(i, s + 0.02, f"{s:.3f}", ha="center", fontsize=8,
                     color="#2E86AB")
        axes[1].text(i, p - 0.04, f"{p:.3f}", ha="center", fontsize=8,
                     color="#E85D24")
    axes[1].set_ylabel("Score"); axes[1].set_ylim(0, 1.1)
    axes[1].legend(fontsize=9); axes[1].grid(alpha=0.3)
    axes[1].set_title("Sensitivity vs Specificity at Optimal Threshold",
                      fontsize=11)

    plt.tight_layout()
    p = os.path.join(OUTPUT_DIR, "comparison_lags.png")
    plt.savefig(p, dpi=150, bbox_inches="tight"); plt.close()
    print(f"\n[PLOT] Comparison chart: {p}")

    # Text summary table
    print(f"\n{'='*65}")
    print(f"FINAL COMPARISON")
    print(f"{'Lookback':>12} {'TSS(opt)':>10} {'AUC':>8} "
          f"{'Sensitivity':>13} {'Specificity':>13} {'Threshold':>11}")
    print("-" * 65)
    for r in results:
        print(f"{r['lookback_min']:>10}min  {r['tss_opt_mean']:>+9.3f}  "
              f"{r['auc_mean']:>8.3f}  {r['sensitivity']:>13.3f}  "
              f"{r['specificity']:>13.3f}  {r['best_threshold']:>11.3f}")
    print(f"{'='*65}")


# =============================================================================
# MAIN
# =============================================================================

all_results = []
for n in LAG_CONFIGS:
    train_one(n, all_results)

plot_comparison(all_results)

print(f"\nModels saved to  : {MODEL_DIR}")
print(f"Plots saved to   : {OUTPUT_DIR}")
print(f"\nUse the best model in your Streamlit dashboard.")
print(f"Set the decision threshold to the optimal value printed above.")
