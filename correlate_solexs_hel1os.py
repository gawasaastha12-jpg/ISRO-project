import pandas as pd
from pathlib import Path

print("=" * 60)
print("SOLEXS ↔ HEL1OS CORRELATION")
print("=" * 60)

# --------------------------------------------------
# load catalogs
# --------------------------------------------------

solexs = pd.read_csv(
    r".\features\solar_fusion\SOLEXS_EVENT_CATALOG.csv"
)

hel1os = pd.read_csv(
    r".\features\hel1os_flares\HEL1OS_FLARE_CATALOG.csv"
)

solexs["peak_time"] = pd.to_datetime(
    solexs["peak_time"],
    utc=True
)

hel1os["flare_peak"] = pd.to_datetime(
    hel1os["flare_peak"],
    utc=True
)

print("\nSOLEXS Events :", len(solexs))
print("HEL1OS Events :", len(hel1os))

# --------------------------------------------------
# correlation window
# --------------------------------------------------

WINDOW = pd.Timedelta(minutes=30)

matches = []

for _, s in solexs.iterrows():

    t = s["peak_time"]

    nearby = hel1os[
        (
            hel1os["flare_peak"] >= t - WINDOW
        )
        &
        (
            hel1os["flare_peak"] <= t + WINDOW
        )
    ]

    if len(nearby) == 0:
        continue

    strongest = nearby.loc[
        nearby["peak_intensity"].idxmax()
    ]

    dt = abs(
        (
            strongest["flare_peak"] - t
        ).total_seconds()
    )

    matches.append({
        "solexs_peak": t,
        "solexs_counts":
            s["peak_counts"],

        "solexs_class":
            s["event_class"],

        "hel1os_peak":
            strongest["flare_peak"],

        "hel1os_intensity":
            strongest["peak_intensity"],

        "hel1os_class":
            strongest["flare_class"],

        "time_difference_sec":
            dt
    })

corr = pd.DataFrame(matches)

print("\nMatches Found:", len(corr))

if len(corr):

    print("\nClass Breakdown")

    print(
        corr.groupby(
            ["solexs_class",
             "hel1os_class"]
        ).size()
    )

# --------------------------------------------------
# save
# --------------------------------------------------

outdir = Path(
    r".\features\solar_fusion"
)

outdir.mkdir(
    parents=True,
    exist_ok=True
)

outfile = (
    outdir /
    "CORRELATED_SOLAR_EVENTS.csv"
)

corr.to_csv(
    outfile,
    index=False
)

print("\nSaved:")
print(outfile)

print("\nTop Correlations")

print(
    corr.sort_values(
        "solexs_counts",
        ascending=False
    ).head(20)
)

print("\nDone.")