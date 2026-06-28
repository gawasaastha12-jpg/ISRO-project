from astropy.io import fits
import pandas as pd
import numpy as np
import os

ROOT = r"C:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project\SOLEXS_downloads\data\lc_files"

print("\n" + "="*60)
print("BUILDING SOLEXS MASTER DATASET")
print("="*60)

lc_files = []

for root, dirs, files in os.walk(ROOT):
    for f in files:
        if f.endswith(".lc.gz"):
            lc_files.append(os.path.join(root, f))

print(f"\nFiles Found: {len(lc_files)}")

all_chunks = []

for i, file in enumerate(sorted(lc_files), start=1):

    print(f"[{i}/{len(lc_files)}] {os.path.basename(file)}")

    try:

        with fits.open(file) as hdul:

            data = hdul[1].data

            df = pd.DataFrame({
                "timestamp": pd.to_datetime(
                    data["TIME"],
                    unit="s",
                    utc=True
                ),
                "counts": data["COUNTS"]
            })

            detector = "SDD1" if "SDD1" in file else "SDD2"

            df["detector"] = detector
            df["source_file"] = os.path.basename(file)

            all_chunks.append(df)

    except Exception as e:

        print("FAILED:", file)
        print(e)

master = pd.concat(
    all_chunks,
    ignore_index=True
)

master = master.sort_values("timestamp")

print("\nRows:", len(master))

print("\nTime Range")
print(master.timestamp.min())
print(master.timestamp.max())

os.makedirs(
    "features/solexs",
    exist_ok=True
)

outfile = "features/solexs/SOLEXS_MASTER.csv"

master.to_csv(
    outfile,
    index=False
)

print("\nSaved:")
print(outfile)

print("\nPreview")
print(master.head())

print("\nDone.")