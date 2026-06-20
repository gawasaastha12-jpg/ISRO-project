import os
import zipfile
import tempfile
import numpy as np
import pandas as pd
import gc

from astropy.io import fits
from scipy.signal import find_peaks, peak_widths
from scipy.stats import skew, kurtosis


# =========================
# CONFIG
# =========================
ROOT_ZIP_DIR = "../data/raw_zips"
OUT_FILE = "../data/processed/dataset_research_v5.csv"

WINDOW_SIZE = 600
STEP = 300

# ── Peak detection tuning ───────────────────────────────────────────────────
# MIN_PROMINENCE_FLOOR: a hard minimum prominence (in raw counts) below which
# we never count something as a peak, even if the window is extremely flat
# and 3*std would give a tiny number. Prevents false positives in ultra-quiet
# windows. Tune this after calibration (see notes at bottom of file).
MIN_PROMINENCE_FLOOR = 10

# PEAK_MIN_DISTANCE: minimum samples between two detected peaks. At 1 sample/sec
# cadence, 30 means two peaks must be 30+ seconds apart to count as separate
# events rather than one flare's rise/fall being double-counted.
PEAK_MIN_DISTANCE = 30

# ── Label thresholds (ratio = peak_prominence / baseline) ──────────────────
# These are STARTING POINTS. Calibrate against a known real flare before
# trusting them — see the calibration notes at the bottom of this file.
LABEL_THRESHOLDS = {
    "quiet_max": 0.5,   # ratio < 0.5  -> label 0 (quiet)
    "b_max": 3,         # ratio < 3    -> label 1 (B-like)
    "c_max": 15,        # ratio < 15   -> label 2 (C-like)
    "m_max": 60,        # ratio < 60   -> label 3 (M-like)
    # ratio >= 60        -> label 4 (X-like)
}

# ── Quiet-window downsampling ────────────────────────────────────────────────
# After the fix, label 0 will likely become the MAJORITY class again (as it
# should be — most of the time the Sun has no flare). Keep this fraction of
# label-0 windows to avoid an extreme imbalance the other way. Start at 0.3
# and adjust once you see your new distribution.
QUIET_KEEP_FRACTION = 0.3

rows = []


# =========================
# SAFE HELPERS
# =========================
def safe(x):
    if x is None:
        return 0.0
    if isinstance(x, float) and (np.isnan(x) or np.isinf(x)):
        return 0.0
    return float(x)


def assign_label(peaks, peak_prominences, baseline):
    """
    EVENT-BASED LABELING (research grade) — FIXED VERSION

    Labels are based on how far the strongest detected peak rises ABOVE
    the window's local baseline, expressed as a ratio. This mirrors how
    GOES flare classification works in real solar physics: class depends
    on peak flux relative to background, not on how "spiky" a noisy
    signal looks statistically.

    Parameters
    ----------
    peaks             : indices of detected peaks (post prominence/distance filtering)
    peak_prominences  : prominence value for each detected peak
    baseline          : median flux of this window (robust quiet-level estimate)

    Returns
    -------
    int label: 0=quiet, 1=B-like, 2=C-like, 3=M-like, 4=X-like
    """
    if len(peaks) == 0:
        return 0  # No significant peak survived filtering -> genuinely quiet

    max_prominence = np.max(peak_prominences)
    ratio = max_prominence / (baseline + 1e-6)

    if ratio < LABEL_THRESHOLDS["quiet_max"]:
        return 0
    elif ratio < LABEL_THRESHOLDS["b_max"]:
        return 1
    elif ratio < LABEL_THRESHOLDS["c_max"]:
        return 2
    elif ratio < LABEL_THRESHOLDS["m_max"]:
        return 3
    else:
        return 4


# =========================
# FEATURE ENGINEERING
# =========================
def extract_features(window):

    window = np.nan_to_num(window)

    if len(window) < 20:
        return None

    # ── FIXED PEAK DETECTION ─────────────────────────────────────────────────
    # The old code called find_peaks(window) with no parameters, which flags
    # every tiny noise wiggle as a "peak" — a pure noise window can register
    # 100+ false peaks. We now require a peak to rise meaningfully above its
    # local surroundings (prominence) and be spaced apart from other peaks
    # (distance), so noise is filtered out and only real events are counted.

    baseline = np.median(window)
    noise_std = np.std(window)

    # Adaptive prominence threshold: scales with this window's own noise
    # level, with a hard floor so ultra-flat windows don't trigger on
    # near-zero prominence values.
    prominence_threshold = max(3 * noise_std, MIN_PROMINENCE_FLOOR)

    peaks, properties = find_peaks(
        window,
        prominence=prominence_threshold,
        distance=PEAK_MIN_DISTANCE,
    )
    peak_prominences = properties.get("prominences", np.array([]))

    mean = np.mean(window)
    median = np.median(window)
    std = np.std(window)

    energy = np.sum(window)

    q75 = np.percentile(window, 75)
    q25 = np.percentile(window, 25)
    iqr = q75 - q25

    snr = mean / (std + 1e-6)

    try:
        sk = skew(window)
    except Exception:
        sk = 0.0

    try:
        kt = kurtosis(window)
    except Exception:
        kt = 0.0

    max_val = np.max(window)
    min_val = np.min(window)

    peak_count = len(peaks)

    if peak_count > 0:
        peak_max = np.max(window[peaks])
        peak_ratio = peak_max / (median + 1e-6)

        try:
            widths = peak_widths(window, peaks)[0]
            largest_width = np.max(widths) if len(widths) > 0 else 0
        except Exception:
            largest_width = 0

        max_prominence = np.max(peak_prominences) if len(peak_prominences) > 0 else 0
    else:
        peak_ratio = 0
        largest_width = 0
        max_prominence = 0

    # TIME-SERIES FEATURES (STEP 3)
    diff = np.diff(window)
    trend = np.mean(diff) if len(diff) > 0 else 0
    volatility = np.std(diff) if len(diff) > 0 else 0
    acceleration = np.mean(np.diff(diff)) if len(diff) > 1 else 0

    # ── LABEL ASSIGNED HERE NOW (using fixed prominence-based logic) ─────────
    label = assign_label(peaks, peak_prominences, baseline)

    return {
        "mean": safe(mean),
        "median": safe(median),
        "std": safe(std),
        "iqr": safe(iqr),
        "skew": safe(sk),
        "kurtosis": safe(kt),
        "energy": safe(energy),
        "snr": safe(snr),
        "max": safe(max_val),
        "min": safe(min_val),
        "peak_count": peak_count,
        "peak_ratio": safe(peak_ratio),
        "max_prominence": safe(max_prominence),  # NEW — diagnostic + useful ML feature
        "largest_width": safe(largest_width),
        "trend": safe(trend),
        "volatility": safe(volatility),
        "acceleration": safe(acceleration),
        "label": label,
    }


# =========================
# FIND ZIP FILES
# =========================
zip_files = []
for root, _, files in os.walk(ROOT_ZIP_DIR):
    for f in files:
        if f.endswith(".zip"):
            zip_files.append(os.path.join(root, f))

print(f"\nFound {len(zip_files)} ZIP files\n")


# =========================
# MAIN PIPELINE
# =========================
for i, zip_path in enumerate(zip_files, 1):

    print(f"\n[{i}/{len(zip_files)}] Processing: {os.path.basename(zip_path)}")

    try:
        with tempfile.TemporaryDirectory() as tmp:

            # STEP 1: extract outer zip
            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(tmp)

            # STEP 2: extract nested zips
            for root, _, files in os.walk(tmp):
                for f in files:
                    if f.endswith(".zip"):
                        inner_zip = os.path.join(root, f)
                        try:
                            with zipfile.ZipFile(inner_zip, "r") as z2:
                                z2.extractall(root)
                        except Exception:
                            pass

            # STEP 3: collect LC files
            lc_files = []
            for root, _, files in os.walk(tmp):
                for f in files:
                    if f.endswith(".lc.gz"):
                        lc_files.append(os.path.join(root, f))

            print("LC files found:", len(lc_files))

            # STEP 4: process LC files
            for lc in lc_files:

                try:
                    with fits.open(lc) as hdul:
                        data = hdul[1].data
                        counts = np.array(data["COUNTS"])
                        counts = np.nan_to_num(counts)
                except Exception:
                    continue

                # sliding window
                for start in range(0, len(counts) - WINDOW_SIZE, STEP):

                    window = counts[start:start + WINDOW_SIZE]

                    feats = extract_features(window)

                    if feats is None:
                        continue

                    label = feats["label"]

                    # =========================
                    # BALANCING (only downsample quiet class)
                    # =========================
                    # After the fix, label 0 (quiet) should be common again
                    # — that's correct, since the Sun is quiet most of the
                    # time. We keep only a fraction of these so the dataset
                    # isn't overwhelmingly one class, while leaving every
                    # flare-containing window (labels 1-4) untouched since
                    # those are rare and valuable.
                    if label == 0:
                        if np.random.rand() > QUIET_KEEP_FRACTION:
                            continue

                    feats["source_file"] = os.path.basename(lc)
                    rows.append(feats)

                gc.collect()

    except Exception as e:
        print("ZIP ERROR:", zip_path, e)
        continue


# =========================
# SAVE DATASET
# =========================
from pipeline_patch_v6 import rebalance, build_forecast_datasets
#
#   df = pd.DataFrame(rows)
#   df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
#
#   # Save raw detection dataset (unchanged — your v5 output)
#   os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
#   df.to_csv(OUT_FILE, index=False)
#
#   # Rebalance + build forecast datasets
#   df_balanced = rebalance(df)
#   df_balanced.to_csv(OUT_FILE.replace("v5", "v6_balanced"), index=False)
#   build_forecast_datasets(df_balanced, out_dir="../data/processed/horizons")

# =============================================================================
# CALIBRATION NOTES — READ BEFORE TRUSTING THE LABELS
# =============================================================================
#
# The values in LABEL_THRESHOLDS (0.5, 3, 15, 60) and MIN_PROMINENCE_FLOOR (10)
# are reasonable starting points, NOT guaranteed-correct for SOLEXS data.
# Calibrate them like this before your final run:
#
# 1. Find a date when a known, well-documented flare occurred (check NOAA's
#    flare event list) during a period when Aditya-L1/SOLEXS was observing.
# 2. Run this script on just that single zip/day.
# 3. Look at the "max_prominence" and "label" columns for windows that
#    overlap the known flare's timestamp.
# 4. If a known X-class flare gets labeled as only "2" (C-like), your
#    thresholds are too high — lower m_max and c_max. If a quiet period
#    gets labeled as 1 or 2, your MIN_PROMINENCE_FLOOR or quiet_max ratio
#    is too low — raise it.
# 5. Re-run on a small subset (2-3 zips) and sanity check the new
#    distribution before committing to the full multi-hour run on all
#    your zip files.
#
# A distribution that looks roughly like:
#   label 0 (quiet) : 40-60%
#   label 1 (B-like): 25-40%
#   label 2 (C-like): 5-15%
#   label 3 (M-like): 1-3%
#   label 4 (X-like): <1%
# is a healthy, physically plausible result. If label 0 is back to <1%
# or label 1 is back above 90%, the prominence filter isn't aggressive
# enough yet — increase MIN_PROMINENCE_FLOOR or the noise_std multiplier.
#
# =============================================================================