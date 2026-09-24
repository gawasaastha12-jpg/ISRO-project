"""
ml_fusion_agent.py
==================
Phase 3: The Machine Learning Fusion Engine.

Features:
- Ingests Phase 2 feature matrix (data/processed/feature_matrix_15m.csv)
- Chronological 80/20 train/test data splitting (zero temporal data leakage)
- Multi-horizon XGBoost Regressors for 15m, 30m, and 60m solar capacity forecasting
- Imbalance-calibrated XGBoost Classifier (scale_pos_weight) for 30m solar capacity drop alerts
- Evaluation logging: MAE & RMSE for regressors; Precision, Recall, F1 & Confusion Matrix for classifier
- Model artifact export to models/ directory via joblib
"""

import os
import sys
import logging
import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)
from xgboost import XGBRegressor, XGBClassifier

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("MLFusionEngine")


# ============================================================================
# 1. Data Loader & Preprocessor
# ============================================================================

class MLDataPipeline:
    """Handles chronological sorting, encoding, and leak-free splitting."""

    @staticmethod
    def load_and_prepare(filepath: str, split_ratio: float = 0.80):
        """Loads feature matrix, sorts chronologically, encodes features, and performs 80/20 split."""
        logger.info(f"Ingesting dataset from: {filepath}")
        df = pd.read_csv(filepath)

        # Sort strictly chronologically by timestamp
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df = df.sort_values("timestamp").reset_index(drop=True)

        # The targets we are trying to predict
        target_cols = [
            'target_capacity_15m', 
            'target_capacity_30m', 
            'target_capacity_60m', 
            'drop_alert_30m'
        ]

        # The metadata we don't want to train on
        meta_cols = ['timestamp', 'location_id', 'location_name']

        # The CLEAN feature matrix (X) - strictly stripping out the future!
        X = df.drop(columns=[c for c in (target_cols + meta_cols) if c in df.columns])

        # Define the individual y targets
        y_15m = df['target_capacity_15m']
        y_30m = df['target_capacity_30m']
        y_60m = df['target_capacity_60m']
        y_alert = df['drop_alert_30m']

        # One-Hot Encode all non-numeric categorical features (e.g. nowcast_phase)
        non_numeric_cols = list(X.select_dtypes(exclude=[np.number]).columns)
        if len(non_numeric_cols) > 0:
            logger.info(f"One-hot encoding categorical features: {non_numeric_cols}")
            X = pd.get_dummies(X, columns=non_numeric_cols, drop_first=True)

        # Ensure all columns are numeric
        X = X.astype(np.float32)
        logger.info(f"Clean Feature Matrix X Columns ({len(X.columns)}): {list(X.columns)}")

        # Strict Chronological Train/Test Split (80% Train, 20% Test)
        split_idx = int(len(df) * split_ratio)
        logger.info(f"Chronological split index: {split_idx} (Train: {split_idx}, Test: {len(df) - split_idx})")

        X_train, X_test = X.iloc[:split_idx], X.iloc[split_idx:]
        
        y_train_15m, y_test_15m = y_15m.iloc[:split_idx], y_15m.iloc[split_idx:]
        y_train_30m, y_test_30m = y_30m.iloc[:split_idx], y_30m.iloc[split_idx:]
        y_train_60m, y_test_60m = y_60m.iloc[:split_idx], y_60m.iloc[split_idx:]
        y_train_alert, y_test_alert = y_alert.iloc[:split_idx], y_alert.iloc[split_idx:]

        return (
            X_train, X_test,
            (y_train_15m, y_test_15m),
            (y_train_30m, y_test_30m),
            (y_train_60m, y_test_60m),
            (y_train_alert, y_test_alert)
        )


# ============================================================================
# 2. Model Training Engine
# ============================================================================

class MLFusionTrainer:
    """Trains multi-horizon regressors and imbalance-calibrated anomaly classifier."""

    @staticmethod
    def train_regressor(X_train: pd.DataFrame, y_train: pd.Series, horizon_name: str) -> XGBRegressor:
        """Trains an XGBoost Regressor for a specific forecast horizon."""
        logger.info(f"Training XGBoost Regressor for {horizon_name} horizon...")
        model = XGBRegressor(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1
        )
        model.fit(X_train, y_train)
        return model

    @staticmethod
    def train_classifier(X_train: pd.DataFrame, y_train: pd.Series) -> XGBClassifier:
        """Trains an XGBoost Classifier with scale_pos_weight for class imbalance."""
        n_pos = (y_train == 1).sum()
        n_neg = (y_train == 0).sum()
        scale_weight = float(n_neg / max(1, n_pos))
        logger.info(f"Training XGBoost Anomaly Classifier (Positive: {n_pos}, Negative: {n_neg}, scale_pos_weight: {scale_weight:.2f})...")

        model = XGBClassifier(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=5,
            scale_pos_weight=scale_weight,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            n_jobs=-1,
            eval_metric="logloss"
        )
        model.fit(X_train, y_train)
        return model


# ============================================================================
# Main Execution Entrypoint
# ============================================================================

if __name__ == "__main__":
    logger.info("Initializing Phase 3 Machine Learning Fusion Engine...")

    input_file = "data/processed/feature_matrix_15m.csv"
    output_model_dir = "models"
    os.makedirs(output_model_dir, exist_ok=True)

    if not os.path.exists(input_file):
        logger.error(f"Feature matrix missing: {input_file}. Run Phase 2 (feature_engine.py) first.")
        sys.exit(1)

    # 1. Load data and create chronological 80/20 train/test split
    X_train, X_test, (y_tr_15m, y_te_15m), (y_tr_30m, y_te_30m), (y_tr_60m, y_te_60m), (y_tr_alert, y_te_alert) = (
        MLDataPipeline.load_and_prepare(input_file, split_ratio=0.80)
    )

    # 2. Train Multi-Horizon Regressors
    model_15m = MLFusionTrainer.train_regressor(X_train, y_tr_15m, "15-Minute")
    model_30m = MLFusionTrainer.train_regressor(X_train, y_tr_30m, "30-Minute")
    model_60m = MLFusionTrainer.train_regressor(X_train, y_tr_60m, "60-Minute")

    # 3. Train Anomaly Classifier (The Alert Oracle)
    model_alert = MLFusionTrainer.train_classifier(X_train, y_tr_alert)

    # 4. Evaluate Regressors on Chronological Test Set
    pred_15m = model_15m.predict(X_test)
    pred_30m = model_30m.predict(X_test)
    pred_60m = model_60m.predict(X_test)

    mae_15m = mean_absolute_error(y_te_15m, pred_15m)
    rmse_15m = np.sqrt(mean_squared_error(y_te_15m, pred_15m))

    mae_30m = mean_absolute_error(y_te_30m, pred_30m)
    rmse_30m = np.sqrt(mean_squared_error(y_te_30m, pred_30m))

    mae_60m = mean_absolute_error(y_te_60m, pred_60m)
    rmse_60m = np.sqrt(mean_squared_error(y_te_60m, pred_60m))

    # 5. Evaluate Classifier on Chronological Test Set
    pred_alert = model_alert.predict(X_test)
    prec_alert = precision_score(y_te_alert, pred_alert, zero_division=0)
    rec_alert = recall_score(y_te_alert, pred_alert, zero_division=0)
    f1_alert = f1_score(y_te_alert, pred_alert, zero_division=0)
    cm_alert = confusion_matrix(y_te_alert, pred_alert)

    # 6. Print Comprehensive Metrics Summary
    print("\n" + "=" * 65)
    print("PHASE 3 EVALUATION METRICS REPORT (CHRONOLOGICAL 20% TEST SET)")
    print("=" * 65)
    
    print("\n--- 1. MULTI-HORIZON CAPACITY REGRESSORS ---")
    print(f"Horizon 15m  | MAE: {mae_15m:.4f} | RMSE: {rmse_15m:.4f}")
    print(f"Horizon 30m  | MAE: {mae_30m:.4f} | RMSE: {rmse_30m:.4f}")
    print(f"Horizon 60m  | MAE: {mae_60m:.4f} | RMSE: {rmse_60m:.4f}")

    print("\n--- 2. ANOMALY CLASSIFIER (DROP ALERT 30M ORACLE) ---")
    print(f"Precision  : {prec_alert:.4f}")
    print(f"Recall     : {rec_alert:.4f}")
    print(f"F1-Score   : {f1_alert:.4f}")
    print("\nConfusion Matrix:")
    print(cm_alert)
    print("=" * 65)

    # 7. Model Export to models/ directory
    joblib.dump(model_15m, os.path.join(output_model_dir, "xgb_regressor_15m.joblib"))
    joblib.dump(model_30m, os.path.join(output_model_dir, "xgb_regressor_30m.joblib"))
    joblib.dump(model_60m, os.path.join(output_model_dir, "xgb_regressor_60m.joblib"))
    joblib.dump(model_alert, os.path.join(output_model_dir, "xgb_classifier_alert_30m.joblib"))

    logger.info(f"All 4 trained models successfully serialized and saved to: '{output_model_dir}/'")
