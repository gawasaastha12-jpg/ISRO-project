import logging
import time
import numpy as np
import pandas as pd
from datetime import datetime, UTC
from typing import Dict, Any
from backend.api.cache import ModelCache

logger = logging.getLogger(__name__)

def get_velc_data(cache: ModelCache) -> Dict[str, Any]:
    start_time = time.time()
    model = cache.models.get("velc_isolation_forest")
    scaler = cache.models.get("velc_scaler")
    df = cache.datasets.get("velc_master")
    version = cache.metadata.get("velc", {}).get("version", "v1.4")
    
    if model is None or scaler is None or df is None:
        logger.warning("VELC engine offline: Isolation Forest model not initialized.")
        return {
            "status": "OFFLINE",
            "message": "VELC inference pipeline unavailable",
            "activity_index": 0,
            "novelty_score": 0.0,
            "anomaly_boxes": 0,
            "similarity_events": [],
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "engine_versions": {"velc": version}
        }
        
    try:
        # Dynamically cycle through the dataset using a 30x playhead speedup
        # to simulate a live streaming telemetry feed
        frame_idx = (int(time.time() * 30) % len(df))
        latest_row = df.iloc[frame_idx]
        features = [
            "Brightness_Index",
            "Texture_Index",
            "Gradient_Index",
            "Morphology_Index",
            "Spatial_Index",
            "Coronal_Index",
            "VELC_Scientific_Activity"
        ]
        X = pd.DataFrame([latest_row[features]])
        X_scaled = scaler.transform(X)
        
        # IsolationForest novelty score calculation
        novelty_score = float(-model.score_samples(X_scaled)[0])
        
        all_X_scaled = scaler.transform(df[features])
        all_scores = -model.score_samples(all_X_scaled)
        p75 = np.percentile(all_scores, 75)
        p90 = np.percentile(all_scores, 90)
        
        if novelty_score >= p90:
            novelty_class = "Highly Anomalous"
            activity_index = 9
            anomaly_boxes = 4
        elif novelty_score >= p75:
            novelty_class = "Unusual"
            activity_index = 6
            anomaly_boxes = 2
        else:
            novelty_class = "Normal"
            activity_index = 3
            anomaly_boxes = 0
            
        # Determine dynamic similarity events based on the playhead index and classification state
        similarity = round(0.82 + (novelty_score * 0.05) % 0.15, 2)
        if novelty_class == "Highly Anomalous":
            sim_type = "CME Loop Expansion"
            sim_id = f"SIM_V_{100 + frame_idx % 50}"
        elif novelty_class == "Unusual":
            sim_type = "Coronal Prominence Eruption"
            sim_id = f"SIM_V_{200 + frame_idx % 50}"
        else:
            sim_type = "Quiet Coronal Loop Shift"
            sim_id = f"SIM_V_{300 + frame_idx % 50}"
            similarity = round(0.70 + (frame_idx % 10) * 0.01, 2)

        return {
            "status": "ONLINE",
            "activity_index": activity_index,
            "novelty_score": round(novelty_score, 4),
            "novelty_class": novelty_class,
            "anomaly_boxes": anomaly_boxes,
            "similarity_events": [
                {
                    "event_id": sim_id,
                    "similarity": similarity,
                    "type": sim_type
                }
            ],
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "engine_versions": {"velc": version}
        }
        
    except Exception as e:
        logger.exception("VELC inference failed")
        return {
            "status": "ERROR",
            "message": str(e),
            "activity_index": 0,
            "novelty_score": 0.0,
            "anomaly_boxes": 0,
            "similarity_events": [],
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "engine_versions": {"velc": version}
        }
