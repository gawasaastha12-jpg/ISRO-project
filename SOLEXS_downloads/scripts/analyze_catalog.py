import pandas as pd

df = pd.read_csv("event_catalog.csv")

df = df[df["artifact"] == 0]

print("Days:", len(df))
print()

for q in [0.50,0.75,0.90,0.95,0.99]:
    print(
        f"Q{int(q*100)}:",
        df["max_counts"].quantile(q)
    )