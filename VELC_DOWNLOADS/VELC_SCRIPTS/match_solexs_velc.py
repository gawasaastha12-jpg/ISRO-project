import pandas as pd
import numpy as np
from pathlib import Path

# ============================================================
# Paths (EDIT THESE)
# ============================================================

SOLEXS_CSV = r"C:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project\SOLEXS\features\solexs_features.csv"

VELC_CSV = r"..\features\velc_features.csv"

OUTPUT_DIR = Path("../fusion")
OUTPUT_DIR.mkdir(exist_ok=True)

OUTPUT_FILE = OUTPUT_DIR / "solexs_velc_fused.csv"

# ============================================================
# Load datasets
# ============================================================

print("\nLoading datasets...")

solexs = pd.read_csv(SOLEXS_CSV)
velc = pd.read_csv(VELC_CSV)

print("SOLEXS:", solexs.shape)
print("VELC :", velc.shape)

# ============================================================
# Parse timestamps
# ============================================================

solexs["DATE-OBS"] = pd.to_datetime(solexs["DATE-OBS"])
velc["DATE-OBS"] = pd.to_datetime(velc["DATE-OBS"])

solexs = solexs.sort_values("DATE-OBS")
velc = velc.sort_values("DATE-OBS")

# ============================================================
# Rename VELC columns
# ============================================================

velc_columns = []

for c in velc.columns:

    if c == "DATE-OBS":
        continue

    new_name = "VELC_" + c

    velc.rename(columns={c: new_name}, inplace=True)

    velc_columns.append(new_name)

# ============================================================
# Merge using nearest timestamp
# ============================================================

print("\nMatching nearest VELC frame...")

merged = pd.merge_asof(
    solexs,
    velc,
    on="DATE-OBS",
    direction="nearest",
    tolerance=pd.Timedelta("60s")
)

# ============================================================
# Calculate time difference
# ============================================================

# Save matched timestamp before renaming if desired
# Here we use merge_asof index alignment

merged["VELC_MATCH_FOUND"] = ~merged["VELC_filename"].isna()

print()

print("Matched rows :", merged["VELC_MATCH_FOUND"].sum())
print("Unmatched    :", (~merged["VELC_MATCH_FOUND"]).sum())

# ============================================================
# Save
# ============================================================

merged.to_csv(OUTPUT_FILE, index=False)

print("\nSaved")

print(OUTPUT_FILE)

print("\nFinal Shape")

print(merged.shape)

print("\nColumns")

print(merged.columns.tolist())