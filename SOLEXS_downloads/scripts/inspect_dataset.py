from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits

files = list(Path("../data/lc_files").rglob("*.lc.gz"))

mins = []
maxs = []
means = []

for i, file in enumerate(files, 1):

    try:
        with gzip.open(file, "rb") as f:
            hdul = fits.open(f)

            counts = np.array(
                hdul[1].data["COUNTS"],
                dtype=float
            )

        counts = counts[np.isfinite(counts)]

        mins.append(np.min(counts))
        maxs.append(np.max(counts))
        means.append(np.mean(counts))

    except Exception as e:
        print("ERROR:", file.name)

print("Files:", len(files))
print("Mean count:", np.mean(means))
print("Global min:", np.min(mins))
print("Global max:", np.max(maxs))