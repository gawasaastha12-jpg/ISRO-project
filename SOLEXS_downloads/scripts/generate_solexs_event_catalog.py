import os
import numpy as np
import pandas as pd
import gzip
import zipfile
import tempfile
from astropy.io import fits

RAW_DIR = "../data/raw_zips"
rows = []


def extract_all(path, tmp):

    """Recursively extract ZIPs inside ZIPs"""

    with zipfile.ZipFile(path, "r") as z:
        z.extractall(tmp)

    # keep expanding nested zips
    changed = True

    while changed:
        changed = False

        for root, _, files in os.walk(tmp):
            for f in files:
                if f.endswith(".zip"):
                    full = os.path.join(root, f)

                    try:
                        with zipfile.ZipFile(full, "r") as z2:
                            z2.extractall(root)
                        os.remove(full)
                        changed = True
                    except:
                        pass


def load_counts(zip_path):

    try:
        with tempfile.TemporaryDirectory() as tmp:

            extract_all(zip_path, tmp)

            lc_files = []

            for r, _, f in os.walk(tmp):
                for file in f:
                    if file.endswith(".lc.gz"):
                        lc_files.append(os.path.join(r, file))

            if not lc_files:
                return None

            lc = lc_files[0]

            with gzip.open(lc, "rb") as fin:
                with open(tmp + "/temp.lc", "wb") as fout:
                    fout.write(fin.read())

            data = fits.open(tmp + "/temp.lc")[1].data
            counts = np.nan_to_num(np.array(data["COUNTS"]))

            return counts

    except Exception as e:
        print("Failed:", e)
        return None


zip_files = [f for f in os.listdir(RAW_DIR) if f.endswith(".zip")]

print("Found ZIP files:", len(zip_files))

for i, z in enumerate(zip_files):

    print(f"\n[{i+1}/{len(zip_files)}] Processing {z}")

    counts = load_counts(os.path.join(RAW_DIR, z))

    if counts is None:
        print("No valid LC found")
        continue

    if len(counts) < 1000:
        print("Too short")
        continue

    max_counts = np.max(counts)
    median = np.median(counts)
    peak_ratio = max_counts / (median + 1e-6)

    artifact = 1 if peak_ratio > 1000 else 0

    rows.append({
        "file": z,
        "max_counts": max_counts,
        "median_counts": median,
        "peak_ratio": peak_ratio,
        "artifact": artifact
    })

df = pd.DataFrame(rows)

out_path = "../data/processed/solexs_event_catalog.csv"
df.to_csv(out_path, index=False)

print("\nSaved:", out_path)
print("Shape:", df.shape)
print(df.head())