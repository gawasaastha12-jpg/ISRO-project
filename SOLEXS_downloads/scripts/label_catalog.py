import pandas as pd

df = pd.read_csv("event_catalog.csv")

labels = []

for _, row in df.iterrows():

    if row["artifact"] == 1:
        labels.append(5)

    elif row["max_counts"] < 1497:
        labels.append(0)

    elif row["max_counts"] < 4147:
        labels.append(1)

    elif row["max_counts"] < 8912:
        labels.append(2)

    elif row["max_counts"] < 20559:
        labels.append(3)

    else:
        labels.append(4)

df["activity_class"] = labels

df.to_csv(
    "event_catalog_labeled.csv",
    index=False
)

print(
    df["activity_class"].value_counts().sort_index()
)