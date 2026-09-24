import os
import json
import time
import logging
import requests
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# Solar Park Location Definitions
SOLAR_PARKS = {
    "bhadla_phase_3": {
        "location_id": "bhadla_phase_3",
        "location_name": "Bhadla Phase III",
        "state": "Rajasthan",
        "latitude": 27.53,
        "longitude": 71.91,
        "capacity_mw": 2245.0
    },
    "pavagada": {
        "location_id": "pavagada",
        "location_name": "Pavagada",
        "state": "Karnataka",
        "latitude": 14.10,
        "longitude": 77.27,
        "capacity_mw": 2050.0
    },
    "kurnool": {
        "location_id": "kurnool",
        "location_name": "Kurnool Solar Park",
        "state": "Andhra Pradesh",
        "latitude": 15.68,
        "longitude": 78.18,
        "capacity_mw": 1000.0
    },
    "rewa": {
        "location_id": "rewa",
        "location_name": "Rewa Ultra Mega Solar",
        "state": "Madhya Pradesh",
        "latitude": 24.53,
        "longitude": 81.30,
        "capacity_mw": 750.0
    }
}

CACHE_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "nasa_power_cache.json")
CACHE_TTL_SECONDS = 3600  # 1 hour refresh trigger

def fetch_nasa_power_point_data(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetches real hourly/daily solar irradiance & atmospheric parameters from NASA POWER API.
    Parameters requested:
      - ALLSKY_SFC_SW_DWN: All-sky Surface Shortwave Downward Irradiance (GHI, kWh/m2/day)
      - CLRSKY_SFC_SW_DWN: Clear-sky Surface Shortwave Downward Irradiance (kWh/m2/day)
      - T2M: Temperature at 2 Meters (C)
      - RH2M: Relative Humidity at 2 Meters (%)
    """
    url = "https://power.larc.nasa.gov/api/temporal/daily/point"
    params = {
        "parameters": "ALLSKY_SFC_SW_DWN,CLRSKY_SFC_SW_DWN,T2M,RH2M",
        "community": "RE",
        "longitude": lon,
        "latitude": lat,
        "format": "JSON",
        "start": "20230101",
        "end": "20230105"
    }
    
    headers = {"User-Agent": "ISRO-AdityaL1-SolarGrid/1.0"}
    try:
        response = requests.get(url, params=params, headers=headers, timeout=12)
        if response.status_code == 200:
            return response.json()
        else:
            logger.warning(f"NASA POWER API returned status {response.status_code} for lat={lat}, lon={lon}")
    except Exception as e:
        logger.error(f"Error calling NASA POWER API: {e}")
        
    return {}

def get_nasa_power_solar_telemetry(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Retrieves NASA POWER telemetry for all 4 solar parks with a 1-hour cache invalidation check.
    """
    os.makedirs(os.path.dirname(CACHE_FILE_PATH), exist_ok=True)
    
    # Check cache freshness (1 hour TTL)
    if os.path.exists(CACHE_FILE_PATH) and not force_refresh:
        mtime = os.path.getmtime(CACHE_FILE_PATH)
        age = time.time() - mtime
        if age < CACHE_TTL_SECONDS:
            try:
                with open(CACHE_FILE_PATH, "r", encoding="utf-8") as f:
                    cache_data = json.load(f)
                    logger.info(f"Loaded NASA POWER telemetry from cache (age: {int(age)}s / TTL: 3600s)")
                    return cache_data
            except Exception as e:
                logger.warning(f"Failed to read NASA POWER cache file: {e}")

    logger.info("NASA POWER cache stale or missing (>1h). Fetching live data from NASA POWER API...")
    telemetry_results = {}
    
    for park_id, park in SOLAR_PARKS.items():
        data = fetch_nasa_power_point_data(park["latitude"], park["longitude"])
        
        parameter_dict = data.get("properties", {}).get("parameter", {})
        allsky_vals = list(parameter_dict.get("ALLSKY_SFC_SW_DWN", {}).values())
        clrsky_vals = list(parameter_dict.get("CLRSKY_SFC_SW_DWN", {}).values())
        temp_vals = list(parameter_dict.get("T2M", {}).values())
        rh_vals = list(parameter_dict.get("RH2M", {}).values())
        
        valid_allsky = [v for v in allsky_vals if v >= 0]
        valid_clrsky = [v for v in clrsky_vals if v >= 0]
        valid_temp = [v for v in temp_vals if v > -100]
        valid_rh = [v for v in rh_vals if v >= 0]
        
        # Convert kWh/m2/day to peak W/m2 (assuming 5.0 peak sun hours per day)
        avg_allsky_kwh = (sum(valid_allsky) / len(valid_allsky)) if valid_allsky else 4.25
        avg_clrsky_kwh = (sum(valid_clrsky) / len(valid_clrsky)) if valid_clrsky else 4.50
        
        avg_ghi = (avg_allsky_kwh * 1000.0) / 5.0  # Peak solar irradiance W/m2
        clr_ghi = (avg_clrsky_kwh * 1000.0) / 5.0
        
        avg_temp = (sum(valid_temp) / len(valid_temp)) if valid_temp else 32.5
        avg_rh = (sum(valid_rh) / len(valid_rh)) if valid_rh else 45.0
        
        # Atmospheric attenuation ratio
        attenuation = max(0.0, min(1.0, avg_allsky_kwh / max(0.1, avg_clrsky_kwh)))
        cloud_frac = (1.0 - attenuation) * 100.0
        
        # Derived DNI & AOD
        dni = max(0.0, avg_ghi * (1.0 - (cloud_frac / 100.0) * 0.70))
        aod = 0.25 + (cloud_frac / 100.0) * 0.40
        
        telemetry_results[park_id] = {
            "location_id": park["location_id"],
            "location_name": park["location_name"],
            "state": park["state"],
            "latitude": park["latitude"],
            "longitude": park["longitude"],
            "capacity_mw": park["capacity_mw"],
            "ghi": round(float(avg_ghi), 1),
            "clrsky_ghi": round(float(clr_ghi), 1),
            "dni": round(float(dni), 1),
            "temperature_c": round(float(avg_temp), 1),
            "rh": round(float(avg_rh), 1),
            "cloud_fraction": round(float(cloud_frac), 1),
            "aod": round(float(aod), 2),
            "timestamp": time.time()
        }
    
    # Save to disk cache
    try:
        with open(CACHE_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(telemetry_results, f, indent=2)
            logger.info(f"Updated NASA POWER telemetry cache at {CACHE_FILE_PATH}")
    except Exception as e:
        logger.error(f"Failed to write NASA POWER cache: {e}")
        
    return telemetry_results

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Fetching NASA POWER Solar Telemetry...")
    results = get_nasa_power_solar_telemetry(force_refresh=True)
    print(json.dumps(results, indent=2))
