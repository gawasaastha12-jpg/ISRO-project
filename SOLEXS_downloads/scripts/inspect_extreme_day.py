from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits
import matplotlib.pyplot as plt

file = next(
    Path("../data/lc_files").rglob(
        "*20250729*lc.gz"
    )
)

with gzip.open(file, "rb") as f:
    hdul = fits.open(f)

    counts = np.array(
        hdul[1].data["COUNTS"],
        dtype=float
    )

counts = counts[np.isfinite(counts)]

print("Length:", len(counts))
print("Max:", counts.max())
print("Index:", np.argmax(counts))

idx = np.argmax(counts)

print(
    counts[max(0,idx-20):idx+20]
)

plt.figure(figsize=(12,5))
plt.plot(counts)
plt.show()