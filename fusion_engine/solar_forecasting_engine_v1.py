import pandas as pd
import numpy as np
from sklearn.model_selection import TimeSeriesSplit
from xgboost import XGBClassifier
from sklearn.metrics import classification_report, roc_auc_score

# ===============================
# CONFIG
# ===============================
SOLEXS_PATH = "features/solexs_flares/SOLEXS_FLARE_CATALOG.csv"
HEL1OS_PATH = "features/hel1os_flares/HEL1OS_FLARE_CATALOG.csv"

BIN_SIZE_MIN = 5
FORECAST_HORIZON_MIN = 90   # predict flare in next 90 min
LEAD_MIN = 30               # minimum precursor window

# ===============================
# LOAD DATA
# ===============================
solexs = pd.read_csv(SOLEXS_PATH)
hel1os = pd.read_csv(HEL1OS_PATH)

solexs["time"] = pd.to_datetime(solexs["peak_time"], utc=True, errors="coerce")
hel1os["time"] = pd.to_datetime(hel1os["flare_peak"], utc=True, errors="coerce")

solexs = solexs.dropna(subset=["time"])
hel1os = hel1os.dropna(subset=["time"])

# ===============================
# CREATE TIME GRID
# ===============================
start = min(solexs["time"].min(), hel1os["time"].min())
end = max(solexs["time"].max(), hel1os["time"].max())

time_index = pd.date_range(start, end, freq=f"{BIN_SIZE_MIN}min", tz="UTC")

df = pd.DataFrame({"time": time_index})

# ===============================
# AGGREGATE SOLEXS SIGNAL
# ===============================
solexs_bin = solexs.groupby(
    pd.Grouper(key="time", freq=f"{BIN_SIZE_MIN}min")
).agg(
    solexs_count=("peak_counts", "count"),
    solexs_energy=("peak_counts", "sum"),
    solexs_sigma=("sigma", "mean"),
    solexs_significance=("significance", "mean")
).reset_index()

df = df.merge(solexs_bin, on="time", how="left")

# ===============================
# AGGREGATE HEL1OS SIGNAL
# ===============================
hel1os_bin = hel1os.groupby(
    pd.Grouper(key="time", freq=f"{BIN_SIZE_MIN}min")
).agg(
    hel1os_count=("flare_class", "count")
).reset_index()

df = df.merge(hel1os_bin, on="time", how="left")

df = df.fillna(0)

# ===============================
# FEATURE ENGINEERING (PRECURSORS)
# ===============================
df["energy_roll_1h"] = df["solexs_energy"].rolling(12).mean()
df["energy_roll_3h"] = df["solexs_energy"].rolling(36).mean()
df["energy_slope"] = df["solexs_energy"].diff()
df["activity_spike"] = df["solexs_energy"] / (df["energy_roll_1h"] + 1e-6)

# ===============================
# LABEL CREATION (FUTURE FLARE PREDICTION)
# ===============================
future_window = FORECAST_HORIZON_MIN // BIN_SIZE_MIN

df["flare_future"] = (
    df["hel1os_count"]
    .shift(-future_window)
    .rolling(future_window)
    .sum()
)

df["y"] = (df["flare_future"] > 0).astype(int)

# remove leakage tail
df = df.dropna()

# ===============================
# MODEL DATA
# ===============================
features = [
    "solexs_count",
    "solexs_energy",
    "solexs_sigma",
    "solexs_significance",
    "energy_roll_1h",
    "energy_roll_3h",
    "energy_slope",
    "activity_spike"
]

X = df[features]
y = df["y"]

# ===============================
# TRAIN MODEL (TIME SERIES SPLIT)
# ===============================
tscv = TimeSeriesSplit(n_splits=5)

model = XGBClassifier(
    n_estimators=200,
    max_depth=5,
    learning_rate=0.05,
    subsample=0.8,
    colsample_bytree=0.8,
    eval_metric="logloss"
)

print("\n🌞 TRAINING FORECASTING MODEL...\n")

for fold, (train_idx, test_idx) in enumerate(tscv.split(X)):
    X_train, X_test = X.iloc[train_idx], X.iloc[test_idx]
    y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]

    model.fit(X_train, y_train)

    preds = model.predict(X_test)
    proba = model.predict_proba(X_test)[:, 1]

    print(f"\n📊 FOLD {fold+1}")
    print(classification_report(y_test, preds))
    print("ROC-AUC:", roc_auc_score(y_test, proba))

# ===============================
# FINAL OUTPUT
# ===============================
df["flare_probability"] = model.predict_proba(X)[:, 1]

df[["time", "flare_probability", "y"]].to_csv(
    "features/solar_fusion/flare_forecast_output.csv",
    index=False
)

print("\n✅ FORECASTING ENGINE COMPLETE")
print("Saved: features/solar_fusion/flare_forecast_output.csv")