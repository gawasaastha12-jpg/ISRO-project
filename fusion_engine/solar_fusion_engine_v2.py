import pandas as pd
import numpy as np
from pathlib import Path

# ==================================================
# CONFIG
# ==================================================

BASE = Path(__file__).resolve().parent.parent / "features"

SOLEXS_PATH = BASE / "solexs_flares" / "SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = BASE / "hel1os_flares" / "HEL1OS_FLARE_CATALOG.csv"

OUTPUT_PATH = BASE / "solar_fusion" / "CORRELATED_SOLAR_EVENTS.csv"

TIME_WINDOW_MIN = 180  # fusion window size

# ==================================================
# LOAD DATA
# ==================================================

solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

# ==================================================
# TIME NORMALIZATION (CRITICAL FIX)
# ==================================================
SOLEXS_TIME_COL = "peak_time"
HEL1OS_TIME_COL = "flare_peak"
solexs["time"] = pd.to_datetime(solexs[SOLEXS_TIME_COL], utc=True, errors="coerce")
hel1os["time"] = pd.to_datetime(hel1os[HEL1OS_TIME_COL], utc=True, errors="coerce")

solexs = solexs.dropna(subset=["time"])
hel1os = hel1os.dropna(subset=["time"])

# ==================================================
# CREATE UNIFIED TIME GRID
# ==================================================

start_time = min(solexs["time"].min(), hel1os["time"].min())
end_time = max(solexs["time"].max(), hel1os["time"].max())

time_bins = pd.date_range(
    start=start_time,
    end=end_time,
    freq=f"{TIME_WINDOW_MIN}min",
    tz="UTC"
)

fusion_rows = []

# ==================================================
# FUSION LOOP (TIME WINDOW CORRELATION)
# ==================================================

for i in range(len(time_bins) - 1):

    window_start = time_bins[i]
    window_end = time_bins[i + 1]

    solexs_window = solexs[
        (solexs["time"] >= window_start) &
        (solexs["time"] < window_end)
    ]

    hel1os_window = hel1os[
        (hel1os["time"] >= window_start) &
        (hel1os["time"] < window_end)
    ]

    fusion_rows.append({
        "time_bin": window_start,
        "solexs_count": len(solexs_window),
        "hel1os_count": len(hel1os_window),
        "solexs_strength": solexs_window["significance"].mean() if len(solexs_window) > 0 else 0,
        "hel1os_strength": hel1os_window["peak_flux"].mean() if "peak_flux" in hel1os_window.columns and len(hel1os_window) > 0 else 0
    })

fusion = pd.DataFrame(fusion_rows)

# ==================================================
# SAFE SCORING FUNCTION
# ==================================================

fusion["final_score"] = (
    fusion["solexs_count"] * 1.0 +
    fusion["hel1os_count"] * 1.0 +
    fusion["solexs_strength"].fillna(0) * 0.5 +
    fusion["hel1os_strength"].fillna(0) * 0.5
)

# ==================================================
# SORT RESULTS
# ==================================================

fusion = fusion.sort_values("final_score", ascending=False)

# ==================================================
# SAVE OUTPUT
# ==================================================

OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
fusion.to_csv(OUTPUT_PATH, index=False)

# ==================================================
# PRINT RESULTS
# ==================================================

print("\n" + "=" * 50)
print("🌞 SOLAR FUSION ENGINE v2 (STABLE FIXED)")
print("=" * 50)

print(f"SOLEXS events : {len(solexs)}")
print(f"HEL1OS events : {len(hel1os)}")
print(f"Time window   : {TIME_WINDOW_MIN} min")
print(f"Bins created  : {len(fusion)}")

print("\n🔥 TOP CORRELATED WINDOWS:\n")
print(fusion.head(10))

print(f"\nSaved to: {OUTPUT_PATH}")