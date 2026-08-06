import gzip
import numpy as np
import pandas as pd
import joblib
import sys
import os
from astropy.io import fits

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR   = os.path.dirname(SCRIPT_DIR)
sys.path.append(os.path.join(ROOT_DIR, "SOLEXS_downloads", "scripts"))

from features_v2 import extract_features

MODEL_FILE = os.path.join(ROOT_DIR, "SOLEXS_downloads", "models", "model_forecast_5min.pkl")
FITS_FILE  = os.path.join(ROOT_DIR, "SOLEXS_downloads", "data", "lc_files",
                           "AL1_SLX_L1_20250211_v1.0", "SDD2",
                           "AL1_SOLEXS_20250211_SDD2_L1.lc.gz")

bundle    = joblib.load(MODEL_FILE)
model     = bundle["model"]
feat_cols = bundle["feature_cols"]

with gzip.open(FITS_FILE) as f:
    with fits.open(f) as hdul:
        data = hdul[1].data
        col_names = data.names
        raw_counts = np.array(data["COUNTS"], dtype=float) if "COUNTS" in col_names else np.array(data[col_names[1]], dtype=float)

raw_counts[raw_counts > 2000] = np.nan
raw_counts = pd.Series(raw_counts).interpolate(limit_direction="both").values

# Check around 04:00 UTC (sample 4 * 3600 = 14400)
for idx in [14400, 14460, 14520]:
    win = raw_counts[idx-600:idx]
    feats = extract_features(win)
    if feats:
        det_thresh = max(3 * feats.get('std', 0.0), 11)
        prom_mult  = feats.get('max_prominence', 0.0) / det_thresh if det_thresh > 0 else 0.0
        feat_map   = {k: v for k, v in feats.items()}
        feat_map['detection_threshold'] = det_thresh
        feat_map['prominence_multiple'] = prom_mult
        
        X = pd.DataFrame([[feat_map.get(c, 0.0) for c in feat_cols]], columns=feat_cols)
        prob = model.predict_proba(X)[0]
        print(f"Sample {idx} (04:00 UTC): mean={feats['mean']:.1f}, max={feats['max']:.1f}, std={feats['std']:.2f}, max_prom={feats['max_prominence']:.2f}, prom_mult={prom_mult:.2f}")
        print(f"  Probs (0:Quiet, 1:B, 2:C, 3:M, 4:X): {np.round(prob*100, 1)}%")
