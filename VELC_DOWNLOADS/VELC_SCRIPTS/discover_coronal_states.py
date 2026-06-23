import os
import numpy as np
import pandas as pd

import matplotlib.pyplot as plt

from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score

import umap
import hdbscan

# ============================================================
# Paths
# ============================================================

MASTER_DATA = "../features/master_dataset/VELC_MASTER_DATASET.csv"

OUTPUT_DIR = "../features/natural_states"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# Load
# ============================================================

print("=" * 60)
print("DISCOVERING NATURAL CORONAL STATES")
print("=" * 60)

df = pd.read_csv(MASTER_DATA)

print(f"\nFrames : {len(df)}")

# ============================================================
# Scientific feature space
# ============================================================

FEATURES = [

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index",
    "VELC_Scientific_Activity"

]

print("\nScientific Features")

for f in FEATURES:
    print("-", f)

X = df[FEATURES].values

# ============================================================
# Normalize
# ============================================================

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

# ============================================================
# UMAP
# ============================================================

print("\nRunning UMAP...")

reducer = umap.UMAP(

    n_neighbors=10,
    min_dist=0.15,
    metric="euclidean",
    random_state=42

)

embedding = reducer.fit_transform(X_scaled)

print("Embedding shape:", embedding.shape)

# ============================================================
# HDBSCAN
# ============================================================

print("\nRunning HDBSCAN...")

clusterer = hdbscan.HDBSCAN(

    min_cluster_size=5,
    min_samples=3,
    prediction_data=True

)

labels = clusterer.fit_predict(embedding)

probability = clusterer.probabilities_

outlier_score = clusterer.outlier_scores_

df["Natural_State"] = labels
df["Cluster_Probability"] = probability
df["Outlier_Score"] = outlier_score

# ============================================================
# Statistics
# ============================================================

n_clusters = len(set(labels)) - (1 if -1 in labels else 0)

n_noise = np.sum(labels == -1)

print("\nClusters discovered :", n_clusters)
print("Noise frames        :", n_noise)

if n_clusters > 1:
    score = silhouette_score(embedding, labels)
    print("Silhouette Score    :", round(score, 3))

# ============================================================
# Cluster summary
# ============================================================

summary = []

for cluster in sorted(set(labels)):

    subset = df[df["Natural_State"] == cluster]

    row = {

        "Cluster": cluster,
        "Frames": len(subset),
        "Mean_Activity": subset["VELC_Scientific_Activity"].mean(),
        "Mean_Brightness": subset["Brightness_Index"].mean(),
        "Mean_Texture": subset["Texture_Index"].mean(),
        "Mean_Gradient": subset["Gradient_Index"].mean(),
        "Mean_Morphology": subset["Morphology_Index"].mean(),
        "Mean_Spatial": subset["Spatial_Index"].mean(),
        "Mean_Coronal": subset["Coronal_Index"].mean()

    }

    summary.append(row)

summary = pd.DataFrame(summary)

print("\nCluster Summary")
print(summary)

# ============================================================
# Save CSV
# ============================================================

df.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "hdbscan_states.csv"
    ),
    index=False
)

summary.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "cluster_summary.csv"
    ),
    index=False
)

# ============================================================
# Save Outliers
# ============================================================

outliers = df[df["Natural_State"] == -1]

outliers.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "outliers.csv"
    ),
    index=False
)

# ============================================================
# Plot 1
# ============================================================

plt.figure(figsize=(10,8))

scatter = plt.scatter(

    embedding[:,0],
    embedding[:,1],
    c=labels,
    cmap="tab20",
    s=70

)

plt.title("Natural Coronal States (HDBSCAN)")
plt.xlabel("UMAP-1")
plt.ylabel("UMAP-2")

plt.colorbar(scatter,label="Cluster")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "umap_hdbscan.png"
    ),
    dpi=300
)

plt.close()

# ============================================================
# Plot 2
# ============================================================

plt.figure(figsize=(10,8))

plt.scatter(

    embedding[:,0],
    embedding[:,1],

    c=df["VELC_Scientific_Activity"],

    cmap="plasma",

    s=70

)

plt.colorbar(label="Scientific Activity")

plt.title("Scientific Activity Across Natural States")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "activity_map.png"
    ),
    dpi=300
)

plt.close()

# ============================================================
# Plot 3
# ============================================================

plt.figure(figsize=(8,5))

summary_non_noise = summary[summary["Cluster"] != -1]

plt.bar(
    summary_non_noise["Cluster"].astype(str),
    summary_non_noise["Frames"]
)

plt.xlabel("Cluster")
plt.ylabel("Frames")
plt.title("Natural State Distribution")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "cluster_distribution.png"
    ),
    dpi=300
)

plt.close()

# ============================================================
# Save embedding
# ============================================================

embedding_df = pd.DataFrame({

    "UMAP1": embedding[:,0],
    "UMAP2": embedding[:,1],
    "Cluster": labels,
    "Probability": probability

})

embedding_df.to_csv(

    os.path.join(
        OUTPUT_DIR,
        "umap_embedding.csv"
    ),

    index=False

)

# ============================================================
# Done
# ============================================================

print("\nSaved")

print(os.path.join(OUTPUT_DIR,"hdbscan_states.csv"))
print(os.path.join(OUTPUT_DIR,"cluster_summary.csv"))
print(os.path.join(OUTPUT_DIR,"outliers.csv"))
print(os.path.join(OUTPUT_DIR,"umap_hdbscan.png"))
print(os.path.join(OUTPUT_DIR,"activity_map.png"))
print(os.path.join(OUTPUT_DIR,"cluster_distribution.png"))
print(os.path.join(OUTPUT_DIR,"umap_embedding.csv"))

print("\nNatural Coronal State Discovery Complete.")