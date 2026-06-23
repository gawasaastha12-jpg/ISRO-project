"""
===========================================================
VELC CORONAL STATE CLASSIFICATION
===========================================================

Uses:
    ../features/category_scores/velc_category_scores.csv

Outputs:
    ../features/coronal_states/

        velc_coronal_states.csv
        cluster_centers.csv
        cluster_statistics.csv
        pca_clusters.png
        cluster_distribution.png

===========================================================
"""

import os

import matplotlib.pyplot as plt
import pandas as pd

from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# ------------------------------------------------------------

INPUT = "../features/category_scores/velc_category_scores.csv"

OUTPUT_DIR = "../features/coronal_states"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ------------------------------------------------------------

print("=" * 60)
print("CORONAL STATE CLASSIFICATION")
print("=" * 60)

df = pd.read_csv(INPUT)

# ------------------------------------------------------------
# Scientific indices
# ------------------------------------------------------------

features = [
    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index"
]

X = df[features]

print("\nUsing Features:")
for f in features:
    print(" -", f)

# ------------------------------------------------------------
# Standardize
# ------------------------------------------------------------

scaler = StandardScaler()

X_scaled = scaler.fit_transform(X)

# ------------------------------------------------------------
# KMeans
# ------------------------------------------------------------

N_CLUSTERS = 4

kmeans = KMeans(
    n_clusters=N_CLUSTERS,
    random_state=42,
    n_init=20
)

clusters = kmeans.fit_predict(X_scaled)

df["Cluster"] = clusters

# ------------------------------------------------------------
# Determine activity level of each cluster
# ------------------------------------------------------------

cluster_mean = (
    df.groupby("Cluster")["VELC_Scientific_Activity"]
      .mean()
      .sort_values()
)

ordered_clusters = cluster_mean.index.tolist()

state_names = {
    ordered_clusters[0]: "Quiet Corona",
    ordered_clusters[1]: "Structured Corona",
    ordered_clusters[2]: "Active Corona",
    ordered_clusters[3]: "Highly Structured Corona"
}

df["Coronal_State"] = df["Cluster"].map(state_names)

# ------------------------------------------------------------
# Save classified dataset
# ------------------------------------------------------------

output_csv = os.path.join(
    OUTPUT_DIR,
    "velc_coronal_states.csv"
)

df.to_csv(output_csv, index=False)

# ------------------------------------------------------------
# Cluster Centers
# ------------------------------------------------------------

centers = pd.DataFrame(
    scaler.inverse_transform(kmeans.cluster_centers_),
    columns=features
)

centers["Cluster"] = centers.index
centers["State"] = centers["Cluster"].map(state_names)

centers.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "cluster_centers.csv"
    ),
    index=False
)

# ------------------------------------------------------------
# Cluster Statistics
# ------------------------------------------------------------

stats = (
    df.groupby("Coronal_State")[features +
        ["VELC_Scientific_Activity"]]
    .agg(["mean", "std"])
)

stats.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "cluster_statistics.csv"
    )
)

# ------------------------------------------------------------
# PCA Visualization
# ------------------------------------------------------------

pca = PCA(n_components=2)

X_pca = pca.fit_transform(X_scaled)

plot_df = pd.DataFrame({
    "PC1": X_pca[:,0],
    "PC2": X_pca[:,1],
    "State": df["Coronal_State"]
})

plt.figure(figsize=(8,6))

for state in plot_df["State"].unique():

    subset = plot_df[
        plot_df["State"] == state
    ]

    plt.scatter(
        subset["PC1"],
        subset["PC2"],
        s=60,
        label=state,
        alpha=0.8
    )

plt.xlabel("Principal Component 1")
plt.ylabel("Principal Component 2")
plt.title("VELC Coronal States (PCA Projection)")
plt.legend()

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "pca_clusters.png"
    ),
    dpi=300
)

plt.close()

# ------------------------------------------------------------
# Cluster Distribution
# ------------------------------------------------------------

counts = df["Coronal_State"].value_counts()

plt.figure(figsize=(7,5))

counts.plot(kind="bar")

plt.ylabel("Frames")
plt.title("Distribution of Coronal States")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUTPUT_DIR,
        "cluster_distribution.png"
    ),
    dpi=300
)

plt.close()

# ------------------------------------------------------------
# Console Output
# ------------------------------------------------------------

print("\nCluster Mean Activity")

for c in ordered_clusters:
    print(
        f"Cluster {c} : "
        f"{state_names[c]} : "
        f"{cluster_mean[c]:.3f}"
    )

print("\nFrame Counts")

print(df["Coronal_State"].value_counts())

print("\nCluster Centers")

print(centers)

print("\nExplained Variance (PCA)")

print(pca.explained_variance_ratio_)

print("\nSaved Files")

print(output_csv)
print(os.path.join(OUTPUT_DIR, "cluster_centers.csv"))
print(os.path.join(OUTPUT_DIR, "cluster_statistics.csv"))
print(os.path.join(OUTPUT_DIR, "pca_clusters.png"))
print(os.path.join(OUTPUT_DIR, "cluster_distribution.png"))

print("\nDone.")