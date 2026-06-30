import logging
import time
from datetime import datetime, UTC
from typing import Dict, Any
from backend.api.cache import ModelCache

logger = logging.getLogger(__name__)

def get_hel1os_activity(cache: ModelCache) -> Dict[str, Any]:
    start_time = time.time()
    df = cache.datasets.get("hel1os")
    version = cache.metadata.get("hel1os", {}).get("version", "v2.0")
    
    if df is None or df.empty:
        logger.warning("HEL1OS engine offline: dataset not found.")
        return {
            "status": "OFFLINE",
            "message": "HEL1OS timeseries dataset not loaded.",
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "engine_versions": {"hel1os": version}
        }
        
    try:
        # Check if activity score is already computed in the dataset
        if "activity_score" not in df.columns:
            from He1os_script.activity_score import compute_activity
            # For performance, only compute on the tail if possible, but compute_activity expects full series for rolling.
            # We'll compute on the last 120 rows to save time (rolling 60 needs at least 60)
            df_slice = df.tail(120).copy()
            df_computed = compute_activity(df_slice)
        else:
            df_computed = df

        latest = df_computed.iloc[-1]
        
        return {
            "status": "ONLINE",
            "activity_score": float(latest.get("activity_score", 0.0)),
            "activity_state": str(latest.get("activity_state", "Unknown")),
            "flux": float(latest.get("excess", 0.0)),
            "recent_bursts": int(latest.get("event_density", 0)),
            "timestamp": str(latest.get("timestamp", datetime.now(UTC).isoformat().replace("+00:00", "Z"))),
            "processing_ms": round((time.time() - start_time) * 1000, 2),
            "engine_versions": {"hel1os": version}
        }
    except Exception as e:
        logger.error(f"Error computing HEL1OS activity: {e}")
        return {
            "status": "ERROR",
            "message": str(e),
            "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "processing_ms": round((time.time() - start_time) * 1000, 2)
        }
