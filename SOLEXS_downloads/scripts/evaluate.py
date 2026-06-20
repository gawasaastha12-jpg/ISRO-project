"""
evaluate.py  —  Research-grade evaluation for solar flare forecasting
======================================================================
Metrics implemented:
  - TSS  (True Skill Statistic)   — standard in solar physics forecasting
  - HSS  (Heidke Skill Score)     — used by NOAA/SWPC
  - Per-class Recall              — critical: missing M/X is catastrophic
  - Macro F1                      — better than weighted for imbalanced data
  - Normalized confusion matrix   — row-normalized (recall per true class)
  - Full sklearn classification report

Usage (standalone):
    from evaluate import evaluate_model, plot_confusion_matrix, print_report
    report = evaluate_model(y_true, y_pred, horizon_min=60)

Usage (called by train.py automatically — you don't need to call this directly):
    train.py imports and calls these functions for every horizon model.

Class map (matches your labeling pipeline):
    0 = quiet
    1 = B-like
    2 = C-like
    3 = M-like
    4 = X-like
"""

import numpy as np
import pandas as pd
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
)


# =============================================================================
# CLASS LABELS
# =============================================================================

CLASS_NAMES = {
    0: "Quiet",
    1: "B-like",
    2: "C-like",
    3: "M-like",
    4: "X-like",
}

FLARE_CLASSES = [1, 2, 3, 4]   # anything above quiet
HIGH_RISK_CLASSES = [3, 4]      # M and X — safety-critical


# =============================================================================
# CORE SKILL SCORES
# =============================================================================

def tss_binary(y_true, y_pred, positive_label):
    """
    True Skill Statistic (TSS) for a single class treated as binary.

    TSS = Recall(positive) + Recall(negative) - 1
        = TP/(TP+FN) - FP/(FP+TN)

    Range: -1 to +1
      TSS = 0   → no skill (same as random chance)
      TSS = 1   → perfect
      TSS = -1  → perfectly wrong

    This is the dominant metric in operational solar flare forecasting.
    Reference: Bloomfield et al. 2012, ApJL 747 L41
    """
    y_true_bin = (np.array(y_true) == positive_label).astype(int)
    y_pred_bin = (np.array(y_pred) == positive_label).astype(int)

    cm = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    recall_pos = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    recall_neg = tn / (tn + fp) if (tn + fp) > 0 else 0.0

    tss = recall_pos + recall_neg - 1.0
    return round(tss, 4)


def hss_binary(y_true, y_pred, positive_label):
    """
    Heidke Skill Score (HSS) for a single class treated as binary.

    HSS = 2*(TP*TN - FP*FN) / ((TP+FN)*(FN+TN) + (TP+FP)*(FP+TN))

    Range: -inf to +1
      HSS = 0   → no skill
      HSS = 1   → perfect
      HSS < 0   → worse than random

    Reference: Heidke 1926; used operationally by NOAA/SWPC.
    """
    y_true_bin = (np.array(y_true) == positive_label).astype(int)
    y_pred_bin = (np.array(y_pred) == positive_label).astype(int)

    cm = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()

    numerator = 2 * (tp * tn - fp * fn)
    denominator = (tp + fn) * (fn + tn) + (tp + fp) * (fp + tn)

    hss = numerator / denominator if denominator > 0 else 0.0
    return round(hss, 4)


def tss_multiclass(y_true, y_pred):
    """
    Macro-averaged TSS across all classes (each treated as one-vs-rest binary).
    Returns per-class TSS dict and the macro average.
    """
    classes = sorted(set(y_true) | set(y_pred))
    per_class = {}
    for c in classes:
        per_class[c] = tss_binary(y_true, y_pred, positive_label=c)
    macro_tss = np.mean(list(per_class.values()))
    return per_class, round(macro_tss, 4)


def hss_multiclass(y_true, y_pred):
    """
    Macro-averaged HSS across all classes.
    Returns per-class HSS dict and the macro average.
    """
    classes = sorted(set(y_true) | set(y_pred))
    per_class = {}
    for c in classes:
        per_class[c] = hss_binary(y_true, y_pred, positive_label=c)
    macro_hss = np.mean(list(per_class.values()))
    return per_class, round(macro_hss, 4)


# =============================================================================
# MAIN EVALUATION FUNCTION
# =============================================================================

def evaluate_model(y_true, y_pred, horizon_min=None, model_name="model", verbose=True):
    """
    Full research-grade evaluation of a flare forecasting model.

    Parameters
    ----------
    y_true       : array-like of true labels
    y_pred       : array-like of predicted labels
    horizon_min  : forecast horizon in minutes (None for detection)
    model_name   : label for this model in the report
    verbose      : if True, prints the full report to console

    Returns
    -------
    dict with all computed metrics — save/log this dict per model.
    """
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)

    label = f"{model_name}" + (f" [{horizon_min}min forecast]" if horizon_min else " [detection]")

    # ── Per-class TSS and HSS ────────────────────────────────────────────────
    tss_per_class, tss_macro = tss_multiclass(y_true, y_pred)
    hss_per_class, hss_macro = hss_multiclass(y_true, y_pred)

    # ── Standard sklearn metrics ─────────────────────────────────────────────
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
    report_dict = classification_report(
        y_true, y_pred,
        target_names=[CLASS_NAMES.get(i, str(i)) for i in sorted(set(y_true) | set(y_pred))],
        output_dict=True,
        zero_division=0,
    )
    report_str = classification_report(
        y_true, y_pred,
        target_names=[CLASS_NAMES.get(i, str(i)) for i in sorted(set(y_true) | set(y_pred))],
        zero_division=0,
    )

    # ── Per-class recall (critical for M/X) ──────────────────────────────────
    cm = confusion_matrix(y_true, y_pred)
    classes_present = sorted(set(y_true) | set(y_pred))
    with np.errstate(divide='ignore', invalid='ignore'):
        per_class_recall = np.where(
            cm.sum(axis=1) > 0,
            cm.diagonal() / cm.sum(axis=1),
            0.0
        )
    recall_by_class = {
        classes_present[i]: round(float(per_class_recall[i]), 4)
        for i in range(len(classes_present))
    }

    # ── High-risk class performance (M + X combined) ─────────────────────────
    mx_mask_true = np.isin(y_true, HIGH_RISK_CLASSES)
    mx_mask_pred = np.isin(y_pred, HIGH_RISK_CLASSES)
    mx_tp = np.sum(mx_mask_true & mx_mask_pred)
    mx_fn = np.sum(mx_mask_true & ~mx_mask_pred)
    mx_fp = np.sum(~mx_mask_true & mx_mask_pred)
    mx_recall    = mx_tp / (mx_tp + mx_fn) if (mx_tp + mx_fn) > 0 else 0.0
    mx_precision = mx_tp / (mx_tp + mx_fp) if (mx_tp + mx_fp) > 0 else 0.0
    mx_f1        = (2 * mx_precision * mx_recall / (mx_precision + mx_recall)
                    if (mx_precision + mx_recall) > 0 else 0.0)

    # ── Assemble results dict ─────────────────────────────────────────────────
    results = {
        "label":           label,
        "horizon_min":     horizon_min,
        "n_samples":       len(y_true),
        "tss_macro":       tss_macro,
        "hss_macro":       hss_macro,
        "macro_f1":        round(macro_f1, 4),
        "tss_per_class":   tss_per_class,
        "hss_per_class":   hss_per_class,
        "recall_per_class": recall_by_class,
        "mx_recall":       round(mx_recall, 4),
        "mx_precision":    round(mx_precision, 4),
        "mx_f1":           round(mx_f1, 4),
        "confusion_matrix": cm.tolist(),
        "classes_present": classes_present,
        "classification_report_str": report_str,
    }

    if verbose:
        _print_report(results)

    return results


# =============================================================================
# PRINT HELPERS
# =============================================================================

def _print_report(results):
    sep = "=" * 65

    print(f"\n{sep}")
    print(f"  EVALUATION REPORT: {results['label']}")
    print(f"  Samples: {results['n_samples']:,}")
    print(sep)

    print(f"\n  ── Skill Scores (key metrics) ──")
    print(f"  TSS (macro avg):   {results['tss_macro']:+.4f}   (0 = no skill, 1 = perfect)")
    print(f"  HSS (macro avg):   {results['hss_macro']:+.4f}   (0 = no skill, 1 = perfect)")
    print(f"  Macro F1:          {results['macro_f1']:.4f}")

    print(f"\n  ── Per-class TSS ──")
    for cls, val in results["tss_per_class"].items():
        name = CLASS_NAMES.get(cls, str(cls))
        bar = _skill_bar(val)
        print(f"  label {cls} ({name:6s}): {val:+.4f}  {bar}")

    print(f"\n  ── Per-class Recall (of true events caught) ──")
    for cls, val in results["recall_per_class"].items():
        name = CLASS_NAMES.get(cls, str(cls))
        flag = "  ← !" if cls in HIGH_RISK_CLASSES and val < 0.5 else ""
        print(f"  label {cls} ({name:6s}): {val:.4f}{flag}")

    print(f"\n  ── M + X Class Combined (safety-critical) ──")
    print(f"  Recall:    {results['mx_recall']:.4f}  (fraction of real M/X events caught)")
    print(f"  Precision: {results['mx_precision']:.4f}  (fraction of M/X predictions that were real)")
    print(f"  F1:        {results['mx_f1']:.4f}")

    print(f"\n  ── Classification Report ──")
    print(results["classification_report_str"])

    print(f"\n  ── Normalized Confusion Matrix (rows = true, cols = predicted) ──")
    _print_confusion_matrix(
        np.array(results["confusion_matrix"]),
        results["classes_present"]
    )
    print(sep)


def _skill_bar(val, width=20):
    """ASCII bar showing skill score from -1 to +1."""
    midpoint = width // 2
    if val >= 0:
        filled = int(val * midpoint)
        bar = " " * midpoint + "█" * filled + "░" * (midpoint - filled)
    else:
        filled = int(abs(val) * midpoint)
        bar = "░" * (midpoint - filled) + "█" * filled + " " * midpoint
    return f"|{bar}|"


def _print_confusion_matrix(cm, classes):
    names = [CLASS_NAMES.get(c, str(c))[:5] for c in classes]
    col_w = 8

    # Row-normalize (recall per true class)
    row_sums = cm.sum(axis=1, keepdims=True)
    with np.errstate(divide='ignore', invalid='ignore'):
        cm_norm = np.where(row_sums > 0, cm / row_sums, 0.0)

    header = "True \\ Pred".ljust(10)
    for n in names:
        header += n.rjust(col_w)
    print(f"  {header}")
    print(f"  {'-' * (10 + col_w * len(names))}")

    for i, (c, row) in enumerate(zip(classes, cm_norm)):
        row_str = CLASS_NAMES.get(c, str(c))[:9].ljust(10)
        for val in row:
            cell = f"{val:.2f}"
            row_str += cell.rjust(col_w)
        print(f"  {row_str}")


# =============================================================================
# SUMMARY TABLE (across all horizons)
# =============================================================================

def print_horizon_summary(all_results: list):
    """
    Print a compact summary table comparing metrics across all forecast horizons.

    Parameters
    ----------
    all_results : list of dicts returned by evaluate_model(), one per horizon
    """
    print("\n" + "=" * 75)
    print("  HORIZON COMPARISON SUMMARY")
    print("=" * 75)
    print(f"  {'Horizon':>10}  {'TSS':>8}  {'HSS':>8}  {'MacroF1':>8}  {'M+X Recall':>12}  {'M+X F1':>8}")
    print(f"  {'-'*10}  {'-'*8}  {'-'*8}  {'-'*8}  {'-'*12}  {'-'*8}")

    for r in sorted(all_results, key=lambda x: (x["horizon_min"] or -1)):
        h = f"{r['horizon_min']}min" if r["horizon_min"] else "detect"
        print(
            f"  {h:>10}  "
            f"{r['tss_macro']:>+8.4f}  "
            f"{r['hss_macro']:>+8.4f}  "
            f"{r['macro_f1']:>8.4f}  "
            f"{r['mx_recall']:>12.4f}  "
            f"{r['mx_f1']:>8.4f}"
        )
    print("=" * 75)
    print("  TSS/HSS = 0 means no skill. Target TSS > 0.3 for any operational use.")
    print("  M+X Recall is the most safety-critical number — missing X flares is bad.\n")


# =============================================================================
# SAVE RESULTS TO CSV
# =============================================================================

def save_results(all_results: list, out_path: str):
    """
    Save a flat summary CSV of all horizon results for easy comparison/plotting.
    """
    rows = []
    for r in all_results:
        row = {
            "horizon_min":  r["horizon_min"],
            "n_samples":    r["n_samples"],
            "tss_macro":    r["tss_macro"],
            "hss_macro":    r["hss_macro"],
            "macro_f1":     r["macro_f1"],
            "mx_recall":    r["mx_recall"],
            "mx_precision": r["mx_precision"],
            "mx_f1":        r["mx_f1"],
        }
        # Flatten per-class TSS and recall
        for cls, val in r["tss_per_class"].items():
            row[f"tss_class{cls}"] = val
        for cls, val in r["recall_per_class"].items():
            row[f"recall_class{cls}"] = val
        rows.append(row)

    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    print(f"[INFO] Results saved → {out_path}")
    return df