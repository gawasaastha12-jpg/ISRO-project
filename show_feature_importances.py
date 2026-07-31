import joblib
import os
import sys

# Core 17 features expected by the models in the exact order they were trained
feature_names = [
    'mean', 'median', 'std', 'iqr', 'skew', 'kurtosis', 'energy', 'snr',
    'max', 'min', 'peak_count', 'peak_ratio', 'max_prominence',
    'detection_threshold', 'prominence_multiple', 'largest_width', 'trend'
]

def show_importances(horizon):
    path = f"SOLEXS_downloads/models/model_forecast_{horizon}.pkl"
    if not os.path.exists(path):
        print(f"Error: Model file '{path}' not found.")
        sys.exit(1)
        
    bundle = joblib.load(path)
    model = bundle.get("model") if isinstance(bundle, dict) else bundle
    importances = model.feature_importances_
    
    # Sort and print
    sorted_feats = sorted(zip(feature_names, importances), key=lambda x: -x[1])
    print(f"\n=== Top Features for {horizon} Horizon Model (Total sum = 1.000) ===")
    for idx, (name, imp) in enumerate(sorted_feats[:5], 1):
        print(f"  {idx}. {name:<20} Gain = {imp:.4f} ({imp*100:.1f}%)")

if __name__ == "__main__":
    horizon = sys.argv[1] if len(sys.argv) > 1 else "5min"
    # Normalize inputs
    if not horizon.endswith("min"):
        horizon = f"{horizon}min"
    show_importances(horizon)
