import pandas as pd

df = pd.read_csv("../data/processed/solexs_event_catalog.csv")

def label(row):

    if row["artifact"] == 1:
        return 5

    r = row["peak_ratio"]

    if r > 500:
        return 4
    elif r > 200:
        return 3
    elif r > 50:
        return 2
    elif r > 10:
        return 1
    else:
        return 0

df["label"] = df.apply(label, axis=1)

df.to_csv("../data/processed/solexs_labeled_catalog.csv", index=False)

print(df["label"].value_counts())