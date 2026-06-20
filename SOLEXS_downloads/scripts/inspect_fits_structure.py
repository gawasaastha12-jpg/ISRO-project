import os
import zipfile
import gzip
import tempfile
from astropy.io import fits

# ROOT folder containing ONLY outer ZIPs
RAW_DIR = "../data/raw_zips"


def find_zip_files():
    """Safely get only real zip files (ignore folders like 'extracted')"""
    return [
        f for f in os.listdir(RAW_DIR)
        if f.lower().endswith(".zip")
        and os.path.isfile(os.path.join(RAW_DIR, f))
    ]


def extract_zip(zip_path, out_dir):
    """Extract outer zip safely"""
    with zipfile.ZipFile(zip_path, "r") as z:
        z.extractall(out_dir)


def find_lc_files(root_dir):
    """Find all .lc.gz recursively"""
    lc_files = []
    for root, _, files in os.walk(root_dir):
        for f in files:
            if f.endswith(".lc.gz"):
                lc_files.append(os.path.join(root, f))
    return lc_files


def inspect_fits(lc_gz_path, tmp_dir):
    """Decompress + inspect FITS structure"""

    # decompress .gz → .lc
    out_lc = os.path.join(tmp_dir, "temp.lc")

    with gzip.open(lc_gz_path, "rb") as fin:
        with open(out_lc, "wb") as fout:
            fout.write(fin.read())

    print("\n🔍 Inspecting FITS:", lc_gz_path)

    try:
        hdul = fits.open(out_lc)
    except Exception as e:
        print("❌ FITS open failed:", e)
        return

    print("\n📦 HDU Structure:")
    hdul.info()

    for i, hdu in enumerate(hdul):
        print(f"\n➡️ HDU {i}")

        try:
            print("Columns:", hdu.columns)
        except Exception:
            print("No columns found")

        try:
            if hasattr(hdu, "data") and hdu.data is not None:
                print("Sample data shape:", hdu.data.shape)
        except Exception:
            pass

    hdul.close()


def main():

    zip_files = find_zip_files()

    print(f"Found {len(zip_files)} ZIP files in {RAW_DIR}")

    if not zip_files:
        raise FileNotFoundError("No valid ZIP files found in raw_zips")

    # pick first valid ZIP
    zip_path = os.path.join(RAW_DIR, zip_files[0])

    print("\n📦 Using ZIP:", zip_path)

    with tempfile.TemporaryDirectory() as tmp:

        # extract outer zip
        extract_zip(zip_path, tmp)

        # find LC files
        lc_files = find_lc_files(tmp)

        print(f"\n🔎 Found {len(lc_files)} .lc.gz files")

        if not lc_files:
            print("❌ No .lc.gz files found — check SDD1/SDD2 structure")
            return

        # inspect first few files
        for lc in lc_files[:3]:
            inspect_fits(lc, tmp)

    print("\n✅ Inspection complete")


if __name__ == "__main__":
    main()