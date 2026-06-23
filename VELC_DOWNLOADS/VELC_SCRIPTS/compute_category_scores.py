"""
compute_category_scores.py

Computes scientific category scores from normalized VELC features.

Input:
    ../features/normalized_velc_features.csv

Output:
    ../features/category_scores/velc_category_scores.csv
"""

import os
import pandas as pd

# ============================================================
# Paths
# ============================================================

INPUT = "../features/normalized_velc_features.csv"

OUT_DIR = "../features/category_scores"
os.makedirs(OUT_DIR, exist_ok=True)

OUTPUT = os.path.join(
    OUT_DIR,
    "velc_category_scores.csv"
)

# ============================================================
# Load
# ============================================================

df = pd.read_csv(INPUT)

print("=" * 60)
print("COMPUTING SCIENTIFIC CATEGORY SCORES")
print("=" * 60)

# ============================================================
# Brightness
# ============================================================

brightness_features = [

    "mean",
    "median",
    "p90",
    "p95",
    "p99",
    "bright_pixels",
    "bright_fraction"

]

# ============================================================
# Texture
# ============================================================

texture_features = [

    "contrast",
    "homogeneity",
    "energy",
    "correlation",
    "ASM",
    "entropy"

]

# ============================================================
# Gradient
# ============================================================

gradient_features = [

    "grad_mean",
    "grad_std",
    "grad_max",
    "grad_energy"

]

# ============================================================
# Morphology
# ============================================================

morphology_features = [

    "num_regions",
    "largest_region"

]

# ============================================================
# Spatial Distribution
# ============================================================

spatial_features = [

    "left_mean",
    "right_mean",
    "top_mean",
    "bottom_mean",
    "LR_ratio",
    "TB_ratio"

]

# ============================================================
# Coronal Structure
# ============================================================

coronal_features = [

    "inner_mean",
    "outer_mean",
    "outer_inner_ratio",
    "radial_slope"

]

# ============================================================
# Mean score of each category
# ============================================================

df["Brightness_Index"] = df[brightness_features].mean(axis=1)

df["Texture_Index"] = df[texture_features].mean(axis=1)

df["Gradient_Index"] = df[gradient_features].mean(axis=1)

df["Morphology_Index"] = df[morphology_features].mean(axis=1)

df["Spatial_Index"] = df[spatial_features].mean(axis=1)

df["Coronal_Index"] = df[coronal_features].mean(axis=1)

# ============================================================
# Overall Activity
# ============================================================

scientific_indices = [

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index"

]

df["VELC_Scientific_Activity"] = (
    df[scientific_indices].mean(axis=1)
)

# ============================================================
# Keep useful columns
# ============================================================

keep = [

    "DATE-OBS",
    "filename",

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index",

    "VELC_Scientific_Activity"

]

output = df[keep]

output.to_csv(
    OUTPUT,
    index=False
)

# ============================================================
# Report
# ============================================================

print()

print("Category Statistics")

for c in scientific_indices:

    print()

    print(c)

    print(output[c].describe())

print()

print("=" * 60)

print("Top Scientific Frames")

print(
    output.sort_values(
        "VELC_Scientific_Activity",
        ascending=False
    )[
        [
            "filename",
            "VELC_Scientific_Activity"
        ]
    ].head(10)
)

print()

print("Saved")

print(OUTPUT)

print("=" * 60)