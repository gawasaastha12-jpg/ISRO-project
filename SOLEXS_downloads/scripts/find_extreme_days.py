from pathlib import Path
import gzip
import numpy as np
from astropy.io import fits

files = list(Path("../data/lc_files").rglob("*.lc.gz"))

results = []

for file in files:

    try:
        with gzip.open(file,"rb") as f:
            hdul = fits.open(f)

            counts = np.array(
                hdul[1].data["COUNTS"],
                dtype=float
            )

        counts = counts[np.isfinite(counts)]

        results.append(
            (np.max(counts), file.name)
        )

    except:
        pass

results.sort(reverse=True)

for peak, name in results[:20]:
    print(f"{int(peak):>10}   {name}")