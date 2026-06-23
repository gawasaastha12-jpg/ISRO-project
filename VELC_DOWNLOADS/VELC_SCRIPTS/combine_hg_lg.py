"""
combine_hg_lg.py

Combines High Gain (HG) and Low Gain (LG) VELC observations
captured at the same timestamp into one unified VELC Activity Index.

Output:
features/fused_velc_activity.csv
"""

import os
import pandas as pd

# ------------------------------------------------------------------
# INPUTS
# ------------------------------------------------------------------

INPUT_CSV = "../features/activity_score/velc_activity_scores.csv"
OUTPUT_DIR = "../features/fused"

os.makedirs(OUTPUT_DIR, exist_ok=True)

OUTPUT_CSV = os.path.join(
    OUTPUT_DIR,
    "fused_velc_activity.csv"
)

# ------------------------------------------------------------------
# LOAD
# ------------------------------------------------------------------

df = pd.read_csv(INPUT_CSV)

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

# ------------------------------------------------------------------
# Detect Gain Mode from filename
# ------------------------------------------------------------------

def gain_mode(name):
    if "_HG_" in name:
        return "HG"
    elif "_LG_" in name:
        return "LG"
    else:
        return "UNKNOWN"

df["GAIN_MODE"] = df["filename"].apply(gain_mode)

# ------------------------------------------------------------------
# Sort
# ------------------------------------------------------------------

df = df.sort_values("DATE-OBS")

# ------------------------------------------------------------------
# Split HG/LG
# ------------------------------------------------------------------

hg = df[df["GAIN_MODE"] == "HG"].copy()
lg = df[df["GAIN_MODE"] == "LG"].copy()

print(f"HG Frames : {len(hg)}")
print(f"LG Frames : {len(lg)}")

# ------------------------------------------------------------------
# Rename columns
# ------------------------------------------------------------------

hg = hg.rename(columns={
    "activity_score": "HG_activity"
})

lg = lg.rename(columns={
    "activity_score": "LG_activity"
})

# ------------------------------------------------------------------
# Merge on observation time
# ------------------------------------------------------------------

merged = pd.merge_asof(
    hg.sort_values("DATE-OBS"),
    lg.sort_values("DATE-OBS"),
    on="DATE-OBS",
    direction="nearest",
    tolerance=pd.Timedelta(seconds=2),
    suffixes=("_HG", "_LG")
)

# ------------------------------------------------------------------
# Fused Activity Index
# ------------------------------------------------------------------

merged["VELC_activity_index"] = (
    merged["HG_activity"] +
    merged["LG_activity"]
) / 2

# ------------------------------------------------------------------
# Trend
# ------------------------------------------------------------------

merged["activity_change"] = (
    merged["VELC_activity_index"].diff()
)

def classify(x):

    if pd.isna(x):
        return "Stable"

    if x > 0.5:
        return "Increasing"

    if x < -0.5:
        return "Decreasing"

    return "Stable"

merged["activity_trend"] = merged["activity_change"].apply(classify)

# ------------------------------------------------------------------
# Keep useful columns
# ------------------------------------------------------------------

final = merged[[
    "DATE-OBS",
    "VELC_activity_index",
    "activity_change",
    "activity_trend",
    "HG_activity",
    "LG_activity",
    "filename_HG",
    "filename_LG"
]]

# ------------------------------------------------------------------
# Save
# ------------------------------------------------------------------

final.to_csv(
    OUTPUT_CSV,
    index=False
)

# ------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------

print("\n==============================")
print("VELC HG/LG Fusion Complete")
print("==============================")

print("\nOutput:")
print(OUTPUT_CSV)

print("\nFrames:")
print(len(final))

print("\nActivity Index Statistics")
print(final["VELC_activity_index"].describe())

print("\nTrend Counts")
print(final["activity_trend"].value_counts())

print("\nTop Activity Frames")
print(
    final.sort_values(
        "VELC_activity_index",
        ascending=False
    )[
        [
            "DATE-OBS",
            "VELC_activity_index",
            "activity_trend"
        ]
    ].head(10)
)