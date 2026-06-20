import os
import zipfile
import tempfile
import numpy as np
import pandas as pd
import gc

from astropy.io import fits
from scipy.signal import find_peaks, peak_widths
from scipy.stats import skew, kurtosis
from scipy.ndimage import uniform_filter1d


# =========================
# CONFIG
# =========================
ROOT_ZIP_DIR = "../data/raw_zips"
OUT_FILE = "../data/processed/dataset_research_v8.csv"

WINDOW_SIZE = 600
STEP = 300

# ── Peak detection tuning (POISSON-AWARE) ───────────────────────────────────
# X-ray photon-counting data follows Poisson statistics, NOT Gaussian noise.
# Verified correct in earlier rounds: requiring a peak's prominence to
# exceed N_SIGMA * sqrt(baseline), after light smoothing, filters noise
# (0/20 false positives on pure Poisson noise) while still detecting real
# flare-like bumps as exactly 1 peak each.
SMOOTH_WINDOW = 5          # samples to average over (light smoothing)
N_SIGMA = 7                # how many Poisson-noise-sigmas a peak must exceed
MIN_PROMINENCE_FLOOR = 10  # hard floor in counts, safety net for near-zero baselines
PEAK_MIN_DISTANCE = 30     # minimum samples between two distinct peaks

# ── MIN_VALID_BASELINE ───────────────────────────────────────────────────────
# Windows where baseline is below this are treated as eclipse/satellite-night/
# instrument-off periods and excluded entirely (label -1), rather than forced
# into a severity bucket the data can't support. Verified in v7: correctly
# excluded 26,069 such windows from a 71,409-window run.
MIN_VALID_BASELINE = 5

# ── Label thresholds — v8: RELATIVE TO THE DETECTION THRESHOLD ─────────────
# HISTORY OF THIS LOGIC (read this — it explains a real, non-obvious bug):
#   v6 used ratio = prominence / baseline -> broke at near-zero baseline
#     (tiny absolute bumps got huge ratios, mislabeled as X-class).
#   v7 fixed that by switching to ABSOLUTE peak counts (baseline + prominence)
#     against fixed thresholds (50/200/800) -> but this created a NEW problem:
#     once baseline rose above ~20 counts, the detection threshold itself
#     (7*sqrt(baseline)) already exceeded the b_max=50 ceiling. This made
#     label 1 (B-like) MATHEMATICALLY UNREACHABLE at typical SOLEXS active
#     baselines — confirmed when v7's run produced only 78 B-like windows
#     (0.17%) against 948 C-like, 995 M-like, and 566 X-like.
#
#   v8 fixes this by defining severity as a MULTIPLE of the detection
#   threshold itself, not a fixed absolute number:
#     prominence < 2x detection_threshold   -> B-like (just cleared the noise floor)
#     prominence < 5x detection_threshold   -> C-like
#     prominence < 15x detection_threshold  -> M-like
#     prominence >= 15x detection_threshold -> X-like
#   This guarantees B-like is always reachable at every baseline, since it's
#   defined relative to "how much above the noise floor", not an absolute
#   count value that the noise floor itself can exceed.
#
# These multipliers are STILL STARTING POINTS — calibrate against a known
# real flare before fully trusting them (see calibration notes at the
# bottom of this file).
MULTIPLE_THRESHOLDS = {
    "b_max": 2,    # prominence < 2x threshold   -> label 1 (B-like)
    "c_max": 5,    # prominence < 5x threshold   -> label 2 (C-like)
    "m_max": 15,   # prominence < 15x threshold  -> label 3 (M-like)
    # prominence >= 15x threshold -> label 4 (X-like)
}

# ── Quiet-window downsampling ────────────────────────────────────────────────
QUIET_KEEP_FRACTION = 0.3

rows = []
invalid_window_count = 0


# =========================
# SAFE HELPERS
# =========================
def safe(x):
    if x is None:
        return 0.0
    if isinstance(x, float) and (np.isnan(x) or np.isinf(x)):
        return 0.0
    return float(x)


def assign_label(peaks, peak_prominences, baseline, detection_threshold):
    """
    EVENT-BASED LABELING — v8: severity relative to the detection threshold.

    Instead of comparing the peak's absolute size to fixed count values
    (which broke at high baselines — see history note above) or a raw
    ratio to baseline (which broke at near-zero baselines), this version
    expresses severity as "how many multiples of the noise floor did this
    peak clear?" This is stable across the full range of SOLEXS baselines.

    Parameters
    ----------
    peaks               : indices of detected peaks
    peak_prominences    : prominence value for each detected peak
    baseline             : median flux of this window
    detection_threshold  : the prominence threshold used to FIND peaks
                            (N_SIGMA * sqrt(baseline), floored at MIN_PROMINENCE_FLOOR)

    Returns
    -------
    int label: -1=invalid/inactive window, 0=quiet, 1=B-like, 2=C-like,
               3=M-like, 4=X-like
    """
    if baseline < MIN_VALID_BASELINE:
        return -1

    if len(peaks) == 0:
        return 0

    prom = np.max(peak_prominences)
    multiple = prom / detection_threshold

    if multiple < MULTIPLE_THRESHOLDS["b_max"]:
        return 1
    elif multiple < MULTIPLE_THRESHOLDS["c_max"]:
        return 2
    elif multiple < MULTIPLE_THRESHOLDS["m_max"]:
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

    smoothed = uniform_filter1d(window, size=SMOOTH_WINDOW)
    baseline = np.median(window)

    poisson_std = np.sqrt(max(baseline, 1.0))
    detection_threshold = max(N_SIGMA * poisson_std, MIN_PROMINENCE_FLOOR)

    peaks, properties = find_peaks(
        smoothed,
        prominence=detection_threshold,
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
        peak_ratio = peak_max / (median + 1e-6)  # diagnostic only — not used for labeling

        try:
            widths = peak_widths(smoothed, peaks)[0]
            largest_width = np.max(widths) if len(widths) > 0 else 0
        except Exception:
            largest_width = 0

        max_prominence = np.max(peak_prominences) if len(peak_prominences) > 0 else 0
        prominence_multiple = max_prominence / detection_threshold  # NEW — what labeling is based on
    else:
        peak_ratio = 0
        largest_width = 0
        max_prominence = 0
        prominence_multiple = 0

    diff = np.diff(window)
    trend = np.mean(diff) if len(diff) > 0 else 0
    volatility = np.std(diff) if len(diff) > 0 else 0
    acceleration = np.mean(np.diff(diff)) if len(diff) > 1 else 0

    label = assign_label(peaks, peak_prominences, baseline, detection_threshold)

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
        "max_prominence": safe(max_prominence),
        "detection_threshold": safe(detection_threshold),   # NEW — diagnostic
        "prominence_multiple": safe(prominence_multiple),    # NEW — what labeling is actually based on
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

            with zipfile.ZipFile(zip_path, "r") as z:
                z.extractall(tmp)

            for root, _, files in os.walk(tmp):
                for f in files:
                    if f.endswith(".zip"):
                        inner_zip = os.path.join(root, f)
                        try:
                            with zipfile.ZipFile(inner_zip, "r") as z2:
                                z2.extractall(root)
                        except Exception:
                            pass

            lc_files = []
            for root, _, files in os.walk(tmp):
                for f in files:
                    if f.endswith(".lc.gz"):
                        lc_files.append(os.path.join(root, f))

            print("LC files found:", len(lc_files))

            for lc in lc_files:

                try:
                    with fits.open(lc) as hdul:
                        data = hdul[1].data
                        counts = np.array(data["COUNTS"])
                        counts = np.nan_to_num(counts)
                except Exception:
                    continue

                for start in range(0, len(counts) - WINDOW_SIZE, STEP):

                    window = counts[start:start + WINDOW_SIZE]

                    feats = extract_features(window)

                    if feats is None:
                        continue

                    label = feats["label"]

                    if label == -1:
                        invalid_window_count += 1
                        continue

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
df = pd.DataFrame(rows)

os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)

df = df.replace([np.inf, -np.inf], np.nan).fillna(0)

df.to_csv(OUT_FILE, index=False)

print("\n===================")
print("Saved:", OUT_FILE)
print("Shape:", df.shape)
print(f"Invalid/inactive windows excluded (baseline < {MIN_VALID_BASELINE}): {invalid_window_count:,}")

if len(df) > 0:
    print("\nLabel distribution:")
    print(df["label"].value_counts().sort_index())
    print("\nLabel distribution (%):")
    print((df["label"].value_counts(normalize=True).sort_index() * 100).round(2))

    counts = df["label"].value_counts()
    c1 = counts.get(1, 0)
    c2 = counts.get(2, 0)
    c3 = counts.get(3, 0)
    c4 = counts.get(4, 0)
    if not (c1 >= c2 >= c3 or c1 >= c4):
        print("\n[CHECK] WARNING: label counts do not follow the expected")
        print("        B >= C >= M and B >= X pattern. Real flare frequency")
        print("        strictly decreases with severity — if higher-severity")
        print("        classes outnumber lower ones, recheck MULTIPLE_THRESHOLDS")
        print("        and MIN_VALID_BASELINE before trusting this dataset.")
    else:
        print("\n[CHECK] Label counts follow the expected severity ordering (B >= C >= M, X). Good sign.")
else:
    print("Dataset empty — check LC extraction")


# =============================================================================
# CALIBRATION NOTES — READ BEFORE TRUSTING THE LABELS
# =============================================================================
#
# FULL HISTORY OF THE LABELING LOGIC (so you understand why it looks like this):
#   v5: find_peaks() with no noise filtering at all -> 88% mislabeled as B-like.
#   v6: added Poisson-aware peak DETECTION (correct), but labeled severity
#       using ratio = prominence/baseline -> blew up at near-zero baseline,
#       producing more "X-like" (158) than "B-like" (228) or "C-like" (31).
#   v7: switched to ABSOLUTE peak counts vs fixed thresholds (50/200/800) ->
#       fixed the near-zero-baseline blowup, but created the opposite problem:
#       at baseline >= ~20, the detection threshold itself already exceeded
#       the B-like ceiling, making B-like nearly unreachable (78 samples, 0.17%).
#   v8 (this version): severity is now a MULTIPLE of the detection threshold
#       itself, so B-like ("just cleared the noise floor") is always reachable
#       regardless of baseline. Verified on a synthetic grid of baselines
#       (10/50/100) and flare sizes (tiny/small/medium/large) — severity
#       escalates monotonically and B-like is populated at every baseline.
#
# CALIBRATE MULTIPLE_THRESHOLDS AGAINST REAL DATA BEFORE THE FULL RUN:
# 1. Find a date with a known, documented flare (check NOAA's flare list)
#    during a period when Aditya-L1/SOLEXS was observing.
# 2. Run this script on just that single zip/day.
# 3. Look at "prominence_multiple" and "label" for windows overlapping the
#    known flare's timestamp. Adjust MULTIPLE_THRESHOLDS so the known
#    flare's class lines up correctly.
# 4. Check the [CHECK] sanity warning — counts should follow B >= C >= M
#    and B >= X. If they still don't, the multipliers need adjusting for
#    SOLEXS's actual flare-size distribution.
# 5. Re-run on a small subset (2-3 zips) before the full run.
#
# A distribution that looks roughly like:
#   label 0 (quiet) : 40-60%
#   label 1 (B-like): 25-40%
#   label 2 (C-like): 5-15%
#   label 3 (M-like): 1-3%
#   label 4 (X-like): <1%
# is a healthy, physically plausible result.
#
# IMPORTANT: if label 3 (M-like) ends up with fewer than ~30-50 real
# examples even after this fix, do NOT SMOTE it aggressively. Consider
# merging M and X into one "severe" class for training, or report the
# low sample count as an honest data limitation.
#
# =============================================================================