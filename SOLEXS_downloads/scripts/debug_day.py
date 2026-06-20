from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits

file = Path(
    "../data/lc_files/AL1_SLX_L1_20240514_v1.0/SDD2/AL1_SOLEXS_20240514_SDD2_L1.lc.gz"
)

print("Exists:", file.exists())

with gzip.open(file, "rb") as f:
    hdul = fits.open(f)

    print("HDUs:", len(hdul))
    hdul.info()

    data = hdul[1].data

    print("\nColumns:")
    print(data.columns)

    counts = np.array(data["COUNTS"], dtype=float)

print("\nLength:", len(counts))
print("NaNs:", np.isnan(counts).sum())
print("Finite:", np.isfinite(counts).sum())
print("Min:", np.nanmin(counts))
print("Max:", np.nanmax(counts))

print("\nFirst 20 values:")
print(counts[:20])

print("\nLast 20 values:")
print(counts[-20:])