import logging
import joblib
import pandas as pd
import json
from typing import Dict, Any

logger = logging.getLogger(__name__)

class ModelCache:
    def __init__(self):
        self.models: Dict[str, Any] = {}
        self.datasets: Dict[str, pd.DataFrame] = {}
        self.metadata: Dict[str, Any] = {}
        
    def load_solexs_models(self, root_dir: str):
        import os
        horizons = ["5min", "10min", "15min", "30min", "60min", "120min", "180min"]
        
        for h in horizons:
            # Check for model_forecast_{h}.pkl
            path = os.path.join(root_dir, "SOLEXS_downloads", "models", f"model_forecast_{h}.pkl")
            if os.path.exists(path):
                try:
                    import hashlib
                    sha256 = hashlib.sha256()
                    with open(path, "rb") as f:
                        while chunk := f.read(8192):
                            sha256.update(chunk)
                    model_sha = sha256.hexdigest()

                    bundle = joblib.load(path)

                    if isinstance(bundle, dict):
                        self.models[f"solexs_{h}"] = {
                            "model": bundle.get("model"),
                            "label_encoder": bundle.get("label_encoder"),
                            "model_sha": model_sha
                        }
                    else:
                        self.models[f"solexs_{h}"] = {
                            "model": bundle,
                            "label_encoder": None,
                            "model_sha": model_sha
                        }
                    # Load threshold if exists, or calibration
                    if isinstance(bundle, dict) and "optimal_threshold" in bundle:
                        self.models[f"solexs_{h}_threshold"] = bundle["optimal_threshold"]
                    print(f"Loaded SOLEXS {h} model.")
                    logger.info(f"Loaded SOLEXS {h} model.")
                except Exception as e:
                    print(f"Failed to load SOLEXS {h} model: {e}")
                    logger.error(f"Failed to load SOLEXS {h} model: {e}")
            else:
                # Try lgbm
                lgbm_path = os.path.join(root_dir, "SOLEXS_downloads", "models", f"lgbm_{h}.pkl")
                if os.path.exists(lgbm_path):
                    try:
                        import hashlib
                        sha256 = hashlib.sha256()
                        with open(lgbm_path, "rb") as f:
                            while chunk := f.read(8192):
                                sha256.update(chunk)
                        model_sha = sha256.hexdigest()

                        model = joblib.load(lgbm_path)
                        self.models[f"solexs_{h}"] = {
                            "model": model,
                            "label_encoder": None,
                            "model_sha": model_sha
                        }
                        print(f"Loaded SOLEXS {h} model.")
                        logger.info(f"Loaded SOLEXS LGBM {h} model.")
                    except Exception as e:
                        print(f"Failed to load SOLEXS LGBM {h} model: {e}")
                        logger.error(f"Failed to load SOLEXS LGBM {h} model: {e}")
                else:
                    print(f"SOLEXS model for {h} not found.")
                    logger.warning(f"SOLEXS model for {h} not found.")
                    
            # Load corresponding datasets for quick inference (latest rows)
            # Check if this model is trained on the 74-feature set to determine folder path
            is_74_model = False
            model_bundle = self.models.get(f"forecast_{h}")
            if isinstance(model_bundle, dict) and model_bundle.get("feature_cols") is not None:
                if len(model_bundle["feature_cols"]) > 20:
                    is_74_model = True
            
            horizons_folder = "horizons_74" if is_74_model else "horizons"
            data_path = os.path.join(root_dir, "SOLEXS_downloads", "data", "processed", horizons_folder, f"forecast_{h}.csv")
            
            if os.path.exists(data_path):
                try:
                    df = pd.read_csv(data_path)
                    self.datasets[f"solexs_{h}"] = df
                    logger.info(f"Loaded SOLEXS dataset for {h} from {horizons_folder}.")
                except Exception as e:
                    logger.error(f"Failed to load dataset {data_path}: {e}")
            else:
                logger.warning(f"Dataset for {h} not found at {data_path}.")
                
    def load_hel1os_data(self, root_dir: str):
        import os
        path = os.path.join(root_dir, "He1os_script", "features", "hel1os_flares", "HEL1OS_TIMESERIES.csv")
        if os.path.exists(path):
            try:
                self.datasets["hel1os"] = pd.read_csv(path)
                logger.info("Loaded HEL1OS timeseries.")
            except Exception as e:
                logger.error(f"Failed to load HEL1OS data: {e}")
        else:
            logger.warning("HEL1OS_TIMESERIES.csv not found.")
            
    def load_correlation_data(self, root_dir: str):
        import os
        path = os.path.join(root_dir, "He1os_script", "features", "solar_fusion", "CORRELATED_SOLAR_EVENTS.csv")
        if os.path.exists(path):
            try:
                self.datasets["correlation"] = pd.read_csv(path)
                logger.info("Loaded Correlation data.")
            except Exception as e:
                logger.error(f"Failed to load Correlation data: {e}")
        else:
            logger.warning("CORRELATED_SOLAR_EVENTS.csv not found.")
            
    def load_metadata(self, root_dir: str):
        import os
        path = os.path.join(root_dir, "backend", "config", "model_metadata.json")
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    self.metadata = json.load(f)
                logger.info("Loaded model metadata.")
            except Exception as e:
                logger.error(f"Failed to load model metadata: {e}")
        else:
            logger.warning("model_metadata.json not found.")
            
    def load_velc_model(self, root_dir: str):
        import os
        from sklearn.ensemble import IsolationForest
        from sklearn.preprocessing import StandardScaler
        
        path = os.path.join(root_dir, "VELC_DOWNLOADS", "features", "master_dataset", "VELC_MASTER_DATASET.csv")
        if os.path.exists(path):
            try:
                df = pd.read_csv(path)
                features = [
                    "Brightness_Index",
                    "Texture_Index",
                    "Gradient_Index",
                    "Morphology_Index",
                    "Spatial_Index",
                    "Coronal_Index",
                    "VELC_Scientific_Activity"
                ]
                X = df[features]
                scaler = StandardScaler()
                X_scaled = scaler.fit_transform(X)
                
                model = IsolationForest(
                    n_estimators=300,
                    contamination=0.1,
                    random_state=42
                )
                model.fit(X_scaled)
                
                self.models["velc_isolation_forest"] = model
                self.models["velc_scaler"] = scaler
                self.datasets["velc_master"] = df
                print("Loaded VELC Isolation Forest model & Scaler dynamically.")
                logger.info("Loaded VELC Isolation Forest model & Scaler dynamically.")
            except Exception as e:
                print(f"Failed to fit/load VELC model: {e}")
                logger.error(f"Failed to fit/load VELC model: {e}")
        else:
            print("VELC_MASTER_DATASET.csv not found.")
            logger.warning("VELC_MASTER_DATASET.csv not found.")

    def load_all(self, root_dir: str):
        logger.info("Starting model cache initialization...")
        self.load_metadata(root_dir)
        self.load_solexs_models(root_dir)
        self.load_hel1os_data(root_dir)
        self.load_correlation_data(root_dir)
        self.load_velc_model(root_dir)
        logger.info("Model cache initialization complete.")

# Global instance
global_cache = ModelCache()
