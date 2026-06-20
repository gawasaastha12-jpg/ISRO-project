"""
build_lag_features.py — Add lag features for genuine forecasting
================================================================
The binary nowcasting task was trivially solvable because features
from window[t] directly encode whether a flare is happening at t.

This script builds a FORECASTING dataset where:
  - Features come from windows [t-2, t-1, t]  (past + present)
  - Label is from window [t+1]                 (near future)

The pre-flare signal — a subtle rising trend across consecutive
windows — is now something the model must actually learn to detect.
This is a genuine ML problem with no trivial solution.

HOW TO RUN
----------
    python build_lag_features.py

OUTPUT
------
    ../data/processed/dataset_lag_features.csv
"""

import os
import numpy as np
import pandas as pd

# =============================================================================
# CONFIG
# =============================================================================

INPUT_PATH  = "../data/processed/dataset_balanced_v8.csv"
OUTPUT_PATH = "../data/processed/dataset_lag_features.csv"

# Features to lag — raw statistical properties only.
# Deliberately excludes the labeling artifacts (peak_count, max_prominence,
# detection_threshold, prominence_multiple, peak_ratio) that caused
# TSS=1.0 in the binary nowcasting run.
LAG_FEATURES = [
    "mean", "median", "std", "iqr",
    "skew", "kurtosis", "energy", "snr",
    "max", "min", "largest_width",
    "trend", "volatility", "acceleration",
]

# How many previous windows to look back
# lag=1 means the previous window, lag=2 means two windows back
N_LAGS = 2

# Predict this many steps into the future
# shift=1 means predict window[t+1] from features of [t-2, t-1, t]
FORECAST_SHIFT = 1

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

# =============================================================================
# LOAD
# =============================================================================

print(f"[LOAD] {INPUT_PATH}")
df = pd.read_csv(INPUT_PATH)
print(f"  Shape: {df.shape}")
print(f"  Source files: {df['source_file'].nunique()} unique files")

# =============================================================================
# BUILD LAG FEATURES PER SOURCE FILE
# =============================================================================
# CRITICAL: lags must be computed WITHIN each source file only.
# Lagging across file boundaries would give window[t] the features from
# the last window of a completely different observation session — nonsense.

print(f"\n[LAG] Building {N_LAGS} lag(s) + {FORECAST_SHIFT}-step-ahead label...")
print(f"  Lag features: {LAG_FEATURES}")
print(f"  Each row will have: current features + lag-1 features + lag-2 features")
print(f"  Label: what class occurs {FORECAST_SHIFT} window(s) ahead (= +5 min)\n")

all_parts = []

for src_file, group in df.groupby("source_file"):

    # Skip synthetic SMOTE rows — they have no temporal sequence
    if src_file == "SYNTHETIC_SMOTE":
        continue

    group = group.reset_index(drop=True)
    n = len(group)

    # Need at least N_LAGS + FORECAST_SHIFT + 1 rows to be useful
    if n < N_LAGS + FORECAST_SHIFT + 1:
        continue

    part = group[LAG_FEATURES + ["label", "source_file"]].copy()

    # Add lag features: shift the feature columns forward by k rows
    # so that row t gets the values from row t-k
    for lag in range(1, N_LAGS + 1):
        for feat in LAG_FEATURES:
            part[f"{feat}_lag{lag}"] = part[feat].shift(lag)

    # Add future label: shift the label backward by FORECAST_SHIFT rows
    # so that row t gets the label from row t+FORECAST_SHIFT
    part["label_future"] = part["label"].shift(-FORECAST_SHIFT)

    # Drop rows that have NaN from the lag/shift operations
    # (first N_LAGS rows have no lag history; last FORECAST_SHIFT rows
    # have no future label)
    part = part.dropna().reset_index(drop=True)

    # Convert future label to int
    part["label_future"] = part["label_future"].astype(int)

    all_parts.append(part)

df_lag = pd.concat(all_parts, ignore_index=True)

# =============================================================================
# BINARY TARGET
# =============================================================================
# Same as before: predict whether ANY flare will occur in the next window

df_lag["label_binary_future"] = (df_lag["label_future"] >= 1).astype(int)

# =============================================================================
# SUMMARY
# =============================================================================

n_quiet = (df_lag["label_binary_future"] == 0).sum()
n_flare = (df_lag["label_binary_future"] == 1).sum()
total   = len(df_lag)

feature_cols = [c for c in df_lag.columns
                if c not in ("label", "label_future",
                             "label_binary_future", "source_file")]

print(f"[RESULT] Lag dataset shape: {df_lag.shape}")
print(f"  Total features: {len(feature_cols)}")
print(f"  Current window features : {len(LAG_FEATURES)}")
print(f"  Lag-1 features          : {len(LAG_FEATURES)}")
print(f"  Lag-2 features          : {len(LAG_FEATURES)}")
print(f"\n  Binary future label distribution:")
print(f"    0 (Quiet next window) : {n_quiet:>7,}  ({100*n_quiet/total:.1f}%)")
print(f"    1 (Flare next window) : {n_flare:>7,}  ({100*n_flare/total:.1f}%)")
print(f"\n  All feature names:")
for i, f in enumerate(feature_cols):
    marker = " <-- lag feature" if "lag" in f else ""
    print(f"    {f}{marker}")

# =============================================================================
# SAVE
# =============================================================================

df_lag.to_csv(OUTPUT_PATH, index=False)
print(f"\n[SAVE] {OUTPUT_PATH}")
print(f"  Shape: {df_lag.shape}")
print(f"\nNext step: python train_lag.py")