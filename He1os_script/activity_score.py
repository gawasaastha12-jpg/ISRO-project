"""
activity_score.py
=================

Builds a continuous HEL1OS activity score from Level-1 hard X-ray
time-series.

Input
-----
HEL1OS_TIMESERIES.csv

Columns:
    timestamp
    count_rate
    background
    excess

Output
------
HEL1OS_ACTIVITY.csv

Columns include:
    rolling statistics
    gradients
    energy
    event density
    activity score (0-100)
    activity state

Author:
ISRO Solar Flare Forecasting Pipeline
"""

import argparse
import os

import numpy as np
import pandas as pd


# ------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------

ROLLING_WINDOWS = {
    "10": 10,
    "30": 30,
    "60": 60,
}

EVENT_THRESHOLD_SIGMA = 3.0


# ------------------------------------------------------------
# Utilities
# ------------------------------------------------------------

def normalize(series):
    """
    Robust Min-Max normalization.
    """

    s = series.copy()

    low = s.quantile(0.01)
    high = s.quantile(0.99)

    s = s.clip(low, high)

    rng = high - low

    if rng == 0:
        return pd.Series(np.zeros(len(s)), index=s.index)

    return (s - low) / rng


def assign_state(score):

    if score < 20:
        return "Quiet"

    elif score < 40:
        return "Elevated"

    elif score < 70:
        return "Active"

    else:
        return "Highly Active"


# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

def compute_activity(df):

    df = df.copy()

    df["timestamp"] = pd.to_datetime(df["timestamp"])

    df = df.sort_values("timestamp").reset_index(drop=True)

    # --------------------------------------------------------
    # Rolling statistics
    # --------------------------------------------------------

    for label, win in ROLLING_WINDOWS.items():

        df[f"rolling_mean_{label}"] = (
            df["excess"]
            .rolling(win, min_periods=1)
            .mean()
        )

        df[f"rolling_std_{label}"] = (
            df["excess"]
            .rolling(win, min_periods=1)
            .std()
            .fillna(0)
        )

        df[f"rolling_max_{label}"] = (
            df["excess"]
            .rolling(win, min_periods=1)
            .max()
        )

        df[f"rolling_energy_{label}"] = (
            (df["excess"] ** 2)
            .rolling(win, min_periods=1)
            .sum()
        )

    # --------------------------------------------------------
    # Gradient
    # --------------------------------------------------------

    df["gradient"] = df["excess"].diff().fillna(0)

    df["gradient_acceleration"] = (
        df["gradient"]
        .diff()
        .fillna(0)
    )

    # --------------------------------------------------------
    # Volatility
    # --------------------------------------------------------

    df["volatility"] = (
        df["rolling_std_60"] /
        (df["rolling_mean_60"].abs() + 1e-6)
    )

    # --------------------------------------------------------
    # Signal-to-noise
    # --------------------------------------------------------

    df["snr"] = (
        df["rolling_mean_60"] /
        (df["rolling_std_60"] + 1e-6)
    )

    # --------------------------------------------------------
    # Z-score
    # --------------------------------------------------------

    df["zscore"] = (
        (df["excess"] - df["rolling_mean_60"]) /
        (df["rolling_std_60"] + 1e-6)
    )

    # --------------------------------------------------------
    # Event density
    # --------------------------------------------------------

    event_mask = (
        df["zscore"] >
        EVENT_THRESHOLD_SIGMA
    ).astype(int)

    df["event_density"] = (
        event_mask
        .rolling(60, min_periods=1)
        .sum()
    )

    # --------------------------------------------------------
    # Normalize features
    # --------------------------------------------------------

    df["norm_excess"] = normalize(df["excess"])

    df["norm_mean"] = normalize(df["rolling_mean_60"])

    df["norm_energy"] = normalize(df["rolling_energy_60"])

    df["norm_gradient"] = normalize(df["gradient"].abs())

    df["norm_volatility"] = normalize(df["volatility"])

    df["norm_density"] = normalize(df["event_density"])

    # --------------------------------------------------------
    # Activity Score
    # --------------------------------------------------------

    df["activity_score"] = (
        0.30 * df["norm_excess"] +
        0.20 * df["norm_mean"] +
        0.15 * df["norm_energy"] +
        0.15 * df["norm_gradient"] +
        0.10 * df["norm_volatility"] +
        0.10 * df["norm_density"]
    )

    df["activity_score"] *= 100

    df["activity_score"] = (
        df["activity_score"]
        .clip(0, 100)
        .round(2)
    )

    # --------------------------------------------------------
    # Activity State
    # --------------------------------------------------------

    df["activity_state"] = (
        df["activity_score"]
        .apply(assign_state)
    )

    return df


# ------------------------------------------------------------
# CLI
# ------------------------------------------------------------

def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--input",
        default="features/hel1os_flares/HEL1OS_TIMESERIES.csv"
    )

    parser.add_argument(
        "--output",
        default="features/hel1os_flares/HEL1OS_ACTIVITY.csv"
    )

    args = parser.parse_args()

    print("=" * 60)
    print("HEL1OS Activity Score Builder")
    print("=" * 60)

    print(f"Loading : {args.input}")

    df = pd.read_csv(args.input)

    print(f"Samples : {len(df):,}")

    activity = compute_activity(df)

    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    activity.to_csv(args.output, index=False)

    print()
    print(f"Saved : {args.output}")

    print()

    print("Activity Distribution")

    print(
        activity["activity_state"]
        .value_counts()
        .sort_index()
    )

    print()

    print("Score Statistics")

    print(
        activity["activity_score"]
        .describe()
    )


if __name__ == "__main__":
    main()