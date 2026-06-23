import os
import numpy as np
import pandas as pd
from sklearn.cluster import HDBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

# ============================================================
# Paths
# ============================================================

MASTER = "../features/master_dataset/VELC_MASTER_DATASET.csv"

OUTPUT = "../features/fused_states"

os.makedirs(OUTPUT, exist_ok=True)

# ============================================================
# Load
# ============================================================

print("="*60)
print("BUILDING FUSED CORONAL STATES")
print("="*60)

df = pd.read_csv(MASTER)

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

print("\nFrames :", len(df))

# ============================================================
# Scientific Features
# ============================================================

features = [

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index",
    "VELC_Scientific_Activity"

]

# ============================================================
# Split HG/LG
# ============================================================

hg = df[df["CHANNEL"]=="HG"].copy()

lg = df[df["CHANNEL"]=="LG"].copy()

print("HG :", len(hg))
print("LG :", len(lg))

# ============================================================
# Merge by timestamp
# ============================================================

merged = pd.merge_asof(

    hg.sort_values("DATE-OBS"),

    lg.sort_values("DATE-OBS"),

    on="DATE-OBS",

    direction="nearest",

    tolerance=pd.Timedelta("1 second"),

    suffixes=("_HG","_LG")

)

merged = merged.dropna().reset_index(drop=True)

print("\nMerged Observations :", len(merged))

# ============================================================
# Build fused feature space
# ============================================================

for f in features:

    merged[f] = (

        merged[f+"_HG"] +

        merged[f+"_LG"]

    ) / 2

# ============================================================
# Standardize
# ============================================================

X = merged[features]

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

# ============================================================
# Discover natural fused states
# ============================================================

clusterer = HDBSCAN(

    min_cluster_size=4,

    min_samples=2

)

labels = clusterer.fit_predict(X_scaled)

merged["Fused_State"] = labels

print("\nClusters discovered :", len(np.unique(labels)))

# ============================================================
# PCA
# ============================================================

pca = PCA(n_components=2)

embedding = pca.fit_transform(X_scaled)

merged["PC1"] = embedding[:,0]

merged["PC2"] = embedding[:,1]

# ============================================================
# Cluster Statistics
# ============================================================

summary = merged.groupby("Fused_State")[features].mean()

summary["Frames"] = merged.groupby("Fused_State").size()

summary = summary.reset_index()

print("\nCluster Summary")

print(summary)

# ============================================================
# Save
# ============================================================

merged.to_csv(

    os.path.join(

        OUTPUT,

        "fused_coronal_states.csv"

    ),

    index=False

)

summary.to_csv(

    os.path.join(

        OUTPUT,

        "cluster_summary.csv"

    ),

    index=False

)

# ============================================================
# PCA Plot
# ============================================================

plt.figure(figsize=(8,6))

scatter = plt.scatter(

    merged["PC1"],

    merged["PC2"],

    c=merged["Fused_State"],

    s=60

)

plt.xlabel("PC1")

plt.ylabel("PC2")

plt.title("Fused Coronal States")

plt.colorbar(scatter)

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "fused_states_pca.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Timeline
# ============================================================

plt.figure(figsize=(12,4))

plt.plot(

    merged["DATE-OBS"],

    merged["Fused_State"],

    marker="o"

)

plt.xlabel("Time")

plt.ylabel("State")

plt.title("Fused Coronal State Evolution")

plt.grid(True)

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "state_timeline.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Activity Timeline
# ============================================================

plt.figure(figsize=(12,4))

plt.plot(

    merged["DATE-OBS"],

    merged["VELC_Scientific_Activity"],

    linewidth=2

)

plt.xlabel("Time")

plt.ylabel("Scientific Activity")

plt.title("Fused Scientific Activity")

plt.grid(True)

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "activity_timeline.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Console
# ============================================================

print("\nSaved")

print(os.path.join(OUTPUT,"fused_coronal_states.csv"))

print(os.path.join(OUTPUT,"cluster_summary.csv"))

print(os.path.join(OUTPUT,"fused_states_pca.png"))

print(os.path.join(OUTPUT,"state_timeline.png"))

print(os.path.join(OUTPUT,"activity_timeline.png"))

print("\nDone.")