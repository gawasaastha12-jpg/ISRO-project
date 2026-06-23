import pandas as pd
import matplotlib.pyplot as plt
from pathlib import Path

# ------------------------------------
# Load metadata
# ------------------------------------

df = pd.read_csv("../features/velc_metadata.csv")

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

df = df.sort_values("DATE-OBS")

# ------------------------------------
# Numerical features only
# ------------------------------------

exclude = [
    "filename",
    "DATE",
    "TIME",
    "DATE-OBS",
    "CHANNEL",
    "GAIN",
    "ROI",
    "Exposure"
]

numeric_cols = []

for c in df.columns:
    if c in exclude:
        continue

    if pd.api.types.is_numeric_dtype(df[c]):
        numeric_cols.append(c)

# ------------------------------------
# Temporal change
# ------------------------------------

for col in numeric_cols:

    df[col + "_change"] = df[col].diff()

# ------------------------------------
# Save
# ------------------------------------

out = "../features/temporal"

Path(out).mkdir(exist_ok=True)

df.to_csv(
    f"{out}/velc_temporal_features.csv",
    index=False
)

# ------------------------------------
# Plot important features
# ------------------------------------

important = [

    "mean",
    "std",
    "entropy",
    "bright_fraction",
    "grad_energy",
    "outer_inner_ratio"

]

for feature in important:

    plt.figure(figsize=(10,4))

    plt.plot(
        df["DATE-OBS"],
        df[feature],
        marker="o",
        linewidth=1
    )

    plt.title(feature)

    plt.grid(True)

    plt.tight_layout()

    plt.savefig(
        f"{out}/{feature}_timeseries.png"
    )

    plt.close()

# ------------------------------------
# Change plots
# ------------------------------------

for feature in important:

    plt.figure(figsize=(10,4))

    plt.plot(
        df["DATE-OBS"],
        df[feature+"_change"],
        color="red",
        marker="o"
    )

    plt.title(feature + " change")

    plt.grid(True)

    plt.tight_layout()

    plt.savefig(
        f"{out}/{feature}_change.png"
    )

    plt.close()

print("="*60)
print("Temporal analysis complete")
print("="*60)

print(df.head())