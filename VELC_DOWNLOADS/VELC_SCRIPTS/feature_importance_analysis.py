import os

import numpy as np
import pandas as pd

import matplotlib.pyplot as plt

from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA

# -------------------------------------------------

FEATURE_FILE = "../features/velc_features.csv"

OUT_DIR = "../features/feature_importance"

os.makedirs(OUT_DIR, exist_ok=True)

# -------------------------------------------------

df = pd.read_csv(FEATURE_FILE)

# Keep filename separately
filename = df["filename"]

# Remove metadata

drop_cols = [
    "filename",
    "DATE-OBS",
    "GAIN",
    "TEMP",
    "CHANNEL",
    "FRAMEBIN",
    "ROI"
]

features = df.drop(columns=drop_cols)

print("="*60)
print("Feature Analysis")
print("="*60)

print()

print("Samples :", len(features))
print("Features:", len(features.columns))

# -------------------------------------------------
# Variance
# -------------------------------------------------

variance = features.var().sort_values(ascending=False)

variance.to_csv(
    os.path.join(
        OUT_DIR,
        "feature_variance_rank.csv"
    )
)

# -------------------------------------------------
# Coefficient of Variation
# -------------------------------------------------

cv = (features.std() / features.mean().abs())

cv = cv.replace([np.inf, -np.inf], np.nan)

cv = cv.fillna(0)

cv = cv.sort_values(ascending=False)

cv.to_csv(
    os.path.join(
        OUT_DIR,
        "feature_cv_rank.csv"
    )
)

# -------------------------------------------------
# Correlation
# -------------------------------------------------

corr = features.corr()

corr.to_csv(
    os.path.join(
        OUT_DIR,
        "feature_correlation.csv"
    )
)

# -------------------------------------------------
# PCA
# -------------------------------------------------

scaler = StandardScaler()

X = scaler.fit_transform(features)

pca = PCA()

pca.fit(X)

importance = np.abs(pca.components_[0])

importance = pd.Series(
    importance,
    index=features.columns
)

importance = importance.sort_values(
    ascending=False
)

importance.to_csv(
    os.path.join(
        OUT_DIR,
        "pca_feature_importance.csv"
    )
)

# -------------------------------------------------
# Plot PCA importance
# -------------------------------------------------

plt.figure(figsize=(10,7))

importance.head(20).sort_values().plot.barh()

plt.title("Top PCA Feature Importance")

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUT_DIR,
        "pca_importance.png"
    )
)

plt.close()

# -------------------------------------------------
# Explained variance
# -------------------------------------------------

plt.figure(figsize=(8,5))

plt.plot(
    np.cumsum(
        pca.explained_variance_ratio_
    ),
    marker="o"
)

plt.xlabel("Principal Components")

plt.ylabel("Cumulative Explained Variance")

plt.grid(True)

plt.tight_layout()

plt.savefig(
    os.path.join(
        OUT_DIR,
        "pca_variance.png"
    )
)

plt.close()

# -------------------------------------------------

print()

print("Top 10 PCA Features")

print()

print(importance.head(10))

print()

print("Top 10 Variance Features")

print()

print(variance.head(10))

print()

print("Top 10 Coefficient of Variation")

print()

print(cv.head(10))

print()

print("="*60)

print("Saved to")

print(OUT_DIR)