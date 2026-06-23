import os
import pandas as pd
import matplotlib.pyplot as plt

FEATURE_FILE = "../features/velc_features.csv"
OUTPUT_DIR = "../features/analysis"

os.makedirs(OUTPUT_DIR, exist_ok=True)

df = pd.read_csv(FEATURE_FILE)

print("=" * 70)
print("VELC FEATURE ANALYSIS")
print("=" * 70)

print("\nDataset Shape")
print(df.shape)

print("\nColumns")
print(df.columns.tolist())

print("\n")

# --------------------------------------------------
# Numerical statistics
# --------------------------------------------------

numeric = df.select_dtypes(include="number")

stats = numeric.describe().T
stats["variance"] = numeric.var()
stats["missing"] = numeric.isna().sum()

stats.to_csv(os.path.join(OUTPUT_DIR, "feature_statistics.csv"))

print("Saved:")
print("feature_statistics.csv")

# --------------------------------------------------
# Correlation Matrix
# --------------------------------------------------

corr = numeric.corr()

corr.to_csv(os.path.join(OUTPUT_DIR, "correlation_matrix.csv"))

print("correlation_matrix.csv")

# --------------------------------------------------
# Histograms
# --------------------------------------------------

for col in numeric.columns:

    plt.figure(figsize=(6,4))
    plt.hist(df[col], bins=30)

    plt.title(col)

    plt.xlabel(col)

    plt.ylabel("Count")

    plt.tight_layout()

    plt.savefig(os.path.join(OUTPUT_DIR, f"{col}_hist.png"))

    plt.close()

print("Histograms saved")

# --------------------------------------------------
# Boxplots
# --------------------------------------------------

for col in numeric.columns:

    plt.figure(figsize=(4,5))

    plt.boxplot(df[col])

    plt.title(col)

    plt.tight_layout()

    plt.savefig(os.path.join(OUTPUT_DIR, f"{col}_boxplot.png"))

    plt.close()

print("Boxplots saved")

# --------------------------------------------------
# Top varying features
# --------------------------------------------------

variance = numeric.var().sort_values(ascending=False)

variance.to_csv(
    os.path.join(OUTPUT_DIR, "feature_variance.csv"),
    header=["Variance"]
)

print("\nTop 10 Most Variable Features")

print(variance.head(10))

# --------------------------------------------------
# Mean values
# --------------------------------------------------

means = numeric.mean().sort_values(ascending=False)

means.to_csv(
    os.path.join(OUTPUT_DIR, "feature_means.csv"),
    header=["Mean"]
)

# --------------------------------------------------
# Brightness trend
# --------------------------------------------------

if "DATE-OBS" in df.columns:

    try:

        temp = df.copy()

        temp["DATE-OBS"] = pd.to_datetime(temp["DATE-OBS"])

        temp = temp.sort_values("DATE-OBS")

        plt.figure(figsize=(10,4))

        plt.plot(temp["DATE-OBS"], temp["mean"])

        plt.title("Mean Brightness Over Time")

        plt.xlabel("Observation Time")

        plt.ylabel("Mean Intensity")

        plt.tight_layout()

        plt.savefig(
            os.path.join(
                OUTPUT_DIR,
                "brightness_time_series.png"
            )
        )

        plt.close()

        print("Brightness trend saved")

    except Exception:

        pass

print("\nAnalysis Complete")
print("Results saved to:")
print(OUTPUT_DIR)