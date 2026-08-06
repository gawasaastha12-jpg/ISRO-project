"""
write_predictions.py
--------------------
Continuous live prediction pipeline.
- Cycles through the FITS file indefinitely (simulating a live telemetry feed)
- Uses WALL-CLOCK UTC time for timestamps in the CSV so the dashboard sees standardized rows
- Prints local IST time to the terminal for easy monitoring
- Writes a new row every STEP_SECS seconds to team_predictions.csv
- Run with: python logs/write_predictions.py
"""

import csv
import time
import gzip
import numpy as np
import joblib
import pandas as pd
import sys
import os
import uuid
from astropy.io import fits
from datetime import datetime, timezone, timedelta

# ── Paths ──────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)

scripts_path = os.path.join(ROOT_DIR, 'SOLEXS_downloads', 'scripts')
if scripts_path not in sys.path:
    sys.path.append(scripts_path)

from features_v2 import extract_features

MODEL_FILE    = os.path.join(ROOT_DIR, "SOLEXS_downloads", "models", "model_forecast_5min.pkl")
FITS_FILE     = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data", "lc_files",
                              "AL1_SLX_L1_20250211_v1.0", "SDD2",
                              "AL1_SOLEXS_20250211_SDD2_L1.lc.gz")
OUTPUT_FILE   = os.path.join(SCRIPT_DIR, "team_predictions.csv")
DASHBOARD_LOG = os.path.join(ROOT_DIR, "logs", "predictions.csv")

WINDOW    = 600   # 600 raw 1s samples = 10-minute feature window
STEP_IDX  = 10   # advance 10 raw samples per inference step
STEP_SECS = 10   # wall-clock seconds between each written row
MAX_ROWS  = 500  # keep CSV trimmed to last N rows to avoid unbounded growth
FITS_START = 12400  # start well into the file (avoids midnight edge artefacts)
# ──────────────────────────────────────────────────────────────────────────────

CLASS_NAMES = {0: "Quiet", 1: "B-like", 2: "C-like", 3: "M-like", 4: "X-like"}

def get_prob(prob_vector, class_id, classes):
    try:
        return float(prob_vector[classes.index(class_id)])
    except (ValueError, IndexError):
        return 0.0

def determine_phase(window, prob_severe):
    trend     = np.polyfit(range(len(window)), window, 1)[0]
    peak_idx  = np.argmax(window)
    peak_frac = peak_idx / len(window)
    if np.max(window) < 200 and prob_severe < 0.05:
        return "Background"
    elif trend > 0.5 and peak_frac > 0.7:
        return "Impulsive"
    elif 0.3 < peak_frac < 0.7:
        return "Peak"
    elif trend < -0.3:
        return "Decay"
    return "Background"

def trim_csv(path, max_rows):
    """Keep only the last max_rows data rows in the CSV."""
    if not os.path.exists(path):
        return
    with open(path, 'r', newline='', encoding='utf-8') as f:
        rows = list(csv.reader(f))
    if len(rows) <= max_rows + 1:   # +1 for header
        return
    header = rows[0]
    kept   = rows[-(max_rows):]
    with open(path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(kept)


# ── Load model ─────────────────────────────────────────────────────────────────
print("=" * 70)
print("  SOLAR FORECASTING LIVE PIPELINE  (continuous, dual timezone handling)")
print("=" * 70)
print(f"  Model  : {os.path.basename(MODEL_FILE)}")
print(f"  Output : {OUTPUT_FILE}")
print(f"  Step   : every {STEP_SECS}s real-time  |  window = {WINDOW}s raw FITS data")
print("=" * 70)

bundle    = joblib.load(MODEL_FILE)
model     = bundle['model']
feat_cols = bundle['feature_cols']
classes   = list(model.classes_)

# ── Load full FITS file into memory once ───────────────────────────────────────
print(f"Loading FITS: {os.path.basename(FITS_FILE)} ...")
with gzip.open(FITS_FILE) as f:
    with fits.open(f) as hdul:
        data      = hdul[1].data
        col_names = data.names
        counts_all = data['COUNTS'].astype(float) if 'COUNTS' in col_names \
                     else data[col_names[1]].astype(float)

# Clean spikes once
counts_all[counts_all > 2000] = np.nan
counts_all = pd.Series(counts_all).interpolate(limit_direction="both").values

print(f"  Loaded {len(counts_all):,} samples.")
print()

# ── Ensure CSV has a header ────────────────────────────────────────────────────
if not os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as f:
        csv.writer(f).writerow(
            ['timestamp', 'nowcast_phase', 'forecast_prob_C', 'forecast_prob_M', 'forecast_prob_X']
        )

# ── Continuous inference loop ──────────────────────────────────────────────────
ptr = FITS_START
n   = len(counts_all)
print("Starting continuous stream... (Ctrl+C to stop)\n")

try:
    while True:
        # Wrap pointer so we cycle the FITS file indefinitely
        if ptr + WINDOW >= n:
            ptr = FITS_START
            print(f"  [wrap] Reached end of FITS file — restarting from index {FITS_START}")

        window = counts_all[ptr : ptr + WINDOW]

        feats = None
        try:
            feats = extract_features(window)
        except Exception:
            pass

        if feats is None:
            ptr += STEP_IDX
            time.sleep(1)
            continue

        # Augment with derived features expected by model
        det_thresh = max(3 * feats.get('std', 0.0), 11)
        prom_mult  = feats.get('max_prominence', 0.0) / det_thresh if det_thresh > 0 else 0.0
        feats['detection_threshold'] = det_thresh
        feats['prominence_multiple'] = prom_mult

        X    = pd.DataFrame([[feats.get(c, 0.0) for c in feat_cols]], columns=feat_cols)
        prob = model.predict_proba(X)[0]
        pred_val  = int(model.predict(X)[0])
        pred_name = CLASS_NAMES.get(pred_val, "Quiet")

        prob_C = get_prob(prob, 2, classes)
        prob_M = get_prob(prob, 3, classes)
        prob_X = get_prob(prob, 4, classes)
        phase  = determine_phase(window, prob_M + prob_X)

        # ── WALL-CLOCK timestamps (UTC for CSV, IST for Console) ───────────────
        utc_now = datetime.now(timezone.utc)
        utc_timestamp = utc_now.strftime('%Y-%m-%dT%H:%M:%S')
        
        ist_offset = timedelta(hours=5, minutes=30)
        ist_timezone = timezone(ist_offset)
        ist_now = utc_now.astimezone(ist_timezone)
        ist_timestamp = ist_now.strftime("%Y-%m-%d %I:%M:%S %p IST")

        # Append to team_predictions.csv (Using strict UTC)
        with open(OUTPUT_FILE, 'a', newline='', encoding='utf-8') as f:
            csv.writer(f).writerow(
                [utc_timestamp, phase, f"{prob_C:.4f}", f"{prob_M:.4f}", f"{prob_X:.4f}"]
            )

        # Trim to last MAX_ROWS rows every 30 steps
        if ptr % (STEP_IDX * 30) == 0:
            trim_csv(OUTPUT_FILE, MAX_ROWS)

        # Console output (Using local IST)
        print(f"[{ist_timestamp}] ptr={ptr:6d} | {phase:<11} | {pred_name:<8} "
              f"({prob[pred_val]*100:5.1f}%) | "
              f"C={prob_C*100:5.1f}% M={prob_M*100:5.1f}% X={prob_X*100:5.1f}% | "
              f"cps={feats.get('mean',0):.1f}")

        ptr += STEP_IDX
        time.sleep(STEP_SECS)

except KeyboardInterrupt:
    print("\n\nPipeline stopped by user.")