"""
02_preprocess_velc.py
---------------------------------------
Preprocess all Aditya-L1 VELC FITS images.

Pipeline
---------
FITS
 ↓
Percentile clipping
 ↓
Normalization
 ↓
Log stretch
 ↓
CLAHE
 ↓
Median filter
 ↓
Save PNG
"""

from pathlib import Path

import cv2
import numpy as np
import matplotlib.pyplot as plt
from astropy.io import fits


INPUT_DIR = Path("..")
OUTPUT_DIR = Path("../processed_images")

OUTPUT_DIR.mkdir(exist_ok=True)


def preprocess(image):

    image = image.astype(np.float32)

    # ------------------------------------
    # Remove extreme outliers
    # ------------------------------------

    low = np.percentile(image, 1)
    high = np.percentile(image, 99.5)

    image = np.clip(image, low, high)

    # ------------------------------------
    # Normalize
    # ------------------------------------

    image -= image.min()
    image /= image.max()

    # ------------------------------------
    # Log Stretch
    # ------------------------------------

    image = np.log1p(9 * image)
    image /= image.max()

    # ------------------------------------
    # Convert to uint8
    # ------------------------------------

    image8 = (255 * image).astype(np.uint8)

    # ------------------------------------
    # CLAHE
    # ------------------------------------

    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    image8 = clahe.apply(image8)

    # ------------------------------------
    # Median Filter
    # ------------------------------------

    image8 = cv2.medianBlur(image8, 3)

    return image8


def save_png(image, outfile):

    plt.figure(figsize=(10, 6))

    plt.imshow(
        image,
        cmap="gray",
        origin="lower"
    )

    plt.axis("off")

    plt.tight_layout()

    plt.savefig(
        outfile,
        dpi=200,
        bbox_inches="tight"
    )

    plt.close()


def process_file(fits_file):

    with fits.open(fits_file) as hdul:

        image = hdul[0].data

    processed = preprocess(image)

    out_png = OUTPUT_DIR / (fits_file.stem + ".png")

    save_png(processed, out_png)

    return processed


def main():

    fits_files = sorted(INPUT_DIR.glob("*.fits"))

    print(f"\nFound {len(fits_files)} FITS files\n")

    for i, file in enumerate(fits_files, start=1):

        print(f"[{i:3d}/{len(fits_files)}] {file.name}")

        process_file(file)

    print("\nDone!")

    print(f"\nProcessed images saved to:\n{OUTPUT_DIR}")


if __name__ == "__main__":
    main()