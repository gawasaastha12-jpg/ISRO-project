from astropy.io import fits

file = r"VELC_DOWNLOADS\VS1_T26_0870_003769_20260614_123841_LG_lev2_V2_1.fits"

hdul = fits.open(file)

hdul.info()

print("\nHeader:")
print(hdul[0].header)

print("\nShape:")
print(hdul[0].data.shape)