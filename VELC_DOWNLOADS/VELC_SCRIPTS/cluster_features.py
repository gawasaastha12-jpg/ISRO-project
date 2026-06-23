import os

import pandas as pd
import matplotlib.pyplot as plt

from sklearn.preprocessing import StandardScaler

from scipy.cluster.hierarchy import linkage
from scipy.cluster.hierarchy import dendrogram
from scipy.cluster.hierarchy import fcluster

# -------------------------------------------------------

FEATURE_FILE = "../features/velc_features.csv"

OUT_DIR = "../features/feature_clusters"

os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------------

df = pd.read_csv(FEATURE_FILE)

drop_cols = [
    "filename",
    "DATE-OBS",
    "GAIN",
    "TEMP",
    "CHANNEL",
    "FRAMEBIN",
    "ROI"
]

X = df.drop(columns=drop_cols)

feature_names = X.columns.tolist()

# -------------------------------------------------------
# Standardize
# -------------------------------------------------------

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

# -------------------------------------------------------
# Feature-feature correlation
# -------------------------------------------------------

corr = pd.DataFrame(
    X_scaled,
    columns=feature_names
).corr()

# -------------------------------------------------------
# Distance matrix
# -------------------------------------------------------

distance = 1 - corr.abs()

# -------------------------------------------------------
# Hierarchical clustering
# -------------------------------------------------------

Z = linkage(
    distance,
    method="ward"
)

# -------------------------------------------------------
# Dendrogram
# -------------------------------------------------------

plt.figure(figsize=(18,8))

dendrogram(
    Z,
    labels=feature_names,
    leaf_rotation=90,
    leaf_font_size=8
)

plt.title("VELC Feature Hierarchical Clustering")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUT_DIR,
        "feature_dendrogram.png"
    ),
    dpi=300
)

plt.close()

# -------------------------------------------------------
# Create clusters
# -------------------------------------------------------

clusters = fcluster(
    Z,
    t=4,
    criterion="maxclust"
)

cluster_df = pd.DataFrame({

    "Feature":feature_names,

    "Cluster":clusters

})

cluster_df = cluster_df.sort_values("Cluster")

cluster_df.to_csv(

    os.path.join(

        OUT_DIR,

        "feature_clusters.csv"

    ),

    index=False

)

# -------------------------------------------------------
# Print clusters
# -------------------------------------------------------

print("="*60)
print("FEATURE CLUSTERS")
print("="*60)

for c in sorted(cluster_df.Cluster.unique()):

    print()

    print(f"Cluster {c}")

    print("-"*30)

    feats = cluster_df[
        cluster_df.Cluster==c
    ]["Feature"]

    for f in feats:
        print(" ",f)

print()

print("="*60)

print("Saved")

print(" feature_clusters.csv")
print(" feature_dendrogram.png")