"""
build_advanced_features.py
==========================
Builds THREE lag-feature datasets for comparison:
  - lag_2  (~10 min lookback)
  - lag_12 (~60 min lookback)
  - lag_24 (~120 min lookback)

For each, computes:
  1. BASE LAG FEATURES      — raw statistics from each past window
  2. DERIVATIVE FEATURES    — Δmean, Δstd, Δenergy, Δsnr, Δwidth, Δtrend
  3. ROLLING STATISTICS     — rolling mean/std/max/energy over 5 and 12 windows
  4. TREND ACCELERATION     — trend_change, second_derivative, slope over 3/6 windows
  5. PEAK EVOLUTION         — prominence_change, width_change, prominence_accel

Labeling artifacts (peak_count, max_prominence, detection_threshold,
prominence_multiple, peak_ratio) are EXCLUDED from features everywhere —
they directly encode the label and must not be used for training.

HOW TO RUN
----------
    python build_advanced_features.py

OUTPUTS
-------
    ../data/processed/lag_2_advanced.csv
    ../data/processed/lag_12_advanced.csv
    ../data/processed/lag_24_advanced.csv
"""

import os
import numpy as np
import pandas as pd
from scipy.stats import linregress

# =============================================================================
# CONFIG
# =============================================================================

INPUT_PATH = "../data/processed/dataset_balanced_v8.csv"
OUTPUT_DIR = "../data/processed"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Lag configs to generate
LAG_CONFIGS = [2, 12, 24]

# Step size in minutes (each window = 5 min)
STEP_MIN = 5

# Base features to lag — raw statistical properties only
# Peak artifacts excluded deliberately
BASE_FEATURES = [
    "mean", "median", "std", "iqr",
    "skew", "kurtosis", "energy", "snr",
    "max", "min", "largest_width",
    "trend", "volatility", "acceleration",
]

# Peak features used ONLY for differential/evolution features, not as raw lags
# (their absolute value encodes the label; their CHANGE over time is safe)
PEAK_FEATURES = ["max_prominence", "largest_width"]

# Target: predict label 1 step ahead
FORECAST_SHIFT = 1

# Labeling artifacts — never use these as features
LABEL_ARTIFACTS = [
    "peak_count", "peak_ratio", "max_prominence",
    "detection_threshold", "prominence_multiple",
]


# =============================================================================
# FEATURE ENGINEERING PER GROUP
# =============================================================================

def engineer_features(group: pd.DataFrame, n_lags: int) -> pd.DataFrame:
    """
    Given a single source-file group (time-ordered rows), compute all
    advanced feature families and return an enriched DataFrame.

    Parameters
    ----------
    group  : time-ordered rows for one source file
    n_lags : how many previous windows to include as lag features
    """
    g = group.reset_index(drop=True)
    n = len(g)
    out = pd.DataFrame(index=g.index)

    # ── 1. Base current-window features ──────────────────────────────────────
    for feat in BASE_FEATURES:
        if feat in g.columns:
            out[feat] = g[feat]

    # ── 2. Lag features ───────────────────────────────────────────────────────
    for lag in range(1, n_lags + 1):
        for feat in BASE_FEATURES:
            if feat in g.columns:
                out[f"{feat}_lag{lag}"] = g[feat].shift(lag)

    # ── 3. Derivative features (Δ = current − lag1) ───────────────────────────
    # These capture the RATE OF CHANGE rather than absolute level.
    # A rising Δmean signals increasing solar activity — key pre-flare signal.
    delta_pairs = [
        ("mean",          "delta_mean"),
        ("std",           "delta_std"),
        ("energy",        "delta_energy"),
        ("snr",           "delta_snr"),
        ("largest_width", "delta_width"),
        ("trend",         "delta_trend"),
    ]
    for src, name in delta_pairs:
        if src in g.columns:
            out[name] = g[src] - g[src].shift(1)
            # Second-order delta (acceleration of the change)
            out[f"{name}_accel"] = out[name] - out[name].shift(1)

    # ── 4. Rolling statistics ─────────────────────────────────────────────────
    # Smooth out single-window Poisson noise.
    # rolling(5)  = last 25 min;  rolling(12) = last 60 min
    for win, label in [(5, "5"), (12, "12")]:
        if win <= n_lags:  # only compute if we have enough lag history
            for feat in ["mean", "std", "max", "energy"]:
                if feat in g.columns:
                    out[f"rolling_{feat}_{label}"] = (
                        g[feat].rolling(window=win, min_periods=2).mean()
                    )
                    # Rolling trend: is the rolling mean rising or falling?
                    out[f"rolling_{feat}_{label}_trend"] = (
                        out[f"rolling_{feat}_{label}"] -
                        out[f"rolling_{feat}_{label}"].shift(1)
                    )

    # ── 5. Trend acceleration features ───────────────────────────────────────
    # 'trend' feature = mean of diff(window) = local slope within one window.
    # trend_change = how much that slope is changing between windows.
    # second_derivative = acceleration of the trend — catches rapidly steepening
    # flux rise, which is a strong pre-flare signal.
    if "trend" in g.columns:
        out["trend_change"]      = g["trend"] - g["trend"].shift(1)
        out["second_derivative"] = out["trend_change"] - out["trend_change"].shift(1)

    # Linear slope over last 3 and 6 windows (using mean as proxy for flux level)
    # slope > 0 and increasing = candidate pre-flare ramp
    if "mean" in g.columns:
        def rolling_slope(series, w):
            slopes = [np.nan] * len(series)
            arr = series.values
            for i in range(w - 1, len(arr)):
                y = arr[i - w + 1: i + 1]
                if not np.any(np.isnan(y)):
                    x = np.arange(w)
                    try:
                        slope, *_ = linregress(x, y)
                        slopes[i] = slope
                    except Exception:
                        pass
            return pd.Series(slopes, index=series.index)

        if n_lags >= 3:
            out["trend_slope_3"] = rolling_slope(g["mean"], 3)
        if n_lags >= 6:
            out["trend_slope_6"] = rolling_slope(g["mean"], 6)
        if n_lags >= 12:
            out["trend_slope_12"] = rolling_slope(g["mean"], 12)

    # ── 6. Peak evolution features ────────────────────────────────────────────
    # We use max_prominence and largest_width here only in DIFFERENTIAL form —
    # the change between windows, not the absolute value (which encodes the label).
    # A growing prominence over consecutive windows = a flare developing.
    if "max_prominence" in g.columns:
        prom = g["max_prominence"]
        out["prominence_change"] = prom - prom.shift(1)
        out["prominence_accel"]  = out["prominence_change"] - out["prominence_change"].shift(1)
        # Ratio of current to previous prominence (how fast is it growing?)
        out["prominence_ratio"]  = prom / (prom.shift(1) + 1e-6)

    if "largest_width" in g.columns:
        width = g["largest_width"]
        out["width_change"] = width - width.shift(1)
        out["width_accel"]  = out["width_change"] - out["width_change"].shift(1)

    # ── 7. Future label (target) ──────────────────────────────────────────────
    out["label_future"]        = g["label"].shift(-FORECAST_SHIFT)
    out["label_binary_future"] = (out["label_future"] >= 1).astype("Int64")
    out["source_file"]         = g["source_file"].values

    # Drop rows with NaN from lag/shift/rolling at edges
    out = out.dropna(subset=["label_binary_future"]).copy()
    out["label_binary_future"] = out["label_binary_future"].astype(int)

    # Drop any remaining NaN rows (from lag edges)
    min_valid_row = n_lags  # first n_lags rows have incomplete lag history
    out = out.iloc[min_valid_row:].copy()

    return out


# =============================================================================
# MAIN
# =============================================================================

print(f"[LOAD] {INPUT_PATH}")
df = pd.read_csv(INPUT_PATH)
print(f"  Shape: {df.shape}")
print(f"  Source files: {df['source_file'].nunique()} unique files")

for n_lags in LAG_CONFIGS:
    lookback_min = n_lags * STEP_MIN
    print(f"\n{'='*55}")
    print(f"Building lag-{n_lags} dataset (~{lookback_min} min lookback)")
    print(f"{'='*55}")

    parts = []
    skipped = 0

    for src_file, group in df.groupby("source_file"):
        if src_file == "SYNTHETIC_SMOTE":
            continue
        # Need enough rows for lags + forecast shift + rolling windows
        min_rows = n_lags + FORECAST_SHIFT + 13  # 13 for rolling-12 + buffer
        if len(group) < min_rows:
            skipped += 1
            continue
        try:
            enriched = engineer_features(group, n_lags)
            if len(enriched) > 0:
                parts.append(enriched)
        except Exception as e:
            skipped += 1
            continue

    if not parts:
        print(f"  [WARN] No data generated for lag-{n_lags}. Skipping.")
        continue

    df_out = pd.concat(parts, ignore_index=True)

    # Remove any column that is a raw labeling artifact
    artifact_cols = [c for c in df_out.columns
                     if any(c == a or c.startswith(a + "_lag")
                            for a in LABEL_ARTIFACTS)
                     and "delta" not in c
                     and "change" not in c
                     and "accel" not in c
                     and "ratio" not in c]
    df_out = df_out.drop(columns=artifact_cols, errors="ignore")

    # Feature summary
    feature_cols = [c for c in df_out.columns
                    if c not in ("label_future", "label_binary_future",
                                 "source_file", "label")]
    n_quiet = (df_out["label_binary_future"] == 0).sum()
    n_flare = (df_out["label_binary_future"] == 1).sum()
    total   = len(df_out)

    print(f"  Files processed : {len(parts)}")
    print(f"  Files skipped   : {skipped} (too short for {n_lags} lags)")
    print(f"  Output shape    : {df_out.shape}")
    print(f"  Features        : {len(feature_cols)}")
    print(f"  Label distribution:")
    print(f"    0 (No flare): {n_quiet:>7,}  ({100*n_quiet/total:.1f}%)")
    print(f"    1 (Flare)   : {n_flare:>7,}  ({100*n_flare/total:.1f}%)")

    # Feature family breakdown
    families = {
        "Base current-window": [f for f in feature_cols if "_lag" not in f
                                  and "delta" not in f and "rolling" not in f
                                  and "slope" not in f and "change" not in f
                                  and "accel" not in f and "ratio" not in f
                                  and "derivative" not in f],
        "Lag features":        [f for f in feature_cols if "_lag" in f],
        "Derivative (Δ)":      [f for f in feature_cols if "delta" in f],
        "Rolling stats":       [f for f in feature_cols if "rolling" in f],
        "Trend accel/slope":   [f for f in feature_cols
                                  if any(k in f for k in
                                         ["slope", "trend_change",
                                          "second_deriv", "trend_slope"])],
        "Peak evolution":      [f for f in feature_cols
                                  if any(k in f for k in
                                         ["prominence", "width_change",
                                          "width_accel"])],
    }
    print(f"\n  Feature families:")
    for fam, feats in families.items():
        print(f"    {fam:30s}: {len(feats):>4} features")

    out_path = os.path.join(OUTPUT_DIR, f"lag_{n_lags}_advanced.csv")
    df_out.to_csv(out_path, index=False)
    print(f"\n  [SAVE] {out_path}")

print(f"\n{'='*55}")
print(f"ALL DONE. Three datasets ready:")
for n in LAG_CONFIGS:
    print(f"  ../data/processed/lag_{n}_advanced.csv")
print(f"\nNext step: python train_compare_lags.py")
