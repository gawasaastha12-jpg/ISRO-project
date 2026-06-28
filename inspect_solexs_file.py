from astropy.io import fits

FILE = r"C:\Users\Aastha\OneDrive\Desktop\Projects\ISRO-project\SOLEXS_downloads\data\lc_files\AL1_SLX_L1_20240201_v1.0\SDD2\AL1_SOLEXS_20240201_SDD2_L1.lc.gz"

print("=" * 70)
print("SOLEXS FILE INSPECTION")
print("=" * 70)
print(FILE)

f = fits.open(FILE)

print("\n")
print("=" * 70)
print("FITS STRUCTURE")
print("=" * 70)
print(f.info())

for hdu_index in range(len(f)):

    print("\n")
    print("=" * 70)
    print(f"HDU {hdu_index}")
    print("=" * 70)

    try:
        print("NAME:", f[hdu_index].name)
    except:
        pass

    try:
        data = f[hdu_index].data

        if data is None:
            print("No table data")
            continue

        print("Rows:", len(data))

        try:
            print("Columns:")
            print(data.columns.names)
        except:
            pass

        print("\nColumn Details:")

        try:
            for col in data.columns:
                print(
                    f"{col.name:<20} "
                    f"Format={col.format:<10} "
                    f"Unit={col.unit}"
                )
        except:
            pass

        print("\nFirst 5 Rows")

        n = min(5, len(data))

        for i in range(n):
            print(data[i])

    except Exception as e:
        print("Error:", e)

print("\n")
print("=" * 70)
print("PRIMARY HEADER")
print("=" * 70)

try:
    for key in list(f[0].header.keys())[:50]:
        print(f"{key}: {f[0].header[key]}")
except:
    pass

f.close()

print("\nDone.")