"""
read_velc.py
-----------------------------------------
Read and visualize Aditya-L1 VELC Level-1 FITS images.

Author: Aastha
"""

from pathlib import Path

import numpy as np
import matplotlib.pyplot as plt
from astropy.io import fits


class VELCReader:

    def __init__(self, fits_path):
        self.fits_path = Path(fits_path)

        if not self.fits_path.exists():
            raise FileNotFoundError(f"\nFITS file not found:\n{self.fits_path}")

        self.header = None
        self.image = None

    def load(self):
        """Load FITS image."""

        with fits.open(self.fits_path) as hdul:

            self.header = hdul[0].header
            self.image = hdul[0].data.astype(np.float32)

        return self.image

    def print_info(self):

        print("=" * 70)
        print("VELC IMAGE INFORMATION")
        print("=" * 70)

        print(f"\nFile : {self.fits_path.name}")
        print(f"Shape: {self.image.shape}")
        print(f"Dtype: {self.image.dtype}")

        print("\nStatistics")
        print("-" * 30)

        print(f"Min    : {np.min(self.image):.2f}")
        print(f"Max    : {np.max(self.image):.2f}")
        print(f"Mean   : {np.mean(self.image):.2f}")
        print(f"Median : {np.median(self.image):.2f}")
        print(f"Std    : {np.std(self.image):.2f}")

        print("\nMetadata")
        print("-" * 30)

        keys = [
            "DATE-OBS",
            "INSTRUME",
            "CHANNEL",
            "GAIN",
            "CAMERA",
            "WAVELENG",
            "TEMP",
            "ROI",
            "FRAMEBIN",
            "PLATESCL",
        ]

        for key in keys:
            if key in self.header:
                print(f"{key:12s}: {self.header[key]}")

    def save_preview(self, output="velc_preview.png"):

        image = self.image.copy()

        image -= image.min()

        image = np.log1p(image)

        image /= image.max()

        plt.figure(figsize=(10, 6))

        plt.imshow(
            image,
            cmap="gray",
            origin="lower",
        )

        plt.colorbar(label="Normalized Intensity")

        plt.title(self.fits_path.name)

        plt.tight_layout()

        plt.savefig(output, dpi=200)

        print(f"\nPreview saved as {output}")

    def show(self):

        image = self.image.copy()

        image -= image.min()

        image = np.log1p(image)

        image /= image.max()

        plt.figure(figsize=(10, 6))

        plt.imshow(
            image,
            cmap="gray",
            origin="lower",
        )

        plt.colorbar(label="Normalized Intensity")

        plt.title(self.fits_path.name)

        plt.tight_layout()

        plt.show()


def main():

    fits_files = sorted(Path("..").glob("*.fits"))

    if len(fits_files) == 0:
        raise FileNotFoundError("No FITS files found in ../")

    print(f"\nFound {len(fits_files)} FITS files")

    print("\nUsing:")

    print(fits_files[0])

    reader = VELCReader(fits_files[0])

    reader.load()

    reader.print_info()

    reader.save_preview()

    reader.show()


if __name__ == "__main__":
    main()