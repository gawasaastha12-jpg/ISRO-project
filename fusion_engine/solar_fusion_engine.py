import pandas as pd
import numpy as np
from pathlib import Path

# ==================================================
# 📌 PATHS (MATCHING YOUR PROJECT STRUCTURE)
# ==================================================

BASE = Path("features")

SOLEXS_PATH = BASE / "solexs_flares" / "SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = BASE / "hel1os_flares" / "HEL1OS_FLARE_CATALOG.csv"

OUTPUT_PATH = BASE / "solar_fusion" / "CORRELATED_SOLAR_EVENTS.csv"

# ==================================================
# ⏱️ CONFIG
# ==================================================

TIME_WINDOW_MIN = 30

# ==================================================
# 📥 LOAD DATA
# ==================================================

def load_csv(path):
    if not path.exists():
        raise FileNotFoundError(f"Missing file: {path}")
    return pd.read_csv(path)

solexs = load_csv(SOLEXS_PATH)
hel1os = load_csv(HEL1OS_PATH)

# ==================================================
# 🧠 SAFE TIME PARSING
# ==================================================

def parse_time(df, col):
    if col in df.columns:
        return pd.to_datetime(df[col], errors="coerce")
    return pd.to_datetime("NaT")

# Your actual columns
solexs["peak_time"] = parse_time(solexs, "flare_peak")
hel1os["peak_time"] = parse_time(hel1os, "flare_peak")

# Drop invalid rows
solexs = solexs.dropna(subset=["peak_time"])
hel1os = hel1os.dropna(subset=["peak_time"])

# ==================================================
# 🔧 SCORING FUNCTIONS
# ==================================================

def time_score(t1, t2):
    delta_min = abs((t1 - t2).total_seconds()) / 60
    return np.exp(-delta_min / 15)

def intensity_score(a, b):
    a = float(a) if pd.notna(a) else 1
    b = float(b) if pd.notna(b) else 1
    return 1 - abs(a - b) / (a + b + 1e-6)

def lag_score(lag_min):
    return np.exp(-abs(lag_min) / 20)

# ==================================================
# 🔗 CORRELATION ENGINE
# ==================================================

results = []

for _, s in solexs.iterrows():
    for _, h in hel1os.iterrows():

        t1 = s["peak_time"]
        t2 = h["peak_time"]

        # ⛔ TIME WINDOW FILTER
        if abs((t1 - t2).total_seconds()) > TIME_WINDOW_MIN * 60:
            continue

        t_score = time_score(t1, t2)
        i_score = intensity_score(
            s.get("peak_flux", 1),
            h.get("intensity", 1)
        )
        lag = (h["peak_time"] - s["peak_time"]).total_seconds() / 60
        l_score = lag_score(lag)

        final_score = (
            0.5 * t_score +
            0.3 * i_score +
            0.2 * l_score
        )

        results.append({
            "solexs_peak": t1,
            "hel1os_peak": t2,
            "lag_minutes": lag,
            "time_score": t_score,
            "intensity_score": i_score,
            "lag_score": l_score,
            "final_score": final_score,
            "solexs_class": s.get("class", "Unknown"),
            "hel1os_class": h.get("class", "Unknown")
        })

# ==================================================
# 📊 OUTPUT
# ==================================================

corr = pd.DataFrame(results)

if len(corr) == 0:
    print("\n❌ No correlations found.")
    print("Try increasing TIME_WINDOW_MIN (currently 30 min)")
else:
    corr = corr.sort_values("final_score", ascending=False)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    corr.to_csv(OUTPUT_PATH, index=False)

    print("\n==================================================")
    print("🌞 SOLAR FUSION ENGINE COMPLETE")
    print("==================================================")
    print(f"Matches Found: {len(corr)}")
    print(f"Saved To     : {OUTPUT_PATH}")

    print("\n🔥 TOP CORRELATIONS:\n")
    print(corr.head(10)[[
        "solexs_peak",
        "hel1os_peak",
        "lag_minutes",
        "final_score"
    ]])