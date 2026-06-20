from pathlib import Path
import gzip
import numpy as np
import pandas as pd
from astropy.io import fits

rows = []

files = sorted(
    Path("../data/lc_files").rglob("*.lc.gz")
)

print("Files found:", len(files))

for i, file in enumerate(files, 1):

    try:

        with gzip.open(file, "rb") as f:
            hdul = fits.open(f)

            counts = np.array(
                hdul[1].data["COUNTS"],
                dtype=float
            )

        counts = counts[np.isfinite(counts)]

        if len(counts) == 0:
            continue

        date = file.name.split("_")[2]

        max_counts = float(np.max(counts))
        mean_counts = float(np.mean(counts))
        median_counts = float(np.median(counts))

        peak_ratio = (
            max_counts /
            (median_counts + 1e-6)
        )

        artifact = int(
            peak_ratio > 1000
        )

        rows.append({
            "date": date,
            "max_counts": max_counts,
            "mean_counts": mean_counts,
            "median_counts": median_counts,
            "peak_ratio": peak_ratio,
            "artifact": artifact
        })

        if i % 50 == 0:
            print(i, "/", len(files))

    except Exception as e:

        print(
            "ERROR:",
            file.name,
            str(e)
        )

df = pd.DataFrame(rows)

df = df.sort_values(
    "date"
)

df.to_csv(
    "event_catalog.csv",
    index=False
)

print()
print("Saved:", len(df), "rows")
print()

print(
    df.sort_values(
        "max_counts",
        ascending=False
    ).head(20)
)