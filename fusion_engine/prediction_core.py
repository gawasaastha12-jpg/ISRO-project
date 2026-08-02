import os
import time
import uuid
import pandas as pd
from datetime import datetime, UTC
from enum import Enum
from typing import Dict, Any, List
import numpy as np
import traceback
import logging

logger = logging.getLogger(__name__)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class FITSTelemetrySim:
    _instance = None
    
    def __init__(self, root_dir: str):
        self.root_dir = root_dir
        self.lc_files = []
        self.current_file_idx = 0
        self.current_counts = None
        self.current_times = None
        
        # Recursively find all .lc.gz files inside the SOLEXS data folder
        lc_dir = os.path.join(root_dir, "SOLEXS_downloads", "data", "lc_files")
        if os.path.exists(lc_dir):
            for r, _, files in os.walk(lc_dir):
                for f in files:
                    if f.endswith(".lc.gz"):
                        self.lc_files.append(os.path.join(r, f))
            self.lc_files.sort()
            
        if self.lc_files:
            logger.info(f"FITS Simulator found {len(self.lc_files)} light curve files.")
            self._load_file(self.lc_files[0])
        else:
            logger.error("FITS Simulator: No .lc.gz files found in SOLEXS_downloads/data/lc_files.")
            
    def _load_file(self, path: str):
        logger.info(f"FITS Simulator loading FITS: {path}")
        # Use a local temporary file in the data folder to decompress FITS cleanly on Windows
        temp_lc = os.path.join(self.root_dir, "SOLEXS_downloads", "data", "temp_telemetry.lc")
        try:
            import gzip
            from astropy.io import fits
            with gzip.open(path, "rb") as fin:
                with open(temp_lc, "wb") as fout:
                    fout.write(fin.read())
                    
            with fits.open(temp_lc, memmap=False) as hdul:
                data = hdul[1].data
                self.current_times = np.array(data["TIME"]).copy()
                self.current_counts = np.nan_to_num(np.array(data["COUNTS"]), nan=0.0).copy()
                
            if os.path.exists(temp_lc):
                try:
                    os.remove(temp_lc)
                except Exception:
                    pass
        except Exception as e:
            logger.error(f"FITS Simulator failed to parse FITS: {e}")
            # Fallback to a synthetic solar count series if astropy/gz fails
            self.current_counts = np.random.randn(86400) * 10 + 20
            self.current_times = np.arange(86400)
            
    @classmethod
    def get_instance(cls, root_dir: str):
        if cls._instance is None:
            cls._instance = cls(root_dir)
        return cls._instance
        
    def get_window(self) -> np.ndarray:
        if self.current_counts is None or len(self.current_counts) < 600:
            return np.zeros(600)
            
        # Map time to simulated index playhead (cycling through the 86400 samples of the day)
        n_points = len(self.current_counts)
        # Playhead speedup factor: simulates 30 seconds of telemetry per wall-clock second
        # This yields a dynamic 150-sample stride every 5 seconds, showing active changes.
        speedup = 30
        playhead = 600 + (int(time.time() * speedup) % (n_points - 600))
        
        # Periodically swap file (e.g. cycle to next FITS day every loop)
        cycle_idx = (int(time.time() / (n_points)) % len(self.lc_files)) if self.lc_files else 0
        if cycle_idx != self.current_file_idx and self.lc_files:
            self.current_file_idx = cycle_idx
            self._load_file(self.lc_files[self.current_file_idx])
            
        return self.current_counts[playhead - 600 : playhead]
        
    def get_current_filename(self) -> str:
        if self.lc_files and self.current_file_idx < len(self.lc_files):
            return os.path.basename(self.lc_files[self.current_file_idx])
        return "SOLEXS_L1_FITS_Stream"


class FlareClass(Enum):
    QUIET = "Quiet"
    B = "B-like"
    C = "C-like"
    M = "M-like"
    X = "X-like"

DEFAULT_CLASSES = [
    FlareClass.QUIET.value,
    FlareClass.B.value,
    FlareClass.C.value,
    FlareClass.M.value,
    FlareClass.X.value
]

SEVERITY = {
    FlareClass.QUIET.value: 0,
    FlareClass.B.value: 1,
    FlareClass.C.value: 2,
    FlareClass.M.value: 3,
    FlareClass.X.value: 4
}

def predict_horizon(model_bundle: Any, df: Any, horizon: str, cache_metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    start_time = time.time()
    
    solexs_meta = (cache_metadata or {}).get("solexs", {}).get(f"forecast_{horizon}", {})
    model_version = solexs_meta.get("version", "v3.0")
    trained_on = solexs_meta.get("trained_on", "2026-05-10")
    dataset_version = solexs_meta.get("dataset", "forecast_5min.csv").split(".")[0]
    
    threshold = 0.50
    model_sha = "N/A"
    
    # Feature columns validation - dynamically read from model bundle if present
    feature_cols = None
    if isinstance(model_bundle, dict):
        feature_cols = model_bundle.get("feature_cols")
    if feature_cols is None:
        feature_cols = [
            "mean", "median", "std", "iqr", "skew", "kurtosis", "energy", "snr",
            "max", "min", "peak_count", "peak_ratio", "max_prominence",
            "detection_threshold", "prominence_multiple", "largest_width", "trend"
        ]
    
    # Load raw FITS telemetry stream and extract features in real time
    latest = None
    try:
        import sys
        scripts_path = os.path.join(ROOT_DIR, "SOLEXS_downloads", "scripts")
        if scripts_path not in sys.path:
            sys.path.append(scripts_path)
        from features_v2 import extract_features
        
        # Get simulated FITS counts window
        sim = FITSTelemetrySim.get_instance(ROOT_DIR)
        window = sim.get_window()
        
        # Extract 74 features
        feats = extract_features(window)
        if feats is not None:
            # Map into expected Pandas Series
            if len(feature_cols) == 17:
                noise_std = feats.get("std", 0.0)
                det_thresh = max(3 * noise_std, 11)
                prom_mult = feats.get("max_prominence", 0.0) / det_thresh if det_thresh > 0 else 0.0
                
                latest = pd.Series({
                    "mean": feats.get("mean", 0.0),
                    "median": feats.get("median", 0.0),
                    "std": feats.get("std", 0.0),
                    "iqr": feats.get("iqr", 0.0),
                    "skew": feats.get("skew", 0.0),
                    "kurtosis": feats.get("kurtosis", 0.0),
                    "energy": feats.get("energy", 0.0),
                    "snr": feats.get("snr", 0.0),
                    "max": feats.get("max", 0.0),
                    "min": feats.get("min", 0.0),
                    "peak_count": feats.get("peak_count", 0.0),
                    "peak_ratio": feats.get("peak_ratio", 0.0),
                    "max_prominence": feats.get("max_prominence", 0.0),
                    "detection_threshold": det_thresh,
                    "prominence_multiple": prom_mult,
                    "largest_width": feats.get("largest_width", 0.0),
                    "trend": feats.get("trend", 0.0),
                    "source_file": sim.get_current_filename()
                })
            else:
                latest_dict = {col: feats.get(col, 0.0) for col in feature_cols}
                latest_dict["source_file"] = sim.get_current_filename()
                latest = pd.Series(latest_dict)
    except Exception as e:
        logger.warning(f"FITS telemetry parsing failed, falling back to CSV lookup: {e}")

    if latest is None:
        # Fallback to CSV indexing if FITS parsing fails
        if len(df) == 0:
            raise ValueError("DataFrame is empty")
        playback_length = min(500, len(df))
        start_offset = len(df) - playback_length
        frame_idx = start_offset + (int(time.time() / 10) % playback_length)
        latest = df.iloc[frame_idx]

    # Validate feature columns are in the retrieved series
    missing = [c for c in feature_cols if c not in latest.index]
    if missing:
        raise ValueError(f"Missing columns in features:\n{missing}")
        
    X = latest[feature_cols].values.reshape(1, -1)
    
    if isinstance(model_bundle, dict):
        model = model_bundle.get("model")
        label_encoder = model_bundle.get("label_encoder")
        model_sha = model_bundle.get("model_sha", "N/A")
        if "optimal_threshold" in model_bundle:
            threshold = model_bundle["optimal_threshold"]
    else:
        model = model_bundle
        label_encoder = None

    model_name = type(model).__name__

    try:
        prediction = model.predict(X)[0]
        prob = model.predict_proba(X)[0]
        
        if label_encoder is not None:
            prediction = label_encoder.inverse_transform([prediction])[0]
        
        # Map predicted class value to standardized Enum strings
        if isinstance(prediction, (int, np.integer)) or (isinstance(prediction, str) and prediction.isdigit()):
            idx = int(prediction)
            if 0 <= idx < len(DEFAULT_CLASSES):
                prediction = DEFAULT_CLASSES[idx]
        else:
            prediction_str = str(prediction)
            if prediction_str == "B": prediction = FlareClass.B.value
            elif prediction_str == "C": prediction = FlareClass.C.value
            elif prediction_str == "M": prediction = FlareClass.M.value
            elif prediction_str == "X": prediction = FlareClass.X.value
            elif prediction_str == "Quiet": prediction = FlareClass.QUIET.value
            else: prediction = prediction_str
            
        prediction = str(prediction)
        
        raw_classes = (
            label_encoder.classes_
            if label_encoder is not None
            else DEFAULT_CLASSES
        )

        standardized_classes = []
        for cls in raw_classes:
            if isinstance(cls, (int, np.integer)) or (isinstance(cls, str) and cls.isdigit()):
                idx = int(cls)
                if 0 <= idx < len(DEFAULT_CLASSES):
                    standardized_classes.append(DEFAULT_CLASSES[idx])
                else:
                    standardized_classes.append(str(cls))
            else:
                cls_str = str(cls)
                if cls_str == "B": standardized_classes.append(FlareClass.B.value)
                elif cls_str == "C": standardized_classes.append(FlareClass.C.value)
                elif cls_str == "M": standardized_classes.append(FlareClass.M.value)
                elif cls_str == "X": standardized_classes.append(FlareClass.X.value)
                elif cls_str == "Quiet": standardized_classes.append(FlareClass.QUIET.value)
                else: standardized_classes.append(cls_str)

        probabilities = {
            cls: float(p)
            for cls, p in zip(standardized_classes, prob)
        }
        
        probability_vector = [
            probabilities.get(cls, 0.0) for cls in DEFAULT_CLASSES
        ]
        
        # Calculate Forecast Severity Index (FSI)
        forecast_severity_index = sum(
            probabilities.get(cls, 0.0) * SEVERITY.get(cls, 0)
            for cls in DEFAULT_CLASSES
        )
        
        entropy = float(-sum(p * np.log2(p) for p in prob if p > 0.0))
        forecast_confidence = float(probabilities.get(prediction, max(probabilities.values())))
        uncertainty = float(1.0 - forecast_confidence)
        
        sorted_probs = sorted(probabilities.values(), reverse=True)
        margin = float(sorted_probs[0] - sorted_probs[1]) if len(sorted_probs) >= 2 else 0.0
        
        prediction_id = str(uuid.uuid4())
        processing_ms = round((time.time() - start_time) * 1000, 2)
        
        # Logging layout with new terminology
        logger.info("========== %s MODEL ==========", horizon.replace("min", "").upper())
        logger.info("Input shape : %s", X.shape)
        logger.info("")
        logger.info("Forecast :")
        logger.info("%s", prediction)
        logger.info("")
        logger.info("Forecast Confidence :")
        logger.info("%.4f", forecast_confidence)
        logger.info("")
        logger.info("Forecast Severity Index (FSI) :")
        logger.info("%.4f", forecast_severity_index)
        logger.info("")
        logger.info("Entropy :")
        logger.info("%.4f", entropy)
        logger.info("")
        logger.info("Margin :")
        logger.info("%.4f", margin)
        logger.info("")
        logger.info("Probabilities")
        for cls in DEFAULT_CLASSES:
            display_cls = cls.split("-")[0]
            logger.info("%-6s : %.4f", display_cls, probabilities.get(cls, 0.0))
        logger.info("")
        logger.info("Processing :")
        logger.info("%d ms", int(processing_ms))
        logger.info("==================================")
        
        return {
            "horizon": horizon.replace("min", "m"),
            "forecast": prediction,
            "confidence": forecast_confidence,
            "forecast_confidence": forecast_confidence,
            "probabilities": probabilities,
            "probability_vector": probability_vector,
            "forecast_severity_index": forecast_severity_index,
            "entropy": entropy,
            "uncertainty": uncertainty,
            "margin": margin,
            "prediction_id": prediction_id,
            "model_name": model_name,
            "model_version": model_version,
            "model_sha": model_sha,
            "dataset_version": dataset_version,
            "trained_on": trained_on,
            "threshold": threshold,
            "processing_ms": processing_ms,
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "solexs_peak": float(latest["max"]) * 1e-10
        }
        
    except Exception as e:
        traceback.print_exc()
        logger.exception("Forecast failed")
        raise e
