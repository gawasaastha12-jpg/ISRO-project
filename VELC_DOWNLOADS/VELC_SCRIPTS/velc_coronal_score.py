"""
velc_coronal_score.py
=====================
Computes a Coronal Activity Score from VELC image features.

This is NOT a trained classifier. It is a physics-informed
composite index — a weighted sum of normalised features that
each have a documented relationship to coronal pre-flare activity.

It runs in two modes:

  MODE 1 — Offline (historical analysis):
    Load velc_features.csv, compute score for every row,
    save enriched CSV with scores and activity tier.

  MODE 2 — Live (dashboard integration):
    Call compute_score(feature_row) with a single-row dict or
    DataFrame row to get back a score and tier in real time.

HOW TO RUN
----------
    python velc_coronal_score.py

    # To score a specific CSV:
    python velc_coronal_score.py --input ../features/velc_features.csv
"""

import argparse
import os
import numpy as np
import pandas as pd

# =============================================================================
# PHYSICAL MOTIVATION FOR EACH FEATURE WEIGHT
# =============================================================================
#
# outer_inner_ratio (weight 0.25)
#   The outer corona brightens before a flare as energy propagates outward
#   through coronal loops. A rising outer/inner ratio is a documented
#   precursor to eruptive events. Highest weight because it is the most
#   physically specific to pre-flare coronal restructuring.
#
# bright_fraction (weight 0.20)
#   What fraction of the visible corona is above a brightness threshold.
#   A larger bright fraction means more active regions are energised.
#   Directly correlated with solar activity level.
#
# grad_energy (weight 0.20)
#   Total gradient energy = how much rapid spatial intensity change exists.
#   High gradient energy means sharp boundaries between bright and dark
#   regions — characteristic of magnetically complex active regions where
#   flares preferentially originate.
#
# entropy (weight 0.20)
#   Shannon entropy of the intensity distribution. A complex, spatially
#   varied corona (multiple active regions, bright loops, dark filaments)
#   has higher entropy than a smooth, quiet corona. Rising entropy indicates
#   increasing structural complexity — a qualitative precursor signal.
#
# largest_region (weight 0.15)
#   Size of the largest connected bright region. Large connected bright
#   structures are associated with mature active regions with stored
#   magnetic energy. Lowest weight because size alone is less specific
#   than the above features.
#
# NOTE ON EXCLUDED FEATURES:
#   LR_ratio and TB_ratio (spatial asymmetry) are excluded from the score
#   because asymmetry alone is not a reliable pre-flare indicator without
#   knowing the orientation of active regions relative to the neutral line.
#   They are retained in the output for dashboard display but not weighted
#   into the composite score.
#
#   GLCM features (contrast, homogeneity, correlation, ASM) are also
#   excluded — they are image texture statistics with no direct physical
#   interpretation in terms of coronal magnetic energy storage.
#
# =============================================================================

SCORE_WEIGHTS = {
    "outer_inner_ratio": 0.25,
    "bright_fraction":   0.20,
    "grad_energy":       0.20,
    "entropy":           0.20,
    "largest_region":    0.15,
}

# Sanity check weights sum to 1
assert abs(sum(SCORE_WEIGHTS.values()) - 1.0) < 1e-9, "Weights must sum to 1"

ACTIVITY_TIERS = [
    (0.00, 0.25, "QUIET",    "Corona is calm. No significant structural changes."),
    (0.25, 0.50, "ELEVATED", "Above-average coronal activity. Monitor trends."),
    (0.50, 0.75, "ACTIVE",   "Significant coronal structures present."),
    (0.75, 1.00, "HIGHLY ACTIVE", "Strong coronal activity. Elevated flare risk context."),
]

# Normalisation reference values (percentile-based, computed from your 100-row dataset)
# These clip the raw feature values to a physically meaningful range before normalising.
# Values below p5 → 0.0, values above p95 → 1.0 (robust to outliers).
# IMPORTANT: recompute these from a larger VELC dataset when available.
NORM_REFS = {
    "outer_inner_ratio": {"p5": 0.8,   "p95": 2.5},
    "bright_fraction":   {"p5": 0.01,  "p95": 0.30},
    "grad_energy":       {"p5": 100.0, "p95": 5000.0},
    "entropy":           {"p5": 3.0,   "p95": 7.0},
    "largest_region":    {"p5": 50.0,  "p95": 2000.0},
}


# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def normalise(value: float, feat: str) -> float:
    """
    Clip-normalise a single feature value to [0, 1] using p5/p95 references.
    Values below p5 → 0, above p95 → 1, linearly scaled in between.
    """
    p5  = NORM_REFS[feat]["p5"]
    p95 = NORM_REFS[feat]["p95"]
    clipped = max(p5, min(p95, value))
    return (clipped - p5) / (p95 - p5 + 1e-9)


def compute_score(row) -> dict:
    """
    Compute the Coronal Activity Score for a single VELC feature row.

    Parameters
    ----------
    row : dict or pd.Series with VELC feature keys

    Returns
    -------
    dict with keys:
        score          float [0, 1]  — composite activity score
        tier           str           — activity tier label
        tier_desc      str           — one-line human description
        components     dict          — normalised value per feature
        raw_values     dict          — raw (un-normalised) feature values
        recommendation str           — dashboard recommendation text
    """
    if isinstance(row, pd.Series):
        row = row.to_dict()

    components = {}
    for feat in SCORE_WEIGHTS:
        raw = float(row.get(feat, 0.0))
        if np.isnan(raw) or np.isinf(raw):
            raw = 0.0
        components[feat] = round(normalise(raw, feat), 4)

    score = sum(SCORE_WEIGHTS[f] * components[f] for f in SCORE_WEIGHTS)
    score = round(float(score), 4)

    tier, tier_desc = "QUIET", ACTIVITY_TIERS[0][3]
    for lo, hi, t, desc in ACTIVITY_TIERS:
        if lo <= score < hi:
            tier, tier_desc = t, desc
            break

    # Recommendation logic — used in dashboard
    if score >= 0.75:
        recommendation = "Coronal structures are highly developed. Strong physical basis for elevated flare risk."
    elif score >= 0.50:
        recommendation = "Active coronal structures detected. Consistent with pre-flare conditions."
    elif score >= 0.25:
        recommendation = "Mild coronal activity. No strong structural indicators of imminent onset."
    else:
        recommendation = "Quiet corona. Coronal evidence does not support elevated flare risk."

    return {
        "score":          score,
        "tier":           tier,
        "tier_desc":      tier_desc,
        "components":     components,
        "raw_values":     {f: round(float(row.get(f, 0.0)), 4) for f in SCORE_WEIGHTS},
        "recommendation": recommendation,
    }


def calibrate_norm_refs(df: pd.DataFrame) -> dict:
    """
    Recompute NORM_REFS from an actual dataset.
    Call this whenever you get more VELC data — the defaults above
    were estimated, not computed from real data.

    Returns a dict in the same format as NORM_REFS.
    """
    refs = {}
    for feat in SCORE_WEIGHTS:
        if feat not in df.columns:
            continue
        vals = df[feat].dropna()
        refs[feat] = {
            "p5":  round(float(np.percentile(vals, 5)),  4),
            "p95": round(float(np.percentile(vals, 95)), 4),
        }
    return refs


def combine_with_solexs(solexs_prob: float,
                         velc_result: dict,
                         alpha: float = 0.15) -> dict:
    """
    Combine SOLEXS onset probability with VELC coronal activity score
    to produce an adjusted probability and confidence tier.

    DESIGN DECISION — why alpha=0.15 (not 0.5):
    SOLEXS has been validated on 25 months of data with TSS=0.648.
    VELC has 2 days of data with no validation. The adjustment should
    be a NUDGE based on physical evidence, not an equal partner.
    alpha=0.15 means VELC can shift the final probability by at most
    ±15 percentage points, and only if the coronal evidence is extreme.

    Parameters
    ----------
    solexs_prob  : float [0,1]  — calibrated onset probability from SOLEXS model
    velc_result  : dict         — output of compute_score()
    alpha        : float        — maximum adjustment from VELC (default 0.15)

    Returns
    -------
    dict with:
        final_prob      : adjusted probability [0, 1]
        adjustment      : how much VELC moved the probability (+/-)
        confidence_tier : VERY HIGH / HIGH / MEDIUM / LOW
        explanation     : human-readable explanation
    """
    velc_score = velc_result["score"]
    velc_tier  = velc_result["tier"]

    # VELC adjustment: +alpha when corona is very active, -alpha when quiet
    # Linear mapping: score 0 → adjustment -alpha, score 1 → adjustment +alpha
    adjustment = alpha * (2 * velc_score - 1)

    final_prob = float(np.clip(solexs_prob + adjustment, 0.0, 1.0))
    adjustment = round(final_prob - solexs_prob, 4)

    # Confidence: high when both sensors agree, medium when they diverge
    solexs_says_flare = solexs_prob >= 0.5
    velc_says_active  = velc_score  >= 0.5

    if solexs_says_flare and velc_says_active:
        confidence = "VERY HIGH"
        expl = (f"Both sensors agree: SOLEXS probability {solexs_prob:.0%} "
                f"and VELC coronal activity {velc_tier} consistently "
                f"indicate elevated flare risk.")
    elif not solexs_says_flare and not velc_says_active:
        confidence = "VERY HIGH"
        expl = (f"Both sensors agree: SOLEXS probability {solexs_prob:.0%} "
                f"and VELC coronal activity {velc_tier} consistently "
                f"indicate quiet conditions.")
    elif solexs_says_flare and not velc_says_active:
        confidence = "MEDIUM"
        expl = (f"Mixed signals: SOLEXS probability is {solexs_prob:.0%} "
                f"but VELC shows {velc_tier} coronal activity. "
                f"X-ray precursors present but no strong coronal structural evidence.")
    else:
        confidence = "MEDIUM"
        expl = (f"Mixed signals: SOLEXS probability is {solexs_prob:.0%} "
                f"but VELC shows {velc_tier} coronal activity. "
                f"Coronal structures are building but X-ray precursors not yet strong.")

    return {
        "solexs_prob":      round(solexs_prob, 4),
        "velc_score":       velc_score,
        "velc_tier":        velc_tier,
        "adjustment":       adjustment,
        "final_prob":       round(final_prob, 4),
        "confidence_tier":  confidence,
        "explanation":      expl,
    }


# =============================================================================
# OFFLINE BATCH SCORING
# =============================================================================

def score_csv(input_path: str, output_path: str = None) -> pd.DataFrame:
    """
    Load velc_features.csv, compute score for every row,
    return and optionally save an enriched DataFrame.
    """
    df = pd.read_csv(input_path)
    print(f"[LOAD] {input_path}  — {len(df)} rows")

    # Recompute normalisation references from actual data
    actual_refs = calibrate_norm_refs(df)
    print("\n[CALIBRATION] Normalisation references from actual data:")
    for feat, refs in actual_refs.items():
        default_p5  = NORM_REFS[feat]["p5"]
        default_p95 = NORM_REFS[feat]["p95"]
        print(f"  {feat:22s}: p5={refs['p5']:.3f} (default {default_p5:.1f})  "
              f"p95={refs['p95']:.3f} (default {default_p95:.1f})")

    # Update global refs with actual data values
    NORM_REFS.update(actual_refs)

    # Merge HG and LG rows: use HG for structural features
    # (HG captures fine detail in bright regions better)
    if "filename" in df.columns:
        df["gain_type"] = df["filename"].str.extract(r'_(HG|LG)_')
        df_hg = df[df["gain_type"] == "HG"].copy()
        if len(df_hg) > 0:
            df_to_score = df_hg
            print(f"\n[FILTER] Using HG rows only: {len(df_hg)} rows")
        else:
            df_to_score = df
            print(f"\n[FILTER] No HG column found in filenames, using all rows")
    else:
        df_to_score = df

    results = []
    for _, row in df_to_score.iterrows():
        r = compute_score(row)
        results.append({
            "DATE-OBS":          row.get("DATE-OBS", ""),
            "filename":          row.get("filename", ""),
            "coronal_score":     r["score"],
            "activity_tier":     r["tier"],
            "tier_desc":         r["tier_desc"],
            "recommendation":    r["recommendation"],
            "norm_outer_inner":  r["components"]["outer_inner_ratio"],
            "norm_bright_frac":  r["components"]["bright_fraction"],
            "norm_grad_energy":  r["components"]["grad_energy"],
            "norm_entropy":      r["components"]["entropy"],
            "norm_largest_reg":  r["components"]["largest_region"],
            # Raw values for transparency
            "raw_outer_inner":   r["raw_values"]["outer_inner_ratio"],
            "raw_bright_frac":   r["raw_values"]["bright_fraction"],
            "raw_grad_energy":   r["raw_values"]["grad_energy"],
            "raw_entropy":       r["raw_values"]["entropy"],
            "raw_largest_reg":   r["raw_values"]["largest_region"],
        })

    df_scored = pd.DataFrame(results)

    # Print distribution
    print(f"\n[SCORES] Coronal Activity Score distribution:")
    print(f"  mean={df_scored['coronal_score'].mean():.3f}  "
          f"std={df_scored['coronal_score'].std():.3f}  "
          f"min={df_scored['coronal_score'].min():.3f}  "
          f"max={df_scored['coronal_score'].max():.3f}")

    print(f"\n[TIERS] Activity tier distribution:")
    tier_counts = df_scored["activity_tier"].value_counts()
    for tier, count in tier_counts.items():
        pct = 100 * count / len(df_scored)
        print(f"  {tier:15s}: {count:>4}  ({pct:.1f}%)")

    print(f"\n[SAMPLE] First 5 scored rows:")
    print(df_scored[["DATE-OBS", "coronal_score",
                      "activity_tier", "recommendation"]].head().to_string())

    if output_path:
        df_scored.to_csv(output_path, index=False)
        print(f"\n[SAVE] {output_path}")

    # Demo: show what combination with a hypothetical SOLEXS probability looks like
    print(f"\n[DEMO] Dashboard combination examples:")
    print(f"  (using latest VELC observation + hypothetical SOLEXS probabilities)\n")
    latest_velc = compute_score(df_to_score.iloc[-1])
    for solexs_p in [0.15, 0.50, 0.88]:
        combined = combine_with_solexs(solexs_p, latest_velc)
        print(f"  SOLEXS={solexs_p:.0%}  VELC={latest_velc['tier']:12s}  "
              f"→ final={combined['final_prob']:.0%}  "
              f"confidence={combined['confidence_tier']:10s}  "
              f"adj={combined['adjustment']:+.3f}")

    return df_scored


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default="../features/velc_features.csv",
        help="Path to velc_features.csv",
    )
    parser.add_argument(
        "--output",
        default="../features/velc_scored.csv",
        help="Where to save the scored output CSV",
    )
    args = parser.parse_args()

    if not os.path.exists(args.input):
        print(f"File not found: {args.input}")
        print("Run from the scripts/ directory or pass --input with the full path.")
    else:
        score_csv(args.input, args.output)
