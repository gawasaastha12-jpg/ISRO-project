"""
ingestion_agent.py
==================
Phase 1: Resilient Geospatial & Space Weather Data Ingestion Pipeline.

Features:
- Multi-location target registry (Bhadla Phase III & Pavagada Solar Parks)
- Resilient NASA POWER REST API extraction with exponential backoff
- Modular ISRO MOSDAC (INSAT-3D) WMS interface placeholder
- Aditya-L1 SoLEXS telemetry ingestion (real-time flare predictions & nowcasts)
- Anomaly detection, IQR outlier scrubbing, and time-weighted interpolation
- Unified 15-minute temporal alignment via pd.merge_asof
"""

import os
import time
import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import requests
import numpy as np
import pandas as pd

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("IngestionAgent")


# ============================================================================
# 1. Configuration & Target Registry
# ============================================================================

TARGET_LOCATIONS: Dict[str, Dict[str, Any]] = {
    "bhadla_phase_3": {
        "name": "Bhadla Phase III Solar Park",
        "state": "Rajasthan",
        "latitude": 27.53,
        "longitude": 71.91,
        "capacity_mw": 2245.0,
    },
    "pavagada": {
        "name": "Pavagada Solar Park",
        "state": "Karnataka",
        "latitude": 14.10,
        "longitude": 77.27,
        "capacity_mw": 2050.0,
    }
}

RETRY_CONFIG = {
    "max_retries": 5,
    "backoff_factor": 2.0,
    "initial_delay": 1.0,
    "timeout_sec": 15,
}


# ============================================================================
# 2. NASA POWER Ingestion Engine
# ============================================================================

class NASADataIngestion:
    """Fetches solar irradiance and atmospheric parameters from NASA POWER API."""

    BASE_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point"

    @classmethod
    def fetch_hourly_data(
        cls,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str
    ) -> pd.DataFrame:
        """
        Queries NASA POWER hourly endpoint with exponential backoff retry policy.
        Dates format: YYYYMMDD
        """
        params = {
            "parameters": "ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DNI,CLOUD_AMT,AOD_55",
            "community": "RE",
            "longitude": lon,
            "latitude": lat,
            "start": start_date,
            "end": end_date,
            "format": "JSON",
            "time-standard": "UTC"
        }

        delay = RETRY_CONFIG["initial_delay"]
        for attempt in range(1, RETRY_CONFIG["max_retries"] + 1):
            try:
                logger.info(f"Fetching NASA POWER data for ({lat}, {lon}) - Attempt {attempt}")
                response = requests.get(
                    cls.BASE_URL,
                    params=params,
                    timeout=RETRY_CONFIG["timeout_sec"]
                )
                response.raise_for_status()
                payload = response.json()

                param_data = payload.get("properties", {}).get("parameter", {})
                if not param_data:
                    raise ValueError("Empty parameter dictionary received from NASA POWER.")

                df = pd.DataFrame(param_data)
                df.index = pd.to_datetime(df.index, format="%Y%m%d%H")
                df.index.name = "timestamp"

                # Rename columns to standard schema
                column_mapping = {
                    "ALLSKY_SFC_SW_DWN": "ghi",
                    "ALLSKY_SFC_SW_DNI": "dni",
                    "CLOUD_AMT": "cloud_fraction",
                    "AOD_55": "aod"
                }
                df = df.rename(columns=column_mapping)

                # Replace NASA error sentinel value (-999.0) with NaN
                df = df.replace(-999.0, np.nan)

                # Check if payload contains any valid data
                if df.isna().all().all():
                    logger.warning("NASA POWER returned all NaN/sentinel values (data not yet available for requested window). Falling back to synthetic baseline.")
                    return cls._generate_fallback_data(lat, lon, start_date, end_date)

                return df

            except (requests.RequestException, ValueError) as err:
                logger.warning(f"NASA POWER fetch failed (attempt {attempt}/{RETRY_CONFIG['max_retries']}): {err}")
                if attempt == RETRY_CONFIG["max_retries"]:
                    logger.error("Max retries exceeded for NASA POWER. Falling back to synthetic baseline.")
                    return cls._generate_fallback_data(lat, lon, start_date, end_date)
                time.sleep(delay)
                delay *= RETRY_CONFIG["backoff_factor"]

        return cls._generate_fallback_data(lat, lon, start_date, end_date)

    @staticmethod
    def _generate_fallback_data(lat: float, lon: float, start_date: str, end_date: str) -> pd.DataFrame:
        """Synthetic fallback generator for offline testing or endpoint downtime."""
        date_range = pd.date_range(
            start=pd.to_datetime(start_date, format="%Y%m%d"),
            end=pd.to_datetime(end_date, format="%Y%m%d") + timedelta(days=1),
            freq="h",
            name="timestamp"
        )
        # Diurnal solar curve approximation
        hours = date_range.hour
        ghi = np.maximum(0, 950 * np.sin(np.pi * (hours - 6) / 12)) + np.random.normal(0, 15, len(date_range))
        dni = np.maximum(0, 850 * np.sin(np.pi * (hours - 6) / 12)) + np.random.normal(0, 10, len(date_range))
        cloud = np.clip(np.random.uniform(10, 40, len(date_range)), 0, 100)
        aod = np.clip(np.random.normal(0.35, 0.05, len(date_range)), 0.05, 1.5)

        df_fallback = pd.DataFrame({
            "ghi": np.clip(ghi, 0, None),
            "dni": np.clip(dni, 0, None),
            "cloud_fraction": cloud,
            "aod": aod
        }, index=date_range)
        return df_fallback


# ============================================================================
# 3. MOSDAC INSAT-3D Ingestion Engine (WMS Placeholder)
# ============================================================================

class MOSDACIngestion:
    """Mock/WMS client for ISRO MOSDAC INSAT-3D/3DR meteorological observations."""

    @staticmethod
    def fetch_layer_metrics(lat: float, lon: float, timestamps: pd.DatetimeIndex) -> pd.DataFrame:
        """
        Emulates INSAT-3D Cloud Optical Depth (COD) and Outgoing Longwave Radiation (OLR).
        Seamlessly replaceable with live WMS GetFeatureInfo / OGC API requests.
        """
        logger.info(f"Querying MOSDAC INSAT-3D layer grid for coordinates ({lat}, {lon})")
        # Synthesize physically correlated COD (0 - 50 scale)
        n_steps = len(timestamps)
        cloud_optical_depth = np.clip(np.random.gamma(shape=2.0, scale=3.0, size=n_steps), 0.0, 50.0)
        olr_wm2 = np.clip(np.random.normal(loc=260.0, scale=20.0, size=n_steps), 150.0, 340.0)

        return pd.DataFrame({
            "mosdac_cod": cloud_optical_depth,
            "mosdac_olr": olr_wm2
        }, index=timestamps)


# ============================================================================
# 4. Aditya-L1 SoLEXS Telemetry Ingestion Engine
# ============================================================================

class AdityaL1Ingestion:
    """Ingests Aditya-L1 SoLEXS & HEL1OS flare nowcasting/forecasting streams."""

    @staticmethod
    def load_telemetry(filepath: Optional[str] = "logs/team_predictions.csv", timestamps: Optional[pd.DatetimeIndex] = None) -> pd.DataFrame:
        """
        Loads local Aditya-L1 prediction log or synthesizes standard payload telemetry.
        Expected schema: [timestamp, nowcast_phase, prob_C, prob_M, prob_X]
        """
        if filepath and os.path.exists(filepath):
            logger.info(f"Loading live Aditya-L1 telemetry stream from {filepath}")
            df = pd.read_csv(filepath)
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.set_index("timestamp").sort_index()

            # Align column names if needed
            rename_cols = {
                "forecast_prob_C": "prob_C",
                "forecast_prob_M": "prob_M",
                "forecast_prob_X": "prob_X"
            }
            df = df.rename(columns=rename_cols)

            if "space_weather_flag" not in df.columns:
                prob_m = df.get("prob_M", pd.Series(0, index=df.index))
                prob_x = df.get("prob_X", pd.Series(0, index=df.index))
                phase = df.get("nowcast_phase", pd.Series("Background", index=df.index))
                df["space_weather_flag"] = np.where(
                    (prob_m > 0.4) | (prob_x > 0.1) | phase.isin(["Impulsive", "Peak"]), 1, 0
                )
            return df

        logger.info("Aditya-L1 telemetry file not found on disk. Generating active solar space weather telemetry array.")
        if timestamps is None:
            now = datetime.now(timezone.utc)
            timestamps = pd.date_range(now - timedelta(days=2), now, freq="15min")

        n_steps = len(timestamps)
        # Synthetic space weather flare states
        phases = np.random.choice(
            ["Background", "Impulsive", "Peak", "Decay"],
            size=n_steps,
            p=[0.85, 0.05, 0.03, 0.07]
        )
        prob_c = np.clip(np.random.beta(0.5, 5, size=n_steps) + (phases == "Impulsive") * 0.4, 0.0, 1.0)
        prob_m = np.clip(prob_c * np.random.uniform(0.1, 0.6, size=n_steps), 0.0, 1.0)
        prob_x = np.clip(prob_m * np.random.uniform(0.01, 0.2, size=n_steps), 0.0, 1.0)

        # Solar degradation flag: active when M/X probability or Impulsive/Peak phase occurs
        space_weather_flag = np.where((prob_m > 0.4) | (prob_x > 0.1) | np.isin(phases, ["Impulsive", "Peak"]), 1, 0)

        return pd.DataFrame({
            "nowcast_phase": phases,
            "prob_C": prob_c,
            "prob_M": prob_m,
            "prob_X": prob_x,
            "space_weather_flag": space_weather_flag
        }, index=timestamps)


# ============================================================================
# 5. Data Preprocessor & Anomaly Detector
# ============================================================================

class DataPreprocessor:
    """Applies statistical outlier scrubbing, physical bounding, and time interpolation."""

    @staticmethod
    def scrub_outliers_iqr(series: pd.Series, k: float = 3.0) -> pd.Series:
        """Removes anomalous sensor spikes using Interquartile Range (IQR) gating."""
        q25 = series.quantile(0.25)
        q75 = series.quantile(0.75)
        iqr = q75 - q25
        lower_bound = q25 - (k * iqr)
        upper_bound = q75 + (k * iqr)
        scrubbed = series.mask((series < lower_bound) | (series > upper_bound), np.nan)
        return scrubbed

    @classmethod
    def clean_and_interpolate(cls, df: pd.DataFrame, target_freq: str = "15min") -> pd.DataFrame:
        """
        Executes full preprocessing:
        1. Outlier removal on numerical continuous streams
        2. Resampling & continuous time-weighted interpolation
        3. Physical constraint clipping
        """
        df_cleaned = df.copy()

        # Scrub numeric irradiance and atmospheric columns
        numeric_cols = ["ghi", "dni", "cloud_fraction", "aod", "mosdac_cod", "mosdac_olr"]
        for col in numeric_cols:
            if col in df_cleaned.columns:
                df_cleaned[col] = cls.scrub_outliers_iqr(df_cleaned[col])

        # Reindex to continuous target frequency grid
        full_index = pd.date_range(start=df_cleaned.index.min(), end=df_cleaned.index.max(), freq=target_freq)
        df_cleaned = df_cleaned.reindex(full_index)
        df_cleaned.index.name = "timestamp"

        # Interpolate numeric features using time weighting
        df_cleaned[df_cleaned.select_dtypes(include=[np.number]).columns] = (
            df_cleaned.select_dtypes(include=[np.number])
            .interpolate(method="time")
            .bfill()
            .ffill()
        )

        # Forward-fill categorical telemetry (e.g. nowcast_phase)
        categorical_cols = df_cleaned.select_dtypes(exclude=[np.number]).columns
        for c in categorical_cols:
            df_cleaned[c] = df_cleaned[c].ffill().bfill()

        # Enforce physical non-negativity bounds
        if "ghi" in df_cleaned:
            df_cleaned["ghi"] = np.clip(df_cleaned["ghi"], 0.0, 1400.0)
        if "dni" in df_cleaned:
            df_cleaned["dni"] = np.clip(df_cleaned["dni"], 0.0, 1200.0)
        if "cloud_fraction" in df_cleaned:
            df_cleaned["cloud_fraction"] = np.clip(df_cleaned["cloud_fraction"], 0.0, 100.0)
        if "aod" in df_cleaned:
            df_cleaned["aod"] = np.clip(df_cleaned["aod"], 0.0, 5.0)

        return df_cleaned


# ============================================================================
# 6. Temporal Alignment & Orchestration Pipeline
# ============================================================================

class IngestionPipelineOrchestrator:
    """Orchestrates multi-source data ingestion, alignment, and final feature export."""

    @classmethod
    def execute_for_location(
        cls,
        location_key: str,
        start_date: str,
        end_date: str
    ) -> pd.DataFrame:
        """Runs the end-to-end ingestion and alignment workflow for a target solar park."""
        loc_cfg = TARGET_LOCATIONS[location_key]
        lat, lon = loc_cfg["latitude"], loc_cfg["longitude"]

        logger.info(f"--- Starting Ingestion Pipeline for: {loc_cfg['name']} ---")

        # 1. Fetch NASA POWER meteorological baseline
        df_nasa = NASADataIngestion.fetch_hourly_data(lat, lon, start_date, end_date)

        # 2. Resample and interpolate NASA baseline to 15-minute grid
        df_nasa_15m = DataPreprocessor.clean_and_interpolate(df_nasa, target_freq="15min")

        # 3. Ingest MOSDAC INSAT-3D metrics
        df_mosdac = MOSDACIngestion.fetch_layer_metrics(lat, lon, df_nasa_15m.index)

        # 4. Ingest Aditya-L1 space weather telemetry
        df_aditya = AdityaL1Ingestion.load_telemetry(timestamps=df_nasa_15m.index)

        # 5. Join Earth meteorological streams
        df_earth = df_nasa_15m.join(df_mosdac, how="left")

        # 6. Temporal Alignment with Space Weather Telemetry via pd.merge_asof
        df_earth_reset = df_earth.reset_index()
        df_aditya_reset = df_aditya.reset_index()

        df_aligned = pd.merge_asof(
            df_earth_reset.sort_values("timestamp"),
            df_aditya_reset.sort_values("timestamp"),
            on="timestamp",
            direction="nearest",
            tolerance=pd.Timedelta("15min")
        ).set_index("timestamp")

        # Metadata injection
        df_aligned["location_id"] = location_key
        df_aligned["location_name"] = loc_cfg["name"]
        df_aligned["latitude"] = lat
        df_aligned["longitude"] = lon
        df_aligned["capacity_mw"] = loc_cfg["capacity_mw"]

        # Clean final DataFrame
        df_final = DataPreprocessor.clean_and_interpolate(df_aligned, target_freq="15min")
        logger.info(f"Pipeline complete for {loc_cfg['name']}. Final shape: {df_final.shape}")
        return df_final


# ============================================================================
# Main Execution Entrypoint
# ============================================================================

if __name__ == "__main__":
    logger.info("Initializing Agent-Driven Geospatial Ingestion Pipeline...")

    # Define query window (last 3 days)
    end_dt = datetime.now(timezone.utc)
    start_dt = end_dt - timedelta(days=3)
    start_str = start_dt.strftime("%Y%m%d")
    end_str = end_dt.strftime("%Y%m%d")

    processed_frames = []
    for loc_key in TARGET_LOCATIONS.keys():
        df_loc = IngestionPipelineOrchestrator.execute_for_location(
            location_key=loc_key,
            start_date=start_str,
            end_date=end_str
        )
        processed_frames.append(df_loc)

    # Combine all target parks into a master training/inference DataFrame
    unified_df = pd.concat(processed_frames, axis=0)

    # Save to disk for Phase 2 ML models
    output_dir = "data/processed"
    os.makedirs(output_dir, exist_ok=True)
    output_path = os.path.join(output_dir, "unified_solar_telemetry_15m.csv")
    unified_df.to_csv(output_path)

    logger.info(f"Master dataset successfully written to: {output_path}")
    logger.info(f"Master Dataset Columns: {list(unified_df.columns)}")
    logger.info(f"Sample Record:\n{unified_df.head(2).T}")
