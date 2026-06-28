import pandas as pd
import numpy as np
from pathlib import Path

# ==================================================
# 📌 PATHS
# ==================================================

BASE = Path(__file__).resolve().parent.parent / "features"

SOLEXS_PATH = BASE / "solexs_flares" / "SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = BASE / "hel1os_flares" / "HEL1OS_FLARE_CATALOG.csv"

OUTPUT_PATH = BASE / "solar_fusion" / "FLARE_FORECASTS.csv"

# ==================================================
# ⚙️ CONFIG
# ==================================================

PRECURSOR_WINDOW_MIN = 30   # look-back window
STEP_MIN = 5                # resolution inside window

# ==================================================
# 📥 LOAD DATA
# ==================================================

solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

# ==================================================
# ⏱️ TIME HANDLING
# ==================================================

solexs["peak_time"] = pd.to_datetime(solexs["peak_time"], errors="coerce")
hel1os["flare_peak"] = pd.to_datetime(hel1os["flare_peak"], errors="coerce")

solexs = solexs.dropna(subset=["peak_time"])
hel1os = hel1os.dropna(subset=["flare_peak"])

# ==================================================
# 🧠 SORT FOR TIME SEARCH
# ==================================================

solexs = solexs.sort_values("peak_time")

# ==================================================
# 🔥 FEATURE NORMALIZATION
# ==================================================

def safe_minmax(series):
    if series.std() == 0:
        return series * 0
    return (series - series.min()) / (series.max() - series.min())

solexs["energy"] = 0

if "peak_flux" in solexs.columns:
    solexs["energy"] += solexs["peak_flux"]

if "duration_sec" in solexs.columns:
    solexs["energy"] += solexs["duration_sec"]

solexs["energy"] = safe_minmax(solexs["energy"])

# ==================================================
# 🚀 FORECAST ENGINE CORE
# ==================================================

results = []

for _, flare in hel1os.iterrows():

    t0 = flare["flare_peak"]

    window_start = t0 - pd.Timedelta(minutes=PRECURSOR_WINDOW_MIN)

    window = solexs[
        (solexs["peak_time"] >= window_start) &
        (solexs["peak_time"] <= t0)
    ]

    if len(window) < 3:
        continue

    # ==================================================
    # 📊 PRECURSOR FEATURES
    # ==================================================

    energy_rise = window["energy"].iloc[-1] - window["energy"].iloc[0]

    activity_rate = len(window) / PRECURSOR_WINDOW_MIN

    if len(window) > 1:
        time_diffs = window["peak_time"].diff().dt.total_seconds().fillna(0)
        cadence_stability = np.std(time_diffs)
    else:
        cadence_stability = 0

    max_energy = window["energy"].max()

    # ==================================================
    # 🧠 FORECAST SCORE MODEL
    # ==================================================

    score = (
        0.4 * energy_rise +
        0.3 * activity_rate +
        0.2 * max_energy +
        0.1 * (1 / (1 + cadence_stability))
    )

    # ==================================================
    # ⏱️ LEAD TIME ESTIMATION
    # ==================================================

    if len(window) > 0:
        lead_time = (t0 - window["peak_time"].max()).total_seconds() / 60
    else:
        lead_time = 0

    # ==================================================
    # 📦 SAVE EVENT
    # ==================================================

    results.append({
        "flare_time": t0,
        "flare_class": flare.get("flare_class", "Unknown"),
        "precursor_events": len(window),
        "energy_rise": energy_rise,
        "activity_rate": activity_rate,
        "cadence_stability": cadence_stability,
        "max_energy": max_energy,
        "forecast_score": score,
        "lead_time_min": lead_time
    })

# ==================================================
# 📊 OUTPUT DATAFRAME
# ==================================================

df = pd.DataFrame(results)

# Normalize forecast probability
if len(df) > 0:
    df["flare_probability"] = safe_minmax(df["forecast_score"])

# Sort by strongest forecast
df = df.sort_values("flare_probability", ascending=False)

# ==================================================
# 💾 SAVE
# ==================================================

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(OUTPUT_PATH, index=False)

# ==================================================
# 📢 OUTPUT
# ==================================================

print("\n==================================================")
print("⚡ FLARE FORECASTING ENGINE v1 (REAL SCIENCE)")
print("==================================================")

print(f"Total flares analyzed: {len(df)}")

print("\n🔥 TOP FORECASTED FLARES:\n")

print(df.head(10)[[
    "flare_time",
    "flare_class",
    "flare_probability",
    "lead_time_min",
    "precursor_events"
]])

print("\nSaved to:", OUTPUT_PATH)