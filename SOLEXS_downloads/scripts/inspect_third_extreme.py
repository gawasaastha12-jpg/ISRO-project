from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits

target = "20250211"

file = next(
    Path("../data/lc_files").rglob(
        f"*{target}*lc.gz"
    )
)

with gzip.open(file,"rb") as f:
    hdul = fits.open(f)

    counts = np.array(
        hdul[1].data["COUNTS"],
        dtype=float
    )

counts = counts[np.isfinite(counts)]

idx = np.argmax(counts)

print("Max:", counts.max())
print("Index:", idx)

print(
    counts[max(0,idx-50):idx+50]
)