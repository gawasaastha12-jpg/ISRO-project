"""
features_v2.py  —  Rich feature engineering for SOLEXS solar flare forecasting
===============================================================================
DROP-IN REPLACEMENT for extract_features() in dataset_research_v5.py

Goes from 17 summary statistics → 61 physics-informed features across 6 groups:

  Group 1 — Basic statistics          (same as v1, kept for continuity)
  Group 2 — Temporal gradient         (rate of change, acceleration)
  Group 3 — Multi-scale statistics    (per-third window stats + rolling drift)
  Group 4 — Spectral / FFT features   (frequency content, spectral entropy)
  Group 5 — Flare morphology          (rise time, decay time, asymmetry)
  Group 6 — Peak detection            (same prominence-based logic as v1)

HOW TO USE
----------
Option A — Regenerate your CSV from scratch (best results):
    In dataset_research_v5.py, replace:
        from features_v2 import extract_features   ← add this import at top
        feats = extract_features(window)           ← already there, no change needed

    Then re-run:
        python dataset_research_v5.py
        python pipeline_patch_v6.py --input ../data/processed/dataset_research_v5.csv

Option B — Run standalone to rebuild dataset from your existing LC files:
    python features_v2.py
    (Uses same ROOT_ZIP_DIR / OUT_FILE paths as your main script)

Option C — Test on a single window first:
    from features_v2 import extract_features, FEATURE_COLS
    import numpy as np
    window = np.random.randn(600) * 100 + 1000
    feats = extract_features(window)
    print(feats.keys())   # should show 61 feature names + 'label'

REQUIREMENTS
------------
    pip install numpy scipy scikit-learn pandas astropy
    (all already installed from your existing pipeline)

COMPATIBILITY
-------------
    - train.py: update FEATURE_COLS import:
        from features_v2 import FEATURE_COLS
    - evaluate.py: no changes needed
    - pipeline_patch_v6.py: no changes needed
"""

import os
import zipfile
import tempfile
import gc

import numpy as np
import pandas as pd
from scipy.signal import find_peaks, peak_widths
from scipy.stats import skew, kurtosis
from scipy.fft import rfft, rfftfreq

try:
    from astropy.io import fits
    ASTROPY_AVAILABLE = True
except ImportError:
    ASTROPY_AVAILABLE = False


# =============================================================================
# CONFIG  (mirrors your main script — edit to match if you changed these)
# =============================================================================

ROOT_ZIP_DIR = "../data/raw_zips"
OUT_FILE     = "../data/processed/dataset_research_v5.csv"

WINDOW_SIZE = 600
STEP        = 300

MIN_PROMINENCE_FLOOR = 10   # absolute floor (counts); raised at peak detection below
PEAK_MIN_DISTANCE    = 30

# ── ABSOLUTE prominence thresholds (calibrated from your SOLEXS data) ────────
# Derived from diagnostic run on dataset_research_v7.csv:
#   label 1 (B): prominence median=29,  max=38
#   label 2 (C): prominence median=67,  max=183
#   label 3 (M): prominence median=173, max=740
#   label 4 (X): prominence median=653, max=290k
#
# These are ABSOLUTE count values, NOT ratios. Switching from ratio-based to
# absolute thresholds fixes the inversion bug where C/M/X outnumbered B-class.
# Each band is ~3-5x the one below, matching GOES class decade spacing.
#
# To recalibrate after adding more data:
#   python -c "import pandas as pd; df=pd.read_csv('../data/processed/dataset_research_v7.csv');
#              print(df.groupby('label')['max_prominence'].describe())"
ABS_LABEL_THRESHOLDS = {
    "quiet_max":  10,    # prominence < 10  counts → quiet (below noise floor)
    "b_max":      45,    # prominence < 45  counts → B-like
    "c_max":     120,    # prominence < 120 counts → C-like
    "m_max":     800,    # prominence < 800 counts → M-like
    # prominence >= 800                     → X-like
}

# Peak detection floor: must be > quiet_max so noise peaks never get labeled
PEAK_PROMINENCE_FLOOR = ABS_LABEL_THRESHOLDS["quiet_max"] + 1  # = 11

QUIET_KEEP_FRACTION = 0.3


# =============================================================================
# FEATURE COLUMN LIST  (import this into train.py)
# =============================================================================

FEATURE_COLS = [
    # ── Group 1: Basic statistics (17) ──────────────────────────────────────
    "mean", "median", "std", "iqr", "skew", "kurtosis",
    "energy", "snr", "max", "min",
    "peak_count", "peak_ratio", "max_prominence", "largest_width",
    "trend", "volatility", "acceleration",

    # ── Group 2: Temporal gradient features (8) ──────────────────────────────
    "max_gradient",           # steepest single-step rise in entire window
    "max_gradient_last60",    # steepest rise in last 60 samples (pre-flare ramp)
    "max_gradient_last120",   # steepest rise in last 120 samples
    "mean_gradient_last60",   # average rate of change in last 60 samples
    "grad_acceleration",      # mean of second derivative (jerk)
    "time_to_peak",           # where does the max occur (0=start, 1=end)
    "peak_rise_rate",         # (max - value_at_start) / time_to_peak
    "last60_vs_first60_ratio",# energy ratio: last 60 / first 60 (rising = >1)

    # ── Group 3: Multi-scale statistics (15) ─────────────────────────────────
    "mean_t1", "std_t1", "max_t1",   # first third of window
    "mean_t2", "std_t2", "max_t2",   # middle third
    "mean_t3", "std_t3", "max_t3",   # last third
    "drift_t1_t3",                   # mean_t3 - mean_t1 (net drift)
    "std_ratio_t3_t1",               # std_t3 / std_t1 (volatility increasing?)
    "max_ratio_t3_t1",               # max_t3 / max_t1 (peak intensity increasing?)
    "rolling_mean_slope",            # slope of 10-point rolling mean
    "rolling_std_slope",             # slope of 10-point rolling std
    "energy_last_quarter_ratio",     # energy in last 150 samples / total energy

    # ── Group 4: Spectral / FFT features (9) ────────────────────────────────
    "dominant_freq",          # frequency of peak FFT magnitude
    "spectral_entropy",       # Shannon entropy of power spectrum (noise vs structure)
    "low_freq_power",         # power in lowest 10 percent of frequencies
    "mid_freq_power",         # power in middle 40 percent
    "high_freq_power",        # power in top 50 percent (noise)
    "low_mid_power_ratio",    # low / mid (impulsive flares: low freq dominant)
    "spectral_flatness",      # geometric/arithmetic mean ratio (1=white noise, 0=tonal)
    "peak_freq_magnitude",    # raw magnitude at dominant frequency
    "spectral_centroid",      # frequency-weighted center of mass of spectrum

    # ── Group 5: Flare morphology features (8) ──────────────────────────────
    "rise_time",              # samples from window start to global peak
    "decay_time",             # samples from global peak to window end
    "rise_decay_asymmetry",   # rise_time / (rise_time + decay_time); real flares ~0.1-0.3
    "n_peaks_above_p75",      # local maxima above 75th percentile
    "n_peaks_above_p90",      # local maxima above 90th percentile
    "peak_sharpness",         # max_val / (mean of 5 samples around peak)
    "pre_peak_slope",         # average slope of 30 samples before peak
    "post_peak_slope",        # average slope of 30 samples after peak (decay rate)

    # ── Group 6: Cross-percentile structure (4) ─────────────────────────────
    "p90_p50_ratio",          # 90th / 50th percentile (tail heaviness)
    "p95_p05_range",          # 95th - 5th percentile (robust range)
    "above_2std_fraction",    # fraction of samples > mean + 2*std (outlier density)
    "above_3std_fraction",    # fraction of samples > mean + 3*std (extreme events)

    # ── Group 7: True rolling statistics (5) ────────────────────────────────
    # Computed over the LAST 60 samples of each window (most recent activity).
    # These smooth short-term noise and expose developing trends.
    "rolling_mean_last60",    # mean of last 60 samples (recent activity level)
    "rolling_std_last60",     # std of last 60 samples (recent volatility)
    "rolling_max_last60",     # max of last 60 samples (recent peak intensity)
    "rolling_energy_last60",  # sum of last 60 samples (recent total energy)
    "rolling_snr_last60",     # mean/std of last 60 (recent signal quality)

    # ── Group 8: Second-order trend features (4) ────────────────────────────
    # trend_change and second_derivative quantify how rapidly activity is
    # accelerating — key for distinguishing flare onset from steady-state.
    "trend_change",           # slope of diff (rate of change is itself changing)
    "trend_last60_vs_full",   # trend in last 60 vs full window (acceleration signal)
    "second_deriv_max",       # max of second derivative (sharpest acceleration)
    "second_deriv_last60",    # mean second derivative in last 60 samples

    # ── Group 9: Peak evolution features (4) ────────────────────────────────
    # Distinguish isolated spikes from developing flares by tracking how the
    # dominant peak evolves within a window (early vs late, growing vs fading).
    "peak_prominence_early",  # max prominence in first half of window
    "peak_prominence_late",   # max prominence in second half of window
    "prominence_change",      # late - early (positive = flare developing)
    "width_last_vs_first",    # width of last peak / width of first peak (growing?)
]

# Total: 74 features
assert len(FEATURE_COLS) == 74, f"Expected 74, got {len(FEATURE_COLS)}"


# =============================================================================
# HELPERS
# =============================================================================

def safe(x):
    if x is None:
        return 0.0
    try:
        v = float(x)
        return 0.0 if (np.isnan(v) or np.isinf(v)) else v
    except Exception:
        return 0.0


def assign_label(peaks, peak_prominences, baseline):
    """
    Absolute-threshold labeling (FIXED — replaces broken ratio-based version).

    Uses absolute prominence values calibrated from SOLEXS data diagnostics.
    Ratio-based labeling failed because baseline variance (5–23k counts) caused
    the same physical prominence to map to different labels depending on window.

    Parameters
    ----------
    peaks            : indices of detected peaks
    peak_prominences : prominence of each peak (absolute count difference)
    baseline         : median flux (kept for API compatibility, no longer used)

    Returns
    -------
    int: 0=quiet, 1=B-like, 2=C-like, 3=M-like, 4=X-like
    """
    if len(peaks) == 0:
        return 0

    max_prominence = float(np.max(peak_prominences))

    if max_prominence < ABS_LABEL_THRESHOLDS["quiet_max"]:
        return 0
    elif max_prominence < ABS_LABEL_THRESHOLDS["b_max"]:
        return 1
    elif max_prominence < ABS_LABEL_THRESHOLDS["c_max"]:
        return 2
    elif max_prominence < ABS_LABEL_THRESHOLDS["m_max"]:
        return 3
    else:
        return 4


def _rolling_slope(arr, window=10):
    """Slope of linear fit to a rolling-mean-smoothed version of arr."""
    if len(arr) < window * 2:
        return 0.0
    rm = np.convolve(arr, np.ones(window) / window, mode='valid')
    x = np.arange(len(rm))
    try:
        slope = np.polyfit(x, rm, 1)[0]
        return slope
    except Exception:
        return 0.0


# =============================================================================
# MAIN FEATURE EXTRACTION  (drop-in replacement for extract_features)
# =============================================================================

def extract_features(window: np.ndarray) -> dict | None:
    """
    Extract 61 physics-informed features from a single flux window.

    Parameters
    ----------
    window : np.ndarray, shape (WINDOW_SIZE,)
        Raw count-rate time series for one sliding window.

    Returns
    -------
    dict of 61 features + 'label', or None if window is too short.
    """
    window = np.nan_to_num(np.asarray(window, dtype=np.float64))

    if len(window) < 20:
        return None

    n = len(window)

    # ── Peak detection (unchanged from v1) ───────────────────────────────────
    baseline   = np.median(window)
    noise_std  = np.std(window)
    prominence_threshold = max(3 * noise_std, PEAK_PROMINENCE_FLOOR)

    peaks, properties = find_peaks(
        window,
        prominence=prominence_threshold,
        distance=PEAK_MIN_DISTANCE,
    )
    peak_prominences = properties.get("prominences", np.array([]))
    peak_count = len(peaks)

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 1 — Basic statistics (same as v1)
    # ─────────────────────────────────────────────────────────────────────────
    mean   = np.mean(window)
    median = np.median(window)
    std    = np.std(window)
    q75    = np.percentile(window, 75)
    q25    = np.percentile(window, 25)
    iqr    = q75 - q25
    snr    = mean / (std + 1e-6)
    energy = np.sum(window)
    max_val = np.max(window)
    min_val = np.min(window)

    try:
        sk = skew(window)
    except Exception:
        sk = 0.0
    try:
        kt = kurtosis(window)
    except Exception:
        kt = 0.0

    diff  = np.diff(window)
    trend       = np.mean(diff) if len(diff) > 0 else 0.0
    volatility  = np.std(diff)  if len(diff) > 0 else 0.0
    acceleration = np.mean(np.diff(diff)) if len(diff) > 1 else 0.0

    if peak_count > 0:
        peak_max      = np.max(window[peaks])
        peak_ratio    = peak_max / (median + 1e-6)
        try:
            widths = peak_widths(window, peaks)[0]
            largest_width = np.max(widths) if len(widths) > 0 else 0.0
        except Exception:
            largest_width = 0.0
        max_prominence = np.max(peak_prominences)
    else:
        peak_ratio     = 0.0
        largest_width  = 0.0
        max_prominence = 0.0

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 2 — Temporal gradient features
    # ─────────────────────────────────────────────────────────────────────────
    peak_idx = int(np.argmax(window))

    # Steepest single-step rise anywhere in window
    max_gradient = float(np.max(diff)) if len(diff) > 0 else 0.0

    # Last 60 / 120 samples (pre-flare ramp region)
    last60  = window[-60:]  if n >= 60  else window
    last120 = window[-120:] if n >= 120 else window
    first60 = window[:60]   if n >= 60  else window

    diff_last60  = np.diff(last60)
    diff_last120 = np.diff(last120)

    max_gradient_last60  = float(np.max(diff_last60))  if len(diff_last60) > 0  else 0.0
    max_gradient_last120 = float(np.max(diff_last120)) if len(diff_last120) > 0 else 0.0
    mean_gradient_last60 = float(np.mean(diff_last60)) if len(diff_last60) > 0  else 0.0

    # Second derivative (jerk — rapid acceleration = flare onset signal)
    diff2 = np.diff(diff) if len(diff) > 1 else np.array([0.0])
    grad_acceleration = float(np.mean(diff2))

    # Where does the global peak occur (normalised 0-1)
    time_to_peak = peak_idx / (n - 1) if n > 1 else 0.5

    # Rise rate: how fast did flux get from start to peak
    if peak_idx > 0:
        peak_rise_rate = (window[peak_idx] - window[0]) / (peak_idx + 1e-6)
    else:
        peak_rise_rate = 0.0

    # Energy in last 60 vs first 60 (>1 = rising trend)
    energy_first60 = float(np.sum(first60))
    energy_last60  = float(np.sum(last60))
    last60_vs_first60_ratio = energy_last60 / (energy_first60 + 1e-6)

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 3 — Multi-scale statistics (per-third window)
    # ─────────────────────────────────────────────────────────────────────────
    t = n // 3
    t1 = window[:t]
    t2 = window[t:2*t]
    t3 = window[2*t:]

    mean_t1, std_t1 = float(np.mean(t1)), float(np.std(t1))
    mean_t2, std_t2 = float(np.mean(t2)), float(np.std(t2))
    mean_t3, std_t3 = float(np.mean(t3)), float(np.std(t3))
    max_t1 = float(np.max(t1))
    max_t2 = float(np.max(t2))
    max_t3 = float(np.max(t3))

    drift_t1_t3      = mean_t3 - mean_t1
    std_ratio_t3_t1  = std_t3  / (std_t1  + 1e-6)
    max_ratio_t3_t1  = max_t3  / (max_t1  + 1e-6)

    # Rolling mean and std slopes
    rolling_mean_slope = safe(_rolling_slope(window, window=10))
    rolling_std_slope  = safe(_rolling_slope(
        pd.Series(window).rolling(10).std().fillna(0).values, window=10
    ))

    # Energy in last quarter vs total
    last_quarter = window[-(n // 4):]
    energy_last_quarter_ratio = float(np.sum(last_quarter)) / (energy + 1e-6)

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 4 — Spectral / FFT features
    # ─────────────────────────────────────────────────────────────────────────
    try:
        # Mean-subtract before FFT to remove DC component (huge offset from
        # raw count rates ~1000+). Without this, DC eats 99.98% of power
        # and all spectral features collapse to near-zero.
        window_ac = window - np.mean(window)
        fft_vals  = np.abs(rfft(window_ac))
        fft_freqs = rfftfreq(n)

        # Use only AC components (index 1 onwards — skip DC at index 0)
        fft_vals_ac  = fft_vals[1:]
        fft_freqs_ac = fft_freqs[1:]
        fft_power    = fft_vals_ac ** 2
        total_power  = np.sum(fft_power) + 1e-6

        # Dominant frequency (index into AC-only array)
        dominant_freq_idx   = int(np.argmax(fft_power))
        dominant_freq       = float(fft_freqs_ac[dominant_freq_idx])
        peak_freq_magnitude = float(fft_vals_ac[dominant_freq_idx])

        # Frequency band split: low 10%, mid 40%, high 50% of AC bins
        n_freq  = len(fft_power)
        low_end = max(1, int(n_freq * 0.10))
        mid_end = max(low_end + 1, int(n_freq * 0.50))

        low_freq_power  = float(np.sum(fft_power[:low_end]))           / total_power
        mid_freq_power  = float(np.sum(fft_power[low_end:mid_end]))    / total_power
        high_freq_power = float(np.sum(fft_power[mid_end:]))           / total_power
        low_mid_power_ratio = low_freq_power / (mid_freq_power + 1e-6)

        # Spectral entropy — normalized to 0-1 by log(N)
        # ~1.0 = white noise (quiet sun)   ~0.0 = single-tone (sharp flare)
        p = fft_power / total_power
        p = p[p > 0]
        n_bins      = len(p)
        raw_entropy = float(-np.sum(p * np.log(p + 1e-12)))
        max_entropy = float(np.log(n_bins)) if n_bins > 1 else 1.0
        spectral_entropy = raw_entropy / (max_entropy + 1e-12)

        # Spectral flatness (geometric mean / arithmetic mean of power)
        log_mean   = np.exp(np.mean(np.log(fft_power + 1e-12)))
        arith_mean = np.mean(fft_power)
        spectral_flatness = float(log_mean / (arith_mean + 1e-6))

        # Spectral centroid (frequency-weighted centre of mass)
        spectral_centroid = float(
            np.sum(fft_freqs_ac * fft_power) / total_power
        )

    except Exception:
        dominant_freq = peak_freq_magnitude = spectral_entropy = 0.0
        low_freq_power = mid_freq_power = high_freq_power = 0.0
        low_mid_power_ratio = spectral_flatness = spectral_centroid = 0.0

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 5 — Flare morphology
    # ─────────────────────────────────────────────────────────────────────────
    rise_time  = peak_idx
    decay_time = n - peak_idx - 1

    total_rd = rise_time + decay_time
    rise_decay_asymmetry = rise_time / (total_rd + 1e-6)

    # Local maxima above percentile thresholds (without prominence filter)
    p75 = float(np.percentile(window, 75))
    p90 = float(np.percentile(window, 90))
    local_peaks_raw, _ = find_peaks(window)
    n_peaks_above_p75 = int(np.sum(window[local_peaks_raw] > p75)) if len(local_peaks_raw) > 0 else 0
    n_peaks_above_p90 = int(np.sum(window[local_peaks_raw] > p90)) if len(local_peaks_raw) > 0 else 0

    # Peak sharpness: how much the peak stands above its immediate neighbourhood
    half_w = 5
    lo = max(0, peak_idx - half_w)
    hi = min(n, peak_idx + half_w + 1)
    neighbourhood = window[lo:hi]
    peak_sharpness = window[peak_idx] / (np.mean(neighbourhood) + 1e-6)

    # Pre-peak slope (30 samples before peak)
    pre_start = max(0, peak_idx - 30)
    pre_segment = window[pre_start:peak_idx + 1]
    if len(pre_segment) > 1:
        pre_peak_slope = float(np.polyfit(np.arange(len(pre_segment)), pre_segment, 1)[0])
    else:
        pre_peak_slope = 0.0

    # Post-peak slope (30 samples after peak)
    post_end = min(n, peak_idx + 31)
    post_segment = window[peak_idx:post_end]
    if len(post_segment) > 1:
        post_peak_slope = float(np.polyfit(np.arange(len(post_segment)), post_segment, 1)[0])
    else:
        post_peak_slope = 0.0

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 6 — Cross-percentile structure
    # ─────────────────────────────────────────────────────────────────────────
    p05 = float(np.percentile(window, 5))
    p50 = float(np.percentile(window, 50))
    p95 = float(np.percentile(window, 95))

    p90_p50_ratio        = p90 / (p50 + 1e-6)
    p95_p05_range        = p95 - p05
    above_2std_fraction  = float(np.mean(window > (mean + 2 * std)))
    above_3std_fraction  = float(np.mean(window > (mean + 3 * std)))

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 7 — True rolling statistics (last 60 samples)
    # ─────────────────────────────────────────────────────────────────────────
    roll60 = window[-60:] if n >= 60 else window
    rolling_mean_last60   = float(np.mean(roll60))
    rolling_std_last60    = float(np.std(roll60))
    rolling_max_last60    = float(np.max(roll60))
    rolling_energy_last60 = float(np.sum(roll60))
    rolling_snr_last60    = rolling_mean_last60 / (rolling_std_last60 + 1e-6)

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 8 — Second-order trend / acceleration features
    # ─────────────────────────────────────────────────────────────────────────
    # diff already computed above as np.diff(window)
    # trend = mean(diff) — already computed

    # Rate of change of the rate of change
    diff2_arr = np.diff(diff) if len(diff) > 1 else np.array([0.0])
    trend_change      = float(np.mean(diff2_arr))          # = grad_acceleration (kept for clarity)
    second_deriv_max  = float(np.max(np.abs(diff2_arr)))   # sharpest acceleration anywhere
    second_deriv_last60 = float(np.mean(diff2_arr[-59:])) if len(diff2_arr) >= 59 else float(np.mean(diff2_arr))

    # Trend in last 60 vs full window
    diff_last60_arr = np.diff(roll60)
    trend_last60 = float(np.mean(diff_last60_arr)) if len(diff_last60_arr) > 0 else 0.0
    trend_last60_vs_full = trend_last60 - float(trend)     # positive = accelerating recently

    # ─────────────────────────────────────────────────────────────────────────
    # GROUP 9 — Peak evolution within window (developing vs isolated flare)
    # ─────────────────────────────────────────────────────────────────────────
    half = n // 2
    window_first_half = window[:half]
    window_second_half = window[half:]

    # Peaks in each half (no prominence filter — we want any local max)
    peaks_early, props_early = find_peaks(
        window_first_half,
        prominence=PEAK_PROMINENCE_FLOOR,
        distance=PEAK_MIN_DISTANCE,
    )
    peaks_late, props_late = find_peaks(
        window_second_half,
        prominence=PEAK_PROMINENCE_FLOOR,
        distance=PEAK_MIN_DISTANCE,
    )

    prom_early = props_early.get("prominences", np.array([0.0]))
    prom_late  = props_late.get("prominences",  np.array([0.0]))

    peak_prominence_early = float(np.max(prom_early)) if len(prom_early) > 0 else 0.0
    peak_prominence_late  = float(np.max(prom_late))  if len(prom_late)  > 0 else 0.0
    prominence_change     = peak_prominence_late - peak_prominence_early  # + = developing

    # Width evolution: last peak width / first peak width
    if peak_count >= 2:
        try:
            all_widths = peak_widths(window, peaks)[0]
            width_last_vs_first = float(all_widths[-1]) / (float(all_widths[0]) + 1e-6)
        except Exception:
            width_last_vs_first = 1.0
    elif peak_count == 1:
        width_last_vs_first = 1.0   # only one peak, no evolution to measure
    else:
        width_last_vs_first = 0.0   # no peaks at all

    # ─────────────────────────────────────────────────────────────────────────
    # LABEL (unchanged from v1)
    # ─────────────────────────────────────────────────────────────────────────
    label = assign_label(peaks, peak_prominences, baseline)

    # ─────────────────────────────────────────────────────────────────────────
    # ASSEMBLE — order must match FEATURE_COLS exactly
    # ─────────────────────────────────────────────────────────────────────────
    return {
        # Group 1
        "mean":               safe(mean),
        "median":             safe(median),
        "std":                safe(std),
        "iqr":                safe(iqr),
        "skew":               safe(sk),
        "kurtosis":           safe(kt),
        "energy":             safe(energy),
        "snr":                safe(snr),
        "max":                safe(max_val),
        "min":                safe(min_val),
        "peak_count":         peak_count,
        "peak_ratio":         safe(peak_ratio),
        "max_prominence":     safe(max_prominence),
        "largest_width":      safe(largest_width),
        "trend":              safe(trend),
        "volatility":         safe(volatility),
        "acceleration":       safe(acceleration),
        # Group 2
        "max_gradient":              safe(max_gradient),
        "max_gradient_last60":       safe(max_gradient_last60),
        "max_gradient_last120":      safe(max_gradient_last120),
        "mean_gradient_last60":      safe(mean_gradient_last60),
        "grad_acceleration":         safe(grad_acceleration),
        "time_to_peak":              safe(time_to_peak),
        "peak_rise_rate":            safe(peak_rise_rate),
        "last60_vs_first60_ratio":   safe(last60_vs_first60_ratio),
        # Group 3
        "mean_t1":                   safe(mean_t1),
        "std_t1":                    safe(std_t1),
        "max_t1":                    safe(max_t1),
        "mean_t2":                   safe(mean_t2),
        "std_t2":                    safe(std_t2),
        "max_t2":                    safe(max_t2),
        "mean_t3":                   safe(mean_t3),
        "std_t3":                    safe(std_t3),
        "max_t3":                    safe(max_t3),
        "drift_t1_t3":               safe(drift_t1_t3),
        "std_ratio_t3_t1":           safe(std_ratio_t3_t1),
        "max_ratio_t3_t1":           safe(max_ratio_t3_t1),
        "rolling_mean_slope":        safe(rolling_mean_slope),
        "rolling_std_slope":         safe(rolling_std_slope),
        "energy_last_quarter_ratio": safe(energy_last_quarter_ratio),
        # Group 4
        "dominant_freq":         safe(dominant_freq),
        "spectral_entropy":      safe(spectral_entropy),
        "low_freq_power":        safe(low_freq_power),
        "mid_freq_power":        safe(mid_freq_power),
        "high_freq_power":       safe(high_freq_power),
        "low_mid_power_ratio":   safe(low_mid_power_ratio),
        "spectral_flatness":     safe(spectral_flatness),
        "peak_freq_magnitude":   safe(peak_freq_magnitude),
        "spectral_centroid":     safe(spectral_centroid),
        # Group 5
        "rise_time":             safe(rise_time),
        "decay_time":            safe(decay_time),
        "rise_decay_asymmetry":  safe(rise_decay_asymmetry),
        "n_peaks_above_p75":     safe(n_peaks_above_p75),
        "n_peaks_above_p90":     safe(n_peaks_above_p90),
        "peak_sharpness":        safe(peak_sharpness),
        "pre_peak_slope":        safe(pre_peak_slope),
        "post_peak_slope":       safe(post_peak_slope),
        # Group 6
        "p90_p50_ratio":         safe(p90_p50_ratio),
        "p95_p05_range":         safe(p95_p05_range),
        "above_2std_fraction":   safe(above_2std_fraction),
        "above_3std_fraction":   safe(above_3std_fraction),
        # Group 7 — rolling statistics
        "rolling_mean_last60":   safe(rolling_mean_last60),
        "rolling_std_last60":    safe(rolling_std_last60),
        "rolling_max_last60":    safe(rolling_max_last60),
        "rolling_energy_last60": safe(rolling_energy_last60),
        "rolling_snr_last60":    safe(rolling_snr_last60),
        # Group 8 — second-order trend
        "trend_change":          safe(trend_change),
        "trend_last60_vs_full":  safe(trend_last60_vs_full),
        "second_deriv_max":      safe(second_deriv_max),
        "second_deriv_last60":   safe(second_deriv_last60),
        # Group 9 — peak evolution
        "peak_prominence_early": safe(peak_prominence_early),
        "peak_prominence_late":  safe(peak_prominence_late),
        "prominence_change":     safe(prominence_change),
        "width_last_vs_first":   safe(width_last_vs_first),
        # Label
        "label": label,
    }


# =============================================================================
# STANDALONE PIPELINE  (mirrors dataset_research_v5.py with v2 features)
# =============================================================================

def run_pipeline():
    """
    Standalone extraction pipeline using v2 features.
    Run this instead of dataset_research_v5.py to regenerate your CSV
    with all 61 features.
    """
    if not ASTROPY_AVAILABLE:
        print("[ERROR] astropy not installed. Run: pip install astropy")
        return

    import gc as _gc

    rows = []

    zip_files = []
    for root, _, files in os.walk(ROOT_ZIP_DIR):
        for f in files:
            if f.endswith(".zip"):
                zip_files.append(os.path.join(root, f))

    print(f"\nFound {len(zip_files)} ZIP files\n")

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

                print(f"  LC files found: {len(lc_files)}")

                for lc in lc_files:
                    try:
                        with fits.open(lc) as hdul:
                            data = hdul[1].data
                            counts = np.array(data["COUNTS"])
                            times  = np.array(data["TIME"])
                            counts = np.nan_to_num(counts)
                    except Exception:
                        continue

                    for start in range(0, len(counts) - WINDOW_SIZE, STEP):
                        window = counts[start:start + WINDOW_SIZE]
                        feats  = extract_features(window)
                        if feats is None:
                            continue
                        # --------------------------------------------------
                        # Window timing information
                        # --------------------------------------------------

                        window_start = times[start]
                        window_end = times[start + WINDOW_SIZE - 1]

                        feats["window_start_time"] = window_start
                        feats["window_end_time"] = window_end
                        feats["window_mid_time"] = (window_start + window_end) / 2.0

                        # window number inside this file
                        feats["window_index"] = start
                        if feats["label"] == 0:
                            if np.random.rand() > QUIET_KEEP_FRACTION:
                                continue

                        feats["source_file"] = os.path.basename(lc)
                        rows.append(feats)

                    _gc.collect()

        except Exception as e:
            print(f"  ZIP ERROR: {e}")
            continue

    df = pd.DataFrame(rows)
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    df = df.replace([np.inf, -np.inf], np.nan).fillna(0)
    df.to_csv(OUT_FILE, index=False)

    print(f"\n{'='*50}")
    print(f"Saved: {OUT_FILE}")
    print(f"Shape: {df.shape}")

    if len(df) > 0:
        counts = df["label"].value_counts().sort_index()
        print("\nLabel distribution:")
        print(counts)
        pcts = (counts / len(df) * 100).round(2)
        print("\nLabel distribution (%):")
        print(pcts)
        print("\nFeature groups extracted:")
        print(f"  Group 1 (basic stats):        17 features")
        print(f"  Group 2 (temporal gradient):   8 features")
        print(f"  Group 3 (multi-scale):         15 features")
        print(f"  Group 4 (spectral/FFT):         9 features")
        print(f"  Group 5 (flare morphology):     8 features")
        print(f"  Group 6 (cross-percentile):     4 features")
        print(f"  {'─'*36}")
        print(f"  TOTAL:                         61 features")

        # ── Sanity check: B >= C >= M and B >= X ─────────────────────────────
        b = counts.get(1, 0)
        c = counts.get(2, 0)
        m = counts.get(3, 0)
        x = counts.get(4, 0)
        ok = (b >= c) and (b >= m) and (b >= x) and (c >= m) and (c >= x)
        print()
        if ok:
            print("[CHECK] PASS: label frequency decreases with severity (B>=C>=M, B>=X, C>=X)")
            print("        Thresholds are physically plausible.")
        else:
            print("[CHECK] WARNING: label counts do not follow the expected")
            print("        B >= C >= M and B >= X pattern. Real flare frequency")
            print("        strictly decreases with severity — if higher-severity")
            print("        classes outnumber lower ones, recheck ABS_LABEL_THRESHOLDS")
            print("        and PEAK_PROMINENCE_FLOOR before trusting this dataset.")
            print(f"        Current: B={b}, C={c}, M={m}, X={x}")
            print()
            print("  SUGGESTED RECALIBRATION COMMAND:")
            print("  python -c \"import pandas as pd; df=pd.read_csv('../data/processed/dataset_research_v5.csv'); print(df.groupby('label')['max_prominence'].describe()[['mean','50%','75%','max']])\"")


# =============================================================================
# QUICK TEST — run directly to validate on a synthetic window
# =============================================================================

def _test():
    print("Testing extract_features() on synthetic windows...\n")

    # Synthetic quiet window
    rng   = np.random.default_rng(42)
    quiet = rng.normal(1000, 20, WINDOW_SIZE)
    f     = extract_features(quiet)
    assert f is not None
    assert len([k for k in f if k != "label"]) == 74
    print(f"  Quiet window  → label={f['label']}  peak_count={f['peak_count']}")
    print(f"  rise_decay_asymmetry={f['rise_decay_asymmetry']:.3f}  "
          f"spectral_entropy={f['spectral_entropy']:.3f}  "
          f"last60_vs_first60_ratio={f['last60_vs_first60_ratio']:.3f}")

    # Synthetic flare window (sharp rise then decay)
    flare = rng.normal(1000, 20, WINDOW_SIZE)
    peak_pos = 150
    flare[peak_pos:peak_pos+30] += np.linspace(0, 5000, 30)
    flare[peak_pos+30:peak_pos+80] += np.linspace(5000, 0, 50)
    f2    = extract_features(flare)
    print(f"\n  Flare window  → label={f2['label']}  peak_count={f2['peak_count']}")
    print(f"  rise_decay_asymmetry={f2['rise_decay_asymmetry']:.3f}  "
          f"spectral_entropy={f2['spectral_entropy']:.3f}  "
          f"max_gradient={f2['max_gradient']:.1f}  "
          f"pre_peak_slope={f2['pre_peak_slope']:.1f}")

    print(f"\nAll {len(FEATURE_COLS)} feature columns verified.")
    print("FEATURE_COLS list is ready to import into train.py.\n")


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        _test()
    else:
        run_pipeline()