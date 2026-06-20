from astropy.io import fits
import numpy as np

def load_counts(file):

    try:
        hdul = fits.open(file, mode="readonly", memmap=False)

        for hdu in hdul:
            try:
                data = hdu.data
                if data is None:
                    continue

                if hasattr(data, "columns"):
                    cols = data.columns.names

                    if "COUNTS" in cols:
                        return np.nan_to_num(data["COUNTS"])

                    if "RATE" in cols:
                        return np.nan_to_num(data["RATE"])

            except:
                continue
	print("Done")
        hdul.close()

    except Exception as e:
        print("ERROR reading:", file, e)

    return None