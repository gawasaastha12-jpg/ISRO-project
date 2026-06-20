from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits

files = list(Path("../data/lc_files").rglob("*.lc.gz"))

maxima = []

for file in files:

    try:
        with gzip.open(file, "rb") as f:
            hdul = fits.open(f)

            counts = np.array(
                hdul[1].data["COUNTS"],
                dtype=float
            )

        counts = counts[np.isfinite(counts)]

        maxima.append(np.max(counts))

    except:
        pass

maxima = np.array(maxima)

print("Files:", len(maxima))
print("Median max:", np.median(maxima))
print("95th percentile:", np.percentile(maxima,95))
print("99th percentile:", np.percentile(maxima,99))
print("Largest 20 peaks:\n")

for x in sorted(maxima, reverse=True)[:20]:
    print(int(x))