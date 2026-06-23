"""
03_extract_features.py
-------------------------------------------------------
Extract scientific features from Aditya-L1 VELC FITS files.

Output:
    ../features/velc_features.csv

Author: Aastha
"""

from pathlib import Path

import cv2
import numpy as np
import pandas as pd

from astropy.io import fits

from scipy.ndimage import sobel
from scipy.stats import entropy

from skimage.measure import label, regionprops
from skimage.feature import graycomatrix, graycoprops


# ==========================================================
# PATHS
# ==========================================================

INPUT_DIR = Path("..")
OUTPUT_DIR = Path("../features")

OUTPUT_DIR.mkdir(exist_ok=True)

OUTPUT_CSV = OUTPUT_DIR / "velc_features.csv"


# ==========================================================
# PREPROCESS
# ==========================================================

def preprocess(image):

    image = image.astype(np.float32)

    low = np.percentile(image, 1)
    high = np.percentile(image, 99.5)

    image = np.clip(image, low, high)

    image -= image.min()

    if image.max() > 0:
        image /= image.max()

    image = np.log1p(9 * image)

    image /= image.max()

    image8 = (255 * image).astype(np.uint8)

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    image8 = clahe.apply(image8)

    image8 = cv2.medianBlur(image8, 3)

    return image8


# ==========================================================
# FEATURE EXTRACTION
# ==========================================================

def extract_features(image, header):

    features = {}

    img = image.astype(np.float32)

    # --------------------------------------------------
    # Intensity
    # --------------------------------------------------

    features["mean"] = img.mean()
    features["median"] = np.median(img)
    features["std"] = img.std()
    features["min"] = img.min()
    features["max"] = img.max()

    features["p90"] = np.percentile(img, 90)
    features["p95"] = np.percentile(img, 95)
    features["p99"] = np.percentile(img, 99)

    # --------------------------------------------------
    # Bright regions
    # --------------------------------------------------

    threshold = np.percentile(img, 99)

    binary = img > threshold

    features["bright_pixels"] = binary.sum()

    features["bright_fraction"] = binary.mean()

    lbl = label(binary)

    props = regionprops(lbl)

    features["num_regions"] = len(props)

    if props:
        features["largest_region"] = max(p.area for p in props)
    else:
        features["largest_region"] = 0

    # --------------------------------------------------
    # Gradient
    # --------------------------------------------------

    sx = sobel(img, axis=0)

    sy = sobel(img, axis=1)

    grad = np.hypot(sx, sy)

    features["grad_mean"] = grad.mean()
    features["grad_std"] = grad.std()
    features["grad_max"] = grad.max()
    features["grad_energy"] = np.mean(grad ** 2)

    # --------------------------------------------------
    # Texture (GLCM)
    # --------------------------------------------------

    glcm = graycomatrix(
        image,
        distances=[1],
        angles=[0],
        levels=256,
        symmetric=True,
        normed=True,
    )

    features["contrast"] = graycoprops(glcm, "contrast")[0, 0]
    features["homogeneity"] = graycoprops(glcm, "homogeneity")[0, 0]
    features["energy"] = graycoprops(glcm, "energy")[0, 0]
    features["correlation"] = graycoprops(glcm, "correlation")[0, 0]
    features["ASM"] = graycoprops(glcm, "ASM")[0, 0]

    # --------------------------------------------------
    # Entropy
    # --------------------------------------------------

    hist, _ = np.histogram(image, bins=256)

    features["entropy"] = entropy(hist + 1)

    # --------------------------------------------------
    # Symmetry
    # --------------------------------------------------

    h, w = img.shape

    left = img[:, :w // 2]
    right = img[:, w // 2:]

    top = img[:h // 2]
    bottom = img[h // 2:]

    left_mean = left.mean()
    right_mean = right.mean()

    top_mean = top.mean()
    bottom_mean = bottom.mean()

    features["left_mean"] = left_mean
    features["right_mean"] = right_mean
    features["top_mean"] = top_mean
    features["bottom_mean"] = bottom_mean

    features["LR_ratio"] = left_mean / (right_mean + 1e-6)
    features["TB_ratio"] = top_mean / (bottom_mean + 1e-6)

    # --------------------------------------------------
    # Radial brightness
    # --------------------------------------------------

    cy = h // 2
    cx = w // 2

    y, x = np.indices(img.shape)

    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)

    inner = img[r < 250]
    outer = img[r > 450]

    inner_mean = inner.mean()
    outer_mean = outer.mean()

    features["inner_mean"] = inner_mean
    features["outer_mean"] = outer_mean
    features["outer_inner_ratio"] = outer_mean / (inner_mean + 1e-6)

    features["radial_slope"] = inner_mean - outer_mean

    # --------------------------------------------------
    # Metadata
    # --------------------------------------------------

    for key in [
        "DATE-OBS",
        "GAIN",
        "TEMP",
        "CHANNEL",
        "FRAMEBIN",
        "ROI",
    ]:

        features[key] = header.get(key, None)

    return features


# ==========================================================
# MAIN
# ==========================================================

def main():

    rows = []

    fits_files = sorted(INPUT_DIR.glob("*.fits"))

    print(f"\nFound {len(fits_files)} FITS files\n")

    for i, file in enumerate(fits_files, start=1):

        print(f"[{i}/{len(fits_files)}] {file.name}")

        with fits.open(file) as hdul:

            header = hdul[0].header

            image = hdul[0].data

        processed = preprocess(image)

        features = extract_features(processed, header)

        features["filename"] = file.name

        rows.append(features)

    df = pd.DataFrame(rows)

    df.to_csv(OUTPUT_CSV, index=False)

    print("\n===================================")
    print("Feature extraction complete.")
    print("===================================")

    print(f"\nRows      : {len(df)}")
    print(f"Features  : {len(df.columns)}")

    print(f"\nSaved to:\n{OUTPUT_CSV}")


if __name__ == "__main__":
    main()