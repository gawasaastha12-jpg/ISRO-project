import os
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from backend.config import settings
from .routes import router
from .cache import global_cache

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("api")

# Get ROOT dir from main.py's location (2 levels up)
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Load all models and data on startup
    logger.info("Initializing ISRO Pipeline Backend...")
    global_cache.load_all(ROOT_DIR)
    yield
    # Clean up on shutdown
    logger.info("Shutting down Backend...")
    global_cache.models.clear()
    global_cache.datasets.clear()

app = FastAPI(
    title="ISRO Pipeline Backend",
    description="Mission Control API for Solar forecasting, HEL1OS, VELC",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
# Trigger auto-reload for final telemetry fallback updates




