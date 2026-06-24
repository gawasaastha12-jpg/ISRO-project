import pandas as pd
import numpy as np
import os

print("="*60)
print("VELC ANOMALY EXPLANATIONS")
print("="*60)

# ============================================================
# LOAD DATA
# ============================================================

df = pd.read_csv(
    "../features/novelty_detection/velc_novelty_scores.csv"
)

# ============================================================
# SCIENTIFIC FEATURES
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

print()
print("Scientific Dimensions")
for f in features:
    print("-", f)

# ============================================================
# POPULATION STATISTICS
# ============================================================

means = df[features].mean()
stds = df[features].std()

# avoid divide-by-zero
stds = stds.replace(0, 1e-9)

# ============================================================
# ONLY ANALYZE ANOMALIES
# ============================================================

anomalies = df[
    df["Novelty_Class"] != "Normal"
].copy()

print()
print("Anomalies Found:", len(anomalies))

# ============================================================
# EXPLAIN EACH ANOMALY
# ============================================================

records = []

for idx, row in anomalies.iterrows():

    zscores = {}

    for f in features:

        z = (
            row[f] - means[f]
        ) / stds[f]

        zscores[f] = z

    ranked = sorted(
        zscores.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )

    top1 = ranked[0]
    top2 = ranked[1]
    top3 = ranked[2]

    records.append({

        "Frame_ID":
            idx,

        "filename":
            row["filename"],

        "DATE-OBS":
            row.get("DATE-OBS", ""),

        "Novelty_Score":
            row["Novelty_Score"],

        "Novelty_Class":
            row["Novelty_Class"],

        "Coronal_State":
            row.get("Coronal_State", ""),

        "Most_Anomalous_Feature":
            top1[0],

        "Most_Anomalous_Z":
            round(top1[1], 3),

        "Second_Feature":
            top2[0],

        "Second_Z":
            round(top2[1], 3),

        "Third_Feature":
            top3[0],

        "Third_Z":
            round(top3[1], 3)

    })

# ============================================================
# SAVE
# ============================================================

expl = pd.DataFrame(records)

outdir = "../features/anomaly_explanations"
os.makedirs(outdir, exist_ok=True)

expl.to_csv(
    f"{outdir}/anomaly_explanations.csv",
    index=False
)

# ============================================================
# SUMMARY
# ============================================================

print()
print("Top 10 Strongest Anomalies")

show_cols = [
    "filename",
    "Novelty_Score",
    "Coronal_State",
    "Most_Anomalous_Feature",
    "Most_Anomalous_Z"
]

print(
    expl.sort_values(
        "Novelty_Score",
        ascending=False
    )[show_cols]
    .head(10)
)

print()
print("Most Frequently Abnormal Features")

feature_counts = pd.concat([
    expl["Most_Anomalous_Feature"],
    expl["Second_Feature"],
    expl["Third_Feature"]
]).value_counts()

print(feature_counts)

print()
print("Saved")
print(
    f"{outdir}/anomaly_explanations.csv"
)

print()
print("Example Explanation")

if len(expl) > 0:

    ex = expl.sort_values(
        "Novelty_Score",
        ascending=False
    ).iloc[0]

    print()
    print("Frame:")
    print(ex["filename"])

    print()
    print("Novelty Score:",
          round(ex["Novelty_Score"],3))

    print("State:",
          ex["Coronal_State"])

    print()

    print(
        f"1. {ex['Most_Anomalous_Feature']} "
        f"(z={ex['Most_Anomalous_Z']})"
    )

    print(
        f"2. {ex['Second_Feature']} "
        f"(z={ex['Second_Z']})"
    )

    print(
        f"3. {ex['Third_Feature']} "
        f"(z={ex['Third_Z']})"
    )

print()
print("Done.")