"""
similarity_search.py

Builds a similarity database for VELC observations.

Input:
../features/category_scores/velc_category_scores.csv

Output:
../features/similarity/
    similarity_matrix.csv
    nearest_neighbors.csv
"""

import os
import numpy as np
import pandas as pd

from sklearn.metrics.pairwise import cosine_similarity

# ============================================================
# Paths
# ============================================================

INPUT = "../features/category_scores/velc_category_scores.csv"

OUTPUT_DIR = "../features/similarity"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# Load data
# ============================================================

df = pd.read_csv(INPUT)

print("=" * 60)
print("VELC SIMILARITY SEARCH ENGINE")
print("=" * 60)
print()

# ============================================================
# Scientific feature space
# ============================================================

FEATURES = [

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index"

]

print("Scientific Feature Space")
for f in FEATURES:
    print(" -", f)

print()

X = df[FEATURES].values

# ============================================================
# Cosine similarity
# ============================================================

sim = cosine_similarity(X)

similarity_df = pd.DataFrame(
    sim,
    index=df["filename"],
    columns=df["filename"]
)

similarity_df.to_csv(
    os.path.join(
        OUTPUT_DIR,
        "similarity_matrix.csv"
    )
)

print("Similarity Matrix Saved")
print()

# ============================================================
# Top K neighbors
# ============================================================

TOP_K = 5

rows = []

for i in range(len(df)):

    scores = sim[i].copy()

    # ignore self
    scores[i] = -1

    idx = np.argsort(scores)[::-1][:TOP_K]

    for rank, j in enumerate(idx, start=1):

        rows.append({

            "Query_Frame":

                df.loc[i, "filename"],

            "Neighbor_Rank":

                rank,

            "Neighbor_Frame":

                df.loc[j, "filename"],

            "Similarity":

                round(scores[j], 6),

            "Query_State":

                df.loc[i, "Coronal_State"],

            "Neighbor_State":

                df.loc[j, "Coronal_State"],

            "Same_State":

                df.loc[i, "Coronal_State"]
                ==
                df.loc[j, "Coronal_State"]

        })

neighbors = pd.DataFrame(rows)

neighbors.to_csv(

    os.path.join(
        OUTPUT_DIR,
        "nearest_neighbors.csv"
    ),
    index=False

)

# ============================================================
# Statistics
# ============================================================

print("=" * 60)
print("Similarity Statistics")
print("=" * 60)

print()

print(neighbors["Similarity"].describe())

print()

print("Average Similarity:",
      round(neighbors["Similarity"].mean(), 4))

print()

print("Frames whose nearest neighbour has same coronal state:")

same = neighbors[
    neighbors["Neighbor_Rank"] == 1
]["Same_State"].mean()

print(f"{same*100:.2f}%")

print()

print("=" * 60)
print("Example Neighbours")
print("=" * 60)

for frame in df["filename"][:5]:

    print()
    print(frame)

    temp = neighbors[
        neighbors["Query_Frame"] == frame
    ]

    print(
        temp[
            [
                "Neighbor_Rank",
                "Neighbor_Frame",
                "Similarity",
                "Neighbor_State"
            ]
        ]
    )

print()

print("=" * 60)
print("Saved")
print("=" * 60)

print(os.path.join(OUTPUT_DIR, "similarity_matrix.csv"))
print(os.path.join(OUTPUT_DIR, "nearest_neighbors.csv"))