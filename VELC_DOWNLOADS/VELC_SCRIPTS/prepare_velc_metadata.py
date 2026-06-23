import pandas as pd
from pathlib import Path

# --------------------------------------------------
# Load extracted features
# --------------------------------------------------

csv_path = Path("../features/velc_features.csv")

df = pd.read_csv(csv_path)

print("Loaded:", df.shape)

# --------------------------------------------------
# Convert observation time
# --------------------------------------------------

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

# --------------------------------------------------
# Exposure type (HG / LG)
# --------------------------------------------------

def get_gain(filename):
    if "_HG_" in filename:
        return "HG"
    elif "_LG_" in filename:
        return "LG"
    return "Unknown"

df["Exposure"] = df["filename"].apply(get_gain)

# --------------------------------------------------
# Observation date
# --------------------------------------------------

df["DATE"] = df["DATE-OBS"].dt.date

# --------------------------------------------------
# Observation time only
# --------------------------------------------------

df["TIME"] = df["DATE-OBS"].dt.time

# --------------------------------------------------
# Frame index
# --------------------------------------------------

df = df.sort_values("DATE-OBS").reset_index(drop=True)

df["Frame_ID"] = range(len(df))

# --------------------------------------------------
# Time difference from previous frame
# --------------------------------------------------

df["delta_seconds"] = (
    df["DATE-OBS"].diff().dt.total_seconds()
)

df["delta_seconds"] = df["delta_seconds"].fillna(0)

# --------------------------------------------------
# Rearrange columns
# --------------------------------------------------

front = [

    "Frame_ID",

    "DATE-OBS",
    "DATE",
    "TIME",

    "Exposure",

    "CHANNEL",
    "GAIN",
    "TEMP",

    "FRAMEBIN",
    "ROI",

    "filename"
]

others = [c for c in df.columns if c not in front]

df = df[front + others]

# --------------------------------------------------
# Save
# --------------------------------------------------

out = "../features/velc_metadata.csv"

df.to_csv(out, index=False)

print("\nSaved")

print(out)

print("\nFirst rows\n")

print(df.head())

print("\nTime span")

print(df["DATE-OBS"].min())

print(df["DATE-OBS"].max())

print("\nExposure counts")

print(df["Exposure"].value_counts())