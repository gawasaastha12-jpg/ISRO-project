import time
import logging
from datetime import datetime
from typing import Dict, Any
from backend.api.cache import ModelCache

logger = logging.getLogger(__name__)

def get_explainability(cache: ModelCache) -> Dict[str, Any]:
    start_time = time.time()
    horizons = ["5min", "15min", "30min", "60min", "120min", "180min"]
    
    # Feature names we used in get_forecast
    feature_cols = [
        "mean", "median", "std", "iqr", "skew", "kurtosis", "energy", "snr",
        "max", "min", "peak_count", "peak_ratio", "max_prominence",
        "detection_threshold", "prominence_multiple", "largest_width", "trend"
    ]
    
    results = {}
    
    for h in horizons:
        model = cache.models.get(f"solexs_{h}")
        if model is None:
            results[h.replace("min", "m")] = []
            continue
            
        try:
            # Try to get native feature importances from XGBoost / LGBM / sklearn models
            if hasattr(model, "feature_importances_"):
                importances = model.feature_importances_
            else:
                # If pipeline, try to get from the last step
                if hasattr(model, "steps"):
                    estimator = model.steps[-1][1]
                    if hasattr(estimator, "feature_importances_"):
                        importances = estimator.feature_importances_
                    else:
                        importances = [0] * len(feature_cols)
                else:
                    importances = [0] * len(feature_cols)
            
            # Map to feature names and sort
            num_feats = min(len(importances), len(feature_cols))
            feat_imp = []
            
            # Normalize to percentage and create mock "confidence contribution"
            total_imp = sum(importances)
            for i in range(num_feats):
                imp = importances[i]
                if imp > 0:
                    pct = (imp / total_imp) * 100 if total_imp > 0 else 0
                    feat_imp.append({
                        "name": feature_cols[i],
                        "value": f"+{pct:.1f}%",
                        "contribution": pct
                    })
            
            # Sort by highest importance
            feat_imp = sorted(feat_imp, key=lambda x: x["contribution"], reverse=True)
            
            # Return top 5
            results[h.replace("min", "m")] = [{"name": x["name"], "value": x["value"]} for x in feat_imp[:5]]
            
        except Exception as e:
            logger.error(f"Failed to extract explainability for {h}: {e}")
            results[h.replace("min", "m")] = []
            
    return {
        "status": "ONLINE",
        "explainability_method": "feature_importance",
        "shap_available": False,
        "horizons": results,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "processing_ms": round((time.time() - start_time) * 1000, 2),
        "engine_versions": {"explainability": cache.metadata.get("solexs", {}).get("forecast_5min", {}).get("version", "v3.2")}
    }
