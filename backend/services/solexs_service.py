import logging
from typing import Dict, Any
from datetime import datetime
from backend.api.cache import ModelCache
from fusion_engine import pipeline_runner
from fusion_engine.prediction_core import predict_horizon

logger = logging.getLogger(__name__)

def get_forecast(cache: ModelCache, horizon: str) -> Dict[str, Any]:
    model_bundle = cache.models.get(f"solexs_{horizon}")
    df = cache.datasets.get(f"solexs_{horizon}")
    
    version = cache.metadata.get("solexs", {}).get(f"forecast_{horizon}", {}).get("version", "v3.0")
    
    if model_bundle is None or df is None:
        logger.warning(f"SOLEXS engine offline for horizon {horizon}")
        return {
            "status": "OFFLINE",
            "message": f"SOLEXS model or dataset for {horizon} not loaded.",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "processing_ms": 0.0,
            "engine_versions": {"solexs": version}
        }
        
    try:
        pred_dict = predict_horizon(model_bundle, df, horizon, cache.metadata)
        return {
            "status": "ONLINE",
            "forecast": pred_dict["forecast"],
            "confidence": pred_dict["confidence"],
            "probabilities": pred_dict["probabilities"],
            "forecast_severity_index": pred_dict["forecast_severity_index"],
            "forecast_evolution_rate": 0.0,
            "trajectory": "Stable",
            "entropy": pred_dict["entropy"],
            "uncertainty": pred_dict["uncertainty"],
            "prediction_id": pred_dict["prediction_id"],
            "probability_vector": pred_dict["probability_vector"],
            "model_sha": pred_dict["model_sha"],
            "timestamp": pred_dict["timestamp"],
            "processing_ms": pred_dict["processing_ms"]
        }
    except Exception as e:
        import traceback
        traceback.print_exc()
        logger.exception("Prediction failed")
        return {
            "status": "ERROR",
            "message": str(e),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "processing_ms": 0.0
        }

def get_multi_horizon_forecast(cache: ModelCache) -> Dict[str, Any]:
    return pipeline_runner.generate_solexs_data(cache)
