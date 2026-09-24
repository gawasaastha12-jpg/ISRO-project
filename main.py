import os
import logging
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.config import settings
from backend.api.routes import router
from backend.api.cache import global_cache

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("SCADA_GRID_ENGINE")

models: Dict[str, Any] = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

MODEL_FILES = {
    "reg_15m": "xgb_reg_15m.pkl",
    "reg_30m": "xgb_reg_30m.pkl",
    "reg_60m": "xgb_reg_60m.pkl",
    "alert": "xgb_classifier_alert.pkl"
}

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan event to load:
    1. Previous forecasting/nowcasting pipeline cache (SOLEXS, HEL1OS, VELC).
    2. Four serialized XGBoost grid models from models/ directory.
    """
    logger.info("==================================================")
    logger.info("⚡ INITIALIZING ISRO PIPELINE & TERRESTRIAL GRID BACKEND...")
    logger.info("==================================================")
    
    # 1. Load original cache (SOLEXS, HEL1OS, VELC datasets & models)
    try:
        global_cache.load_all(BASE_DIR)
        logger.info(" Loaded original forecasting & nowcasting pipeline datasets.")
    except Exception as e:
        logger.error(f"❌ Error loading original cache: {e}")

    # 2. Load 4 serialized XGBoost models
    for key, filename in MODEL_FILES.items():
        file_path = os.path.join(MODELS_DIR, filename)
        if os.path.exists(file_path):
            try:
                models[key] = joblib.load(file_path)
                logger.info(f" Successfully loaded XGBoost model [{key}] from {filename}")
            except Exception as e:
                logger.error(f"❌ Failed to load XGBoost model [{key}]: {e}")
        else:
            logger.warning(f"⚠️ Model file {filename} not found in {MODELS_DIR}.")

    logger.info("⚡ All Pipelines Ready: Forecasting, Nowcasting & SCADA Grid Oracle.")
    yield
    
    logger.info("Shutting down Backend...")
    global_cache.models.clear()
    global_cache.datasets.clear()
    models.clear()

# Initialize FastAPI App
app = FastAPI(
    title="ISRO Pipeline & Terrestrial Solar Grid Backend",
    description="Mission Control API for Solar forecasting, HEL1OS, VELC nowcasting & SCADA Grid Dispatch",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include original API routes (/api/v1/dashboard, /api/v1/forecast, etc.)
app.include_router(router)

# ============================================================================
# PYDANTIC SCHEMAS FOR TERRESTRIAL GRID & SCADA DISPATCH
# ============================================================================
class GridTelemetry(BaseModel):
    location_id: str
    location_name: str
    state: str
    latitude: float
    longitude: float
    capacity_mw: float
    current_capacity: float
    target_15m: float
    target_30m: float
    target_60m: float
    drop_alert_30m: int
    ghi: float
    dni: float
    cloud_fraction: float
    aod: float
    space_weather_flag: int
    nowcast_phase: str
    prob_M: float
    prob_X: float

class DispatchReserveRequest(BaseModel):
    location_id: str = Field(..., example="pavagada", description="ID of solar park location needing reserves")
    action: Optional[str] = Field("dispatch_spinning_reserves", description="Intervention action code")

class DispatchReserveResponse(BaseModel):
    status: str
    message: str
    compensated_capacity: float

# ============================================================================
# TERRESTRIAL GRID TELEMETRY & DISPATCH ENDPOINTS
# ============================================================================

from backend.services.grid_service import get_live_grid_status

@app.get("/api/grid-status", response_model=List[GridTelemetry], summary="Get Real-Time Solar Grid Telemetry & ML Forecasts")
@app.get("/api/v1/grid-status", response_model=List[GridTelemetry], summary="Get Real-Time Solar Grid Telemetry & ML Forecasts")
async def get_grid_status():
    """
    Evaluates loaded XGBoost models against live NASA POWER solar irradiance,
    PVLib clear-sky physics, and Aditya-L1 flare probabilities across solar parks.
    """
    return get_live_grid_status(global_cache, BASE_DIR)

@app.post("/api/dispatch-reserves", response_model=DispatchReserveResponse, status_code=200, summary="Trigger SCADA Manual Grid Intervention")
@app.post("/api/v1/dispatch-reserves", response_model=DispatchReserveResponse, status_code=200, summary="Trigger SCADA Manual Grid Intervention")
async def dispatch_reserves(request: DispatchReserveRequest):
    """
    Handles manual grid intervention triggers from the React UI.
    Prints high-visibility terminal logs simulating SCADA integration and returns 200 OK.
    """
    logger.info("\n" + "="*70)
    logger.info("🚨 [SCADA INTEGRATION ALERT] MANUAL GRID INTERVENTION TRIGGERED 🚨")
    logger.info(f"👉 DISPATCHING SPINNING RESERVES TO: {request.location_id.upper()}")
    logger.info(f"👉 ACTION COMMAND: {request.action}")
    logger.info("⚡ INJECTING 0.85 COMPENSATED CAPACITY FROM BATTERY STORAGE / FAST-START HYDRO")
    logger.info("="*70 + "\n")
    
    return DispatchReserveResponse(
        status="success",
        message="Reserves Online",
        compensated_capacity=0.85
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
