"""
build_fusion_dataset.py
===========================================================
Build a synchronized SOLEXS + HEL1OS forecasting dataset.

Purpose
-------
This script fuses handcrafted SoLEXS window features with
synchronized HEL1OS activity features using timestamp matching.

Pipeline
--------
SOLEXS dataset (window_mid_time)
            │
            ▼
Convert Unix timestamp → datetime
            │
            ▼
Filter to overlapping observation period
            │
            ▼
Nearest-time merge with HEL1OS
            │
            ▼
Append HEL1OS activity features
            │
            ▼
dataset_research_v9_fusion.csv

Author : Aastha 
===========================================================
"""

import argparse
import os

import numpy as np
import pandas as pd
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ==========================================================
# CONFIG
# ==========================================================

HEL_COLS = [
    "timestamp",
    "activity_score",
    "count_rate",
    "excess",
    "gradient",
    "gradient_acceleration",
    "volatility",
    "snr",
    "event_density",
    "rolling_mean_60",
    "rolling_std_60",
    "rolling_energy_60",
    "activity_state",
]

STATE_MAP = {
    "Quiet": 0,
    "Elevated": 1,
    "Active": 2,
    "Highly Active": 3,
}

DEFAULT_SOLEXS = ROOT / "SOLEXS_downloads" / "data" / "processed" / "dataset_research_v5.csv"

DEFAULT_HELIOS = ROOT / "He1os_script" / "features" / "hel1os_flares" / "HEL1OS_ACTIVITY.csv"

DEFAULT_OUTPUT = ROOT / "fusion_engine" / "FUSION_DATASET.csv"

MERGE_TOLERANCE = "10s"


# ==========================================================
# LOAD
# ==========================================================

def load_datasets(solexs_path, helios_path):

    print("=" * 60)
    print("Loading datasets")
    print("=" * 60)

    solexs = pd.read_csv(solexs_path)
    helios = pd.read_csv(helios_path)

    print(f"SOLEXS : {len(solexs):,} rows")
    print(f"HEL1OS : {len(helios):,} rows")

    return solexs, helios


# ==========================================================
# PREPARE
# ==========================================================

def prepare_data(solexs, helios):

    print("\nPreparing timestamps...")

    # Keep the original Unix timestamp and create a new datetime column
    solexs["window_mid_dt"] = (
        pd.to_datetime(
            solexs["window_mid_time"],
            unit="s"
        ).astype("datetime64[ns]")
    )

    helios["timestamp"] = (
        pd.to_datetime(
            helios["timestamp"]
        ).astype("datetime64[ns]")
    )

    print("\nObservation overlap")
    print("---------------------")

    overlap_start = max(
        solexs["window_mid_dt"].min(),
        helios["timestamp"].min()
    )

    overlap_end = min(
        solexs["window_mid_dt"].max(),
        helios["timestamp"].max()
    )

    print("Start :", overlap_start)
    print("End   :", overlap_end)

    before = len(solexs)

    solexs = solexs[
        (solexs["window_mid_dt"] >= overlap_start) &
        (solexs["window_mid_dt"] <= overlap_end)
    ].copy()

    after = len(solexs)

    print(f"\nRemoved {before-after:,} non-overlapping windows")

    # merge_asof requires sorted keys
    solexs = solexs.sort_values("window_mid_dt").reset_index(drop=True)
    helios = helios.sort_values("timestamp").reset_index(drop=True)

    return solexs, helios

# ==========================================================
# MERGE
# ==========================================================

def merge_datasets(solexs, helios):

    print("\nPerforming nearest timestamp merge...")

    print("\nSOLEXS timestamps")
    print(solexs["window_mid_dt"].head())

    print("\nHEL1OS timestamps")
    print(helios["timestamp"].head())

    print("\nSOLEXS dtype")
    print(solexs["window_mid_dt"].dtype)

    print("\nHEL1OS dtype")
    print(helios["timestamp"].dtype)

    print(solexs["window_mid_dt"].iloc[0])
    print(helios["timestamp"].iloc[0])

    print()

    print(solexs["window_mid_dt"].iloc[100])
    print(helios["timestamp"].iloc[100])

    print("\nSOLEXS")
    print(solexs["window_mid_dt"].head(20))

    print("\nHEL1OS")
    print(helios["timestamp"].head(20))

    fusion = pd.merge_asof(
        solexs,
        helios[HEL_COLS],
        left_on="window_mid_dt",
        right_on="timestamp",
        direction="nearest",
        tolerance=pd.Timedelta(MERGE_TOLERANCE),
    )

    before = len(fusion)

    fusion = fusion.dropna(subset=["activity_score"]).copy()

    print(f"Matched rows : {len(fusion):,}")
    print(f"Dropped      : {before-len(fusion):,}")

    return fusion


# ==========================================================
# FEATURE ENGINEERING
# ==========================================================

def build_hel_features(df):

    print("\nBuilding HEL1OS context features...")

    df["hel_state"] = (
        df["activity_state"]
        .map(STATE_MAP)
        .fillna(0)
        .astype(int)
    )

    df["hel_time_diff_sec"] = (
        df["window_mid_dt"] -
        df["timestamp"]
    ).dt.total_seconds().abs()

    df["hel_activity_delta"] = (
        df["activity_score"].diff().fillna(0)
    )

    df["hel_activity_acceleration"] = (
        df["hel_activity_delta"].diff().fillna(0)
    )

    df["hel_activity_roll30"] = (
        df["activity_score"]
        .rolling(30, min_periods=1)
        .mean()
    )

    df["hel_activity_roll60"] = (
        df["activity_score"]
        .rolling(60, min_periods=1)
        .mean()
    )

    return df

# ==========================================================
# QUALITY REPORT
# ==========================================================

def quality_report(df):
    """
    Generate and print a quality report for the fused dataset.
    """
    print("\n" + "=" * 60)
    print("FUSION DATASET QUALITY REPORT")
    print("=" * 60)

    # 1. Row/Col counts
    print(f"Total rows    : {len(df):,}")
    print(f"Total columns : {len(df.columns)}")

    # 2. Missing values
    missing = df.isnull().sum()
    missing_cols = missing[missing > 0]
    if not missing_cols.empty:
        print("\nMissing values:")
        for col, count in missing_cols.items():
            print(f"  - {col}: {count:,} ({count / len(df) * 100:.2f}%)")
    else:
        print("\nNo missing values found in any columns!")

    # 3. Time lag statistics
    if "hel_time_diff_sec" in df.columns:
        print("\nMerge time difference statistics (seconds):")
        print(df["hel_time_diff_sec"].describe())

    # 4. Activity State/Label distribution
    if "activity_state" in df.columns:
        print("\nHEL1OS Activity State Distribution:")
        print(df["activity_state"].value_counts(dropna=False))

    if "hel_state" in df.columns:
        print("\nHEL1OS Numeric State Distribution:")
        print(df["hel_state"].value_counts(dropna=False))

    # 5. Temporal ranges
    time_cols = [c for c in ["window_mid_dt", "timestamp"] if c in df.columns]
    for col in time_cols:
        print(f"\nTime range for '{col}':")
        print(f"  Min: {df[col].min()}")
        print(f"  Max: {df[col].max()}")

    print("=" * 60 + "\n")


# ==========================================================
# SAVE
# ==========================================================

def save_dataset(df, outfile):

    outfile = Path(outfile)

    # Create output directory if it doesn't exist
    outfile.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Save CSV
    df.to_csv(outfile, index=False)

    print("\n" + "=" * 60)
    print("Fusion dataset saved successfully")
    print("=" * 60)

    print(f"Output : {outfile}")
    print(f"Shape  : {df.shape}")

    print("\nColumns added from HEL1OS:")
    print([
        "activity_score",
        "count_rate",
        "excess",
        "gradient",
        "gradient_acceleration",
        "volatility",
        "snr",
        "event_density",
        "rolling_mean_60",
        "rolling_std_60",
        "rolling_energy_60",
        "activity_state",
        "hel_state",
        "hel_time_diff_sec",
        "hel_activity_delta",
        "hel_activity_acceleration",
        "hel_activity_roll30",
        "hel_activity_roll60",
    ])

# ==========================================================
# MAIN
# ==========================================================

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--solexs",
        default=str(DEFAULT_SOLEXS),
    )

    parser.add_argument(
        "--helios",
        default=str(DEFAULT_HELIOS),
    )

    parser.add_argument(
        "--output",
        default=str(DEFAULT_OUTPUT),
    )

    args = parser.parse_args()

    solexs, helios = load_datasets(
        args.solexs,
        args.helios,
    )

    solexs, helios = prepare_data(
        solexs,
        helios,
    )

    fusion = merge_datasets(
        solexs,
        helios,
    )

    fusion = build_hel_features(
        fusion,
    )

    quality_report(
        fusion,
    )

    save_dataset(
        fusion,
        args.output,
    )


if __name__ == "__main__":
    main()