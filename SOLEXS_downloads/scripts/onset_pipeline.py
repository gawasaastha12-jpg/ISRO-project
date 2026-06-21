"""
onset_pipeline.py  —  Research-grade Solar Flare Onset Forecasting
===================================================================
Single script that does everything:

  Stage 1 — Event detection & onset labeling
  Stage 2 — Lag feature engineering (60-min lookback, 12 lags)
  Stage 3 — Multi-horizon training (5, 30, 60 min ahead)
  Stage 4 — Evaluation with TSS, HSS, AUC, SHAP
  Stage 5 — Horizon comparison table + saved models

WHY ONSET LABELS MATTER
-----------------------
Current approach: every flare window is labeled positive → model learns
  "is there a flare RIGHT NOW?" (trivial — just look at amplitude)

Onset approach: ONLY the first window of each new event is positive → model
  learns "are there PRE-FLARE PRECURSORS building up?" (genuine early warning)

This is the difference between a flare detector and a flare forecaster.

HOW TO RUN
----------
  pip install lightgbm shap
  python onset_pipeline.py

  Optional flags:
    --input     path to your feature CSV     (default: ../data/processed/dataset_research_v5.csv)
    --models    where to save models         (default: ../models)
    --outputs   where to save plots/reports  (default: ../outputs)
    --no_shap   skip SHAP (faster)
    --quick     use 30% of data for fast test

CONFIG (edit at top of file)
-----------------------------
  FORECAST_TARGET  : "CMX" (C+M+X) or "MX" (M+X only, stricter)
  MIN_QUIET_GAP    : 6 windows = 30 min quiet before a new event counts
  N_LAGS           : 12 windows = 60-min lookback context
  HORIZONS         : {1: "5min", 6: "30min", 12: "60min"}
"""

import argparse
import json
import os
import warnings
import time

import numpy as np
import pandas as pd
from scipy.stats import linregress

warnings.filterwarnings("ignore")

# ── Optional imports with graceful fallbacks ─────────────────────────────────
try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False
    from sklearn.ensemble import GradientBoostingClassifier
    print("[WARN] lightgbm not found — falling back to sklearn GBM (slower).")
    print("       Install with: pip install lightgbm\n")

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    print("[WARN] shap not found — SHAP analysis will be skipped.")
    print("       Install with: pip install shap\n")

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    PLOT_AVAILABLE = True
except ImportError:
    PLOT_AVAILABLE = False

import joblib
from sklearn.metrics import (
    roc_auc_score, average_precision_score,
    confusion_matrix, classification_report,
    roc_curve, precision_recall_curve,
)
from sklearn.model_selection import StratifiedGroupKFold


# =============================================================================
# CONFIG
# =============================================================================

# Forecast target: which flare classes count as "positive"
# "CMX" → label >= 2 (C, M, X)   ← recommended: enough events to train on
# "MX"  → label >= 3 (M, X only) ← stricter, very sparse, harder to train
FORECAST_TARGET = "CMX"

# Minimum consecutive quiet windows before a new flare event can start
# 6 × 5 min = 30 minutes of quiet required (prevents mid-flare dips = new onset)
MIN_QUIET_GAP = 6

# Number of lag windows (each = 5 min step) = 60-min lookback context
N_LAGS = 12

# Forecast horizons: {index_shift: label_string}
HORIZONS = {
    1:  "5min",
    6:  "30min",
    12: "60min",
}

# Base features to use for lag construction
# Deliberately EXCLUDES peak_count, peak_ratio, max_prominence (label artifacts)
# because these directly encode the flare magnitude that the label is derived from
BASE_FEATURES = [
    # Statistical
    "mean", "median", "std", "iqr", "skew", "kurtosis",
    "energy", "snr", "max", "min",
    # Temporal
    "trend", "volatility", "acceleration",
    "max_gradient", "mean_gradient_last60",
    # Multi-scale
    "drift_t1_t3", "std_ratio_t3_t1", "rolling_mean_slope",
    # Spectral
    "spectral_entropy", "low_freq_power", "low_mid_power_ratio",
    # Morphology
    "rise_decay_asymmetry", "pre_peak_slope", "post_peak_slope",
    # Rolling (Group 7)
    "rolling_mean_last60", "rolling_std_last60",
    "rolling_max_last60", "rolling_snr_last60",
    # Trend acceleration (Group 8)
    "trend_last60_vs_full", "second_deriv_max",
    # Peak evolution (Group 9) — DIFFERENTIAL only, not raw prominence
    "prominence_change", "width_last_vs_first",
]

# LightGBM hyperparameters (tuned for binary imbalanced classification)
LGB_BASE_PARAMS = {
    "objective":       "binary",
    "metric":          "auc",
    "boosting_type":   "gbdt",
    "learning_rate":   0.01,
    "n_estimators":    2000,
    "num_leaves":      127,
    "max_depth":       -1,
    "min_child_samples": 5,
    "feature_fraction": 0.80,
    "bagging_fraction": 0.80,
    "bagging_freq":    1,
    "random_state":    42,
    "n_jobs":          -1,
    "verbose":         -1,
}

N_CV_FOLDS = 5


# =============================================================================
# STAGE 1 — EVENT DETECTION & ONSET LABELING
# =============================================================================

def build_onset_labels(df: pd.DataFrame, forecast_target: str, min_quiet_gap: int) -> pd.DataFrame:
    """
    Mark only the FIRST window of each distinct flare event as onset=1.

    Parameters
    ----------
    df              : feature dataframe with 'label' and 'source_file' columns
    forecast_target : "CMX" (label>=2) or "MX" (label>=3)
    min_quiet_gap   : min consecutive quiet windows before a new event

    Returns
    -------
    df with added 'label_onset' column (1=onset, 0=quiet/ongoing)
    """
    threshold = 2 if forecast_target == "CMX" else 3
    label_name = f"onset_{forecast_target}"

    print(f"\n[STAGE 1] Event onset detection")
    print(f"  Target         : {forecast_target} (label >= {threshold})")
    print(f"  Min quiet gap  : {min_quiet_gap} × 5min = {min_quiet_gap*5} min")

    parts = []
    total_onsets = 0
    total_ongoing = 0
    total_events = 0

    for src_file, group in df.groupby("source_file"):
        if src_file == "SYNTHETIC_SMOTE":
            continue

        g = group.reset_index(drop=True).copy()
        g["label_onset"] = 0

        is_target = (g["label"] >= threshold).astype(int).values
        n = len(is_target)

        quiet_streak = min_quiet_gap  # assume enough quiet at start
        in_event = False

        for i in range(n):
            if is_target[i] == 0:
                quiet_streak += 1
                in_event = False
            else:
                if not in_event and quiet_streak >= min_quiet_gap:
                    g.loc[i, "label_onset"] = 1
                    total_onsets += 1
                    total_events += 1
                elif in_event:
                    total_ongoing += 1
                quiet_streak = 0
                in_event = True

        parts.append(g)

    df_out = pd.concat(parts, ignore_index=True)
    total = len(df_out)

    print(f"  Distinct events: {total_events:,}")
    print(f"  Onset windows  : {total_onsets:,} ({100*total_onsets/total:.2f}%)")
    print(f"  Ongoing windows: {total_ongoing:,} (excluded from positive class)")
    print(f"  Quiet windows  : {total - total_onsets - total_ongoing:,}")
    print(f"  Imbalance ratio: {(total - total_onsets) / max(total_onsets, 1):.0f}:1")

    return df_out


# =============================================================================
# STAGE 2 — LAG FEATURE ENGINEERING
# =============================================================================

def _rolling_slope(series: pd.Series, w: int) -> pd.Series:
    """Slope of linear fit over rolling window of length w."""
    slopes = np.full(len(series), np.nan)
    arr = series.values
    for i in range(w - 1, len(arr)):
        y = arr[i - w + 1:i + 1]
        if not np.any(np.isnan(y)):
            try:
                slopes[i] = linregress(np.arange(w), y)[0]
            except Exception:
                pass
    return pd.Series(slopes, index=series.index)


def build_lag_features(df: pd.DataFrame, horizon_shift: int,
                       base_features: list, n_lags: int) -> pd.DataFrame:
    """
    Build lag features + multi-window derivatives for one forecast horizon.

    For each source file (time series), construct:
      - Current window features
      - Lag 1..N features (historical context)
      - Delta features (change vs previous window)
      - Rolling statistics over 3, 6, 12 windows
      - Rolling slope features
      - Peak evolution differentials
      - Target: label_onset at t + horizon_shift

    Parameters
    ----------
    df             : dataframe with label_onset and source_file columns
    horizon_shift  : number of windows ahead to predict
    base_features  : list of feature column names to use
    n_lags         : number of lag windows

    Returns
    -------
    pd.DataFrame ready for training
    """
    # Filter to features that actually exist in df
    avail = [f for f in base_features if f in df.columns]
    missing = [f for f in base_features if f not in df.columns]
    if missing:
        print(f"  [WARN] {len(missing)} base features not in dataset: {missing[:5]}{'...' if len(missing)>5 else ''}")

    parts = []
    skipped = 0
    min_rows = n_lags + horizon_shift + 5

    for src_file, group in df.groupby("source_file"):
        if src_file == "SYNTHETIC_SMOTE":
            continue
        if len(group) < min_rows:
            skipped += 1
            continue

        g = group.reset_index(drop=True)
        out = pd.DataFrame(index=g.index)

        # ── Current window features ──────────────────────────────────────────
        for feat in avail:
            out[feat] = g[feat]

        # ── Lag features (1 .. N_LAGS) ───────────────────────────────────────
        for lag in range(1, n_lags + 1):
            for feat in avail:
                out[f"{feat}_lag{lag}"] = g[feat].shift(lag)

        # ── Delta features (change vs t-1) ───────────────────────────────────
        delta_feats = ["mean", "std", "energy", "snr", "rolling_mean_last60",
                       "rolling_std_last60", "trend", "volatility"]
        for src in delta_feats:
            if src in g.columns:
                out[f"delta_{src}"] = g[src] - g[src].shift(1)
                out[f"delta_{src}_accel"] = out[f"delta_{src}"] - out[f"delta_{src}"].shift(1)

        # ── Rolling statistics (over 3, 6, 12 windows) ───────────────────────
        for win, wlabel in [(3, "3"), (6, "6"), (12, "12")]:
            for feat in ["mean", "std", "max", "energy", "rolling_snr_last60"]:
                if feat in g.columns:
                    rm = g[feat].rolling(window=win, min_periods=2).mean()
                    out[f"roll{wlabel}_{feat}"] = rm
                    out[f"roll{wlabel}_{feat}_trend"] = rm - rm.shift(1)

        # ── Rolling slope features ────────────────────────────────────────────
        for w, wl in [(3, "3"), (6, "6"), (12, "12")]:
            if "mean" in g.columns:
                out[f"slope_{wl}_mean"] = _rolling_slope(g["mean"], w)
            if "rolling_snr_last60" in g.columns:
                out[f"slope_{wl}_snr"] = _rolling_slope(g["rolling_snr_last60"], w)

        # ── Trend acceleration ────────────────────────────────────────────────
        if "trend" in g.columns:
            out["trend_change"]      = g["trend"] - g["trend"].shift(1)
            out["second_derivative"] = out["trend_change"] - out["trend_change"].shift(1)

        # ── Peak evolution differentials ──────────────────────────────────────
        if "prominence_change" in g.columns:
            pc = g["prominence_change"]
            out["prom_change_lag1"]  = pc.shift(1)
            out["prom_change_delta"] = pc - pc.shift(1)
            out["prom_change_accel"] = out["prom_change_delta"] - out["prom_change_delta"].shift(1)

        # ── Target: onset label horizon_shift steps ahead ────────────────────
        out["label_onset_future"] = g["label_onset"].shift(-horizon_shift)
        out["source_file"]        = g["source_file"].values

        # Drop rows with NaN targets or insufficient lag history
        out = out.dropna(subset=["label_onset_future"])
        out = out.iloc[n_lags:]  # first n_lags rows have incomplete history

        if len(out) > 0:
            out["label_onset_future"] = out["label_onset_future"].astype(int)
            parts.append(out)

    if skipped > 0:
        print(f"  Files skipped (too short): {skipped}")

    df_out = pd.concat(parts, ignore_index=True)
    return df_out


# =============================================================================
# STAGE 3 — EVALUATION METRICS
# =============================================================================

def compute_metrics(y_true, y_prob, threshold=0.5) -> dict:
    """TSS, HSS, AUC, sensitivity, specificity, precision, F1 for binary."""
    y_pred = (y_prob >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()

    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0
    precision   = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    f1          = 2 * precision * sensitivity / (precision + sensitivity + 1e-9)

    tss = sensitivity + specificity - 1.0

    num = 2 * (tp * tn - fp * fn)
    den = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)
    hss = num / den if den > 0 else 0.0

    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = 0.5

    try:
        avg_prec = average_precision_score(y_true, y_prob)
    except Exception:
        avg_prec = 0.0

    return {
        "tss": round(tss, 4), "hss": round(hss, 4),
        "auc": round(auc, 4), "avg_prec": round(avg_prec, 4),
        "sensitivity": round(sensitivity, 4), "specificity": round(specificity, 4),
        "precision": round(precision, 4), "f1": round(f1, 4),
        "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn),
        "threshold": round(threshold, 4),
    }


def find_optimal_threshold(y_true, y_prob) -> float:
    """Find threshold that maximises TSS."""
    thresholds = np.linspace(0.05, 0.95, 91)
    best_tss, best_thresh = -1.0, 0.5
    for t in thresholds:
        m = compute_metrics(y_true, y_prob, threshold=t)
        if m["tss"] > best_tss:
            best_tss, best_thresh = m["tss"], t
    return round(best_thresh, 3)


# =============================================================================
# STAGE 4 — TRAINING & CROSS-VALIDATION
# =============================================================================

def train_horizon(df_feat: pd.DataFrame, horizon_label: str,
                  models_dir: str, outputs_dir: str,
                  no_shap: bool = False, quick: bool = False) -> dict:
    """
    Train one LightGBM model for a single forecast horizon.
    Uses StratifiedGroupKFold to keep source files together (no temporal leakage).
    """
    print(f"\n{'─'*65}")
    print(f"  HORIZON: {horizon_label}")

    feat_cols = [c for c in df_feat.columns
                 if c not in ("label_onset_future", "source_file")]

    X = df_feat[feat_cols].values
    y = df_feat["label_onset_future"].values
    groups = df_feat["source_file"].values

    if quick:
        idx = np.random.default_rng(42).choice(len(X), size=int(len(X)*0.3), replace=False)
        X, y, groups = X[idx], y[idx], groups[idx]

    n_pos = y.sum()
    n_neg = (y == 0).sum()
    spw   = n_neg / max(n_pos, 1)

    print(f"  Samples  : {len(y):,}  |  Onsets: {int(n_pos):,} ({100*n_pos/len(y):.1f}%)  |  SPW: {spw:.1f}")

    # ── Cross-validation ──────────────────────────────────────────────────────
    cv = StratifiedGroupKFold(n_splits=N_CV_FOLDS, shuffle=True, random_state=42)
    fold_metrics = []
    all_y_true, all_y_prob = [], []

    for fold_i, (train_idx, val_idx) in enumerate(cv.split(X, y, groups), 1):
        X_tr, X_val = X[train_idx], X[val_idx]
        y_tr, y_val = y[train_idx], y[val_idx]

        if LGB_AVAILABLE:
            params = {**LGB_BASE_PARAMS, "scale_pos_weight": spw}
            model = lgb.LGBMClassifier(**params)
            model.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.early_stopping(50, verbose=False),
                           lgb.log_evaluation(-1)],
            )
        else:
            model = GradientBoostingClassifier(
                n_estimators=300, max_depth=5,
                learning_rate=0.05, random_state=42,
            )
            model.fit(X_tr, y_tr)

        y_prob = model.predict_proba(X_val)[:, 1]
        opt_thresh = find_optimal_threshold(y_val, y_prob)
        m = compute_metrics(y_val, y_prob, threshold=opt_thresh)

        all_y_true.extend(y_val)
        all_y_prob.extend(y_prob)

        fold_metrics.append(m)
        print(f"  Fold {fold_i}: TSS={m['tss']:+.4f}  AUC={m['auc']:.4f}  "
              f"sens={m['sensitivity']:.4f}  spec={m['specificity']:.4f}  "
              f"thresh={m['threshold']:.2f}")

    # Pooled metrics
    all_y_true = np.array(all_y_true)
    all_y_prob = np.array(all_y_prob)
    opt_thresh_pooled = find_optimal_threshold(all_y_true, all_y_prob)
    pooled = compute_metrics(all_y_true, all_y_prob, threshold=opt_thresh_pooled)

    mean_tss = np.mean([m["tss"] for m in fold_metrics])
    std_tss  = np.std( [m["tss"] for m in fold_metrics])
    mean_auc = np.mean([m["auc"] for m in fold_metrics])

    print(f"\n  CV Summary:")
    print(f"    TSS  : {mean_tss:+.4f} ± {std_tss:.4f}")
    print(f"    AUC  : {mean_auc:.4f}")
    print(f"    Pooled TSS (optimal thresh={opt_thresh_pooled:.2f}): {pooled['tss']:+.4f}")
    print(f"    Sensitivity: {pooled['sensitivity']:.4f}  Specificity: {pooled['specificity']:.4f}")

    # ── Final model on full dataset ───────────────────────────────────────────
    print(f"  Training final model on full dataset...")
    if LGB_AVAILABLE:
        params_final = {**LGB_BASE_PARAMS, "scale_pos_weight": spw}
        final_model = lgb.LGBMClassifier(**params_final)
        final_model.fit(X, y, callbacks=[lgb.log_evaluation(-1)])
    else:
        final_model = GradientBoostingClassifier(
            n_estimators=300, max_depth=5, learning_rate=0.05, random_state=42
        )
        final_model.fit(X, y)

    # ── Save model ────────────────────────────────────────────────────────────
    model_path = os.path.join(models_dir, f"lgbm_onset_{horizon_label}.pkl")
    joblib.dump({"model": final_model, "feature_cols": feat_cols,
                 "threshold": opt_thresh_pooled}, model_path)

    meta = {
        "horizon": horizon_label,
        "forecast_target": FORECAST_TARGET,
        "min_quiet_gap_windows": MIN_QUIET_GAP,
        "n_lags": N_LAGS,
        "n_features": len(feat_cols),
        "n_samples": int(len(y)),
        "n_onsets": int(n_pos),
        "scale_pos_weight": round(spw, 2),
        "optimal_threshold": opt_thresh_pooled,
        "cv_tss_mean": round(mean_tss, 4),
        "cv_tss_std":  round(std_tss, 4),
        "cv_auc_mean": round(mean_auc, 4),
        "pooled_tss":  round(pooled["tss"], 4),
        "pooled_sensitivity": round(pooled["sensitivity"], 4),
        "pooled_specificity": round(pooled["specificity"], 4),
        "pooled_precision":   round(pooled["precision"], 4),
        "pooled_f1":          round(pooled["f1"], 4),
    }
    meta_path = os.path.join(models_dir, f"lgbm_onset_{horizon_label}_meta.json")
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    print(f"  Saved → {model_path}")

    # ── Plots ─────────────────────────────────────────────────────────────────
    if PLOT_AVAILABLE:
        _save_plots(final_model, X, y, feat_cols, all_y_true, all_y_prob,
                    opt_thresh_pooled, horizon_label, outputs_dir)

    # ── SHAP ─────────────────────────────────────────────────────────────────
    if SHAP_AVAILABLE and not no_shap and LGB_AVAILABLE:
        _save_shap(final_model, X, feat_cols, horizon_label, outputs_dir)

    return meta


# =============================================================================
# PLOTS
# =============================================================================

def _save_plots(model, X, y, feat_cols, y_true, y_prob,
                threshold, horizon_label, outputs_dir):
    """Save ROC curve, confusion matrix, and feature importance plots."""
    os.makedirs(outputs_dir, exist_ok=True)

    # ROC curve
    try:
        fpr, tpr, _ = roc_curve(y_true, y_prob)
        auc = roc_auc_score(y_true, y_prob)
        fig, ax = plt.subplots(figsize=(6, 5))
        ax.plot(fpr, tpr, lw=2, label=f"AUC={auc:.3f}")
        ax.plot([0, 1], [0, 1], "k--", lw=1)
        thresh_idx = np.argmin(np.abs(np.linspace(0, 1, len(fpr)) - threshold))
        ax.set_xlabel("False Positive Rate")
        ax.set_ylabel("True Positive Rate")
        ax.set_title(f"ROC Curve — Onset {horizon_label}")
        ax.legend()
        fig.tight_layout()
        fig.savefig(os.path.join(outputs_dir, f"roc_onset_{horizon_label}.png"), dpi=120)
        plt.close(fig)
    except Exception as e:
        print(f"  [WARN] ROC plot failed: {e}")

    # Confusion matrix
    try:
        y_pred = (y_prob >= threshold).astype(int)
        cm = confusion_matrix(y_true, y_pred)
        fig, ax = plt.subplots(figsize=(4, 4))
        im = ax.imshow(cm, cmap="Blues")
        ax.set_xticks([0, 1]); ax.set_yticks([0, 1])
        ax.set_xticklabels(["No onset", "Onset"])
        ax.set_yticklabels(["No onset", "Onset"])
        ax.set_xlabel("Predicted"); ax.set_ylabel("True")
        ax.set_title(f"Confusion Matrix — {horizon_label}")
        for i in range(2):
            for j in range(2):
                ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                        color="white" if cm[i, j] > cm.max() / 2 else "black")
        fig.tight_layout()
        fig.savefig(os.path.join(outputs_dir, f"confusion_onset_{horizon_label}.png"), dpi=120)
        plt.close(fig)
    except Exception as e:
        print(f"  [WARN] Confusion plot failed: {e}")

    # Feature importance (top 30)
    try:
        if hasattr(model, "feature_importances_"):
            imp = model.feature_importances_
            top_idx = np.argsort(imp)[-30:]
            fig, ax = plt.subplots(figsize=(8, 7))
            ax.barh([feat_cols[i] for i in top_idx], imp[top_idx])
            ax.set_title(f"Feature Importance — Onset {horizon_label}")
            ax.set_xlabel("Importance")
            fig.tight_layout()
            fig.savefig(os.path.join(outputs_dir,
                        f"feat_imp_onset_{horizon_label}.png"), dpi=120)
            plt.close(fig)

            # Feature family breakdown
            families = {
                "Basic stats": ["mean","median","std","iqr","skew","kurtosis","energy","snr","max","min"],
                "Temporal grad": ["trend","volatility","acceleration","max_gradient","mean_gradient_last60"],
                "Multi-scale": ["drift","std_ratio","rolling_mean_slope"],
                "Spectral": ["spectral","low_freq","low_mid"],
                "Morphology": ["rise_decay","pre_peak","post_peak"],
                "Rolling (G7)": ["rolling_mean_last60","rolling_std","rolling_max","rolling_snr"],
                "2nd-order (G8)": ["trend_last60","second_deriv"],
                "Peak evol (G9)": ["prominence_change","width_last"],
                "Lag": ["_lag"],
                "Delta": ["delta_"],
                "Roll window": ["roll3_","roll6_","roll12_"],
                "Slope": ["slope_"],
            }
            family_imp = {}
            for fname, keywords in families.items():
                total = sum(imp[i] for i, c in enumerate(feat_cols)
                            if any(k in c for k in keywords))
                family_imp[fname] = total

            fig, ax = plt.subplots(figsize=(8, 5))
            items = sorted(family_imp.items(), key=lambda x: x[1], reverse=True)
            ax.barh([x[0] for x in items], [x[1] for x in items])
            ax.set_title(f"Feature Family Importance — Onset {horizon_label}")
            ax.set_xlabel("Total Importance")
            fig.tight_layout()
            fig.savefig(os.path.join(outputs_dir,
                        f"family_imp_onset_{horizon_label}.png"), dpi=120)
            plt.close(fig)
    except Exception as e:
        print(f"  [WARN] Feature importance plot failed: {e}")


def _save_shap(model, X, feat_cols, horizon_label, outputs_dir):
    """Compute and save SHAP summary plot."""
    try:
        print(f"  Computing SHAP values (sample of 500)...")
        sample_size = min(500, len(X))
        idx = np.random.default_rng(0).choice(len(X), size=sample_size, replace=False)
        X_sample = X[idx]

        explainer   = shap.TreeExplainer(model)
        shap_values = explainer.shap_values(X_sample)

        if isinstance(shap_values, list):
            shap_vals = shap_values[1]
        else:
            shap_vals = shap_values

        fig, ax = plt.subplots(figsize=(9, 7))
        shap.summary_plot(shap_vals, X_sample, feature_names=feat_cols,
                          show=False, max_display=20)
        plt.title(f"SHAP Summary — Onset {horizon_label}")
        plt.tight_layout()
        plt.savefig(os.path.join(outputs_dir, f"shap_onset_{horizon_label}.png"),
                    dpi=120, bbox_inches="tight")
        plt.close("all")
        print(f"  SHAP saved → shap_onset_{horizon_label}.png")
    except Exception as e:
        print(f"  [WARN] SHAP failed: {e}")


# =============================================================================
# STAGE 5 — HORIZON COMPARISON SUMMARY
# =============================================================================

def print_summary(all_meta: list):
    """Print a clean comparison table across all forecast horizons."""
    sep = "=" * 75
    print(f"\n{sep}")
    print(f"  ONSET FORECAST — HORIZON COMPARISON SUMMARY")
    print(f"  Target: {FORECAST_TARGET} flares  |  Lookback: {N_LAGS*5} min  |  Gap: {MIN_QUIET_GAP*5} min quiet")
    print(sep)
    print(f"  {'Horizon':>8}  {'CV TSS':>9}  {'±':>6}  {'Pooled TSS':>11}  {'AUC':>7}  {'Sens':>7}  {'Spec':>7}  {'Thresh':>7}")
    print(f"  {'-'*8}  {'-'*9}  {'-'*6}  {'-'*11}  {'-'*7}  {'-'*7}  {'-'*7}  {'-'*7}")
    for m in sorted(all_meta, key=lambda x: list(HORIZONS.values()).index(x["horizon"])):
        print(
            f"  {m['horizon']:>8}  "
            f"{m['cv_tss_mean']:>+9.4f}  "
            f"{m['cv_tss_std']:>6.4f}  "
            f"{m['pooled_tss']:>+11.4f}  "
            f"{m['cv_auc_mean']:>7.4f}  "
            f"{m['pooled_sensitivity']:>7.4f}  "
            f"{m['pooled_specificity']:>7.4f}  "
            f"{m['optimal_threshold']:>7.3f}"
        )
    print(sep)
    print("  TSS > 0 = skill above random. Target: TSS > 0.30 for operational use.")
    print("  Sensitivity = fraction of real onset events caught (higher = fewer missed flares).")
    print("  Specificity = fraction of quiet windows correctly identified (lower FP rate).\n")

    best = max(all_meta, key=lambda x: x["pooled_tss"])
    print(f"  Best horizon: {best['horizon']}  (Pooled TSS={best['pooled_tss']:+.4f})")
    print(f"  Use model: lgbm_onset_{best['horizon']}.pkl at threshold {best['optimal_threshold']:.3f}")
    print(sep)


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Solar flare onset forecasting pipeline")
    parser.add_argument("--input",   default="../data/processed/dataset_research_v5.csv")
    parser.add_argument("--models",  default="../models")
    parser.add_argument("--outputs", default="../outputs")
    parser.add_argument("--no_shap", action="store_true", help="Skip SHAP analysis")
    parser.add_argument("--quick",   action="store_true", help="Use 30 percent of data")
    parser.add_argument("--target",  default=FORECAST_TARGET, choices=["CMX", "MX"])
    parser.add_argument("--gap",     default=MIN_QUIET_GAP, type=int)
    args = parser.parse_args()

    os.makedirs(args.models,  exist_ok=True)
    os.makedirs(args.outputs, exist_ok=True)

    t0 = time.time()

    print("=" * 65)
    print("  SOLAR FLARE ONSET FORECASTING PIPELINE")
    print(f"  Input     : {args.input}")
    print(f"  Target    : {args.target} flares")
    print(f"  Gap       : {args.gap} windows = {args.gap*5} min quiet required")
    print(f"  Lookback  : {N_LAGS} windows = {N_LAGS*5} min")
    print(f"  Horizons  : {list(HORIZONS.values())}")
    print(f"  Model     : {'LightGBM' if LGB_AVAILABLE else 'sklearn GBM'}")
    if args.quick:
        print(f"  [QUICK MODE] Using 30 percent of data")
    print("=" * 65)

    # ── Load ──────────────────────────────────────────────────────────────────
    print(f"\n[LOAD] {args.input}")
    df = pd.read_csv(args.input)
    print(f"  Shape: {df.shape}")
    print(f"  Source files: {df['source_file'].nunique() if 'source_file' in df.columns else 'N/A'}")

    if "source_file" not in df.columns:
        print("[ERROR] 'source_file' column required for temporal cross-validation.")
        print("        Re-run features_v2.py to regenerate the dataset.")
        return

    if args.quick:
        df = df.sample(frac=0.3, random_state=42).reset_index(drop=True)

    # ── Stage 1: Onset labeling ───────────────────────────────────────────────
    df = build_onset_labels(df, forecast_target=args.target, min_quiet_gap=args.gap)

    # ── Stages 2-4: Per-horizon training ─────────────────────────────────────
    all_meta = []

    for shift, hlabel in HORIZONS.items():
        print(f"\n[STAGE 2] Building lag features for horizon {hlabel} (shift={shift})")
        df_feat = build_lag_features(
            df, horizon_shift=shift,
            base_features=BASE_FEATURES, n_lags=N_LAGS,
        )
        n_pos = df_feat["label_onset_future"].sum()
        print(f"  Dataset: {len(df_feat):,} rows  |  {int(n_pos):,} onsets  "
              f"({100*n_pos/len(df_feat):.2f}%)")

        if n_pos < 10:
            print(f"  [SKIP] Too few onset events ({n_pos}) for reliable training.")
            continue

        # Save interim dataset for inspection
        interim_path = os.path.join(
            os.path.dirname(args.input),
            f"lag_{N_LAGS}_onset_{hlabel}.csv"
        )
        df_feat.to_csv(interim_path, index=False)
        print(f"  Saved interim dataset → {interim_path}")

        meta = train_horizon(
            df_feat, horizon_label=hlabel,
            models_dir=args.models, outputs_dir=args.outputs,
            no_shap=args.no_shap, quick=False,
        )
        all_meta.append(meta)

    # ── Stage 5: Summary ──────────────────────────────────────────────────────
    if all_meta:
        print_summary(all_meta)

        summary_path = os.path.join(args.outputs, "onset_horizon_summary.json")
        with open(summary_path, "w") as f:
            json.dump(all_meta, f, indent=2)
        print(f"[INFO] Summary saved → {summary_path}")

    elapsed = time.time() - t0
    print(f"\n[DONE] Total time: {elapsed/60:.1f} min")


if __name__ == "__main__":
    main()


# =============================================================================
# INFERENCE EXAMPLE — how to use a saved onset model
# =============================================================================
#
# import joblib, numpy as np
#
# bundle = joblib.load("../models/lgbm_onset_30min.pkl")
# model      = bundle["model"]
# feat_cols  = bundle["feature_cols"]
# threshold  = bundle["threshold"]
#
# # x_new must be a 1-row array with all feature columns in correct order
# # Build it from your real-time feature extractor output
# prob = model.predict_proba(x_new)[0, 1]
# alert = prob >= threshold
# print(f"Flare onset probability (30min): {prob:.3f}  Alert: {alert}")
#
# =============================================================================
