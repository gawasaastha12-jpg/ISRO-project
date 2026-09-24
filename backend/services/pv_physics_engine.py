import pandas as pd
import numpy as np
import pvlib
from pvlib.location import Location
from typing import Dict, Any

def compute_pvlib_physics(
    latitude: float,
    longitude: float,
    ghi_actual: float,
    temperature_c: float,
    timestamp: pd.Timestamp = None
) -> Dict[str, Any]:
    """
    Uses PVLib to calculate clear-sky baseline, solar zenith/azimuth angles,
    cell temperature correction, and theoretical PV capacity factor.
    """
    if timestamp is None:
        timestamp = pd.Timestamp.now(tz="UTC")
        
    times = pd.DatetimeIndex([timestamp])
    site = Location(latitude, longitude, tz="UTC", altitude=200, name="SolarPark")
    
    # 1. Solar position
    solpos = site.get_solarposition(times)
    zenith = float(solpos["zenith"].iloc[0])
    azimuth = float(solpos["azimuth"].iloc[0])
    
    # 2. Haurwitz / Ineichen Clear-sky baseline GHI
    clearsky = pvlib.clearsky.haurwitz(solpos["apparent_zenith"])
    ghi_clearsky = float(clearsky["ghi"].iloc[0])
    
    # Avoid zero division during night hours
    if ghi_clearsky < 1.0:
        ghi_clearsky = max(1.0, ghi_actual)
        
    # 3. Cell Temperature calculation (NOCT = 45 C)
    poa_irradiance = max(0.0, ghi_actual)
    cell_temp_c = temperature_c + (poa_irradiance / 800.0) * (45.0 - 20.0)
    
    # 4. Temperature-adjusted PV efficiency factor (gamma = -0.4% per C from STC 25 C)
    temp_derate = 1.0 - 0.004 * (cell_temp_c - 25.0)
    
    # Baseline capacity factor (normalized [0.0 - 1.0])
    capacity_factor = (poa_irradiance / 1000.0) * temp_derate
    capacity_factor = float(np.clip(capacity_factor, 0.0, 0.95))
    
    return {
        "solar_zenith": round(zenith, 2),
        "solar_azimuth": round(azimuth, 2),
        "ghi_clearsky": round(ghi_clearsky, 1),
        "cell_temp_c": round(cell_temp_c, 1),
        "temp_derate": round(temp_derate, 4),
        "capacity_factor": round(capacity_factor, 4)
    }

if __name__ == "__main__":
    print("Testing PVLib Solar Physics Engine...")
    # Test Bhadla clear day parameters
    bhadla_phys = compute_pvlib_physics(latitude=27.53, longitude=71.91, ghi_actual=830.7, temperature_c=14.1)
    print("Bhadla PVLib Output:", bhadla_phys)
    
    # Test Pavagada clear day parameters
    pavagada_phys = compute_pvlib_physics(latitude=14.10, longitude=77.27, ghi_actual=1057.9, temperature_c=21.0)
    print("Pavagada PVLib Output:", pavagada_phys)
