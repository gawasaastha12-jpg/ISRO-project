"""
similarity_explorer.py  —  VELC Coronagraph Similarity Search Engine
=====================================================================
Given a query VELC frame, finds the N most similar coronal structures
in the dataset using feature-space distance metrics.

This is a genuine scientific retrieval tool — scientists can ask:
  "Show me all VELC frames that look like this active region structure"
  "What was the corona doing in the 10 most similar historical frames?"
  "Have we ever seen a coronal state like this before?"

SEARCH METHODS
--------------
  cosine     — best for shape similarity (ignores absolute brightness)
  euclidean  — best for absolute feature similarity
  mahalanobis — best for statistically meaningful distance
                (accounts for feature correlations and scales)
                recommended for scientific use

HOW TO RUN
----------
  # Query by frame index (0-based):
  python similarity_explorer.py --query_idx 63

  # Query by filename:
  python similarity_explorer.py --query_file "VS1_T26...LG_lev1_V2_1.fits"

  # Query by highest novelty score (default if no query given):
  python similarity_explorer.py

  # Change number of results:
  python similarity_explorer.py --query_idx 0 --top_k 8

  # Compare all three distance metrics:
  python similarity_explorer.py --query_idx 0 --compare_metrics

OUTPUT
------
  similarity_results_{query_id}.png     ← visual comparison: query + top-K
  similarity_scores_{query_id}.csv      ← distances, states, scores
  similarity_matrix.png                 ← full N×N heatmap (optional)
"""

import argparse
import os
import glob
import warnings
warnings.filterwarnings("ignore")

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from scipy.spatial.distance import cosine, euclidean
from scipy.stats import zscore
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA


# =============================================================================
# CONFIG
# =============================================================================

FEATURES_CSV = "../features/novelty_detection/velc_novelty_scores.csv"  # primary
FALLBACK_CSV = "../features/novelty_detection/velc_novelty_scores.csv"
FITS_DIR     = ".."
OUTPUT_DIR   = "../features/similarity_explorer"

SCIENTIFIC_DIMS = [
    "Brightness_Index", "Texture_Index", "Gradient_Index",
    "Morphology_Index", "Spatial_Index", "Coronal_Index",
]

# Raw VELC features for richer similarity (when available)
RAW_FEATURES = [
    "mean", "std", "bright_fraction", "bright_pixels", "largest_region",
    "grad_mean", "grad_energy", "contrast", "entropy", "homogeneity",
    "radial_slope", "outer_inner_ratio", "num_regions", "LR_ratio", "TB_ratio",
]

STATE_COLORS = {
    "Quiet Corona":            "#22C55E",
    "Structured Corona":       "#3B82F6",
    "Active Corona":           "#F97316",
    "Highly Structured Corona":"#EF4444",
}

NOVELTY_COLORS = {
    "Normal":           "#22C55E",
    "Unusual":          "#EAB308",
    "Highly Anomalous": "#EF4444",
}


# =============================================================================
# DATA LOADING
# =============================================================================

def load_feature_data() -> pd.DataFrame:
    """Load the best available feature CSV."""
    for path in [FEATURES_CSV, FALLBACK_CSV]:
        alt = path.replace("_with_scores", "")
        for candidate in [path, alt]:
            if os.path.exists(candidate):
                df = pd.read_csv(candidate)
                print(f"  Loaded features: {candidate}  ({len(df)} frames)")
                return df

    # Try to find any CSV with scientific indices
    for pattern in ["../features/**/*.csv", "../features/*.csv"]:
        matches = glob.glob(pattern, recursive=True)
        for m in matches:
            try:
                df = pd.read_csv(m)
                if "Brightness_Index" in df.columns or "activity_score" in df.columns:
                    print(f"  Loaded features: {m}  ({len(df)} frames)")
                    return df
            except Exception:
                pass

    raise FileNotFoundError(
        "No VELC feature CSV found. Run your feature extraction pipeline first.\n"
        f"Expected at: {FEATURES_CSV}"
    )


def get_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, list[str]]:
    """
    Build the feature matrix used for similarity computation.
    Prefers scientific indices; falls back to raw features.
    """
    # Try scientific indices first
    sci_avail = [c for c in SCIENTIFIC_DIMS if c in df.columns]
    raw_avail  = [c for c in RAW_FEATURES    if c in df.columns]

    if len(sci_avail) >= 3:
        use_cols = sci_avail + [c for c in raw_avail
                                if c not in sci_avail][:6]
    elif len(raw_avail) >= 3:
        use_cols = raw_avail
    else:
        # Last resort: all numeric columns except metadata
        skip = {"filename", "DATE-OBS", "GAIN", "TEMP", "CHANNEL",
                "FRAMEBIN", "ROI", "Coronal_State", "Novelty_Class",
                "activity_level", "trend", "confidence"}
        use_cols = [c for c in df.select_dtypes(include=np.number).columns
                    if c not in skip][:20]

    X = df[use_cols].fillna(df[use_cols].median()).values.astype(np.float64)
    return X, use_cols


# =============================================================================
# SIMILARITY ENGINE
# =============================================================================

class SimilarityEngine:
    """
    Feature-space similarity search for VELC coronagraph frames.

    Supports three distance metrics:
      cosine      — angle between feature vectors (shape similarity)
      euclidean   — L2 distance in scaled feature space
      mahalanobis — statistically normalized distance (recommended)
    """

    def __init__(self, df: pd.DataFrame):
        self.df = df.reset_index(drop=True)
        X_raw, self.feature_cols = get_feature_matrix(df)

        # Standardize features
        self.scaler = StandardScaler()
        self.X = self.scaler.fit_transform(X_raw)

        # Precompute covariance inverse for Mahalanobis
        try:
            cov = np.cov(self.X.T)
            if cov.ndim == 0:
                cov = np.array([[cov]])
            self.cov_inv = np.linalg.pinv(cov)
            self._mahal_ok = True
        except Exception:
            self._mahal_ok = False

        # PCA for visualization
        n_components = min(3, self.X.shape[1], self.X.shape[0] - 1)
        self.pca = PCA(n_components=n_components)
        self.X_pca = self.pca.fit_transform(self.X)

        print(f"  Feature matrix: {self.X.shape}  "
              f"(cols: {self.feature_cols[:5]}{'...' if len(self.feature_cols)>5 else ''})")
        print(f"  PCA variance explained: "
              f"{self.pca.explained_variance_ratio_.sum()*100:.1f}% "
              f"({n_components} components)")

    def query(self, idx: int, top_k: int = 5,
              metric: str = "mahalanobis") -> pd.DataFrame:
        """
        Find top_k most similar frames to frame at index `idx`.

        Parameters
        ----------
        idx    : query frame index
        top_k  : number of neighbours to return (excluding query itself)
        metric : "cosine", "euclidean", or "mahalanobis"

        Returns
        -------
        DataFrame with columns: index, filename, distance, similarity,
                                 Coronal_State, Novelty_Score, rank
        """
        if idx < 0 or idx >= len(self.X):
            raise ValueError(f"Index {idx} out of range (0–{len(self.X)-1})")

        q = self.X[idx]
        distances = self._compute_distances(q, metric)

        # Sort ascending (closest first), exclude self
        sorted_idx = np.argsort(distances)
        sorted_idx = sorted_idx[sorted_idx != idx][:top_k]

        results = []
        for rank, neighbour_idx in enumerate(sorted_idx, 1):
            row = self.df.iloc[neighbour_idx]
            dist = float(distances[neighbour_idx])

            # Convert distance to similarity score 0-1
            # Use exponential decay: sim = exp(-dist)
            sim = float(np.exp(-dist / (np.median(distances) + 1e-9)))
            sim = np.clip(sim, 0.0, 1.0)

            results.append({
                "rank":         rank,
                "frame_idx":    neighbour_idx,
                "filename":     str(row.get("filename", f"frame_{neighbour_idx}")),
                "distance":     round(dist, 4),
                "similarity":   round(sim, 4),
                "Coronal_State": str(row.get("Coronal_State", "Unknown")),
                "Novelty_Class": str(row.get("Novelty_Class", "Unknown")),
                "Novelty_Score": float(row.get("Novelty_Score", 0)),
                "activity_score": float(row.get("activity_score",
                                  row.get("VELC_Scientific_Activity", 0))),
                "gain":         "LG" if "_LG_" in str(row.get("filename","")) else "HG",
            })

        return pd.DataFrame(results)

    def _compute_distances(self, q: np.ndarray, metric: str) -> np.ndarray:
        if metric == "cosine":
            dists = np.array([
                cosine(q, self.X[i]) if np.linalg.norm(self.X[i]) > 0 else 1.0
                for i in range(len(self.X))
            ])
        elif metric == "mahalanobis" and self._mahal_ok:
            dists = np.array([
                float(np.sqrt(max(0, (q - self.X[i]) @ self.cov_inv @ (q - self.X[i]))))
                for i in range(len(self.X))
            ])
        else:  # euclidean (default fallback)
            dists = np.linalg.norm(self.X - q, axis=1)
        return dists

    def query_by_filename(self, filename: str, **kwargs) -> tuple[int, pd.DataFrame]:
        """Find frame by filename substring and run query."""
        matches = self.df[self.df["filename"].str.contains(
            filename, case=False, na=False
        )]
        if len(matches) == 0:
            raise ValueError(f"Filename '{filename}' not found in dataset")
        idx = int(matches.index[0])
        return idx, self.query(idx, **kwargs)

    def compare_metrics(self, idx: int, top_k: int = 5) -> dict:
        """Compare results across all three distance metrics."""
        results = {}
        for metric in ["cosine", "euclidean", "mahalanobis"]:
            try:
                results[metric] = self.query(idx, top_k, metric)
            except Exception as e:
                print(f"  [WARN] {metric} failed: {e}")
        return results


# =============================================================================
# FITS LOADING (shared with anomaly_gallery.py)
# =============================================================================

def find_fits_file(filename: str, fits_dir: str) -> str | None:
    basename = os.path.basename(filename)
    stem = basename.replace(".gz", "").replace(".fits", "")
    for pattern in [
        os.path.join(fits_dir, "**", basename),
        os.path.join(fits_dir, "**", stem + ".fits"),
        os.path.join(fits_dir, "**", stem + ".fits.gz"),
        os.path.join(fits_dir, "**", stem + "*.fits"),
    ]:
        matches = glob.glob(pattern, recursive=True)
        if matches:
            return matches[0]
    return None


def load_and_render(filename: str, fits_dir: str,
                    ax: plt.Axes, cmap="inferno"):
    """Load FITS and render to axis. Returns True if real image loaded."""
    fpath = find_fits_file(filename, fits_dir) if fits_dir else None
    image = None

    if fpath:
        try:
            from astropy.io import fits
            with fits.open(fpath, memmap=False) as hdul:
                for hdu in hdul:
                    if hdu.data is not None:
                        d = hdu.data
                        if d.ndim == 2:
                            image = d.astype(np.float32)
                            break
                        elif d.ndim >= 3:
                            image = d.reshape(d.shape[-2], d.shape[-1]).astype(np.float32)
                            break
        except Exception:
            pass

    if image is not None:
        img = np.nan_to_num(image, 0)
        lo, hi = np.percentile(img[img > 0], [1, 99.5]) if np.any(img > 0) else (0, 1)
        img = np.clip(img, lo, hi)
        img = np.log1p(img - lo)
        img = (img - img.min()) / (img.max() - img.min() + 1e-9)
        ax.imshow(img, cmap=cmap, origin="lower", interpolation="bilinear")
        return True
    else:
        # Synthetic placeholder
        ax.set_facecolor("#050810")
        rng = np.random.default_rng(hash(filename) % 2**32)
        y, x = np.ogrid[-64:64, -64:64]
        r = np.sqrt(x**2 + y**2)
        corona = np.exp(-((r - 28) ** 2) / (2 * 10**2))
        corona += rng.normal(0, 0.03, corona.shape)
        ax.imshow(np.clip(corona, 0, 1), cmap=cmap, origin="lower",
                  interpolation="bilinear")
        return False


# =============================================================================
# VISUALIZATION
# =============================================================================

def build_similarity_plot(query_idx: int, query_row: pd.Series,
                           results: pd.DataFrame, engine: SimilarityEngine,
                           fits_dir: str, output_dir: str,
                           metric: str = "mahalanobis"):
    """
    Build the main similarity comparison plot.
    Layout: query frame (large, left) + top-K matches (grid, right)
    """
    top_k = len(results)
    n_match_cols = min(top_k, 3)
    n_match_rows = int(np.ceil(top_k / n_match_cols))

    fig_w = 3.5 + n_match_cols * 2.8
    fig_h = max(4.0, n_match_rows * 2.8 + 1.0)

    fig = plt.figure(figsize=(fig_w, fig_h), facecolor="#0A0E1A")

    # Left: query frame (tall)
    gs_main = gridspec.GridSpec(
        1, 2, figure=fig,
        width_ratios=[1.3, n_match_cols],
        wspace=0.05, left=0.02, right=0.98,
        top=0.88, bottom=0.03
    )
    ax_query = fig.add_subplot(gs_main[0, 0])

    # Right: match grid
    gs_matches = gridspec.GridSpecFromSubplotSpec(
        n_match_rows, n_match_cols,
        subplot_spec=gs_main[0, 1],
        hspace=0.06, wspace=0.05
    )

    # ── Render query frame ────────────────────────────────────────────────
    q_fname  = str(query_row.get("filename", f"frame_{query_idx}"))
    rendered = load_and_render(q_fname, fits_dir, ax_query, cmap="inferno")

    q_state  = str(query_row.get("Coronal_State", "Unknown"))
    q_ns     = float(query_row.get("Novelty_Score", 0))
    q_nclass = str(query_row.get("Novelty_Class", "Unknown"))
    q_gain   = "LG" if "_LG_" in q_fname else "HG"

    scolor = STATE_COLORS.get(q_state, "#93C5FD")
    ncolor = NOVELTY_COLORS.get(q_nclass, "#7C8FA6")
    gcolor = "#3B82F6" if q_gain == "HG" else "#F97316"

    ax_query.text(0.5, 1.01, "QUERY FRAME",
                  transform=ax_query.transAxes, ha="center", va="bottom",
                  fontsize=8, color="#93C5FD", fontfamily="monospace",
                  fontweight="bold")
    ax_query.text(0.02, 0.97, f"{q_gain}  NS={q_ns:.3f}",
                  transform=ax_query.transAxes, fontsize=7, color=ncolor,
                  fontfamily="monospace", va="top",
                  bbox=dict(facecolor="#000000", edgecolor=ncolor,
                            alpha=0.85, boxstyle="round,pad=0.2", lw=0.8))
    ax_query.text(0.5, 0.03, q_state,
                  transform=ax_query.transAxes, fontsize=7, color=scolor,
                  fontfamily="monospace", va="bottom", ha="center",
                  bbox=dict(facecolor="#000000", edgecolor=scolor,
                            alpha=0.85, boxstyle="round,pad=0.25", lw=0.8))

    ax_query.set_xticks([]); ax_query.set_yticks([])
    for spine in ax_query.spines.values():
        spine.set_edgecolor(scolor); spine.set_linewidth(2.0)

    # ── Render matches ────────────────────────────────────────────────────
    for i, (_, result_row) in enumerate(results.iterrows()):
        r, c = divmod(i, n_match_cols)
        ax = fig.add_subplot(gs_matches[r, c])

        m_fname  = str(result_row.get("filename", ""))
        m_state  = str(result_row.get("Coronal_State", "Unknown"))
        m_sim    = float(result_row.get("similarity", 0))
        m_dist   = float(result_row.get("distance", 0))
        m_ns     = float(result_row.get("Novelty_Score", 0))
        m_nclass = str(result_row.get("Novelty_Class", "Unknown"))
        m_gain   = "LG" if "_LG_" in m_fname else "HG"
        rank     = int(result_row.get("rank", i + 1))

        load_and_render(m_fname, fits_dir, ax, cmap="inferno")

        ms_color = STATE_COLORS.get(m_state, "#93C5FD")
        mn_color = NOVELTY_COLORS.get(m_nclass, "#7C8FA6")
        mg_color = "#3B82F6" if m_gain == "HG" else "#F97316"

        # Similarity score bar
        bar_w = m_sim
        ax.axhspan(0, 0.04, xmin=0, xmax=bar_w,
                   color=ms_color, alpha=0.6, transform=ax.transAxes)

        ax.text(0.02, 0.97, f"#{rank}  sim={m_sim:.2f}",
                transform=ax.transAxes, fontsize=6, color=mn_color,
                fontfamily="monospace", va="top",
                bbox=dict(facecolor="#000000", edgecolor=mn_color,
                          alpha=0.8, boxstyle="round,pad=0.15", lw=0.6))
        ax.text(0.5, 0.03, m_state[:20],
                transform=ax.transAxes, fontsize=5.5, color=ms_color,
                fontfamily="monospace", va="bottom", ha="center",
                bbox=dict(facecolor="#000000", edgecolor=ms_color,
                          alpha=0.8, boxstyle="round,pad=0.15", lw=0.6))
        ax.text(0.98, 0.97, m_gain,
                transform=ax.transAxes, fontsize=5.5, color=mg_color,
                fontfamily="monospace", va="top", ha="right")

        ax.set_xticks([]); ax.set_yticks([])
        for spine in ax.spines.values():
            spine.set_edgecolor(ms_color); spine.set_linewidth(0.8)

    # ── Title + metadata ──────────────────────────────────────────────────
    q_short = os.path.basename(q_fname)[-40:]
    fig.text(0.5, 0.95,
             f"VELC SIMILARITY SEARCH  ·  metric: {metric}  ·  top-{top_k} matches",
             ha="center", fontsize=9, color="#93C5FD",
             fontfamily="monospace", fontweight="bold")
    fig.text(0.5, 0.915,
             f"Query: {q_short}",
             ha="center", fontsize=7, color="#7C8FA6",
             fontfamily="monospace")

    query_id = f"idx{query_idx}"
    out_path = os.path.join(output_dir, f"similarity_results_{query_id}.png")
    fig.savefig(out_path, dpi=140, bbox_inches="tight", facecolor="#0A0E1A")
    plt.close(fig)
    print(f"  Saved: similarity_results_{query_id}.png")
    return out_path


def build_metric_comparison(query_idx: int, all_results: dict,
                              engine: SimilarityEngine, output_dir: str):
    """Show how the three distance metrics agree/disagree on top-5 matches."""
    metrics = list(all_results.keys())
    top_k = min(5, min(len(v) for v in all_results.values()))

    fig, axes = plt.subplots(len(metrics), top_k,
                              figsize=(top_k * 2.2, len(metrics) * 2.4),
                              facecolor="#0A0E1A")
    if len(metrics) == 1:
        axes = axes.reshape(1, -1)

    for mi, metric in enumerate(metrics):
        results = all_results[metric]
        axes[mi, 0].text(-0.15, 0.5, metric.upper(),
                          transform=axes[mi, 0].transAxes,
                          rotation=90, va="center", ha="right",
                          fontsize=8, color="#93C5FD",
                          fontfamily="monospace")
        for ki, (_, row) in enumerate(results.head(top_k).iterrows()):
            ax = axes[mi, ki]
            fname = str(row.get("filename", ""))
            state = str(row.get("Coronal_State", "Unknown"))
            sim   = float(row.get("similarity", 0))
            gain  = "LG" if "_LG_" in fname else "HG"

            # Synthetic placeholder (avoid loading FITS repeatedly)
            rng = np.random.default_rng(hash(fname) % 2**32)
            y, x = np.ogrid[-32:32, -32:32]
            r = np.sqrt(x**2 + y**2)
            img = np.exp(-((r - 20)**2) / (2 * 8**2)) + rng.normal(0, 0.03, (64, 64))
            ax.imshow(np.clip(img, 0, 1), cmap="inferno", origin="lower")

            scolor = STATE_COLORS.get(state, "#93C5FD")
            ax.set_title(f"#{ki+1} sim={sim:.2f}", fontsize=6,
                         color="#7C8FA6", fontfamily="monospace", pad=2)
            ax.set_xticks([]); ax.set_yticks([])
            for spine in ax.spines.values():
                spine.set_edgecolor(scolor); spine.set_linewidth(0.8)
            ax.set_facecolor("#050810")

    fig.suptitle(f"Metric Comparison — Query frame {query_idx}",
                 fontsize=10, color="#93C5FD", fontfamily="monospace",
                 y=0.98)
    fig.tight_layout(rect=[0.05, 0, 1, 0.96])

    out_path = os.path.join(output_dir, f"metric_comparison_idx{query_idx}.png")
    fig.savefig(out_path, dpi=130, bbox_inches="tight", facecolor="#0A0E1A")
    plt.close(fig)
    print(f"  Saved: metric_comparison_idx{query_idx}.png")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="VELC coronagraph similarity search engine"
    )
    parser.add_argument("--query_idx",      type=int,   default=None)
    parser.add_argument("--query_file",     type=str,   default=None)
    parser.add_argument("--top_k",          type=int,   default=5)
    parser.add_argument("--metric",         type=str,   default="mahalanobis",
                        choices=["cosine", "euclidean", "mahalanobis"])
    parser.add_argument("--compare_metrics", action="store_true")
    parser.add_argument("--fits_dir",       default=FITS_DIR)
    parser.add_argument("--output",         default=OUTPUT_DIR)
    args = parser.parse_args()

    print("=" * 60)
    print("  VELC CORONAGRAPH SIMILARITY EXPLORER")
    print("=" * 60)

    os.makedirs(args.output, exist_ok=True)

    # ── Load data ─────────────────────────────────────────────────────────
    df = load_feature_data()
    engine = SimilarityEngine(df)

    # ── Determine query frame ─────────────────────────────────────────────
    if args.query_file:
        query_idx, results = engine.query_by_filename(
            args.query_file, top_k=args.top_k, metric=args.metric
        )
        print(f"\n  Query: '{args.query_file}' → frame index {query_idx}")

    elif args.query_idx is not None:
        query_idx = args.query_idx
        results   = engine.query(query_idx, args.top_k, args.metric)
        print(f"\n  Query: frame index {query_idx}")

    else:
        # Default: query the most anomalous frame
        if "Novelty_Score" in df.columns:
            query_idx = int(df["Novelty_Score"].idxmax())
            print(f"\n  No query specified — using most anomalous frame (idx={query_idx})")
        else:
            query_idx = 0
            print(f"\n  No query specified — using frame 0")
        results = engine.query(query_idx, args.top_k, args.metric)

    query_row = df.iloc[query_idx]

    # ── Print results ─────────────────────────────────────────────────────
    q_fname = str(query_row.get("filename", f"frame_{query_idx}"))
    print(f"\n  Query frame:")
    print(f"    File    : {os.path.basename(q_fname)}")
    print(f"    State   : {query_row.get('Coronal_State', 'Unknown')}")
    print(f"    NS      : {query_row.get('Novelty_Score', 'N/A')}")

    print(f"\n  Top-{args.top_k} most similar frames ({args.metric} distance):")
    print(f"  {'Rank':>5}  {'Sim':>6}  {'Dist':>8}  {'State':25s}  {'Gain':>4}  {'NS':>6}")
    print(f"  {'─'*5}  {'─'*6}  {'─'*8}  {'─'*25}  {'─'*4}  {'─'*6}")
    for _, r in results.iterrows():
        print(f"  {int(r['rank']):>5}  {r['similarity']:>6.3f}  "
              f"{r['distance']:>8.3f}  {str(r['Coronal_State'])[:25]:25s}  "
              f"{r['gain']:>4}  {r['Novelty_Score']:>6.3f}")

    # ── Build visualization ───────────────────────────────────────────────
    print(f"\n  Building similarity plot...")
    build_similarity_plot(
        query_idx, query_row, results, engine,
        args.fits_dir, args.output, args.metric
    )

    # ── Save CSV ──────────────────────────────────────────────────────────
    csv_path = os.path.join(args.output,
                             f"similarity_scores_idx{query_idx}.csv")
    results.to_csv(csv_path, index=False)
    print(f"  Saved: similarity_scores_idx{query_idx}.csv")

    # ── Metric comparison ─────────────────────────────────────────────────
    if args.compare_metrics:
        print(f"\n  Building metric comparison plot...")
        all_results = engine.compare_metrics(query_idx, args.top_k)
        build_metric_comparison(query_idx, all_results, engine, args.output)

        # Agreement analysis
        print(f"\n  Metric agreement analysis:")
        if len(all_results) >= 2:
            mlist = list(all_results.keys())
            for i in range(len(mlist)):
                for j in range(i+1, len(mlist)):
                    m1, m2 = mlist[i], mlist[j]
                    idx1 = set(all_results[m1]["frame_idx"])
                    idx2 = set(all_results[m2]["frame_idx"])
                    overlap = len(idx1 & idx2)
                    print(f"    {m1} vs {m2}: "
                          f"{overlap}/{args.top_k} frames in common")

    print(f"\n{'='*60}")
    print(f"  Similarity search complete.")
    print(f"  Output: {args.output}")
    print(f"\n  To query a different frame:")
    print(f"    python similarity_explorer.py --query_idx <N>")
    print(f"    python similarity_explorer.py --query_file <partial_filename>")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
