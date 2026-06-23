import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# ============================================================
# Paths
# ============================================================

INPUT = "../features/natural_states/hdbscan_states.csv"

OUTPUT = "../features/temporal_states"

os.makedirs(OUTPUT, exist_ok=True)

# ============================================================
# Load
# ============================================================

print("=" * 60)
print("TEMPORAL CORONAL STATE ANALYSIS")
print("=" * 60)

df = pd.read_csv(INPUT)

df["DATE-OBS"] = pd.to_datetime(df["DATE-OBS"])

df = df.sort_values("DATE-OBS").reset_index(drop=True)

print("\nFrames:", len(df))

# ============================================================
# Transition List
# ============================================================

transitions = []

for i in range(len(df)-1):

    current = df.loc[i, "Natural_State"]
    nxt = df.loc[i+1, "Natural_State"]

    dt = (
        df.loc[i+1, "DATE-OBS"] -
        df.loc[i, "DATE-OBS"]
    ).total_seconds()

    transitions.append({

        "From_State": current,
        "To_State": nxt,
        "From_Frame": i,
        "To_Frame": i+1,
        "Time_Delta_sec": dt

    })

transition_df = pd.DataFrame(transitions)

# ============================================================
# Transition Matrix
# ============================================================

transition_matrix = pd.crosstab(

    transition_df["From_State"],
    transition_df["To_State"]

)

transition_probability = transition_matrix.div(

    transition_matrix.sum(axis=1),

    axis=0

)

# ============================================================
# Stability
# ============================================================

episodes = []

start = 0

current_state = df.loc[0, "Natural_State"]

for i in range(1, len(df)):

    if df.loc[i, "Natural_State"] != current_state:

        duration = i - start

        t1 = df.loc[start, "DATE-OBS"]

        t2 = df.loc[i-1, "DATE-OBS"]

        episodes.append({

            "State": current_state,

            "Start_Frame": start,

            "End_Frame": i-1,

            "Frames": duration,

            "Start_Time": t1,

            "End_Time": t2,

            "Mean_Activity":

            df.iloc[start:i]["VELC_Scientific_Activity"].mean()

        })

        current_state = df.loc[i, "Natural_State"]

        start = i

episodes.append({

    "State": current_state,

    "Start_Frame": start,

    "End_Frame": len(df)-1,

    "Frames": len(df)-start,

    "Start_Time": df.loc[start, "DATE-OBS"],

    "End_Time": df.loc[len(df)-1, "DATE-OBS"],

    "Mean_Activity":

    df.iloc[start:]["VELC_Scientific_Activity"].mean()

})

episodes = pd.DataFrame(episodes)

# ============================================================
# State Statistics
# ============================================================

state_stats = episodes.groupby("State").agg(

    Number_of_Episodes=("Frames","count"),

    Mean_Duration=("Frames","mean"),

    Max_Duration=("Frames","max"),

    Mean_Activity=("Mean_Activity","mean")

).reset_index()

# ============================================================
# Save CSVs
# ============================================================

transition_df.to_csv(

    os.path.join(

        OUTPUT,

        "state_transitions.csv"

    ),

    index=False

)

transition_matrix.to_csv(

    os.path.join(

        OUTPUT,

        "transition_matrix.csv"

    )

)

transition_probability.to_csv(

    os.path.join(

        OUTPUT,

        "transition_probabilities.csv"

    )

)

episodes.to_csv(

    os.path.join(

        OUTPUT,

        "activity_episodes.csv"

    ),

    index=False

)

state_stats.to_csv(

    os.path.join(

        OUTPUT,

        "state_stability.csv"

    ),

    index=False

)

# ============================================================
# Heatmap
# ============================================================

plt.figure(figsize=(8,6))

plt.imshow(

    transition_probability,

    interpolation="nearest",

    aspect="auto"

)

plt.colorbar(label="Probability")

plt.xticks(

    range(len(transition_probability.columns)),

    transition_probability.columns

)

plt.yticks(

    range(len(transition_probability.index)),

    transition_probability.index

)

plt.xlabel("Next State")

plt.ylabel("Current State")

plt.title("Coronal State Transition Probability")

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "transition_heatmap.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Timeline
# ============================================================

plt.figure(figsize=(14,4))

plt.plot(

    df["DATE-OBS"],

    df["Natural_State"],

    marker="o"

)

plt.xlabel("Time")

plt.ylabel("Natural State")

plt.title("Natural Coronal State Evolution")

plt.grid(True)

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "state_timeline.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Activity Timeline
# ============================================================

plt.figure(figsize=(14,4))

plt.plot(

    df["DATE-OBS"],

    df["VELC_Scientific_Activity"],

    linewidth=2

)

plt.xlabel("Time")

plt.ylabel("Scientific Activity")

plt.title("Scientific Activity Evolution")

plt.grid(True)

plt.tight_layout()

plt.savefig(

    os.path.join(

        OUTPUT,

        "activity_timeline.png"

    ),

    dpi=300

)

plt.close()

# ============================================================
# Console Output
# ============================================================

print("\nTransition Matrix")
print(transition_matrix)

print("\nTransition Probabilities")
print(transition_probability.round(3))

print("\nState Stability")
print(state_stats)

print("\nDetected Episodes:", len(episodes))

print("\nLongest Episode")
print(

    episodes.sort_values(

        "Frames",

        ascending=False

    ).head()

)

print("\nSaved Files")

for f in [

    "state_transitions.csv",

    "transition_matrix.csv",

    "transition_probabilities.csv",

    "activity_episodes.csv",

    "state_stability.csv",

    "transition_heatmap.png",

    "state_timeline.png",

    "activity_timeline.png"

]:

    print(os.path.join(OUTPUT, f))

print("\nTemporal Analysis Complete.")