import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # API Settings
    API_VERSION: str = "v1"
    API_TITLE: str = "Mission Control API"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:3000", "http://127.0.0.1:5173", "*"]
    
    # Engine Refresh & Cache
    CACHE_TTL_SECONDS: int = 5
    
    # Model Paths
    FUSION_MODEL_PATH: str = "fusion_engine/outputs/best_solar_fusion_model.pkl"
    SOLEXS_DATA_PATH: str = "SOLEXS_downloads"
    HEL1OS_DATA_PATH: str = "He1os_script"
    VELC_DATA_PATH: str = "VELC_DOWNLOADS"
    
    # System Paths
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    class Config:
        env_file = ".env"

settings = Settings()
