import time
import uuid
from datetime import datetime
from enum import Enum
from typing import Dict, Any, List
import numpy as np
import traceback
import logging

logger = logging.getLogger(__name__)

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
    
    # Feature columns validation
    feature_cols = [
        "mean", "median", "std", "iqr", "skew", "kurtosis", "energy", "snr",
        "max", "min", "peak_count", "peak_ratio", "max_prominence",
        "detection_threshold", "prominence_multiple", "largest_width", "trend"
    ]
    
    missing = [c for c in feature_cols if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns:\n{missing}")
        
    latest = df.iloc[-1]
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
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }
        
    except Exception as e:
        traceback.print_exc()
        logger.exception("Forecast failed")
        raise e
