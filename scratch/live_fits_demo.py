import gzip
from astropy.io import fits
import numpy as np
import time
import sys
sys.path.append('../SOLEXS_downloads/scripts')
from features_v2 import extract_features

FITS_FILE = r"../SOLEXS_downloads/data/lc_files/AL1_SLX_L1_20250211_v1.0/SDD2/AL1_SOLEXS_20250211_SDD2_L1.lc.gz"

print("=== LIVE FITS INGESTION DEMO ===")
print(f"Opening: {FITS_FILE}")

with gzip.open(FITS_FILE) as f:
    hdul = fits.open(f)
    data = hdul[1].data
    counts = data['COUNTS'].astype(float)
    times  = data['TIME'].astype(float)
    hdul.close()

print(f"Loaded {len(counts)} time samples")
print(f"Time range: {times[0]:.1f} to {times[-1]:.1f} seconds")
print(f"Peak counts: {max(counts):.1f}")
print(f"Mean counts: {np.mean(counts):.2f}")

# Sliding window demo
WINDOW = 600
STEP   = 10
print(f"\nRunning sliding window feature extraction (window={WINDOW}s, step={STEP}s)...")

for i in range(0, min(len(counts)-WINDOW, 500), STEP):
    window = counts[i:i+WINDOW]
    feats  = extract_features(window)
    print(f"  t={times[i]:.0f}s | mean={feats['mean']:.2f} | "
          f"max={feats['max']:.1f} | "
          f"prominence_multiple={feats.get('prominence_multiple',0):.3f}")
    time.sleep(0.1)

print("\nFITS ingestion complete.")