import pandas as pd
import os

print("=" * 60)
print("BUILDING VELC MASTER DATASET")
print("=" * 60)

# ============================================================
# Load datasets
# ============================================================

features = pd.read_csv("../features/velc_features.csv")

normalized = pd.read_csv("../features/normalized_velc_features.csv")

category = pd.read_csv(
    "../features/category_scores/velc_category_scores.csv"
)

coronal = pd.read_csv(
    "../features/coronal_states/velc_coronal_states.csv"
)

fused = pd.read_csv(
    "../features/fused/fused_velc_activity.csv"
)

print("\nLoaded")

print("Features    :", features.shape)
print("Normalized  :", normalized.shape)
print("Category    :", category.shape)
print("Coronal     :", coronal.shape)
print("Fused       :", fused.shape)

# ============================================================
# Convert timestamps
# ============================================================

for df in [features, normalized, category, coronal]:
    if "DATE-OBS" in df.columns:
        df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

fused["DATE-OBS"] = pd.to_datetime(fused["DATE-OBS"])

# ============================================================
# Build master dataset
# ============================================================

master = features.copy()

# ------------------------------------------------------------
# Add normalized features
# ------------------------------------------------------------

norm_cols = [
    c for c in normalized.columns
    if c not in master.columns
]

master = pd.concat(
    [
        master,
        normalized[norm_cols]
    ],
    axis=1
)

# ------------------------------------------------------------
# Add scientific category scores
# ------------------------------------------------------------

cat_cols = [
    c for c in category.columns
    if c not in master.columns
]

master = pd.concat(
    [
        master,
        category[cat_cols]
    ],
    axis=1
)

# ------------------------------------------------------------
# Add coronal states
# ------------------------------------------------------------

cor_cols = [
    c for c in coronal.columns
    if c not in master.columns
]

master = pd.concat(
    [
        master,
        coronal[cor_cols]
    ],
    axis=1
)

# ------------------------------------------------------------
# Merge HG/LG fused activity
# ------------------------------------------------------------

master = master.merge(
    fused,
    on="DATE-OBS",
    how="left"
)

# ============================================================
# Remove duplicated columns
# ============================================================

master = master.loc[:, ~master.columns.duplicated()]

# ============================================================
# Sort
# ============================================================

master = master.sort_values("DATE-OBS")

# ============================================================
# Save
# ============================================================

out_dir = "../features/master_dataset"
os.makedirs(out_dir, exist_ok=True)

outfile = os.path.join(
    out_dir,
    "VELC_MASTER_DATASET.csv"
)

master.to_csv(outfile, index=False)

# ============================================================
# Summary
# ============================================================

print("\nMaster Dataset")

print(master.shape)

print("\nColumns")

for c in master.columns:
    print("-", c)

print("\nSaved")

print(outfile)

print("\nPreview")

print(master.head())

print("\nDone.")