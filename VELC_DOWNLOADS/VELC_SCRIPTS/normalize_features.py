"""
normalize_features.py

Normalizes VELC numerical features into the range [0,1]
using Min-Max normalization.

Output:
../features/normalized_velc_features.csv
"""

import os
import numpy as np
import pandas as pd

# ==========================================================
# Paths
# ==========================================================

INPUT_CSV = "../features/velc_features.csv"
OUTPUT_DIR = "../features"
OUTPUT_CSV = os.path.join(OUTPUT_DIR, "normalized_velc_features.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ==========================================================
# Load Dataset
# ==========================================================

df = pd.read_csv(INPUT_CSV)

print("=" * 60)
print("VELC FEATURE NORMALIZATION")
print("=" * 60)

print(f"\nFrames : {len(df)}")
print(f"Columns: {len(df.columns)}")

# ==========================================================
# Metadata columns (do NOT normalize)
# ==========================================================

metadata_columns = [
    "DATE-OBS",
    "GAIN",
    "TEMP",
    "CHANNEL",
    "FRAMEBIN",
    "ROI",
    "filename"
]

# ==========================================================
# Find numeric scientific features
# ==========================================================

numeric_columns = []

for col in df.columns:

    if col in metadata_columns:
        continue

    if pd.api.types.is_numeric_dtype(df[col]):
        numeric_columns.append(col)

print(f"\nScientific Features Found : {len(numeric_columns)}")

# ==========================================================
# Normalize
# ==========================================================

normalized = df.copy()

constant_features = []

for col in numeric_columns:

    minimum = df[col].min()
    maximum = df[col].max()

    if minimum == maximum:
        normalized[col] = 0.0
        constant_features.append(col)
        continue

    normalized[col] = (df[col] - minimum) / (maximum - minimum)

# ==========================================================
# Save
# ==========================================================

normalized.to_csv(OUTPUT_CSV, index=False)

# ==========================================================
# Report
# ==========================================================

print("\nConstant Features (set to 0):")

if len(constant_features) == 0:
    print("None")

else:
    for c in constant_features:
        print(" -", c)

print("\nChecking normalization...")

mins = normalized[numeric_columns].min().round(4)
maxs = normalized[numeric_columns].max().round(4)

print("\nMinimum values:")
print(mins.head(10))

print("\nMaximum values:")
print(maxs.head(10))

print("\nSaved:")
print(OUTPUT_CSV)

print("\nPreview:")
print(normalized.head())

print("\nNormalization Complete.")
print("=" * 60)