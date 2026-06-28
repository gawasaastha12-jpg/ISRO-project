import os
import glob
import warnings

import numpy as np
import pandas as pd

from astropy.io import fits
from scipy.signal import find_peaks

warnings.filterwarnings("ignore")

# ============================================================
# CONFIG
# ============================================================

ROOT = r"C:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project\SOLEXS_downloads\data\lc_files"

OUTDIR = r".\features\solexs_flares"
os.makedirs(OUTDIR, exist_ok=True)

OUTFILE = os.path.join(
    OUTDIR,
    "SOLEXS_FLARE_CATALOG.csv"
)

SIGMA_MULTIPLIER = 5
MIN_PEAK_DISTANCE = 60      # seconds
MIN_COUNTS = 20

# ============================================================
# FIND FILES
# ============================================================

files = sorted(
    glob.glob(
        os.path.join(ROOT, "**", "*.lc.gz"),
        recursive=True
    )
)

print("\n" + "=" * 60)
print("SOLEXS FLARE DETECTION")
print("=" * 60)

print(f"\nFiles Found: {len(files)}")

if len(files) == 0:
    raise RuntimeError("No .lc.gz files found")

# ============================================================
# STORAGE
# ============================================================

flare_rows = []

# ============================================================
# PROCESS EACH FILE
# ============================================================

for i, file in enumerate(files, start=1):

    print(f"[{i}/{len(files)}] {os.path.basename(file)}")

    try:

        with fits.open(file) as hdul:

            data = hdul[1].data

            time = np.array(data["TIME"], dtype=float)
            counts = np.array(data["COUNTS"], dtype=float)

        # ----------------------------------------
        # Remove NaNs
        # ----------------------------------------

        mask = np.isfinite(counts)

        time = time[mask]
        counts = counts[mask]

        if len(counts) < 100:
            continue

        # ----------------------------------------
        # Background estimation
        # ----------------------------------------

        background = np.nanmedian(counts)

        sigma = np.nanstd(counts)

        threshold = background + SIGMA_MULTIPLIER * sigma

        # ----------------------------------------
        # Peak detection
        # ----------------------------------------

        peaks, props = find_peaks(
            counts,
            height=max(threshold, MIN_COUNTS),
            distance=MIN_PEAK_DISTANCE
        )

        if len(peaks) == 0:
            continue

        detector = "UNKNOWN"

        if "SDD1" in file:
            detector = "SDD1"

        elif "SDD2" in file:
            detector = "SDD2"

        # ----------------------------------------
        # Store peaks
        # ----------------------------------------

        for p in peaks:

            peak_time = pd.to_datetime(
                time[p],
                unit="s",
                utc=True
            )

            peak_counts = float(counts[p])

            significance = (
                (peak_counts - background)
                / (sigma + 1e-9)
            )

            if significance >= 20:
                flare_class = "Extreme"

            elif significance >= 10:
                flare_class = "Major"

            elif significance >= 5:
                flare_class = "Moderate"

            else:
                flare_class = "Minor"

            flare_rows.append({
                "peak_time": peak_time,
                "peak_counts": peak_counts,
                "background": background,
                "sigma": sigma,
                "significance": significance,
                "flare_class": flare_class,
                "detector": detector,
                "source_file": os.path.basename(file)
            })

    except Exception as e:

        print("ERROR:", os.path.basename(file))
        print(e)

# ============================================================
# RESULTS
# ============================================================

catalog = pd.DataFrame(flare_rows)

if len(catalog) == 0:

    print("\nNo flares detected.")
    raise SystemExit

catalog = catalog.sort_values(
    "peak_time"
).reset_index(drop=True)

catalog.to_csv(
    OUTFILE,
    index=False
)

# ============================================================
# SUMMARY
# ============================================================

print("\n" + "=" * 60)
print("DETECTION COMPLETE")
print("=" * 60)

print("\nDetected Events:", len(catalog))

print("\nFlare Classes")

print(
    catalog["flare_class"]
    .value_counts()
)

print("\nTop 20 Strongest")

print(
    catalog
    .sort_values(
        "significance",
        ascending=False
    )
    .head(20)
)

print("\nSaved:")

print(OUTFILE)