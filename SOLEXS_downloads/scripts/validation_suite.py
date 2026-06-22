"""
validation_suite.py  —  Scientific Validation for Solar Flare Onset Forecasting
=================================================================================
Implements the four credibility-strengthening steps:

  Step 1 — Leave-One-Month-Out (LOMO) cross-validation
           Validates on completely unseen observation periods.
           Prevents temporal leakage that StratifiedGroupKFold can miss
           when multiple files from the same month exist.

  Step 2 — Multi-model comparison
           LightGBM vs XGBoost vs Logistic Regression vs MLP
           All evaluated identically so comparison is fair.

  Step 3 — Probability calibration
           Platt scaling (LogisticRegression on model outputs) and
           Isotonic regression. Reliability diagrams show whether
           "70% confidence" actually means 70% of the time.

  Step 4 — Feature ablation
           Trains with each feature GROUP removed in turn.
           Quantifies how much TSS each group contributes.
           Separates "nice to have" from "essential" features.

HOW TO RUN
----------
  # Full suite on 30min horizon (recommended first run):
  python validation_suite.py --horizon 30min

  # Quick test (fast, uses subset of data):
  python validation_suite.py --horizon 30min --quick

  # All three horizons:
  python validation_suite.py --all_horizons

  # Skip slow steps:
  python validation_suite.py --horizon 30min --no_calibration --no_ablation

OUTPUTS
-------
  ../results/validation/
    lomo_results_{horizon}.csv          ← per-month LOMO metrics
    model_comparison_{horizon}.csv      ← TSS/AUC per model family
    calibration_{horizon}.png           ← reliability diagram
    ablation_{horizon}.csv              ← TSS drop per feature group
    ablation_{horizon}.png              ← ablation bar chart
    validation_summary_{horizon}.json   ← all results in one file

REQUIREMENTS
------------
  pip install lightgbm xgboost shap
  (sklearn, scipy, matplotlib already installed)
"""

import argparse
import json
import os
import time
import warnings

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.special import expit
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score, average_precision_score, confusion_matrix
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import Pipeline

warnings.filterwarnings("ignore")

try:
    import lightgbm as lgb
    LGB_AVAILABLE = True
except ImportError:
    LGB_AVAILABLE = False
    print("[WARN] lightgbm not installed. Run: pip install lightgbm")

try:
    import xgboost as xgb
    XGB_AVAILABLE = True
except ImportError:
    XGB_AVAILABLE = False
    print("[WARN] xgboost not installed. Run: pip install xgboost")


# =============================================================================
# CONFIG
# =============================================================================

DATA_DIR    = "../data/processed"
RESULTS_DIR = "../results/validation"
MODELS_DIR  = "../models"

# Horizon → interim lag dataset filename (produced by onset_pipeline.py)
HORIZON_FILES = {
    "5min":  "lag_12_onset_5min.csv",
    "30min": "lag_12_onset_30min.csv",
    "60min": "lag_12_onset_60min.csv",
}

TARGET_COL   = "label_onset_future"
SOURCE_COL   = "source_file"

# Feature groups for ablation study
# Keys = group names, values = substrings that identify columns belonging to that group
FEATURE_GROUPS = {
    "Basic stats":      ["mean", "median", "std", "iqr", "skew", "kurtosis",
                         "energy", "snr", "max", "min"],
    "Temporal grad":    ["trend", "volatility", "acceleration", "max_gradient",
                         "mean_gradient_last60"],
    "Multi-scale":      ["drift_t1_t3", "std_ratio_t3_t1", "rolling_mean_slope"],
    "Spectral":         ["spectral_entropy", "low_freq_power", "low_mid_power_ratio"],
    "Morphology":       ["rise_decay_asymmetry", "pre_peak_slope", "post_peak_slope"],
    "Rolling (G7)":     ["rolling_mean_last60", "rolling_std_last60",
                         "rolling_max_last60", "rolling_snr_last60"],
    "2nd-order (G8)":   ["trend_last60_vs_full", "second_deriv_max"],
    "Peak evol (G9)":   ["prominence_change", "width_last_vs_first"],
    "Lag features":     ["_lag"],
    "Delta features":   ["delta_"],
    "Roll window":      ["roll3_", "roll6_", "roll12_"],
    "Slope features":   ["slope_"],
}

# LightGBM params (same as onset_pipeline.py for fair comparison)
LGB_PARAMS = {
    "objective": "binary", "metric": "auc", "boosting_type": "gbdt",
    "learning_rate": 0.01, "n_estimators": 2000, "num_leaves": 127,
    "max_depth": -1, "min_child_samples": 5, "feature_fraction": 0.80,
    "bagging_fraction": 0.80, "bagging_freq": 1, "random_state": 42,
    "n_jobs": -1, "verbose": -1,
}

XGB_PARAMS = {
    "objective": "binary:logistic", "eval_metric": "auc",
    "n_estimators": 500, "max_depth": 6, "learning_rate": 0.05,
    "subsample": 0.8, "colsample_bytree": 0.8, "min_child_weight": 3,
    "random_state": 42, "n_jobs": -1, "verbosity": 0,
}


# =============================================================================
# SHARED UTILITIES
# =============================================================================

def compute_metrics(y_true, y_prob, threshold=0.5) -> dict:
    y_pred = (y_prob >= threshold).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred, labels=[0, 1]).ravel()
    sens = tp / (tp + fn + 1e-9)
    spec = tn / (tn + fp + 1e-9)
    prec = tp / (tp + fp + 1e-9)
    f1   = 2 * prec * sens / (prec + sens + 1e-9)
    tss  = sens + spec - 1.0
    num  = 2 * (tp * tn - fp * fn)
    den  = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)
    hss  = num / den if den > 0 else 0.0
    try:
        auc = roc_auc_score(y_true, y_prob)
    except Exception:
        auc = 0.5
    try:
        ap = average_precision_score(y_true, y_prob)
    except Exception:
        ap = 0.0
    return {"tss": round(tss, 4), "hss": round(hss, 4), "auc": round(auc, 4),
            "avg_prec": round(ap, 4), "sensitivity": round(sens, 4),
            "specificity": round(spec, 4), "precision": round(prec, 4),
            "f1": round(f1, 4), "threshold": round(threshold, 4),
            "tp": int(tp), "tn": int(tn), "fp": int(fp), "fn": int(fn)}


def find_optimal_threshold(y_true, y_prob) -> float:
    best_tss, best_t = -1.0, 0.5
    for t in np.linspace(0.02, 0.95, 94):
        m = compute_metrics(y_true, y_prob, threshold=t)
        if m["tss"] > best_tss:
            best_tss, best_t = m["tss"], t
    return round(best_t, 3)


def load_horizon_data(horizon: str, data_dir: str, quick: bool = False):
    fname = HORIZON_FILES.get(horizon)
    if fname is None:
        raise ValueError(f"Unknown horizon: {horizon}. Choose from {list(HORIZON_FILES)}")
    path = os.path.join(data_dir, fname)
    if not os.path.exists(path):
        raise FileNotFoundError(
            f"Lag dataset not found: {path}\n"
            f"Run onset_pipeline.py first to generate it."
        )
    df = pd.read_csv(path)
    if quick:
        df = df.sample(frac=0.3, random_state=42).reset_index(drop=True)
    feat_cols = [c for c in df.columns if c not in (TARGET_COL, SOURCE_COL)]
    return df, feat_cols


def extract_month(source_file: str) -> str:
    """Extract YYYYMM from filenames like AL1_SOLEXS_20250614_SDD2_L1.lc.gz"""
    import re
    m = re.search(r"(\d{6})\d{2}", source_file)
    return m.group(1) if m else "unknown"


def build_lgbm(spw: float):
    if not LGB_AVAILABLE:
        raise ImportError("lightgbm not installed")
    return lgb.LGBMClassifier(**{**LGB_PARAMS, "scale_pos_weight": spw})


def build_xgb(spw: float):
    if not XGB_AVAILABLE:
        raise ImportError("xgboost not installed")
    return xgb.XGBClassifier(**{**XGB_PARAMS, "scale_pos_weight": spw})


def fit_predict(model, X_tr, y_tr, X_val, spw=None):
    """Fit model and return probability predictions on validation set."""
    if LGB_AVAILABLE and isinstance(model, lgb.LGBMClassifier):
        model.fit(
            X_tr, y_tr,
            eval_set=[(X_val, np.zeros(len(X_val)))],
            callbacks=[lgb.early_stopping(50, verbose=False),
                       lgb.log_evaluation(-1)],
        )
    else:
        model.fit(X_tr, y_tr)
    return model.predict_proba(X_val)[:, 1]


# =============================================================================
# STEP 1 — LEAVE-ONE-MONTH-OUT CROSS-VALIDATION
# =============================================================================

def run_lomo(df: pd.DataFrame, feat_cols: list, horizon: str,
             results_dir: str) -> pd.DataFrame:
    """
    Leave-One-Month-Out cross-validation.

    For each calendar month present in the dataset:
      - Train on all windows NOT from that month
      - Validate on windows from that month only

    This is strictly stronger than StratifiedGroupKFold because it tests
    generalisation to completely unseen time periods, not just unseen files
    from the same time period.

    Key question answered: does the model work on months it has never seen?
    """
    print(f"\n{'='*65}")
    print(f"  STEP 1: Leave-One-Month-Out CV  ({horizon})")
    print(f"{'='*65}")

    df = df.copy()
    df["month"] = df[SOURCE_COL].apply(extract_month)
    months = sorted(df["month"].unique())
    months = [m for m in months if m != "unknown"]

    print(f"  Months available: {len(months)}  ({months[0]} → {months[-1]})")

    X_all = df[feat_cols].values
    y_all = df[TARGET_COL].values

    records = []
    all_y_true, all_y_prob, all_months = [], [], []

    for month in months:
        test_mask  = df["month"] == month
        train_mask = ~test_mask

        X_tr, y_tr = X_all[train_mask], y_all[train_mask]
        X_val, y_val = X_all[test_mask], y_all[test_mask]

        n_pos_val = y_val.sum()
        if n_pos_val < 2:
            print(f"  Month {month}: skipped (only {n_pos_val} onset events in test)")
            continue

        n_pos_tr = y_tr.sum()
        spw = (len(y_tr) - n_pos_tr) / max(n_pos_tr, 1)

        if LGB_AVAILABLE:
            model = build_lgbm(spw)
            y_prob = fit_predict(model, X_tr, y_tr, X_val)
        else:
            from sklearn.ensemble import GradientBoostingClassifier
            model = GradientBoostingClassifier(n_estimators=200, max_depth=5,
                                               learning_rate=0.05, random_state=42)
            model.fit(X_tr, y_tr)
            y_prob = model.predict_proba(X_val)[:, 1]

        opt_thresh = find_optimal_threshold(y_val, y_prob)
        m = compute_metrics(y_val, y_prob, threshold=opt_thresh)

        record = {"month": month, "n_test": int(len(y_val)),
                  "n_onsets": int(n_pos_val), **m}
        records.append(record)
        all_y_true.extend(y_val)
        all_y_prob.extend(y_prob)
        all_months.extend([month] * len(y_val))

        print(f"  Month {month}: TSS={m['tss']:+.4f}  AUC={m['auc']:.4f}  "
              f"sens={m['sensitivity']:.4f}  spec={m['specificity']:.4f}  "
              f"n_onsets={n_pos_val}")

    df_results = pd.DataFrame(records)

    # Summary stats
    tss_vals = df_results["tss"].values
    auc_vals = df_results["auc"].values
    print(f"\n  LOMO Summary across {len(df_results)} months:")
    print(f"    TSS : {np.mean(tss_vals):+.4f} ± {np.std(tss_vals):.4f}  "
          f"[min={np.min(tss_vals):+.4f}, max={np.max(tss_vals):+.4f}]")
    print(f"    AUC : {np.mean(auc_vals):.4f} ± {np.std(auc_vals):.4f}")

    # Pooled across all months
    all_y_true = np.array(all_y_true)
    all_y_prob = np.array(all_y_prob)
    opt_thresh_pooled = find_optimal_threshold(all_y_true, all_y_prob)
    pooled = compute_metrics(all_y_true, all_y_prob, threshold=opt_thresh_pooled)
    print(f"    Pooled TSS (all months): {pooled['tss']:+.4f}  "
          f"Sens={pooled['sensitivity']:.4f}  Spec={pooled['specificity']:.4f}")

    # Save
    out_path = os.path.join(results_dir, f"lomo_results_{horizon}.csv")
    df_results.to_csv(out_path, index=False)
    print(f"  Saved → {out_path}")

    # Plot TSS by month
    try:
        fig, ax = plt.subplots(figsize=(10, 4))
        colors = ["#d62728" if t < 0 else "#2ca02c" if t > 0.3 else "#ff7f0e"
                  for t in df_results["tss"]]
        ax.bar(df_results["month"], df_results["tss"], color=colors)
        ax.axhline(0, color="black", lw=0.8, ls="--")
        ax.axhline(np.mean(tss_vals), color="blue", lw=1.5, ls="-",
                   label=f"Mean TSS = {np.mean(tss_vals):+.3f}")
        ax.set_xlabel("Calendar Month")
        ax.set_ylabel("TSS")
        ax.set_title(f"LOMO Cross-Validation — Onset {horizon}")
        ax.legend()
        plt.xticks(rotation=45, ha="right")
        fig.tight_layout()
        fig.savefig(os.path.join(results_dir, f"lomo_tss_{horizon}.png"), dpi=120)
        plt.close(fig)
    except Exception as e:
        print(f"  [WARN] LOMO plot failed: {e}")

    return df_results


# =============================================================================
# STEP 2 — MULTI-MODEL COMPARISON
# =============================================================================

def run_model_comparison(df: pd.DataFrame, feat_cols: list, horizon: str,
                         results_dir: str) -> pd.DataFrame:
    """
    Train and evaluate multiple model families under identical conditions.

    Models compared:
      - LightGBM       (gradient boosting, our primary model)
      - XGBoost        (gradient boosting, different regularisation)
      - Logistic Reg.  (linear baseline — if this is close to LGB, features matter more than model)
      - MLP            (shallow neural network — tests non-linear capacity beyond trees)

    All use the same 5-fold LOMO-style split for fair comparison.
    """
    print(f"\n{'='*65}")
    print(f"  STEP 2: Multi-Model Comparison  ({horizon})")
    print(f"{'='*65}")

    df = df.copy()
    df["month"] = df[SOURCE_COL].apply(extract_month)
    months = sorted(m for m in df["month"].unique() if m != "unknown")

    # Use first 5 months as a fast but fair comparison split
    # (full LOMO already done in Step 1 — here we want speed + breadth)
    if len(months) >= 6:
        # 5-fold: each fold = leave out ~20% of months
        fold_size = max(1, len(months) // 5)
        folds = [months[i:i+fold_size] for i in range(0, len(months), fold_size)][:5]
    else:
        folds = [[m] for m in months]

    X_all = df[feat_cols].values
    y_all = df[TARGET_COL].values
    spw_global = (y_all == 0).sum() / max((y_all == 1).sum(), 1)

    # Define models
    model_factories = {"LogisticReg": lambda spw: Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(C=0.1, class_weight="balanced",
                                   max_iter=1000, random_state=42)),
    ])}

    model_factories["MLP"] = lambda spw: Pipeline([
        ("scaler", StandardScaler()),
        ("clf", MLPClassifier(hidden_layer_sizes=(128, 64), activation="relu",
                              max_iter=200, random_state=42, early_stopping=True)),
    ])

    if LGB_AVAILABLE:
        model_factories["LightGBM"] = build_lgbm
    if XGB_AVAILABLE:
        model_factories["XGBoost"] = build_xgb

    records = []

    for model_name, factory in model_factories.items():
        print(f"\n  Model: {model_name}")
        fold_metrics = []

        for fold_i, test_months in enumerate(folds, 1):
            test_mask  = df["month"].isin(test_months)
            train_mask = ~test_mask

            if train_mask.sum() < 50 or test_mask.sum() < 10:
                continue

            X_tr, y_tr = X_all[train_mask], y_all[train_mask]
            X_val, y_val = X_all[test_mask], y_all[test_mask]

            if y_val.sum() < 2:
                continue

            spw = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)

            try:
                t0 = time.time()
                model = factory(spw)
                if LGB_AVAILABLE and isinstance(model, lgb.LGBMClassifier):
                    y_prob = fit_predict(model, X_tr, y_tr, X_val)
                else:
                    model.fit(X_tr, y_tr)
                    y_prob = model.predict_proba(X_val)[:, 1]
                elapsed = time.time() - t0

                opt_t = find_optimal_threshold(y_val, y_prob)
                m = compute_metrics(y_val, y_prob, threshold=opt_t)
                fold_metrics.append(m)
                print(f"    Fold {fold_i} ({','.join(test_months)}): "
                      f"TSS={m['tss']:+.4f}  AUC={m['auc']:.4f}  "
                      f"({elapsed:.1f}s)")
            except Exception as e:
                print(f"    Fold {fold_i}: FAILED — {e}")
                continue

        if not fold_metrics:
            continue

        mean_tss = np.mean([m["tss"] for m in fold_metrics])
        std_tss  = np.std( [m["tss"] for m in fold_metrics])
        mean_auc = np.mean([m["auc"] for m in fold_metrics])
        mean_sens = np.mean([m["sensitivity"] for m in fold_metrics])
        mean_spec = np.mean([m["specificity"] for m in fold_metrics])

        print(f"    → TSS: {mean_tss:+.4f} ± {std_tss:.4f}  "
              f"AUC: {mean_auc:.4f}  Sens: {mean_sens:.4f}  Spec: {mean_spec:.4f}")

        records.append({
            "model": model_name, "n_folds": len(fold_metrics),
            "tss_mean": round(mean_tss, 4), "tss_std": round(std_tss, 4),
            "auc_mean": round(mean_auc, 4),
            "sens_mean": round(mean_sens, 4), "spec_mean": round(mean_spec, 4),
        })

    df_cmp = pd.DataFrame(records).sort_values("tss_mean", ascending=False)

    print(f"\n  Model Comparison Summary:")
    print(f"  {'Model':15s}  {'TSS':>9}  {'±':>6}  {'AUC':>7}  {'Sens':>7}  {'Spec':>7}")
    print(f"  {'-'*15}  {'-'*9}  {'-'*6}  {'-'*7}  {'-'*7}  {'-'*7}")
    for _, row in df_cmp.iterrows():
        print(f"  {row['model']:15s}  {row['tss_mean']:>+9.4f}  "
              f"{row['tss_std']:>6.4f}  {row['auc_mean']:>7.4f}  "
              f"{row['sens_mean']:>7.4f}  {row['spec_mean']:>7.4f}")

    out_path = os.path.join(results_dir, f"model_comparison_{horizon}.csv")
    df_cmp.to_csv(out_path, index=False)
    print(f"  Saved → {out_path}")

    # Bar chart comparison
    try:
        fig, axes = plt.subplots(1, 3, figsize=(12, 4))
        for ax, metric, label in zip(axes, ["tss_mean", "auc_mean", "sens_mean"],
                                     ["TSS", "AUC", "Sensitivity"]):
            vals = df_cmp[metric].values
            errs = df_cmp.get("tss_std", pd.Series([0]*len(df_cmp))).values if metric == "tss_mean" else None
            bars = ax.bar(df_cmp["model"], vals, yerr=errs if metric=="tss_mean" else None,
                          capsize=4, color=["#1f77b4","#ff7f0e","#2ca02c","#d62728"][:len(vals)])
            ax.set_ylabel(label)
            ax.set_title(f"{label} by Model — {horizon}")
            ax.tick_params(axis="x", rotation=15)
            if metric == "tss_mean":
                ax.axhline(0, color="black", lw=0.8, ls="--")
        fig.tight_layout()
        fig.savefig(os.path.join(results_dir, f"model_comparison_{horizon}.png"), dpi=120)
        plt.close(fig)
    except Exception as e:
        print(f"  [WARN] Comparison plot failed: {e}")

    return df_cmp


# =============================================================================
# STEP 3 — PROBABILITY CALIBRATION
# =============================================================================

def run_calibration(df: pd.DataFrame, feat_cols: list, horizon: str,
                    results_dir: str) -> dict:
    """
    Calibrate the LightGBM probability outputs so predicted probabilities
    are reliable — "P=0.7" should mean the event occurs 70% of the time.

    Two methods compared:
      - Platt scaling  (logistic regression on raw model scores)
      - Isotonic       (non-parametric monotonic mapping)

    Reliability diagram: shows calibrated vs uncalibrated probability curves.
    Expected Calibration Error (ECE) quantifies calibration quality.
    """
    if not LGB_AVAILABLE:
        print("\n  [SKIP] Calibration requires LightGBM.")
        return {}

    print(f"\n{'='*65}")
    print(f"  STEP 3: Probability Calibration  ({horizon})")
    print(f"{'='*65}")

    # Use a simple train/calibration/test split by time
    # (sort by source file date, use last 20% as test)
    df = df.copy()
    df["month"] = df[SOURCE_COL].apply(extract_month)
    months_sorted = sorted(m for m in df["month"].unique() if m != "unknown")

    if len(months_sorted) < 3:
        print("  [SKIP] Not enough months for calibration split.")
        return {}

    n_test_months = max(1, len(months_sorted) // 5)
    test_months  = months_sorted[-n_test_months:]
    calib_months = months_sorted[-(2*n_test_months):-n_test_months]
    train_months = months_sorted[:-(2*n_test_months)]

    print(f"  Train months : {train_months[0]} → {train_months[-1]} ({len(train_months)} months)")
    print(f"  Calib months : {calib_months} ({len(calib_months)} months)")
    print(f"  Test months  : {test_months} ({len(test_months)} months)")

    train_mask = df["month"].isin(train_months)
    calib_mask = df["month"].isin(calib_months)
    test_mask  = df["month"].isin(test_months)

    X_all = df[feat_cols].values
    y_all = df[TARGET_COL].values

    X_tr, y_tr = X_all[train_mask], y_all[train_mask]
    X_cal, y_cal = X_all[calib_mask], y_all[calib_mask]
    X_te, y_te  = X_all[test_mask],  y_all[test_mask]

    if y_te.sum() < 2 or y_cal.sum() < 2:
        print("  [SKIP] Not enough positive samples in calibration/test splits.")
        return {}

    spw = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)

    # Base model
    base_model = build_lgbm(spw)
    base_model.fit(X_tr, y_tr, callbacks=[lgb.log_evaluation(-1)])
    prob_raw_cal = base_model.predict_proba(X_cal)[:, 1]
    prob_raw_te  = base_model.predict_proba(X_te)[:, 1]

    # Platt scaling (logistic regression on log-odds)
    platt = LogisticRegression(C=1.0, random_state=42)
    platt.fit(prob_raw_cal.reshape(-1, 1), y_cal)
    prob_platt = platt.predict_proba(prob_raw_te.reshape(-1, 1))[:, 1]

    # Isotonic regression
    from sklearn.isotonic import IsotonicRegression
    iso = IsotonicRegression(out_of_bounds="clip")
    iso.fit(prob_raw_cal, y_cal)
    prob_iso = iso.predict(prob_raw_te)

    def ece(y_true, y_prob, n_bins=10):
        """Expected Calibration Error."""
        bins = np.linspace(0, 1, n_bins + 1)
        total_ece = 0.0
        for lo, hi in zip(bins[:-1], bins[1:]):
            mask = (y_prob >= lo) & (y_prob < hi)
            if mask.sum() == 0:
                continue
            acc = y_true[mask].mean()
            conf = y_prob[mask].mean()
            total_ece += mask.sum() * abs(acc - conf)
        return total_ece / len(y_true)

    ece_raw   = ece(y_te, prob_raw_te)
    ece_platt = ece(y_te, prob_platt)
    ece_iso   = ece(y_te, prob_iso)

    print(f"  ECE (uncalibrated) : {ece_raw:.4f}")
    print(f"  ECE (Platt)        : {ece_platt:.4f}")
    print(f"  ECE (Isotonic)     : {ece_iso:.4f}")

    opt_t_raw   = find_optimal_threshold(y_te, prob_raw_te)
    opt_t_platt = find_optimal_threshold(y_te, prob_platt)
    opt_t_iso   = find_optimal_threshold(y_te, prob_iso)

    m_raw   = compute_metrics(y_te, prob_raw_te,   threshold=opt_t_raw)
    m_platt = compute_metrics(y_te, prob_platt,    threshold=opt_t_platt)
    m_iso   = compute_metrics(y_te, prob_iso,      threshold=opt_t_iso)

    print(f"  TSS (uncalibrated) : {m_raw['tss']:+.4f}  (threshold={opt_t_raw})")
    print(f"  TSS (Platt)        : {m_platt['tss']:+.4f}  (threshold={opt_t_platt})")
    print(f"  TSS (Isotonic)     : {m_iso['tss']:+.4f}  (threshold={opt_t_iso})")

    # Reliability diagram
    try:
        fig, axes = plt.subplots(1, 2, figsize=(11, 5))
        ax_rel, ax_hist = axes

        for probs, name, color in [
            (prob_raw_te, "Uncalibrated", "#1f77b4"),
            (prob_platt,  "Platt",        "#ff7f0e"),
            (prob_iso,    "Isotonic",     "#2ca02c"),
        ]:
            try:
                frac_pos, mean_pred = calibration_curve(y_te, probs, n_bins=10,
                                                        strategy="quantile")
                ax_rel.plot(mean_pred, frac_pos, "s-", color=color,
                            label=f"{name} (ECE={ece(y_te,probs):.3f})", markersize=4)
            except Exception:
                pass

        ax_rel.plot([0, 1], [0, 1], "k--", lw=1, label="Perfect calibration")
        ax_rel.set_xlabel("Mean predicted probability")
        ax_rel.set_ylabel("Fraction of positives")
        ax_rel.set_title(f"Reliability Diagram — Onset {horizon}")
        ax_rel.legend(fontsize=8)

        # Histogram of probabilities
        ax_hist.hist(prob_raw_te[y_te==0], bins=40, alpha=0.6,
                     color="#1f77b4", label="Quiet (true neg)", density=True)
        ax_hist.hist(prob_raw_te[y_te==1], bins=40, alpha=0.6,
                     color="#d62728", label="Onset (true pos)", density=True)
        ax_hist.axvline(opt_t_raw, color="black", ls="--",
                        label=f"Threshold={opt_t_raw}")
        ax_hist.set_xlabel("Predicted probability")
        ax_hist.set_ylabel("Density")
        ax_hist.set_title(f"Score Distribution — {horizon}")
        ax_hist.legend(fontsize=8)

        fig.tight_layout()
        fig.savefig(os.path.join(results_dir, f"calibration_{horizon}.png"), dpi=120)
        plt.close(fig)
        print(f"  Saved → calibration_{horizon}.png")
    except Exception as e:
        print(f"  [WARN] Calibration plot failed: {e}")

    # Save calibrated model
    calib_bundle = {
        "base_model": base_model,
        "platt_scaler": platt,
        "isotonic": iso,
        "feature_cols": feat_cols,
        "ece_raw": round(ece_raw, 4),
        "ece_platt": round(ece_platt, 4),
        "ece_iso": round(ece_iso, 4),
        "optimal_threshold_platt": opt_t_platt,
        "optimal_threshold_iso": opt_t_iso,
    }
    joblib.dump(calib_bundle,
                os.path.join(MODELS_DIR, f"lgbm_onset_{horizon}_calibrated.pkl"))
    print(f"  Calibrated model saved → lgbm_onset_{horizon}_calibrated.pkl")

    return {"ece_raw": ece_raw, "ece_platt": ece_platt, "ece_iso": ece_iso,
            "tss_raw": m_raw["tss"], "tss_platt": m_platt["tss"],
            "tss_iso": m_iso["tss"]}


# =============================================================================
# STEP 4 — FEATURE ABLATION
# =============================================================================

def run_ablation(df: pd.DataFrame, feat_cols: list, horizon: str,
                 results_dir: str) -> pd.DataFrame:
    """
    Feature group ablation study.

    For each feature group:
      1. Remove all columns belonging to that group
      2. Retrain on the reduced feature set
      3. Measure TSS drop vs full model

    TSS drop = TSS(full) - TSS(without group)
    Large drop = that group is essential.
    Small drop = that group is redundant or captured elsewhere.

    Uses a single train/test month split for speed.
    """
    print(f"\n{'='*65}")
    print(f"  STEP 4: Feature Ablation  ({horizon})")
    print(f"{'='*65}")

    df = df.copy()
    df["month"] = df[SOURCE_COL].apply(extract_month)
    months_sorted = sorted(m for m in df["month"].unique() if m != "unknown")

    if len(months_sorted) < 2:
        print("  [SKIP] Need at least 2 months for ablation split.")
        return pd.DataFrame()

    n_test = max(1, len(months_sorted) // 5)
    test_months  = months_sorted[-n_test:]
    train_months = months_sorted[:-n_test]

    train_mask = df["month"].isin(train_months)
    test_mask  = df["month"].isin(test_months)

    X_all = df[feat_cols].values
    y_all = df[TARGET_COL].values

    X_tr, y_tr = X_all[train_mask], y_all[train_mask]
    X_te, y_te = X_all[test_mask],  y_all[test_mask]

    if y_te.sum() < 2:
        print("  [SKIP] Not enough onsets in test split.")
        return pd.DataFrame()

    spw = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)

    def train_eval(X_tr_, y_tr_, X_te_, spw_):
        if LGB_AVAILABLE:
            m = build_lgbm(spw_)
            m.fit(X_tr_, y_tr_, callbacks=[lgb.log_evaluation(-1)])
        else:
            from sklearn.ensemble import GradientBoostingClassifier
            m = GradientBoostingClassifier(n_estimators=200, max_depth=5,
                                           learning_rate=0.05, random_state=42)
            m.fit(X_tr_, y_tr_)
        probs = m.predict_proba(X_te_)[:, 1]
        thresh = find_optimal_threshold(y_te, probs)
        return compute_metrics(y_te, probs, threshold=thresh)["tss"]

    # Full model baseline
    print(f"  Training full model baseline...")
    tss_full = train_eval(X_tr, y_tr, X_te, spw)
    print(f"  Full model TSS: {tss_full:+.4f}")

    records = []
    feat_arr = np.array(feat_cols)

    for group_name, keywords in FEATURE_GROUPS.items():
        # Find columns belonging to this group
        group_mask = np.zeros(len(feat_cols), dtype=bool)
        for kw in keywords:
            for i, col in enumerate(feat_cols):
                if kw in col:
                    group_mask[i] = True

        n_removed = group_mask.sum()
        if n_removed == 0:
            print(f"  {group_name:20s}: 0 features found — skipping")
            continue

        keep_mask = ~group_mask
        X_tr_abl = X_tr[:, keep_mask]
        X_te_abl = X_te[:, keep_mask]

        tss_abl = train_eval(X_tr_abl, y_tr, X_te_abl, spw)
        tss_drop = tss_full - tss_abl

        records.append({
            "group": group_name,
            "n_features_removed": int(n_removed),
            "tss_without": round(tss_abl, 4),
            "tss_drop": round(tss_drop, 4),
        })

        importance = "CRITICAL" if tss_drop > 0.10 else \
                     "Important" if tss_drop > 0.03 else \
                     "Marginal"  if tss_drop > 0.00 else "Redundant"

        print(f"  {group_name:20s}: removed {n_removed:3d} features  "
              f"TSS={tss_abl:+.4f}  drop={tss_drop:+.4f}  [{importance}]")

    df_abl = pd.DataFrame(records).sort_values("tss_drop", ascending=False)

    out_path = os.path.join(results_dir, f"ablation_{horizon}.csv")
    df_abl.to_csv(out_path, index=False)
    print(f"  Saved → {out_path}")

    # Ablation bar chart
    try:
        fig, ax = plt.subplots(figsize=(9, 5))
        colors = ["#d62728" if d > 0.10 else "#ff7f0e" if d > 0.03
                  else "#2ca02c" if d > 0 else "#aec7e8"
                  for d in df_abl["tss_drop"]]
        ax.barh(df_abl["group"], df_abl["tss_drop"], color=colors)
        ax.axvline(0, color="black", lw=0.8)
        ax.set_xlabel("TSS drop (higher = more important)")
        ax.set_title(f"Feature Group Ablation — Onset {horizon}\n"
                     f"Full model TSS = {tss_full:+.4f}")
        ax.invert_yaxis()

        # Legend
        from matplotlib.patches import Patch
        legend = [Patch(color="#d62728", label="CRITICAL (>0.10 drop)"),
                  Patch(color="#ff7f0e", label="Important (0.03–0.10)"),
                  Patch(color="#2ca02c", label="Marginal (0–0.03)"),
                  Patch(color="#aec7e8", label="Redundant (<0 drop)")]
        ax.legend(handles=legend, fontsize=8, loc="lower right")

        fig.tight_layout()
        fig.savefig(os.path.join(results_dir, f"ablation_{horizon}.png"), dpi=120)
        plt.close(fig)
    except Exception as e:
        print(f"  [WARN] Ablation plot failed: {e}")

    return df_abl


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Scientific validation suite for solar flare onset forecasting"
    )
    parser.add_argument("--horizon",        default="30min",
                        choices=list(HORIZON_FILES.keys()))
    parser.add_argument("--all_horizons",   action="store_true",
                        help="Run all three horizons sequentially")
    parser.add_argument("--quick",          action="store_true",
                        help="Use 30 percent of data for fast testing")
    parser.add_argument("--no_calibration", action="store_true")
    parser.add_argument("--no_ablation",    action="store_true")
    parser.add_argument("--no_comparison",  action="store_true")
    parser.add_argument("--data_dir",       default=DATA_DIR)
    parser.add_argument("--results_dir",    default=RESULTS_DIR)
    args = parser.parse_args()

    os.makedirs(args.results_dir, exist_ok=True)
    os.makedirs(MODELS_DIR, exist_ok=True)

    horizons = list(HORIZON_FILES.keys()) if args.all_horizons else [args.horizon]

    for horizon in horizons:
        print(f"\n{'#'*65}")
        print(f"  VALIDATION SUITE — Horizon: {horizon}")
        print(f"{'#'*65}")

        t0 = time.time()

        try:
            df, feat_cols = load_horizon_data(horizon, args.data_dir, args.quick)
            print(f"\n  Loaded: {len(df):,} rows  |  {len(feat_cols)} features  "
                  f"|  {df[TARGET_COL].sum():,} onsets")
        except FileNotFoundError as e:
            print(f"  [ERROR] {e}")
            continue

        summary = {"horizon": horizon, "n_samples": len(df),
                   "n_onsets": int(df[TARGET_COL].sum()),
                   "n_features": len(feat_cols)}

        # Step 1: LOMO
        lomo_df = run_lomo(df, feat_cols, horizon, args.results_dir)
        if len(lomo_df) > 0:
            summary["lomo_tss_mean"] = round(lomo_df["tss"].mean(), 4)
            summary["lomo_tss_std"]  = round(lomo_df["tss"].std(), 4)
            summary["lomo_auc_mean"] = round(lomo_df["auc"].mean(), 4)

        # Step 2: Multi-model comparison
        if not args.no_comparison:
            cmp_df = run_model_comparison(df, feat_cols, horizon, args.results_dir)
            if len(cmp_df) > 0:
                best = cmp_df.iloc[0]
                summary["best_model"]     = best["model"]
                summary["best_model_tss"] = best["tss_mean"]

        # Step 3: Calibration
        if not args.no_calibration:
            cal_results = run_calibration(df, feat_cols, horizon, args.results_dir)
            summary.update({f"calib_{k}": v for k, v in cal_results.items()})

        # Step 4: Ablation
        if not args.no_ablation:
            abl_df = run_ablation(df, feat_cols, horizon, args.results_dir)
            if len(abl_df) > 0:
                top_group = abl_df.iloc[0]
                summary["most_important_group"]     = top_group["group"]
                summary["most_important_group_drop"] = top_group["tss_drop"]

        # Save summary
        summary_path = os.path.join(args.results_dir, f"validation_summary_{horizon}.json")
        with open(summary_path, "w") as f:
            json.dump(summary, f, indent=2)

        elapsed = time.time() - t0
        print(f"\n[DONE] Horizon {horizon} — total time: {elapsed/60:.1f} min")
        print(f"  All results saved to: {args.results_dir}")

    print(f"\n{'='*65}")
    print(f"  VALIDATION SUITE COMPLETE")
    print(f"  Results: {args.results_dir}")
    print(f"{'='*65}\n")


if __name__ == "__main__":
    main()
