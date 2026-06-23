import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pathlib import Path
from sklearn.preprocessing import MinMaxScaler

# ==========================================================
# Paths
# ==========================================================

FEATURE_FILE = "../features/velc_temporal_features.csv"
OUTPUT_DIR = "../features/activity_score"

Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)

# ==========================================================
# Load data
# ==========================================================

df = pd.read_csv(FEATURE_FILE)

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

# ==========================================================
# Determine Gain Mode
# ==========================================================

df["GAIN_MODE"] = np.where(
    df["filename"].str.contains("_HG_"),
    "HG",
    "LG"
)

print("=" * 60)
print("GAIN COUNTS")
print("=" * 60)
print(df["GAIN_MODE"].value_counts())

# ==========================================================
# Features used for activity score
# ==========================================================

FEATURES = [
    "bright_fraction",
    "grad_energy",
    "outer_inner_ratio",
    "num_regions"
]

print("\nFeatures used:")
for f in FEATURES:
    print(" -", f)

# ==========================================================
# Compute activity score independently for HG/LG
# ==========================================================

all_frames = []

for gain in ["HG", "LG"]:

    subset = df[df["GAIN_MODE"] == gain].copy()

    scaler = MinMaxScaler()

    subset[FEATURES] = scaler.fit_transform(subset[FEATURES])

    subset["activity_score"] = (
            subset["bright_fraction"] * 0.35 +
            subset["grad_energy"] * 0.30 +
            subset["outer_inner_ratio"] * 0.20 +
            subset["num_regions"] * 0.15
    ) * 100

    all_frames.append(subset)

df = pd.concat(all_frames)

# ==========================================================
# Activity Level
# ==========================================================

conditions = [
    df.activity_score < 25,
    (df.activity_score >= 25) & (df.activity_score < 50),
    (df.activity_score >= 50) & (df.activity_score < 75),
    df.activity_score >= 75
]

labels = [
    "Quiet",
    "Moderate",
    "High",
    "Very High"
]

df["activity_level"] = np.select(
    conditions,
    labels,
    default="Quiet"
)

# ==========================================================
# Trend
# ==========================================================

df = df.sort_values("DATE-OBS")

df["activity_change"] = (
    df.groupby("GAIN_MODE")["activity_score"]
      .diff()
)

trend = []

for change in df["activity_change"]:

    if pd.isna(change):
        trend.append("Start")

    elif change > 2:
        trend.append("Increasing")

    elif change < -2:
        trend.append("Decreasing")

    else:
        trend.append("Stable")

df["trend"] = trend

# ==========================================================
# Save CSV
# ==========================================================

output_csv = Path(OUTPUT_DIR) / "velc_activity_scores.csv"

df.to_csv(output_csv, index=False)

# ==========================================================
# Statistics
# ==========================================================

print("\n")
print("=" * 60)
print("OVERALL ACTIVITY STATISTICS")
print("=" * 60)

print(df["activity_score"].describe())

print("\n")

print("=" * 60)
print("BY GAIN")
print("=" * 60)

print(
    df.groupby("GAIN_MODE")["activity_score"].describe()
)

print("\n")

print("=" * 60)
print("Activity Levels")
print("=" * 60)

print(df["activity_level"].value_counts())

# ==========================================================
# Top Frames
# ==========================================================

print("\n")

print("=" * 60)
print("Top 10 Most Active Frames")
print("=" * 60)

print(
    df.sort_values(
        "activity_score",
        ascending=False
    )[
        [
            "filename",
            "GAIN_MODE",
            "activity_score",
            "activity_level",
            "trend"
        ]
    ].head(10)
)

# ==========================================================
# Plot HG/LG separately
# ==========================================================

plt.figure(figsize=(14,6))

for gain in ["HG", "LG"]:

    subset = df[df["GAIN_MODE"] == gain]

    plt.plot(
        subset["DATE-OBS"],
        subset["activity_score"],
        marker="o",
        label=gain
    )

plt.legend()

plt.title("VELC Activity Score Over Time")

plt.xlabel("Observation Time")

plt.ylabel("Activity Score")

plt.grid(True)

plt.tight_layout()

plt.savefig(
    Path(OUTPUT_DIR) /
    "activity_score_timeseries.png",
    dpi=300
)

plt.close()

# ==========================================================
# Histogram
# ==========================================================

plt.figure(figsize=(8,5))

for gain in ["HG", "LG"]:

    subset = df[df["GAIN_MODE"] == gain]

    plt.hist(
        subset["activity_score"],
        bins=12,
        alpha=0.6,
        label=gain
    )

plt.xlabel("Activity Score")

plt.ylabel("Count")

plt.title("Activity Score Distribution")

plt.legend()

plt.tight_layout()

plt.savefig(
    Path(OUTPUT_DIR) /
    "activity_score_histogram.png",
    dpi=300
)

plt.close()

print("\nPlots saved.")

print("\nSaved:")
print(output_csv)

print("\nDone.")