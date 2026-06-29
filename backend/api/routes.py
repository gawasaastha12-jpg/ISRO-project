from fastapi import APIRouter, Depends
from typing import Dict, Any
import os
import csv
import time
import psutil

from .schemas import DashboardResponse, HealthResponse, ModelMetadataResponse, HistoryResponse, SystemResponse
from .dependencies import get_model_cache
from backend.services.dashboard_service import get_dashboard_data
from backend.services.solexs_service import get_multi_horizon_forecast, get_forecast
from backend.services.hel1os_service import get_hel1os_activity
from backend.services.velc_service import get_velc_data
from backend.services.correlation_service import get_correlation
from backend.services.fusion_service import get_fusion_and_alert
from backend.services.explainability_service import get_explainability
from backend.services.explainability_service import get_explainability

START_TIME = time.time()

router = APIRouter(prefix="/api/v1")

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(cache = Depends(get_model_cache)):
    """Aggregation endpoint for the entire dashboard."""
    return get_dashboard_data(cache, ROOT_DIR)

@router.get("/forecast")
async def get_all_forecasts(cache = Depends(get_model_cache)):
    return get_multi_horizon_forecast(cache)

@router.get("/forecast/{horizon}")
async def get_single_forecast(horizon: str, cache = Depends(get_model_cache)):
    horizon_clean = horizon
    if horizon.endswith("m") and not horizon.endswith("min"):
        horizon_clean = horizon + "in"
    return get_forecast(cache, horizon_clean)

@router.get("/hel1os")
async def get_hel1os(cache = Depends(get_model_cache)):
    return get_hel1os_activity(cache)

@router.get("/velc")
async def get_velc(cache = Depends(get_model_cache)):
    return get_velc_data(cache)

@router.get("/correlation")
async def get_corr(cache = Depends(get_model_cache)):
    return get_correlation(cache)

@router.get("/fusion")
async def get_fusion(cache = Depends(get_model_cache)):
    solexs_data = get_multi_horizon_forecast(cache)
    hel1os_data = get_hel1os_activity(cache)
    return get_fusion_and_alert(cache, solexs_data, hel1os_data)

@router.get("/explainability")
async def get_expl(cache = Depends(get_model_cache)):
    return get_explainability(cache)

@router.get("/health", response_model=HealthResponse)
async def get_health(cache = Depends(get_model_cache)):
    return {
        "cache": "ONLINE" if len(cache.datasets) > 0 else "OFFLINE",
        "models": "ONLINE" if len(cache.models) > 0 else "OFFLINE",
        "datasets": "ONLINE" if len(cache.datasets) > 0 else "OFFLINE",
        "api": "ONLINE",
        "storage": "ONLINE",
        "memory": f"{psutil.virtual_memory().used / (1024**3):.1f} / {psutil.virtual_memory().total / (1024**3):.1f} GB",
        "uptime": f"{int((time.time() - START_TIME) / 3600)}h {int(((time.time() - START_TIME) % 3600) / 60)}m",
        "latency_ms": 1.2
    }

@router.get("/models", response_model=ModelMetadataResponse)
async def get_models(cache = Depends(get_model_cache)):
    return {
        "status": "ONLINE",
        "metadata": cache.metadata
    }

@router.get("/history", response_model=HistoryResponse)
async def get_history():
    log_path = os.path.join(ROOT_DIR, "logs", "predictions.csv")
    predictions = []
    if os.path.exists(log_path):
        try:
            with open(log_path, mode="r", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                cleaned = []
                for row in reader:
                    clean_row = {}
                    for k, v in row.items():
                        if k is not None:
                            clean_row[str(k)] = str(v) if v is not None else ""
                    cleaned.append(clean_row)
                predictions = cleaned[-100:]
        except Exception:
            pass
    return {
        "status": "ONLINE",
        "predictions": predictions
    }

@router.get("/system", response_model=SystemResponse)
async def get_system(cache = Depends(get_model_cache)):
    return {
        "available_models": list(cache.models.keys()),
        "available_datasets": list(cache.datasets.keys()),
        "disk_usage": f"{psutil.disk_usage('/').percent}%",
        "cache_usage": f"{len(cache.models) + len(cache.datasets)} items",
        "ram": f"{psutil.virtual_memory().percent}%",
        "gpu": "N/A", # Needs pynvml, stubbed
        "cpu": f"{psutil.cpu_percent()}%",
        "version": "v1.4.0"
    }
