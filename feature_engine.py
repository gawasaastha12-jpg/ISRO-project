"""
feature_engine.py
=================
Phase 2: Physics-Grounded Feature Engineering & Multi-Horizon Target Generation.

Features:
- Ingests Phase 1 master telemetry (data/processed/unified_solar_telemetry_15m.csv)
- Physical ground truth modeling via pvlib (solar position, zenith, azimuth, capacity factor)
- Space weather efficiency penalties and zenith-based nighttime zeroing
- Group-aware feature engineering (cyclic time, 15m/1h deltas, 1h rolling mean & variance)
- Group-aware multi-horizon target labeling (15m, 30m, 60m future capacity shifts)
- Zenith-masked drop_alert_30m binary targets (ignoring natural sunsets)
- Zero-leakage tail trimming (.dropna(subset=['target_capacity_60m']))
"""

import os
import sys
import logging
import numpy as np
import pandas as pd

# Add user site-packages if pvlib is installed there
sys.path.append(r"C:\Users\Aastha\AppData\Roaming\Python\Python314\site-packages")

import pvlib

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("FeatureEngine")


# ============================================================================
# 1. Physics Engine (pvlib & Photovoltaic Power Modeling)
# ============================================================================

class PVPhysicalModel:
    """Computes solar position geometry and models expected photovoltaic power generation."""

    @staticmethod
    def compute_solar_position(times: pd.DatetimeIndex, lat: float, lon: float) -> pd.DataFrame:
        """Calculates solar zenith and azimuth angles using pvlib."""
        solpos = pvlib.solarposition.get_solarposition(times, lat, lon)
        return pd.DataFrame({
            "solar_zenith": solpos["zenith"].values,
            "solar_azimuth": solpos["azimuth"].values
        }, index=times)

    @classmethod
    def calculate_capacity_factor(cls, df: pd.DataFrame) -> pd.Series:
        """
        Calculates physical nominal capacity factor (0.0 to 1.0) incorporating:
        - Clear-sky conversion (GHI / 1000 * 0.85)
        - Cloud degradation (1.0 - (cloud_fraction / 100) * 0.8)
        - Space weather penalty (0.95 multiplier applied ONLY when space_weather_flag == 1)
        - Nighttime zeroing (Force capacity factor to 0.0 when solar_zenith > 85.0)
        """
        ghi = df["ghi"]
        cloud_frac = df["cloud_fraction"]
        sw_flag = df["space_weather_flag"]
        zenith = df["solar_zenith"]

        # Base solar irradiance to capacity conversion (85% standard performance ratio)
        base_power = (ghi / 1000.0) * 0.85

        # Cloud degradation factor
        cloud_factor = np.clip(1.0 - (cloud_frac / 100.0) * 0.8, 0.1, 1.0)

        # Space weather penalty multiplier (5% degradation penalty during high solar activity / flares)
        sw_penalty = np.where(sw_flag == 1, 0.95, 1.0)

        # Physical capacity factor calculation
        cap_factor = base_power * cloud_factor * sw_penalty

        # Nighttime zeroing (solar zenith > 85 deg means sun below operational horizon)
        cap_factor = np.where(zenith > 85.0, 0.0, cap_factor)

        # Enforce strict capacity factor bounds [0.0, 1.0]
        return pd.Series(np.clip(cap_factor, 0.0, 1.0), index=df.index, name="capacity_factor")


# ============================================================================
# 2. Group-Aware Feature Engineering & Target Engine
# ============================================================================

class GroupAwareFeatureEngine:
    """Applies group-aware temporal operations and target generation per location_id."""

    @classmethod
    def process_dataset(cls, input_filepath: str) -> pd.DataFrame:
        """Executes full Phase 2 feature engineering and multi-horizon target labeling."""
        logger.info(f"Loading Phase 1 master telemetry from: {input_filepath}")
        df = pd.read_csv(input_filepath)

        # Ensure timestamp is parsed as DatetimeIndex in UTC
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values(["location_id", "timestamp"]).reset_index(drop=True)

        logger.info("Computing solar positioning (pvlib) and physical capacity factor...")
        
        # 1. Compute solar position per location
        solpos_list = []
        for loc_id, group in df.groupby("location_id"):
            lat = group["latitude"].iloc[0]
            lon = group["longitude"].iloc[0]
            times = pd.DatetimeIndex(group["timestamp"], tz="UTC")
            
            sol_df = PVPhysicalModel.compute_solar_position(times, lat, lon)
            sol_df["location_id"] = loc_id
            sol_df["timestamp"] = group["timestamp"].values
            solpos_list.append(sol_df)

        solpos_combined = pd.concat(solpos_list, ignore_index=True)
        df = pd.merge(df, solpos_combined, on=["location_id", "timestamp"], how="left")

        # 2. Compute Physical Capacity Factor
        df["capacity_factor"] = PVPhysicalModel.calculate_capacity_factor(df)

        # 3. Cyclic Time Features
        dt = pd.to_datetime(df["timestamp"])
        df["hour_sin"] = np.sin(2.0 * np.pi * dt.dt.hour / 24.0)
        df["hour_cos"] = np.cos(2.0 * np.pi * dt.dt.hour / 24.0)
        df["day_of_year_sin"] = np.sin(2.0 * np.pi * dt.dt.dayofyear / 365.25)
        df["day_of_year_cos"] = np.cos(2.0 * np.pi * dt.dt.dayofyear / 365.25)

        logger.info("Applying strictly Group-Aware temporal deltas and rolling statistics...")

        # 4. Group-Aware Features & Multi-Horizon Targets
        processed_groups = []
        for loc_id, group in df.groupby("location_id"):
            group = group.copy().sort_values("timestamp")

            # Deltas per location
            group["ghi_diff_1"] = group["ghi"].diff(1)
            group["ghi_diff_4"] = group["ghi"].diff(4)
            group["cloud_diff_1"] = group["cloud_fraction"].diff(1)
            group["cloud_diff_4"] = group["cloud_fraction"].diff(4)

            # Rolling statistics per location (1-hour window = 4 x 15min steps)
            group["ghi_roll_mean_1h"] = group["ghi"].rolling(window=4, min_periods=1).mean()
            group["ghi_roll_var_1h"] = group["ghi"].rolling(window=4, min_periods=1).var().fillna(0.0)

            # Multi-Horizon Targets per location
            group["target_capacity_15m"] = group["capacity_factor"].shift(-1)
            group["target_capacity_30m"] = group["capacity_factor"].shift(-2)
            group["target_capacity_60m"] = group["capacity_factor"].shift(-4)

            # Capacity Drop Alert (30-min horizon): > 30% drop relative to current capacity_factor
            # Crucial: Force to 0 if solar_zenith > 85.0 (ignoring natural sunsets)
            cap_curr = group["capacity_factor"]
            cap_target_30 = group["target_capacity_30m"]
            zenith = group["solar_zenith"]

            relative_drop = (cap_curr - cap_target_30) / (cap_curr + 1e-5)
            raw_alert = np.where((relative_drop > 0.30) & (cap_curr > 0.05), 1, 0)
            
            # Nighttime Target Masking: force alert to 0 during natural sunset / nighttime
            group["drop_alert_30m"] = np.where(zenith > 85.0, 0, raw_alert)

            # Backfill warmup feature deltas within group
            feature_cols_group = ["ghi_diff_1", "ghi_diff_4", "cloud_diff_1", "cloud_diff_4"]
            group[feature_cols_group] = group[feature_cols_group].bfill().fillna(0.0)

            processed_groups.append(group)

        df_processed = pd.concat(processed_groups, ignore_index=True)

        logger.info("Applying Zero-Leakage Tail Handling: trimming unobservable future tail (.dropna(subset=['target_capacity_60m']))...")
        # Drop the last 4 rows per location block where target_capacity_60m is NaN
        df_final = df_processed.dropna(subset=["target_capacity_60m"]).reset_index(drop=True)

        return df_final


# ============================================================================
# Main Execution Entrypoint
# ============================================================================

if __name__ == "__main__":
    logger.info("Initializing Phase 2 Feature Engineering & Target Generation Pipeline...")

    input_file = "data/processed/unified_solar_telemetry_15m.csv"
    output_dir = "data/processed"
    output_file = os.path.join(output_dir, "feature_matrix_15m.csv")

    if not os.path.exists(input_file):
        logger.error(f"Input telemetry file missing: {input_file}. Run Phase 1 (ingestion_agent.py) first.")
        sys.exit(1)

    df_features = GroupAwareFeatureEngine.process_dataset(input_file)

    # Save enriched feature dataset
    os.makedirs(output_dir, exist_ok=True)
    df_features.to_csv(output_file, index=False)

    logger.info(f"Feature matrix successfully written to: {output_file}")
    logger.info(f"Dataset Shape: {df_features.shape}")
    
    print("\n" + "=" * 60)
    print("VERIFICATION 1: MISSING VALUE SUMMARY (df.isna().sum())")
    print("=" * 60)
    print(df_features.isna().sum())

    print("\n" + "=" * 60)
    print("VERIFICATION 2: DROP ALERT 30M CLASS DISTRIBUTION")
    print("=" * 60)
    print(df_features["drop_alert_30m"].value_counts(dropna=False))

    print("\n" + "=" * 60)
    print("VERIFICATION 3: SAMPLE FEATURE MATRIX RECORD")
    print("=" * 60)
    sample_cols = [
        "timestamp", "location_id", "solar_zenith", "capacity_factor",
        "ghi_diff_1", "ghi_roll_mean_1h", "target_capacity_30m", "target_capacity_60m", "drop_alert_30m"
    ]
    print(df_features[sample_cols].head(3).T)
    print("=" * 60 + "\n")
