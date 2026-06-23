import os
import warnings

import pandas as pd
import matplotlib.pyplot as plt

from sklearn.preprocessing import StandardScaler
import umap.umap_ as umap

warnings.filterwarnings("ignore")

print("="*60)
print("VELC UMAP VISUALIZATION")
print("="*60)

# -------------------------------------------------------
# Load dataset
# -------------------------------------------------------

FILE = "../features/master_dataset/VELC_MASTER_DATASET.csv"

df = pd.read_csv(FILE)

print("\nFrames:", len(df))

# -------------------------------------------------------
# Scientific feature selection
# -------------------------------------------------------

exclude = [
    "DATE-OBS",
    "filename",
    "GAIN",
    "TEMP",
    "CHANNEL",
    "FRAMEBIN",
    "ROI",
    "Cluster",
    "Coronal_State"
]

feature_columns = []

for c in df.columns:

    if c in exclude:
        continue

    if pd.api.types.is_numeric_dtype(df[c]):
        feature_columns.append(c)

print("\nScientific Features Used:", len(feature_columns))

for f in feature_columns:
    print("-", f)

# -------------------------------------------------------
# Standardize
# -------------------------------------------------------

X = df[feature_columns].copy()

X = X.fillna(X.mean())

scaler = StandardScaler()

X = scaler.fit_transform(X)

# -------------------------------------------------------
# UMAP
# -------------------------------------------------------

print("\nRunning UMAP...")

reducer = umap.UMAP(
    n_neighbors=12,
    min_dist=0.15,
    metric="euclidean",
    random_state=42
)

embedding = reducer.fit_transform(X)

df["UMAP1"] = embedding[:,0]
df["UMAP2"] = embedding[:,1]

print("Embedding Shape:", embedding.shape)

# -------------------------------------------------------
# Save embedding
# -------------------------------------------------------

outdir = "../features/umap"

os.makedirs(outdir, exist_ok=True)

df.to_csv(
    os.path.join(outdir,"velc_umap.csv"),
    index=False
)

# -------------------------------------------------------
# Plot by coronal state
# -------------------------------------------------------

plt.figure(figsize=(10,8))

states = df["Coronal_State"].unique()

for state in states:

    subset = df[df["Coronal_State"] == state]

    plt.scatter(
        subset["UMAP1"],
        subset["UMAP2"],
        s=70,
        alpha=0.8,
        label=state
    )

plt.legend()

plt.xlabel("UMAP-1")
plt.ylabel("UMAP-2")

plt.title("VELC UMAP Projection (Coronal States)")

plt.tight_layout()

plt.savefig(
    os.path.join(outdir,"umap_coronal_states.png"),
    dpi=300
)

plt.close()

# -------------------------------------------------------
# Plot scientific activity
# -------------------------------------------------------

plt.figure(figsize=(10,8))

sc = plt.scatter(
    df["UMAP1"],
    df["UMAP2"],
    c=df["VELC_Scientific_Activity"],
    s=70,
    cmap="plasma"
)

plt.colorbar(sc,label="Scientific Activity")

plt.xlabel("UMAP-1")
plt.ylabel("UMAP-2")

plt.title("VELC Scientific Activity Manifold")

plt.tight_layout()

plt.savefig(
    os.path.join(outdir,"umap_activity.png"),
    dpi=300
)

plt.close()

# -------------------------------------------------------
# Plot observation order
# -------------------------------------------------------

plt.figure(figsize=(10,8))

plt.plot(
    df["UMAP1"],
    df["UMAP2"],
    '-o',
    linewidth=1,
    markersize=3
)

plt.xlabel("UMAP-1")
plt.ylabel("UMAP-2")

plt.title("Temporal Evolution Through UMAP Space")

plt.tight_layout()

plt.savefig(
    os.path.join(outdir,"umap_temporal_path.png"),
    dpi=300
)

plt.close()

# -------------------------------------------------------
# Save coordinates
# -------------------------------------------------------

coords = df[
    [
        "DATE-OBS",
        "filename",
        "Coronal_State",
        "VELC_Scientific_Activity",
        "UMAP1",
        "UMAP2"
    ]
]

coords.to_csv(
    os.path.join(outdir,"umap_coordinates.csv"),
    index=False
)

print("\nSaved")

print("velc_umap.csv")
print("umap_coordinates.csv")
print("umap_coronal_states.png")
print("umap_activity.png")
print("umap_temporal_path.png")

print("\nDone.")