import zipfile
from pathlib import Path

# ----------------------------
# PATHS
# ----------------------------
ROOT_ZIP_DIR = Path("../data/raw_zips")
WORK_DIR = Path("../data/processed/extracted")

WORK_DIR.mkdir(parents=True, exist_ok=True)

# ----------------------------
# RECURSIVE ZIP EXTRACTOR
# ----------------------------
def extract_all_zips(root_dir):

    changed = True

    while changed:
        changed = False

        zip_files = list(root_dir.rglob("*.zip"))

        for zip_path in zip_files:

            try:
                extract_to = zip_path.parent

                with zipfile.ZipFile(zip_path, "r") as z:
                    z.extractall(extract_to)

                zip_path.unlink()  # remove zip after extraction

                print(f"✅ Extracted: {zip_path.name}")

                changed = True

            except Exception as e:
                print(f"⚠️ Failed ZIP: {zip_path.name} -> {e}")


# ----------------------------
# MAIN FLOW
# ----------------------------
def main():

    zip_files = list(ROOT_ZIP_DIR.glob("*.zip"))

    print(f"\n📦 Found {len(zip_files)} top-level ZIP files")

    # Step 1: extract top-level zips into work dir
    for z in zip_files:

        try:
            with zipfile.ZipFile(z, "r") as archive:
                archive.extractall(WORK_DIR)

            print(f"📦 Extracted top-level: {z.name}")

        except Exception as e:
            print(f"❌ Bad ZIP: {z.name} -> {e}")

    # Step 2: recursively extract nested zips
    print("\n🔁 Starting recursive extraction...\n")
    extract_all_zips(WORK_DIR)

    # Step 3: verify LC files
    lc_files = list(WORK_DIR.rglob("*.lc.gz"))

    print("\n====================")
    print(f"🔎 FINAL LC FILES FOUND: {len(lc_files)}")
    print("====================")

    if len(lc_files) > 0:
        print("\nSample files:")
        for f in lc_files[:5]:
            print(" -", f)


# ----------------------------
# RUN
# ----------------------------
if __name__ == "__main__":
    main()