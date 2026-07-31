"""
pipeline_patch_v6.py  —  DROP-IN PATCH for dataset_research_v8 pipeline
==========================================================================
What this adds on top of your existing script:

  1. REBALANCING
     - Merges label 4 (X-like, only 29 real examples) into label 3 (M+X severe)
     - Keeps QUIET_KEEP_FRACTION of label-0 windows
     - Keeps B_CLASS_KEEP_FRACTION of label-1 windows (set to 0.5 for v8,
       since v8 has only 1,708 real B-like examples vs v5's inflated 110k)
     - Leaves labels 2 and 3 completely untouched (never discard rare flares)
     - Applies SMOTE to boost minority classes where needed

  2. MULTI-HORIZON LABEL SHIFTING
     - Turns your detection dataset into N forecast datasets
     - For horizon H: features from window[t] predict label of window[t+H]
     - Each horizon saved as a separate CSV
     - Horizons: 5, 10, 15, 30, 60, 120, 180 minutes

HOW TO USE
----------
    python pipeline_patch_v6.py --input ../data/processed/dataset_research_v8.csv

REQUIREMENTS
------------
    pip install imbalanced-learn
"""

import argparse
import os

import numpy as np
import pandas as pd
from collections import Counter

# ── Optional SMOTE import ────────────────────────────────────────────────────
try:
    from imblearn.over_sampling import SMOTE
    SMOTE_AVAILABLE = True
except ImportError:
    SMOTE_AVAILABLE = False
    print(
        "[WARN] imbalanced-learn not found. SMOTE oversampling will be skipped.\n"
        "       Install with:  pip install imbalanced-learn\n"
    )


# =============================================================================
# CONFIG
# =============================================================================

# Fraction of label-0 (quiet) windows to keep.
QUIET_KEEP_FRACTION = 0.3

# Fraction of label-1 (B-like) windows to keep.
# v8 has only 1,708 real B-like examples (vs v5's inflated ~110k),
# so we keep 50% instead of the old aggressive 15%.
B_CLASS_KEEP_FRACTION = 0.5

# SMOTE target count for minority classes.
# None = auto-compute (10% of post-downsample label-1 count).
# Set a fixed integer to override, e.g. SMOTE_TARGET_COUNT = 500
SMOTE_TARGET_COUNT = None

STEP_SECONDS = 300
FORECAST_HORIZONS_MIN = [5, 10, 15, 30, 60, 120, 180]


# =============================================================================
# STEP 1 — REBALANCING
# =============================================================================

def rebalance(df: pd.DataFrame, random_state: int = 42) -> pd.DataFrame:
    """
    Rebalance a flare detection dataset.

    Strategy:
      - Label 0 (quiet):      downsample to QUIET_KEEP_FRACTION
      - Label 1 (B-like):     downsample to B_CLASS_KEEP_FRACTION
      - Labels 2, 3:          keep all, then SMOTE minority if needed
      - Label 4 (X-like):     already merged into 3 before this is called
    """
    print("\n[REBALANCE] Original distribution:")
    _print_dist(df)

    parts = []

    for lbl, group in df.groupby("label"):
        if lbl == 0:
            keep = group.sample(frac=QUIET_KEEP_FRACTION, random_state=random_state)
            print(f"  label {lbl}: {len(group):,} -> {len(keep):,} (kept {QUIET_KEEP_FRACTION:.0%})")
            parts.append(keep)

        elif lbl == 1:
            keep = group.sample(frac=B_CLASS_KEEP_FRACTION, random_state=random_state)
            print(f"  label {lbl}: {len(group):,} -> {len(keep):,} (kept {B_CLASS_KEEP_FRACTION:.0%})")
            parts.append(keep)

        else:
            print(f"  label {lbl}: {len(group):,} -> {len(group):,} (kept 100%)")
            parts.append(group)

    df_down = pd.concat(parts).reset_index(drop=True)

    print("\n[REBALANCE] After downsampling:")
    _print_dist(df_down)

    # ── SMOTE oversampling ───────────────────────────────────────────────────
    if not SMOTE_AVAILABLE:
        print("\n[REBALANCE] Skipping SMOTE (imbalanced-learn not installed).")
        df_final = df_down.sample(frac=1, random_state=random_state).reset_index(drop=True)
        print("\n[REBALANCE] Final distribution:")
        _print_dist(df_final)
        return df_final

    feature_cols = [c for c in df_down.columns if c not in ("label", "source_file")]

    label1_count = (df_down["label"] == 1).sum()
    if SMOTE_TARGET_COUNT is not None:
        target = SMOTE_TARGET_COUNT
    else:
        target = max(int(label1_count * 0.10), 1)

    print(f"\n[REBALANCE] SMOTE target count per minority class: {target:,}")

    current_counts = Counter(df_down["label"])
    sampling_strategy = {}

    # Only SMOTE labels that exist in the downsampled set (label 4 is gone now)
    for lbl in [2, 3]:
        current = current_counts.get(lbl, 0)
        if current < target and current >= 2:
            sampling_strategy[lbl] = target
        elif current < 2:
            print(f"  [WARN] label {lbl} has only {current} samples — SMOTE needs ≥2, skipping.")
        else:
            print(f"  [INFO] label {lbl} already has {current} samples >= target {target}. SMOTE skipped for this class.")

    if not sampling_strategy:
        print("  [INFO] All classes already meet target count. SMOTE skipped.")
        df_final = df_down.sample(frac=1, random_state=random_state).reset_index(drop=True)
        print("\n[REBALANCE] Final distribution:")
        _print_dist(df_final)
        return df_final

    X = df_down[feature_cols].values
    y = df_down["label"].values

    min_minority = min(current_counts.get(lbl, 0) for lbl in sampling_strategy)
    k = min(5, min_minority - 1)

    if k < 1:
        print(f"  [WARN] Not enough minority samples for SMOTE (k={k}). Skipping.")
        df_final = df_down.sample(frac=1, random_state=random_state).reset_index(drop=True)
        print("\n[REBALANCE] Final distribution:")
        _print_dist(df_final)
        return df_final

    smote = SMOTE(
        sampling_strategy=sampling_strategy,
        k_neighbors=k,
        random_state=random_state,
    )

    try:
        X_res, y_res = smote.fit_resample(X, y)

        n_original  = len(df_down)
        n_synthetic = len(X_res) - n_original

        df_smote = pd.DataFrame(X_res, columns=feature_cols)
        df_smote["label"] = y_res

        real_source_files = df_down["source_file"].reset_index(drop=True)
        synthetic_source_files = pd.Series(["SYNTHETIC_SMOTE"] * n_synthetic, dtype=str)
        df_smote["source_file"] = pd.concat(
            [real_source_files, synthetic_source_files], ignore_index=True
        )

        df_final = df_smote.sample(frac=1, random_state=random_state).reset_index(drop=True)
        print(f"  (real rows: {n_original:,} | synthetic rows added: {n_synthetic:,})")
        print("\n[REBALANCE] Final distribution (after SMOTE):")
        _print_dist(df_final)
        return df_final

    except Exception as e:
        print(f"  [WARN] SMOTE failed: {e}. Returning downsampled-only dataset.")
        df_final = df_down.sample(frac=1, random_state=random_state).reset_index(drop=True)
        print("\n[REBALANCE] Final distribution:")
        _print_dist(df_final)
        return df_final


# =============================================================================
# STEP 2 — MULTI-HORIZON LABEL SHIFTING
# =============================================================================

def build_forecast_datasets(
    df: pd.DataFrame,
    out_dir: str = "../data/processed/horizons",
    horizons_min: list = None,
) -> dict:
    """
    Build one forecast dataset per horizon by shifting labels forward in time.

    Detection:   features[t] → label[t]      (is there a flare NOW?)
    Forecasting: features[t] → label[t + H]  (will there be a flare in H minutes?)

    Label shift is applied per source_file group to avoid cross-file leakage.
    Synthetic SMOTE rows are excluded from forecast datasets (no temporal sequence).
    """
    if horizons_min is None:
        horizons_min = FORECAST_HORIZONS_MIN

    os.makedirs(out_dir, exist_ok=True)

    horizon_offsets = {
        h: max(1, round((h * 60) / STEP_SECONDS))
        for h in horizons_min
    }

    print(f"\n[FORECAST] Building {len(horizons_min)} horizon datasets")
    print(f"  Step size: {STEP_SECONDS}s = {STEP_SECONDS/60:.1f} min per index")
    for h, offset in horizon_offsets.items():
        print(f"  {h:>4} min -> shift labels by {offset} rows")

    feature_cols = [c for c in df.columns if c not in ("label", "source_file")]
    result = {}

    for h_min, offset in horizon_offsets.items():

        horizon_parts = []

        for src_file, group in df.groupby("source_file"):

            if src_file == "SYNTHETIC_SMOTE":
                continue

            group = group.reset_index(drop=True)
            n = len(group)

            if n <= offset:
                continue

            feats = group[feature_cols].iloc[:n - offset].copy()
            future_labels = group["label"].iloc[offset:].reset_index(drop=True)

            feats["label"] = future_labels.values
            feats["source_file"] = src_file
            feats["forecast_horizon_min"] = h_min

            horizon_parts.append(feats)

        if not horizon_parts:
            print(f"  [WARN] Horizon {h_min}min: no data (all files too short?)")
            continue

        df_horizon = pd.concat(horizon_parts, ignore_index=True)

        out_path = os.path.join(out_dir, f"forecast_{h_min}min.csv")
        df_horizon.to_csv(out_path, index=False)
        result[h_min] = df_horizon

        print(f"\n  Horizon {h_min:>4}min -> {out_path}")
        print(f"    Shape: {df_horizon.shape}")
        _print_dist(df_horizon, indent="    ")

    print(f"\n[FORECAST] Done. {len(result)} horizon datasets saved to: {out_dir}")
    return result


# =============================================================================
# HELPERS
# =============================================================================

def _print_dist(df: pd.DataFrame, indent: str = "  ") -> None:
    counts = df["label"].value_counts().sort_index()
    pcts   = (counts / len(df) * 100).round(1)
    names  = {0: "quiet", 1: "B-like", 2: "C-like", 3: "Severe(M+X)", 4: "X-like"}
    for lbl in counts.index:
        name = names.get(lbl, "?")
        print(f"{indent}label {lbl} ({name:12s}): {counts[lbl]:>8,}  ({pcts[lbl]:5.1f}%)")
    print(f"{indent}{'TOTAL':16s}: {len(df):>8,}")


# =============================================================================
# STANDALONE CLI
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="Rebalance + build multi-horizon forecast datasets from a detection CSV."
    )
    parser.add_argument("--mode", choices=["csv"], default="csv")
    parser.add_argument(
        "--input",
        default="../data/processed/dataset_research_v8.csv",
        help="Path to detection CSV. Always use v8 — earlier versions have labeling bugs.",
    )
    parser.add_argument(
        "--out_balanced",
        default="../data/processed/dataset_balanced_v8.csv",
    )
    parser.add_argument(
        "--out_horizons_dir",
        default="../data/processed/horizons",
    )
    parser.add_argument("--skip_smote", action="store_true")
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    print(f"[INFO] Loading: {args.input}")
    df = pd.read_csv(args.input)
    print(f"[INFO] Loaded {len(df):,} rows, {df.shape[1]} columns")

    # ── Safety warning if someone accidentally points at an old file ─────────
    for old_ver in ["v5", "v6", "v7"]:
        if old_ver in args.input:
            print(f"\n[WARNING] You are loading a '{old_ver}' file which has known "
                  f"labeling bugs. Use dataset_research_v8.csv instead.\n")

    # ── Merge label 4 (X-like) into label 3 (severe) ────────────────────────
    # v8 has only 29 real X-class examples — too few to train reliably as a
    # standalone class. Merging with M-like gives 199 real severe examples.
    n_x_before = (df["label"] == 4).sum()
    df.loc[df["label"] == 4, "label"] = 3
    print(f"\n[INFO] Merged label 4 (X-like, {n_x_before} samples) into label 3 (Severe M+X)")
    print(f"[INFO] New Severe (M+X) class count: {(df['label'] == 3).sum():,}")

    # ── Disable SMOTE if requested ───────────────────────────────────────────
    global SMOTE_AVAILABLE
    if args.skip_smote:
        SMOTE_AVAILABLE = False
        print("[INFO] SMOTE disabled via --skip_smote flag")

    # ── Step 1: Rebalance ────────────────────────────────────────────────────
    df_balanced = rebalance(df, random_state=args.seed)

    os.makedirs(os.path.dirname(args.out_balanced), exist_ok=True)
    df_balanced.to_csv(args.out_balanced, index=False)
    print(f"\n[INFO] Balanced dataset saved -> {args.out_balanced}")

    # ── Step 2: Multi-horizon forecast datasets ──────────────────────────────
    build_forecast_datasets(
        df_balanced,
        out_dir=args.out_horizons_dir,
        horizons_min=FORECAST_HORIZONS_MIN,
    )


if __name__ == "__main__":
    main()