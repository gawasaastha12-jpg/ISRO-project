import pandas as pd
from pathlib import Path

print("=" * 60)
print("SOLEXS EVENT CONSOLIDATION")
print("=" * 60)

flare_file = Path(
    r".\features\solexs_flares\SOLEXS_FLARE_CATALOG.csv"
)

df = pd.read_csv(flare_file)

df["peak_time"] = pd.to_datetime(df["peak_time"])

df = df.sort_values("peak_time").reset_index(drop=True)

print(f"\nInput Peaks: {len(df):,}")

# --------------------------------------------------
# merge peaks within 10 minutes
# --------------------------------------------------

MERGE_WINDOW = pd.Timedelta(minutes=10)

events = []

current_start = df.iloc[0]["peak_time"]
current_end = df.iloc[0]["peak_time"]

current_peak_time = df.iloc[0]["peak_time"]
current_peak_counts = df.iloc[0]["peak_counts"]

current_detector = df.iloc[0]["detector"]

for i in range(1, len(df)):

    row = df.iloc[i]

    t = row["peak_time"]

    if (t - current_end) <= MERGE_WINDOW:

        current_end = t

        if row["peak_counts"] > current_peak_counts:
            current_peak_counts = row["peak_counts"]
            current_peak_time = t

    else:

        duration = (
            current_end - current_start
        ).total_seconds()

        events.append({
            "event_start": current_start,
            "event_end": current_end,
            "peak_time": current_peak_time,
            "peak_counts": current_peak_counts,
            "duration_sec": duration
        })

        current_start = t
        current_end = t
        current_peak_time = t
        current_peak_counts = row["peak_counts"]

# final event

events.append({
    "event_start": current_start,
    "event_end": current_end,
    "peak_time": current_peak_time,
    "peak_counts": current_peak_counts,
    "duration_sec":
        (current_end - current_start).total_seconds()
})

events = pd.DataFrame(events)

# --------------------------------------------------
# classify
# --------------------------------------------------

def classify(x):

    if x > 100000:
        return "Extreme"

    if x > 10000:
        return "Major"

    if x > 1000:
        return "Moderate"

    return "Minor"

events["event_class"] = (
    events["peak_counts"]
    .apply(classify)
)

print("\nResults")
print("-" * 40)

print(f"Original Peaks : {len(df):,}")
print(f"Solar Events   : {len(events):,}")

print("\nClasses")

print(
    events["event_class"]
    .value_counts()
)

outdir = Path(
    r".\features\solar_fusion"
)

outdir.mkdir(
    parents=True,
    exist_ok=True
)

outfile = (
    outdir /
    "SOLEXS_EVENT_CATALOG.csv"
)

events.to_csv(
    outfile,
    index=False
)

print("\nSaved")

print(outfile)

print("\nTop Events")

print(
    events.sort_values(
        "peak_counts",
        ascending=False
    )
    .head(20)
)

print("\nDone.")