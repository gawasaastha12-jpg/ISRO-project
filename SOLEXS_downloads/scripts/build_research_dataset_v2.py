import numpy as np
import pandas as pd
from pathlib import Path
from astropy.io import fits
from scipy.signal import find_peaks, peak_widths
from scipy.stats import skew, kurtosis

# ----------------------------
# PATHS
# ----------------------------
DATA_DIR = Path("../data/processed/extracted")
OUTPUT = Path("../data/processed/dataset_research_v2.csv")

rows = []

# ----------------------------
# SAFE FITS READER
# ----------------------------
def read_counts(file_path):

    try:
        hdul = fits.open(file_path)
        data = hdul[1].data

        if "COUNTS" not in data.columns.names:
            return None

        counts = np.array(data["COUNTS"])
        counts = np.nan_to_num(counts)

        return counts

    except Exception as e:
        print("FITS error:", file_path, e)
        return None


# ----------------------------
# FEATURE ENGINEERING
# ----------------------------
def features(window):

    peaks, _ = find_peaks(window)

    energy = np.sum(window)
    snr = np.mean(window) / (np.std(window) + 1e-6)

    iqr = np.percentile(window, 75) - np.percentile(window, 25)

    if len(peaks) > 0:
        widths = peak_widths(window, peaks)[0]
        largest_width = np.max(widths)
        peak_max = np.max(window[peaks])
    else:
        largest_width = 0
        peak_max = 0

    return {
        "mean": np.mean(window),
        "median": np.median(window),
        "std": np.std(window),
        "iqr": iqr,
        "skew": skew(window),
        "kurtosis": kurtosis(window),
        "energy": energy,
        "snr": snr,
        "max": np.max(window),
        "min": np.min(window),
        "peak_ratio": peak_max / (np.median(window) + 1e-6),
        "largest_width": largest_width,
        "peak_count": len(peaks),
    }


# ----------------------------
# LABELING (STABLE VERSION)
# ----------------------------
def label(window):

    peaks, _ = find_peaks(window)

    if len(peaks) == 0:
        return 0  # quiet

    peak_ratio = np.max(window) / (np.median(window) + 1e-6)

    if peak_ratio > 1000:
        return 5  # artifact
    elif peak_ratio < 3:
        return 0
    elif peak_ratio < 10:
        return 1
    elif peak_ratio < 50:
        return 2
    elif peak_ratio < 200:
        return 3
    else:
        return 4


# ----------------------------
# MAIN LOOP
# ----------------------------
lc_files = list(DATA_DIR.rglob("*.lc.gz"))

print(f"Found {len(lc_files)} LC files")

WINDOW = 900
STEP = 300

for i, f in enumerate(lc_files):

    if i % 50 == 0:
        print(f"Processing {i}/{len(lc_files)}")

    counts = read_counts(f)

    if counts is None or len(counts) < WINDOW:
        continue

    for start in range(0, len(counts) - WINDOW, STEP):

        window = counts[start:start + WINDOW]

        row = features(window)
        row["label"] = label(window)
        row["source_file"] = f.name

        rows.append(row)


# ----------------------------
# SAVE
# ----------------------------
df = pd.DataFrame(rows)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT, index=False)

print("\n===================")
print("Saved:", OUTPUT)
print("Shape:", df.shape)
print(df["label"].value_counts())