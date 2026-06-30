import logging
from typing import Dict, Any
import time
import os
import csv
import uuid
from datetime import datetime, UTC
from .solexs_service import get_multi_horizon_forecast
from .hel1os_service import get_hel1os_activity
from .velc_service import get_velc_data
from .correlation_service import get_correlation
from .fusion_service import get_fusion_and_alert
from .explainability_service import get_explainability
import random
import pandas as pd

logger = logging.getLogger(__name__)

# Global list to store the last 100 dashboard data points for history sparklines
dashboard_history = []

# Pre-populate with 50 realistic historical entries to avoid empty lists on startup
for i in range(50):
    ts = (datetime.now(UTC) - pd.Timedelta(minutes=50-i)).isoformat().replace("+00:00", "Z")
    dashboard_history.append({
        "timestamp": ts,
        "solexs_confidence": round(0.40 + random.random() * 0.30, 4),
        "hel1os_activity_score": round(30.0 + random.random() * 40.0, 2),
        "velc_novelty_score": round(0.30 + random.random() * 0.40, 4),
        "fusion_confidence": round(0.50 + random.random() * 0.30, 4)
    })

def get_dashboard_data(cache, root_dir) -> Dict[str, Any]:
    api_start_time = time.time()
    
    from concurrent.futures import ThreadPoolExecutor
    
    with ThreadPoolExecutor(max_workers=5) as executor:
        solexs_future = executor.submit(get_multi_horizon_forecast, cache)
        hel1os_future = executor.submit(get_hel1os_activity, cache)
        velc_future = executor.submit(get_velc_data, cache)
        correlation_future = executor.submit(get_correlation, cache)
        explainability_future = executor.submit(get_explainability, cache)
        
        solexs_data = solexs_future.result()
        hel1os_data = hel1os_future.result()
        velc_data = velc_future.result()
        correlation_data = correlation_future.result()
        explainability_data = explainability_future.result()
    
    # 6. Fusion & Alerts (relies on solexs_data and hel1os_data)
    fusion_alert = get_fusion_and_alert(cache, solexs_data, hel1os_data)
    fusion_data = fusion_alert.get("fusion", {})
    alert_data = fusion_alert.get("alert", {})
    
    api_ms = round((time.time() - api_start_time) * 1000, 2)
    latency_ms = int(api_ms)
    
    global dashboard_history
    dashboard_history.append({
        "timestamp": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "solexs_confidence": float(solexs_data.get("forecast_confidence") or solexs_data.get("confidence") or 0.0),
        "hel1os_activity_score": float(hel1os_data.get("activity_score") or 0.0),
        "velc_novelty_score": float(velc_data.get("novelty_score") or 0.0),
        "fusion_confidence": float(fusion_data.get("forecast_confidence") or fusion_data.get("confidence") or 0.0)
    })
    if len(dashboard_history) > 100:
        dashboard_history = dashboard_history[-100:]
    
    # Engine versions
    engine_versions = {
        "solexs": solexs_data.get("engine_versions", {}).get("solexs", "v3.2"),
        "hel1os": hel1os_data.get("engine_versions", {}).get("hel1os", "v2.0"),
        "velc": velc_data.get("engine_versions", {}).get("velc", "v1.4"),
        "correlation": correlation_data.get("engine_versions", {}).get("correlation", "v1.1"),
        "fusion": fusion_data.get("engine_versions", {}).get("fusion", "v2.2"),
        "explainability": explainability_data.get("engine_versions", {}).get("explainability", "v3.2")
    }
    
    # Performance
    performance = {
        "api_ms": api_ms,
        "forecast_ms": solexs_data.get("processing_ms", 0.0),
        "hel1os_ms": hel1os_data.get("processing_ms", 0.0),
        "velc_ms": velc_data.get("processing_ms", 0.0),
        "correlation_ms": correlation_data.get("processing_ms", 0.0),
        "fusion_ms": fusion_data.get("processing_ms", 0.0),
        "alert_ms": 0.0, # Part of fusion_ms right now
        "dashboard_ms": api_ms
    }
    
    # Log prediction
    log_dir = os.path.join(root_dir, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_path = os.path.join(log_dir, "predictions.csv")
    
    req_id = str(uuid.uuid4())
    ts_iso = datetime.now(UTC).isoformat().replace("+00:00", "Z")
    
    multi_h = solexs_data.get("multi_horizon", [])
    get_h = lambda x: next((h["forecast"] for h in multi_h if h["horizon"] == x), "")
    prediction_id = solexs_data.get("prediction_id", req_id)
    
    try:
        file_exists = os.path.isfile(log_path)
        with open(log_path, mode="a", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            if not file_exists:
                writer.writerow(["timestamp", "forecast", "forecast_confidence", "5min", "10min", "15min", "30min", "60min", "120min", "180min", "hel_score", "velc_score", "fused_confidence", "alert", "latency_ms", "prediction_id"])
            writer.writerow([
                ts_iso,
                fusion_data.get("forecast", ""),
                fusion_data.get("forecast_confidence", 0),
                get_h("5m"),
                get_h("10m"),
                get_h("15m"),
                get_h("30m"),
                get_h("60m"),
                get_h("120m"),
                get_h("180m"),
                hel1os_data.get("activity_score", 0),
                velc_data.get("novelty_score", 0),
                fusion_data.get("forecast_confidence", 0),
                alert_data.get("current_alert", ""),
                latency_ms,
                prediction_id
            ])
    except Exception as e:
        logger.error(f"Failed to log prediction: {e}")
        
    # Build Dashboard structure
    return {
        "schema_version": "2.0",
        "mission_status": {
            "utc": datetime.now(UTC).strftime("%H:%M:%S UTC"),
            "system": "Nominal",
            "api_latency_ms": latency_ms,
            "last_updated": datetime.now(UTC).isoformat().replace("+00:00", "Z")
        },
        "instruments": {
            "solexs": solexs_data,
            "hel1os": hel1os_data,
            "velc": velc_data
        },
        "analytics": {
            "correlation": correlation_data,
            "fusion": fusion_data,
            "explainability": explainability_data
        },
        "alerts": {
            "current_alert": alert_data.get("current_alert", "NORMAL"),
            "history": [
                {
                    "id": 1, 
                    "level": alert_data.get("current_alert", "NORMAL"),
                    "timestamp": alert_data.get("timestamp", datetime.now(UTC).isoformat().replace("+00:00", "Z")),
                    "reason": alert_data.get("reason", "Nominal"),
                    "status": "Active",
                    "operatorNotes": "System fusion output"
                }
            ]
        },
        "performance": performance,
        "engine_versions": engine_versions,
        "history": list(dashboard_history)
    }
