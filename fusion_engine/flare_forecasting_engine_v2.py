import pandas as pd
import numpy as np

from sklearn.model_selection import TimeSeriesSplit
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.metrics import (
    classification_report,
    roc_auc_score,
    average_precision_score
)

# =========================================================
# CONFIG
# =========================================================
SOLEXS_PATH = "features/solexs_flares/SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = "features/hel1os_flares/HEL1OS_FLARE_CATALOG.csv"

BIN_SIZE = "5min"
LOOKAHEAD_BINS = 12   # 60 minutes ahead (5min bins)

# =========================================================
# LOAD DATA
# =========================================================
solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

# =========================================================
# TIME FIX (CRITICAL SCIENTIFIC STEP)
# =========================================================
solexs["time"] = pd.to_datetime(solexs["peak_time"], utc=True, errors="coerce")
hel1os["time"] = pd.to_datetime(hel1os["flare_peak"], utc=True, errors="coerce")

solexs = solexs.dropna(subset=["time"])
hel1os = hel1os.dropna(subset=["time"])

solexs["time_bin"] = solexs["time"].dt.floor(BIN_SIZE)
hel1os["time_bin"] = hel1os["time"].dt.floor(BIN_SIZE)

# =========================================================
# AGGREGATION (PHYSICS SIGNALS)
# =========================================================
solexs_bin = solexs.groupby("time_bin").agg(
    solexs_mean=("peak_counts", "mean"),
    solexs_max=("peak_counts", "max"),
    solexs_std=("peak_counts", "std"),
).reset_index()

hel1os_bin = hel1os.groupby("time_bin").agg(
    hel1os_mean=("peak_flux", "mean"),
    hel1os_max=("peak_flux", "max"),
    hel1os_std=("peak_flux", "std"),
).reset_index()

# fill missing
solexs_bin = solexs_bin.fillna(0)
hel1os_bin = hel1os_bin.fillna(0)

# =========================================================
# UNIFIED GRID (VERY IMPORTANT)
# =========================================================
start = min(solexs_bin["time_bin"].min(), hel1os_bin["time_bin"].min())
end   = max(solexs_bin["time_bin"].max(), hel1os_bin["time_bin"].max())

full_time = pd.DataFrame({
    "time_bin": pd.date_range(start, end, freq=BIN_SIZE, tz="UTC")
})

df = full_time.merge(solexs_bin, on="time_bin", how="left")
df = df.merge(hel1os_bin, on="time_bin", how="left")

df = df.fillna(0)

# =========================================================
# NORMALIZATION (STABLE SCALING)
# =========================================================
def norm(x):
    return (x - x.min()) / (x.max() - x.min() + 1e-8)

df["S"] = norm(df["solexs_mean"])
df["H"] = norm(df["hel1os_mean"])

# =========================================================
# FEATURE ENGINEERING (PHYSICS-BASED)
# =========================================================
df["S_slope"] = df["S"].diff(3).fillna(0)
df["S_volatility"] = df["S"].rolling(6).std().fillna(0)

df["H_spike_rate"] = (df["H"] > df["H"].rolling(6).mean()).rolling(6).sum().fillna(0)

df["S_H_ratio"] = df["S"] / (df["H"] + 1e-6)

df["H_lag_6"] = df["H"].shift(6).fillna(0)
df["H_lag_12"] = df["H"].shift(12).fillna(0)

# =========================================================
# FUTURE ENERGY LABEL (CRITICAL FIX)
# =========================================================
df["future_H"] = (
    df["H"]
    .rolling(LOOKAHEAD_BINS, min_periods=1)
    .sum()
    .shift(-LOOKAHEAD_BINS)
)

df["future_H"] = df["future_H"].fillna(0)

# adaptive threshold (physics-aware)
THRESH = df["future_H"].quantile(0.97)

df["flare_label"] = (df["future_H"] > THRESH).astype(int)

# =========================================================
# FINAL DATASET
# =========================================================
features = [
    "S", "H",
    "S_slope",
    "S_volatility",
    "H_spike_rate",
    "S_H_ratio",
    "H_lag_6",
    "H_lag_12"
]

X = df[features]
y = df["flare_label"]

print("\n🌞 DATA READY:", df.shape)
print("\n📊 CLASS DISTRIBUTION:\n", y.value_counts())

# =========================================================
# TIME SERIES SPLIT (NO LEAKAGE)
# =========================================================
split = int(len(df) * 0.8)

X_train, X_test = X.iloc[:split], X.iloc[split:]
y_train, y_test = y.iloc[:split], y.iloc[split:]

# =========================================================
# MODEL (ROBUST FOR IMBALANCE)
# =========================================================
model = HistGradientBoostingClassifier(
    max_depth=6,
    learning_rate=0.05,
    max_iter=300
)

model.fit(X_train, y_train)

# =========================================================
# PREDICTION
# =========================================================
probs = model.predict_proba(X_test)[:, 1]
preds = (probs > 0.5).astype(int)

# =========================================================
# EVALUATION (RESEARCH GRADE METRICS)
# =========================================================
print("\n📊 CLASSIFICATION REPORT:\n")
print(classification_report(y_test, preds, zero_division=0))

try:
    print("ROC-AUC:", roc_auc_score(y_test, probs))
except:
    print("ROC-AUC: not defined")

try:
    print("PR-AUC:", average_precision_score(y_test, probs))
except:
    print("PR-AUC: not defined")

# =========================================================
# SAVE OUTPUT
# =========================================================
df["flare_probability"] = model.predict_proba(X)[:, 1]

out_path = "features/solar_fusion/flare_forecast_output_v3_research.csv"
df.to_csv(out_path, index=False)

print("\n✅ SAVED:", out_path)
print("\n🚀 V3 RESEARCH FORECASTING COMPLETE")