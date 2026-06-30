import logging
import time
from datetime import datetime, UTC
from typing import Dict, Any
from backend.api.cache import ModelCache
from fusion_engine.confidence_engine import fuse_prediction
from fusion_engine.alert_engine import process_alert

logger = logging.getLogger(__name__)

def get_fusion_and_alert(cache: ModelCache, solexs_data: Dict[str, Any], hel1os_data: Dict[str, Any]) -> Dict[str, Any]:
    start_time = time.time()
    try:
        version = cache.metadata.get("fusion", {}).get("version", "v2.2")
        prediction = solexs_data.get("forecast", "Quiet")
        if prediction == "Unknown":
            prediction = "Quiet"
        # Ensure probabilities exist
        probs = solexs_data.get("probabilities", {"Quiet": 100.0, "B": 0.0, "C": 0.0, "M": 0.0, "X": 0.0})
        
        # In case the single horizon dictionary was passed instead of multi_horizon overall
        if "prob" in solexs_data:
            probs = solexs_data["prob"]
            
        activity_score = hel1os_data.get("activity_score", 0.0)
        activity_state = hel1os_data.get("activity_state", "Quiet")
        
        # Use existing bayesian fusion
        fusion_result = fuse_prediction(
            prediction=prediction,
            probabilities=probs,
            activity_score=activity_score,
            activity_state=activity_state
        )
        
        # Use existing alert engine
        alert = process_alert(fusion_result)
        
        # Return fused response
        return {
            "status": "ONLINE",
            "fusion": {
                "status": "ONLINE",
                "forecast": fusion_result.get("fused_class", prediction),
                "forecast_confidence": float(fusion_result.get("confidence", 0.0)),
                "alert_level": alert.get("alert", "NORMAL"),
                "priority": 1 if alert.get("alert") in ["SEVERE", "ALERT"] else 0,
                "recommended_action": alert.get("recommendation", "Monitor nominal operations"),
                "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "processing_ms": round((time.time() - start_time) * 1000, 2),
                "engine_versions": {"fusion": version}
            },
            "alert": {
                "current_alert": alert.get("alert", "NORMAL"),
                "reason": alert.get("recommendation", "Nominal"),
                "timestamp": solexs_data.get("timestamp")
            }
        }
    except Exception as e:
        logger.error(f"Error in Fusion engine: {e}")
        return {
            "status": "ERROR",
            "message": str(e),
            "fusion": {
                "status": "ERROR",
                "message": str(e),
                "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
                "processing_ms": round((time.time() - start_time) * 1000, 2)
            },
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2)
        }
