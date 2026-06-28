import pandas as pd
import numpy as np

SOLEXS_PATH = "features/solexs_flares/SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = "features/hel1os_flares/HEL1OS_FLARE_CATALOG.csv"

BASE_WINDOW_MIN = 180

# =========================
# LOAD
# =========================
solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

# =========================
# TIME PARSE (FORCE UNIFORM UTC)
# =========================
solexs["time"] = pd.to_datetime(solexs["peak_time"], utc=True, errors="coerce")
hel1os["time"] = pd.to_datetime(hel1os["flare_peak"], utc=True, errors="coerce")

solexs = solexs.dropna(subset=["time"]).sort_values("time")
hel1os = hel1os.dropna(subset=["time"]).sort_values("time")

# =========================
# ENERGY
# =========================
solexs["energy"] = solexs["peak_counts"].fillna(0)
hel1os["energy"] = hel1os["peak_flux"].fillna(0)

solexs["energy_n"] = solexs["energy"] / (solexs["energy"].max() + 1e-9)
hel1os["energy_n"] = hel1os["energy"] / (hel1os["energy"].max() + 1e-9)

# =========================
# DYNAMIC WINDOW ADJUSTMENT
# =========================
# If no matches, we expand window automatically
WINDOWS_TO_TRY = [180, 360, 720]

fusion = None

for TIME_WINDOW_MIN in WINDOWS_TO_TRY:

    print(f"\nTrying window = {TIME_WINDOW_MIN} min")

    results = []

    for _, h in hel1os.iterrows():
        h_time = h["time"]

        window_start = h_time - pd.Timedelta(minutes=TIME_WINDOW_MIN)
        window_end = h_time + pd.Timedelta(minutes=TIME_WINDOW_MIN)

        candidates = solexs[
            (solexs["time"] >= window_start) &
            (solexs["time"] <= window_end)
        ]

        for _, s in candidates.iterrows():
            dt = abs((h_time - s["time"]).total_seconds()) / 60.0

            time_weight = np.exp(-dt / TIME_WINDOW_MIN)
            intensity = h["energy_n"] * s["energy_n"]

            results.append({
                "hel1os_time": h_time,
                "solexs_time": s["time"],
                "dt_min": dt,
                "score": time_weight * intensity
            })

    fusion = pd.DataFrame(results)

    print(f"Matches found: {len(fusion)}")

    if len(fusion) > 0:
        break

# =========================
# SAFE OUTPUT
# =========================
print("\n==================================================")
print("🌞 ROBUST SOLAR FUSION ENGINE v3 (FIXED)")
print("==================================================")

if fusion is None or len(fusion) == 0:
    print("❌ No correlations found even after expanding window")
    print("👉 This means datasets are NOT temporally aligned")
    exit()

summary = fusion.groupby("hel1os_time").agg(
    max_score=("score", "max"),
    mean_score=("score", "mean"),
    matches=("score", "count")
).reset_index()

summary = summary.sort_values("max_score", ascending=False)

print("\n🔥 TOP CORRELATIONS:\n")
print(summary.head(15))

out_path = "features/solar_fusion/CORRELATED_SOLAR_EVENTS_REAL.csv"
summary.to_csv(out_path, index=False)

print(f"\nSaved to: {out_path}")