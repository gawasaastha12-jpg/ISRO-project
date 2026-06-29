import os
import time
import numpy as np
import pandas as pd
from datetime import datetime

from .confidence_engine import fuse_prediction
from .alert_engine import process_alert
from .prediction_core import predict_horizon, FlareClass, DEFAULT_CLASSES, SEVERITY
from backend.api.cache import ModelCache

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

import logging
logger = logging.getLogger(__name__)

def generate_solexs_data(cache: ModelCache) -> dict:
    start_time = time.time()
    horizons = ["5min", "10min", "15min", "30min", "60min", "120min", "180min"]
    results = []
    
    for h in horizons:
        model_bundle = cache.models.get(f"solexs_{h}")
        df = cache.datasets.get(f"solexs_{h}")
        
        if model_bundle is not None and df is not None:
            try:
                pred_dict = predict_horizon(model_bundle, df, h, cache.metadata)
                pred_dict["status"] = "ONLINE"
                results.append(pred_dict)
            except Exception as e:
                logger.error(f"Error predicting SOLEXS horizon {h}: {e}")
                
    if not results:
        return {
            "status": "OFFLINE",
            "message": "All SOLEXS horizons are offline.",
            "forecast": "Unknown",
            "forecast_confidence": 0.0,
            "forecast_severity_index": 0.0,
            "trajectory": "Unknown",
            "forecast_evolution_rate": 0.0,
            "probabilities": {},
            "probability_vector": [],
            "entropy": 0.0,
            "uncertainty": 0.0,
            "prediction_id": "",
            "multi_horizon": [],
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "processing_ms": round((time.time() - start_time) * 1000, 2)
        }
        
    nowcast = results[0]
    
    # Expected severities linear regression fit over actual chronological minute coordinates
    time_map = {
        "5m": 5.0,
        "10m": 10.0,
        "15m": 15.0,
        "30m": 30.0,
        "60m": 60.0,
        "120m": 120.0,
        "180m": 180.0
    }
    times = []
    y = []
    
    for r in results:
        hz = r["horizon"]
        if hz in time_map:
            times.append(time_map[hz])
            y.append(r["forecast_severity_index"])
            
    # Configurable escalation and decay rate limits per minute
    ESCALATION_THRESHOLD = 0.0005
    DECAY_THRESHOLD = -0.0005
    
    if len(times) >= 2:
        slope, intercept = np.polyfit(times, y, 1)
        forecast_evolution_rate = float(slope)
        
        if forecast_evolution_rate > ESCALATION_THRESHOLD:
            trajectory = "Escalating"
        elif forecast_evolution_rate < DECAY_THRESHOLD:
            trajectory = "Decaying"
        else:
            trajectory = "Stable"
    else:
        forecast_evolution_rate = 0.0
        trajectory = "Stable"
        
    return {
        "status": "ONLINE" if len(results) == len(horizons) else "DEGRADED",
        "forecast": nowcast["forecast"],
        "confidence": nowcast["forecast_confidence"],
        "forecast_confidence": nowcast["forecast_confidence"],
        "forecast_severity_index": nowcast["forecast_severity_index"],
        "trajectory": trajectory,
        "forecast_evolution_rate": round(float(forecast_evolution_rate), 6),
        "probabilities": nowcast["probabilities"],
        "probability_vector": nowcast["probability_vector"],
        "entropy": nowcast["entropy"],
        "uncertainty": nowcast["uncertainty"],
        "margin": nowcast["margin"],
        "prediction_id": nowcast["prediction_id"],
        "multi_horizon": results,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "processing_ms": round((time.time() - start_time) * 1000, 2),
        "engine_versions": {"solexs": cache.metadata.get("solexs", {}).get("forecast_5min", {}).get("version", "v3.0")}
    }

def run_pipeline():
    """Run the pipeline and return structured dictionary."""
    cache = ModelCache()
    cache.load_all(ROOT)
    
    forecast_data = generate_solexs_data(cache)
    forecast = forecast_data.get("forecast", "Quiet")
    probabilities = forecast_data.get("probabilities", {"Quiet": 1.0, "B-like": 0.0, "C-like": 0.0, "M-like": 0.0, "X-like": 0.0})
    
    # ----------------- HEL1OS -----------------
    activity_score = 84.0
    activity_state = "Highly Active"
    hel1os_data = {
        "activity_score": activity_score,
        "activity_state": activity_state,
        "flux": 2.4e-4,
        "recent_bursts": 3,
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    # ----------------- VELC -----------------
    velc_data = {
        "activity_index": 8,
        "novelty_score": 89.5,
        "anomaly_boxes": 3,
        "similarity_events": [],
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }

    # ----------------- Correlation -----------------
    correlation_data = {
        "overall_score": 0.82,
        "pairs": [
            {"pair": "SOLEXS ↔ HEL1OS", "value": 0.91, "rating": 5},
            {"pair": "SOLEXS ↔ VELC", "value": 0.74, "rating": 4},
            {"pair": "HEL1OS ↔ VELC", "value": 0.69, "rating": 3}
        ]
    }

    # ----------------- Fusion & Alert -----------------
    fusion_result = fuse_prediction(
        prediction=forecast,
        probabilities=probabilities,
        activity_score=activity_score,
        activity_state=activity_state
    )
    alert = process_alert(fusion_result)

    fusion_data = {
        "prediction": forecast,
        "confidence": float(fusion_result["confidence"]),
        "alert_level": alert.get("alert", "NORMAL"),
        "priority": 1,
        "recommended_action": alert.get("recommendation", "Monitor nominal operations")
    }

    alert_data = {
        "current_alert": alert.get("alert", "NORMAL"),
        "history": [
            {"id": 1, "level": alert.get("alert", "NORMAL"), "timestamp": datetime.utcnow().isoformat() + "Z", "reason": "Current fusion output", "status": "Active", "operatorNotes": alert.get("recommendation", "")}
        ]
    }

    # ----------------- Explainability -----------------
    explainability_data = {
        "horizons": {
            "5m": [{"name": "Peak Count", "value": "+0.031"}],
            "15m": [{"name": "Energy", "value": "+0.035"}],
            "30m": [{"name": "HEL Activity", "value": "+0.041"}],
            "60m": [{"name": "VELC Novelty", "value": "+0.055"}],
            "120m": [{"name": "Structure", "value": "+0.048"}],
            "180m": [{"name": "Baseline Flux", "value": "+0.052"}]
        }
    }

    return {
        "mission_status": {
            "utc": datetime.utcnow().strftime("%H:%M:%S UTC"),
            "system": "Nominal",
            "api_latency_ms": 42,
            "last_updated": datetime.utcnow().isoformat() + "Z"
        },
        "instruments": {
            "solexs": forecast_data,
            "hel1os": hel1os_data,
            "velc": velc_data
        },
        "analytics": {
            "correlation": correlation_data,
            "fusion": fusion_data,
            "explainability": explainability_data
        },
        "alerts": alert_data
    }
