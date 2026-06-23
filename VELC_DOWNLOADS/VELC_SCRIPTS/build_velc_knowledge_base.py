import os
import json
import numpy as np
import pandas as pd

from sklearn.metrics.pairwise import cosine_similarity

print("=" * 60)
print("BUILDING VELC KNOWLEDGE BASE")
print("=" * 60)

# ----------------------------------------------------------
# Load master dataset
# ----------------------------------------------------------

MASTER = "../features/master_dataset/VELC_MASTER_DATASET.csv"

df = pd.read_csv(MASTER)

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

df = df.sort_values("DATE-OBS").reset_index(drop=True)

print("\nFrames :", len(df))

# ----------------------------------------------------------
# Scientific feature space
# ----------------------------------------------------------

feature_columns = [

    "Brightness_Index",
    "Texture_Index",
    "Gradient_Index",
    "Morphology_Index",
    "Spatial_Index",
    "Coronal_Index",
    "VELC_Scientific_Activity"

]

print("\nScientific Dimensions")

for f in feature_columns:
    print("-", f)

X = df[feature_columns].values

# ----------------------------------------------------------
# Cosine similarity
# ----------------------------------------------------------

similarity = cosine_similarity(X)

print("\nSimilarity Matrix Shape")

print(similarity.shape)

# ----------------------------------------------------------
# Build knowledge objects
# ----------------------------------------------------------

knowledge = []

for i in range(len(df)):

    sims = similarity[i]

    nearest = np.argsort(sims)[::-1]

    nearest = nearest[nearest != i][:5]

    obj = {

        "Frame_ID": int(i),

        "DATE-OBS": str(df.loc[i, "DATE-OBS"]),

        "filename": df.loc[i, "filename"],

        "Coronal_State": df.loc[i, "Coronal_State"],

        "Scientific_Activity":
            float(df.loc[i, "VELC_Scientific_Activity"]),

        "Activity_Index":
            float(df.loc[i, "VELC_activity_index"]),

        "Scientific_Features": {

            c: float(df.loc[i, c])

            for c in feature_columns

        },

        "Previous_Frame":

            int(i-1) if i > 0 else None,

        "Next_Frame":

            int(i+1) if i < len(df)-1 else None,

        "Nearest_Neighbours": [

            {

                "Frame_ID": int(j),

                "Similarity": float(sims[j]),

                "DATE-OBS": str(df.loc[j, "DATE-OBS"]),

                "Coronal_State":
                    df.loc[j, "Coronal_State"],

                "Activity":
                    float(df.loc[j,
                                 "VELC_Scientific_Activity"])

            }

            for j in nearest

        ]

    }

    knowledge.append(obj)

# ----------------------------------------------------------
# Save JSON
# ----------------------------------------------------------

output_dir = "../features/knowledge_base"

os.makedirs(output_dir, exist_ok=True)

json_file = os.path.join(
    output_dir,
    "velc_knowledge_base.json"
)

with open(json_file, "w") as f:

    json.dump(
        knowledge,
        f,
        indent=4
    )

# ----------------------------------------------------------
# Save similarity matrix
# ----------------------------------------------------------

sim_df = pd.DataFrame(
    similarity,
    index=df["filename"],
    columns=df["filename"]
)

sim_file = os.path.join(
    output_dir,
    "similarity_matrix.csv"
)

sim_df.to_csv(sim_file)

# ----------------------------------------------------------
# Summary
# ----------------------------------------------------------

print("\nKnowledge Objects")

print(len(knowledge))

print("\nExample Object\n")

print(json.dumps(
    knowledge[0],
    indent=4
)[:1500])

print("\nSaved")

print(json_file)

print(sim_file)

print("\nKnowledge Base Complete")