import pandas as pd
import numpy as np
import os

from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

import matplotlib.pyplot as plt

print("="*60)
print("VELC NOVELTY DETECTION")
print("="*60)

df = pd.read_csv(
    "../features/master_dataset/VELC_MASTER_DATASET.csv"
)

features = [
    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index",
    "VELC_Scientific_Activity"
]

X = df[features]

print()
print("Frames :", len(df))

print()
print("Scientific Features")
for f in features:
    print("-", f)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

model = IsolationForest(
    n_estimators=300,
    contamination=0.1,
    random_state=42
)

model.fit(X_scaled)

scores = -model.score_samples(X_scaled)

df["Novelty_Score"] = scores

p75 = np.percentile(scores, 75)
p90 = np.percentile(scores, 90)

def classify(score):

    if score >= p90:
        return "Highly Anomalous"

    elif score >= p75:
        return "Unusual"

    return "Normal"

df["Novelty_Class"] = df["Novelty_Score"].apply(classify)

outdir = "../features/novelty_detection"
os.makedirs(outdir, exist_ok=True)

df.to_csv(
    f"{outdir}/velc_novelty_scores.csv",
    index=False
)

top = df.sort_values(
    "Novelty_Score",
    ascending=False
)

top.head(20).to_csv(
    f"{outdir}/top_anomalies.csv",
    index=False
)

plt.figure(figsize=(8,5))
plt.hist(df["Novelty_Score"], bins=20)
plt.xlabel("Novelty Score")
plt.ylabel("Frames")
plt.title("VELC Novelty Distribution")
plt.tight_layout()

plt.savefig(
    f"{outdir}/novelty_distribution.png",
    dpi=300
)

print()
print("Novelty Statistics")
print(df["Novelty_Score"].describe())

print()
print("Novelty Classes")
print(df["Novelty_Class"].value_counts())

print()
print("Top 10 Anomalies")

cols = [
    "filename",
    "Novelty_Score",
    "Novelty_Class",
    "Coronal_State"
]

print(
    top[cols].head(10)
)

print()
print("Saved")
print(f"{outdir}/velc_novelty_scores.csv")
print(f"{outdir}/top_anomalies.csv")
print(f"{outdir}/novelty_distribution.png")