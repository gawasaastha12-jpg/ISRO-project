"""
anomaly_gallery.py  —  VELC Anomaly Image Gallery
==================================================
Loads the top anomalous VELC FITS images and builds a publication-quality
gallery showing each image alongside its scientific characterization.

Each panel shows:
  - Rendered coronagraph image (log-scaled, contrast-enhanced)
  - Novelty score and class
  - Coronal state (from clustering)
  - Top 2 anomalous scientific dimensions (with z-scores)
  - Gain mode and timestamp

HOW TO RUN
----------
  python anomaly_gallery.py

  Optional:
    --anomalies   path to anomaly_explanations.csv
                  (default: ../features/novelty_detection/velc_novelty_scores.csv)
    --fits_dir    directory containing FITS files
                  (default: ..)
    --output      output directory
                  (default: ../features/anomaly_gallery)
    --top_n       number of frames to show (default: 12)
    --cols        columns in gallery grid  (default: 4)

OUTPUT
------
  top_anomalies_gallery.png    ← main gallery (N panels)
  anomaly_summary_table.png    ← compact summary table
  gallery_metadata.csv         ← all displayed frames + metadata
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
from matplotlib.patches import FancyBboxPatch
from pathlib import Path


# =============================================================================
# CONFIG
# =============================================================================

ANOMALY_CSV  = "../features/novelty_detection/velc_novelty_scores.csv"
FITS_DIR     = ".."
OUTPUT_DIR   = "../features/anomaly_gallery"
TOP_N        = 12
N_COLS       = 4

SCIENTIFIC_DIMS = [
    "Brightness_Index", "Texture_Index", "Gradient_Index",
    "Morphology_Index", "Spatial_Index", "Coronal_Index",
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
# FITS IMAGE LOADING
# =============================================================================

def find_fits_file(filename: str, fits_dir: str) -> str | None:
    """Search recursively for a FITS file by basename."""
    basename = os.path.basename(filename)
    # Strip .gz for searching
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


def load_fits_image(filepath: str) -> np.ndarray | None:
    """
    Load a VELC coronagraph FITS image.
    Returns a 2D float array, or None on failure.

    Tries multiple HDU extensions and handles compressed FITS.
    """
    try:
        from astropy.io import fits as astrofits
        with astrofits.open(filepath, memmap=False) as hdul:
            # Try each HDU for image data
            for hdu in hdul:
                data = hdu.data
                if data is None:
                    continue
                if data.ndim == 2:
                    return data.astype(np.float32)
                elif data.ndim == 3:
                    # Take first frame if cube
                    return data[0].astype(np.float32)
                elif data.ndim == 4:
                    return data[0, 0].astype(np.float32)
    except Exception as e:
        pass

    # Fallback: try as compressed
    try:
        import gzip, io
        from astropy.io import fits as astrofits
        with gzip.open(filepath) as f:
            raw = f.read()
        with astrofits.open(io.BytesIO(raw)) as hdul:
            for hdu in hdul:
                if hdu.data is not None and hdu.data.ndim >= 2:
                    d = hdu.data
                    if d.ndim == 2:
                        return d.astype(np.float32)
                    return d.reshape(d.shape[-2], d.shape[-1]).astype(np.float32)
    except Exception:
        pass

    return None


def render_coronagraph(image: np.ndarray | None,
                        ax: plt.Axes,
                        title: str = "") -> bool:
    """
    Render a coronagraph image onto an axis with appropriate contrast.
    Returns True if image was rendered, False if placeholder shown.
    """
    if image is None:
        # Placeholder — show synthetic coronal ring
        _draw_placeholder(ax, title)
        return False

    # Replace NaN/inf
    image = np.nan_to_num(image, nan=0.0, posinf=0.0, neginf=0.0)

    # Log scale with soft clip (preserve coronal structure)
    img_min = np.percentile(image[image > 0], 1) if np.any(image > 0) else 1.0
    img_max = np.percentile(image, 99.5)
    image_clipped = np.clip(image, img_min, img_max)

    # Log transform
    with np.errstate(divide='ignore', invalid='ignore'):
        log_img = np.log1p(image_clipped - img_min)

    # Normalize 0-1
    lo, hi = log_img.min(), log_img.max()
    if hi > lo:
        log_img = (log_img - lo) / (hi - lo)

    ax.imshow(log_img, cmap="inferno", origin="lower",
              interpolation="bilinear", vmin=0, vmax=1)
    ax.set_facecolor("#000000")
    return True


def _draw_placeholder(ax: plt.Axes, label: str = ""):
    """Draw a synthetic coronal ring placeholder when FITS not available."""
    ax.set_facecolor("#050810")
    y, x = np.ogrid[-64:64, -64:64]
    r = np.sqrt(x**2 + y**2)
    corona = np.exp(-((r - 30) ** 2) / (2 * 12**2))
    corona += np.random.default_rng(42).normal(0, 0.02, corona.shape)
    ax.imshow(corona, cmap="inferno", origin="lower",
              interpolation="bilinear")
    ax.text(64, 64, "FITS\nnot found", ha="center", va="center",
            color="#7C8FA6", fontsize=6, fontfamily="monospace",
            alpha=0.6)


# =============================================================================
# PANEL ANNOTATION
# =============================================================================

def annotate_panel(ax: plt.Axes, row: pd.Series,
                   z_cols: list, rank: int):
    """
    Add scientific annotations to one gallery panel.
    Overlays are drawn directly on the image axis.
    """
    # Top bar: rank + novelty class
    novelty_class = str(row.get("Novelty_Class", "Unknown"))
    novelty_score = float(row.get("Novelty_Score", 0))
    state = str(row.get("Coronal_State", "Unknown"))

    ncolor = NOVELTY_COLORS.get(novelty_class, "#7C8FA6")
    scolor = STATE_COLORS.get(state, "#93C5FD")

    # Novelty score bar at top
    ax.text(0.02, 0.97, f"#{rank}  {novelty_class}",
            transform=ax.transAxes, fontsize=6.5, color=ncolor,
            fontfamily="monospace", va="top", fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="#000000",
                      edgecolor=ncolor, alpha=0.8, linewidth=0.8))

    ax.text(0.98, 0.97, f"NS={novelty_score:.3f}",
            transform=ax.transAxes, fontsize=6, color="#93C5FD",
            fontfamily="monospace", va="top", ha="right",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="#000000",
                      edgecolor="#1E2D54", alpha=0.8, linewidth=0.5))

    # Coronal state at bottom
    ax.text(0.5, 0.03, state,
            transform=ax.transAxes, fontsize=6.5, color=scolor,
            fontfamily="monospace", va="bottom", ha="center",
            bbox=dict(boxstyle="round,pad=0.25", facecolor="#000000",
                      edgecolor=scolor, alpha=0.85, linewidth=0.8))

    # Top 2 anomalous z-scores (right side)
    top_zs = _get_top_z_scores(row, z_cols, top_n=2)
    for i, (dim, z) in enumerate(top_zs):
        short = dim.replace("_Index", "").replace("VELC_Scientific_", "Sci.")
        zcolor = "#EF4444" if abs(z) > 2 else "#EAB308" if abs(z) > 1.5 else "#7C8FA6"
        ax.text(0.98, 0.85 - i * 0.12, f"{short}: {z:+.2f}σ",
                transform=ax.transAxes, fontsize=5.5, color=zcolor,
                fontfamily="monospace", va="top", ha="right",
                bbox=dict(boxstyle="round,pad=0.15", facecolor="#000000",
                          edgecolor=zcolor, alpha=0.75, linewidth=0.5))

    # Gain mode (top left)
    fname = str(row.get("filename", ""))
    gain = "LG" if "_LG_" in fname else "HG" if "_HG_" in fname else "??"
    gain_color = "#3B82F6" if gain == "HG" else "#F97316"
    ax.text(0.02, 0.03, gain,
            transform=ax.transAxes, fontsize=6, color=gain_color,
            fontfamily="monospace", va="bottom", fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.2", facecolor="#000000",
                      edgecolor=gain_color, alpha=0.8, linewidth=0.5))

    ax.set_xticks([])
    ax.set_yticks([])
    for spine in ax.spines.values():
        spine.set_edgecolor(ncolor)
        spine.set_linewidth(1.2)


def _get_top_z_scores(row: pd.Series, z_cols: list, top_n: int = 2):
    """Return top_n (dimension, z_score) pairs sorted by |z|."""
    zs = []
    for col in z_cols:
        z_col = f"z_{col}"
        if z_col in row.index:
            try:
                zs.append((col, float(row[z_col])))
            except Exception:
                pass
    zs.sort(key=lambda x: abs(x[1]), reverse=True)
    return zs[:top_n]


# =============================================================================
# MAIN GALLERY
# =============================================================================

def build_gallery(df: pd.DataFrame, fits_dir: str,
                  output_dir: str, top_n: int, n_cols: int):
    """Build the main anomaly gallery image."""
    os.makedirs(output_dir, exist_ok=True)

    # Select top_n by novelty score
    df_top = df.nlargest(top_n, "Novelty_Score").reset_index(drop=True)

    n_rows = int(np.ceil(top_n / n_cols))

    fig_w = n_cols * 3.2
    fig_h = n_rows * 3.5 + 0.8  # +0.8 for title

    fig = plt.figure(figsize=(fig_w, fig_h), facecolor="#0A0E1A")
    gs  = gridspec.GridSpec(n_rows, n_cols, figure=fig,
                            hspace=0.08, wspace=0.05,
                            top=0.92, bottom=0.02,
                            left=0.02, right=0.98)

    z_cols = [c for c in SCIENTIFIC_DIMS if f"z_{c}" in df.columns]

    n_loaded = 0
    n_placeholder = 0

    for idx, row in df_top.iterrows():
        r, c = divmod(idx, n_cols)
        ax   = fig.add_subplot(gs[r, c])

        # Try to load real FITS image
        fpath = find_fits_file(str(row.get("filename", "")), fits_dir)
        image = load_fits_image(fpath) if fpath else None

        rendered = render_coronagraph(image, ax)
        if rendered:
            n_loaded += 1
        else:
            n_placeholder += 1

        annotate_panel(ax, row, z_cols, rank=idx + 1)

    # Title
    fig.text(0.5, 0.96,
             "VELC CORONAGRAPH — TOP ANOMALOUS FRAMES",
             ha="center", va="top", fontsize=11,
             color="#93C5FD", fontfamily="monospace",
             fontweight="bold")
    fig.text(0.5, 0.935,
             f"Ranked by Novelty Score  ·  {n_loaded} images loaded, "
             f"{n_placeholder} placeholders  ·  "
             f"Border color = novelty class",
             ha="center", va="top", fontsize=7.5,
             color="#7C8FA6", fontfamily="monospace")

    out_path = os.path.join(output_dir, "top_anomalies_gallery.png")
    fig.savefig(out_path, dpi=140, bbox_inches="tight",
                facecolor="#0A0E1A")
    plt.close(fig)
    print(f"  Saved: top_anomalies_gallery.png  "
          f"({n_loaded} real images, {n_placeholder} placeholders)")
    return out_path


# =============================================================================
# SUMMARY TABLE
# =============================================================================

def build_summary_table(df: pd.DataFrame, output_dir: str, top_n: int = 12):
    """
    Build a compact summary table showing all top anomalies
    with their key metrics — useful for papers and presentations.
    """
    df_top = df.nlargest(top_n, "Novelty_Score").reset_index(drop=True)

    fig, ax = plt.subplots(figsize=(14, top_n * 0.52 + 1.2),
                            facecolor="#0A0E1A")
    ax.set_facecolor("#0A0E1A")
    ax.axis("off")

    # Build table data
    z_cols = [c for c in SCIENTIFIC_DIMS if f"z_{c}" in df.columns]

    col_labels = ["#", "Filename (truncated)", "Gain", "NS",
                  "Novelty Class", "Coronal State"] + \
                 [c.replace("_Index", "").replace("VELC_Scientific_", "") + " z"
                  for c in z_cols[:4]]

    rows_data = []
    cell_colors = []

    for idx, row in df_top.iterrows():
        fname = str(row.get("filename", ""))
        # Truncate filename to fit
        short_name = fname[-45:] if len(fname) > 45 else fname
        gain = "LG" if "_LG_" in fname else "HG" if "_HG_" in fname else "??"

        ns     = f"{row.get('Novelty_Score', 0):.3f}"
        nclass = str(row.get("Novelty_Class", ""))
        state  = str(row.get("Coronal_State", ""))

        zvals = []
        for zcol in z_cols[:4]:
            key = f"z_{zcol}"
            if key in row.index:
                zvals.append(f"{float(row[key]):+.2f}")
            else:
                zvals.append("—")

        row_data = [str(idx + 1), short_name, gain, ns, nclass, state] + zvals
        rows_data.append(row_data)

        # Cell colors
        ncolor = NOVELTY_COLORS.get(nclass, "#7C8FA6")
        scolor = STATE_COLORS.get(state, "#93C5FD")
        gcolor = "#3B82F6" if gain == "HG" else "#F97316"

        row_colors = ["#141C35"] * len(row_data)
        row_colors[2] = gcolor + "20"
        row_colors[4] = ncolor + "25"
        row_colors[5] = scolor + "20"
        cell_colors.append(row_colors)

    table = ax.table(
        cellText=rows_data,
        colLabels=col_labels,
        cellLoc="left",
        loc="center",
        cellColours=cell_colors,
    )

    table.auto_set_font_size(False)
    table.set_fontsize(7.5)
    table.scale(1.0, 1.5)

    # Style header
    for j in range(len(col_labels)):
        table[0, j].set_facecolor("#1E2D54")
        table[0, j].set_text_props(color="#93C5FD",
                                    fontfamily="monospace",
                                    fontweight="bold")

    # Style data cells
    for i in range(1, top_n + 1):
        for j in range(len(col_labels)):
            table[i, j].set_text_props(color="#E2E8F0",
                                        fontfamily="monospace")
            table[i, j].set_edgecolor("#1E2D54")

    fig.text(0.5, 0.97, "VELC ANOMALY SUMMARY TABLE",
             ha="center", fontsize=11, color="#93C5FD",
             fontfamily="monospace", fontweight="bold")

    out_path = os.path.join(output_dir, "anomaly_summary_table.png")
    fig.savefig(out_path, dpi=130, bbox_inches="tight",
                facecolor="#0A0E1A")
    plt.close(fig)
    print(f"  Saved: anomaly_summary_table.png")


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--anomalies", default=ANOMALY_CSV)
    parser.add_argument("--fits_dir",  default=FITS_DIR)
    parser.add_argument("--output",    default=OUTPUT_DIR)
    parser.add_argument("--top_n",     default=TOP_N,  type=int)
    parser.add_argument("--cols",      default=N_COLS, type=int)
    args = parser.parse_args()

    print("=" * 60)
    print("  VELC ANOMALY GALLERY")
    print("=" * 60)

    # ── Load anomaly explanations ─────────────────────────────────────────
    if not os.path.exists(args.anomalies):
        print(f"[ERROR] Anomaly file not found: {args.anomalies}")
        print("        Run anomaly_explanations.py first.")
        return

    df = pd.read_csv(args.anomalies)
    print(f"\n  Loaded: {len(df)} anomalous frames")
    print(f"  Showing top {min(args.top_n, len(df))} by novelty score")

    if "Novelty_Score" not in df.columns:
        print("[ERROR] 'Novelty_Score' column not found in anomaly CSV.")
        print("        Expected columns from anomaly_explanations.py output.")
        return

    # ── Check FITS availability ───────────────────────────────────────────
    print(f"\n  Searching for FITS files in: {args.fits_dir}")
    sample = str(df.iloc[0].get("filename", ""))
    test_path = find_fits_file(sample, args.fits_dir)
    if test_path:
        print(f"  FITS files found  ✓  (e.g. {os.path.basename(test_path)})")
    else:
        print(f"  FITS files not found — will use synthetic placeholders")
        print(f"  (gallery will still show all metadata correctly)")
        print(f"  To load real images: --fits_dir /path/to/your/fits/files")

    # ── Build gallery ─────────────────────────────────────────────────────
    print(f"\n  Building gallery ({args.top_n} panels, {args.cols} columns)...")
    os.makedirs(args.output, exist_ok=True)

    build_gallery(df, args.fits_dir, args.output, args.top_n, args.cols)
    build_summary_table(df, args.output, min(args.top_n, len(df)))

    # ── Save metadata CSV ─────────────────────────────────────────────────
    df_top = df.nlargest(args.top_n, "Novelty_Score").reset_index(drop=True)
    meta_path = os.path.join(args.output, "gallery_metadata.csv")
    df_top.to_csv(meta_path, index=False)
    print(f"  Saved: gallery_metadata.csv")

    # ── Summary ───────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  Gallery complete.")
    print(f"  Output: {args.output}")
    print(f"\n  Top anomaly:")
    top = df.nlargest(1, "Novelty_Score").iloc[0]
    print(f"    File     : {os.path.basename(str(top.get('filename','?')))}")
    print(f"    NS       : {top.get('Novelty_Score', '?'):.4f}")
    print(f"    State    : {top.get('Coronal_State', '?')}")
    print(f"    Class    : {top.get('Novelty_Class', '?')}")
    print(f"\n  Next step: python similarity_explorer.py")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
