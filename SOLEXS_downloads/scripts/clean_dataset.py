import pandas as pd

inp = "../data/processed/dataset_research.csv"
out = "../data/processed/dataset_clean.csv"

df = pd.read_csv(inp)

print("Original shape:", df.shape)
print(df["label"].value_counts())

# -------------------------
# FIX 1: remove artifacts
# -------------------------
df = df[df["label"] != 5]

print("\nAfter removing artifacts:")
print(df["label"].value_counts())

# -------------------------
# FIX 2: drop extreme rarity classes (optional but recommended)
# -------------------------
min_samples = 50
keep_labels = df["label"].value_counts()
keep_labels = keep_labels[keep_labels >= min_samples].index

df = df[df["label"].isin(keep_labels)]

print("\nAfter removing ultra-rare classes:")
print(df["label"].value_counts())

# save cleaned dataset
df.to_csv(out, index=False)

print("\nSaved:", out)
print("Final shape:", df.shape)