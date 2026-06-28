import pandas as pd
import numpy as np

print("\n🌞 BUILDING UNIFIED SOLAR TIMESERIES (PHASE 1)\n")

# =========================
# PATHS (FIXED TO YOUR STRUCTURE)
# =========================
SOLEXS_PATH = "features/solexs_flares/SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = "features/hel1os_flares/HEL1OS_FLARE_CATALOG.csv"
OUTPUT_PATH = "features/solar_fusion/unified_timeseries.csv"

# =========================
# LOAD DATA
# =========================
solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

# =========================
# SAFE TIME PARSING (FIX TZ ISSUES)
# =========================
solexs["time"] = pd.to_datetime(solexs["peak_time"], utc=True, errors="coerce")
hel1os["time"] = pd.to_datetime(hel1os["flare_peak"], utc=True, errors="coerce")

solexs = solexs.dropna(subset=["time"])
hel1os = hel1os.dropna(subset=["time"])

# =========================
# 5-MIN TIME BINNING (CORE FIX)
# =========================
solexs["time_bin"] = solexs["time"].dt.floor("5min")
hel1os["time_bin"] = hel1os["time"].dt.floor("5min")

# =========================
# FEATURE ENGINEERING - SOLEXS
# =========================
solexs_bin = solexs.groupby("time_bin").agg(
    solexs_mean=("peak_counts", "mean"),
    solexs_max=("peak_counts", "max"),
    solexs_std=("peak_counts", "std")
).reset_index()

# =========================
# FEATURE ENGINEERING - HEL1OS
# =========================
hel1os_bin = hel1os.groupby("time_bin").agg(
    hel1os_mean=("flare_class", "count"),   # proxy for spike activity
).reset_index()

hel1os_bin.rename(columns={"flare_class": "hel1os_spikes"}, inplace=True)

# =========================
# ALIGN TIME AXIS (IMPORTANT FIX)
# =========================
start = min(solexs_bin["time_bin"].min(), hel1os_bin["time_bin"].min())
end = max(solexs_bin["time_bin"].max(), hel1os_bin["time_bin"].max())

full_grid = pd.DataFrame({
    "time_bin": pd.date_range(start=start, end=end, freq="5min", tz="UTC")
})

# =========================
# MERGE INTO UNIFIED GRID
# =========================
df = full_grid.merge(solexs_bin, on="time_bin", how="left")
df = df.merge(hel1os_bin, on="time_bin", how="left")

df = df.fillna(0)

# =========================
# NORMALIZATION FUNCTION (FIXED)
# =========================
def normalize(col):
    if col.max() == col.min():
        return col * 0
    return (col - col.min()) / (col.max() - col.min())

# =========================
# FEATURE CONSTRUCTION
# =========================
df["solexs_norm"] = normalize(df["solexs_mean"])
df["hel1os_norm"] = normalize(df["hel1os_mean"])

df["activity_index"] = (
    0.5 * df["solexs_norm"] +
    0.5 * df["hel1os_norm"]
)

# =========================
# LAG FEATURE (IMPORTANT FOR FORECASTING)
# =========================
df["hel1os_future"] = df["hel1os_norm"].shift(-12)  # 60 min ahead (5-min bins)

df["flare_label"] = (df["hel1os_future"] > 0.3).astype(int)

# =========================
# SAVE OUTPUT
# =========================
df.to_csv(OUTPUT_PATH, index=False)

print("\n✅ UNIFIED TIMESERIES CREATED")
print("Saved to:", OUTPUT_PATH)
print("\nColumns:", df.columns.tolist())