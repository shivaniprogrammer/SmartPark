"""
Evaluation script for SmartPark Demand and Availability Models.
Calculates and prints comprehensive metrics:
- Regression: MAE, RMSE, R²
- Classification: Accuracy, Precision, Recall, F1-score, Classification Report, Confusion Matrix
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai.utils.preprocessing import (
    ParkingDataPreprocessor,
    encode_demand_target,
    decode_demand_target,
    DEMAND_LABELS
)
from ai.training.train_availability_model import generate_horizon_training_dataset

def evaluate_demand_model():
    print("\n" + "="*70)
    print("      SMARTPARK AI: DEMAND PREDICTION MODEL EVALUATION")
    print("="*70)
    
    model_path = os.path.join(os.path.dirname(__file__), "..", "models", "demand_model.pkl")
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "parking_data.csv")
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}. Please train first.")
        return
        
    bundle = joblib.load(model_path)
    preprocessor: ParkingDataPreprocessor = bundle["preprocessor"]
    regressor = bundle["regressor"]
    classifier = bundle["classifier"]
    
    df = pd.read_csv(data_path)
    X = preprocessor.transform(df)
    y_reg = df["occupancy_rate"].values
    y_clf = encode_demand_target(df["demand_level"])
    
    # 80/20 Test split with consistent random seed
    _, X_test, _, y_test_reg, _, y_test_clf = train_test_split(
        X, y_reg, y_clf, test_size=0.2, random_state=42, stratify=y_clf
    )
    
    # 1. Regression Metrics (Occupancy Rate %)
    y_pred_reg = regressor.predict(X_test)
    mae = mean_absolute_error(y_test_reg, y_pred_reg)
    rmse = np.sqrt(mean_squared_error(y_test_reg, y_pred_reg))
    r2 = r2_score(y_test_reg, y_pred_reg)
    
    print(f"\n[1] Occupancy Rate Regression Metrics ({bundle.get('regressor_name', 'Regressor')}):")
    print(f"    - Mean Absolute Error (MAE)       : {mae:.4f} %")
    print(f"    - Root Mean Squared Error (RMSE)  : {rmse:.4f} %")
    print(f"    - Coefficient of Determination (R²): {r2:.4f}")
    
    # 2. Classification Metrics (Demand Level)
    y_pred_clf = classifier.predict(X_test)
    acc = accuracy_score(y_test_clf, y_pred_clf)
    prec_weighted = precision_score(y_test_clf, y_pred_clf, average="weighted", zero_division=0)
    rec_weighted = recall_score(y_test_clf, y_pred_clf, average="weighted", zero_division=0)
    f1_weighted = f1_score(y_test_clf, y_pred_clf, average="weighted", zero_division=0)
    
    prec_macro = precision_score(y_test_clf, y_pred_clf, average="macro", zero_division=0)
    rec_macro = recall_score(y_test_clf, y_pred_clf, average="macro", zero_division=0)
    f1_macro = f1_score(y_test_clf, y_pred_clf, average="macro", zero_division=0)
    
    print(f"\n[2] Demand Level Classification Metrics ({bundle.get('classifier_name', 'Classifier')}):")
    print(f"    - Accuracy                       : {acc * 100:.2f} %")
    print(f"    - Weighted Precision             : {prec_weighted:.4f}")
    print(f"    - Weighted Recall                : {rec_weighted:.4f}")
    print(f"    - Weighted F1-Score              : {f1_weighted:.4f}")
    print(f"    - Macro F1-Score                 : {f1_macro:.4f}")
    
    print("\n[3] Classification Detailed Report:")
    target_names = [DEMAND_LABELS[i] for i in sorted(list(set(y_test_clf)))]
    print(classification_report(y_test_clf, y_pred_clf, target_names=target_names, digits=4))
    
    print("[4] Confusion Matrix:")
    cm = confusion_matrix(y_test_clf, y_pred_clf)
    cm_df = pd.DataFrame(cm, index=[f"Actual {name}" for name in target_names], columns=[f"Pred {name}" for name in target_names])
    print(cm_df.to_string())

def evaluate_availability_model():
    print("\n" + "="*70)
    print("    SMARTPARK AI: AVAILABILITY PREDICTION MODEL EVALUATION")
    print("="*70)
    
    model_path = os.path.join(os.path.dirname(__file__), "..", "models", "availability_model.pkl")
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "parking_data.csv")
    
    if not os.path.exists(model_path):
        print(f"Error: Model not found at {model_path}. Please train first.")
        return
        
    bundle = joblib.load(model_path)
    preprocessor: ParkingDataPreprocessor = bundle["preprocessor"]
    model = bundle["model"]
    
    raw_df = pd.read_csv(data_path)
    horizon_df = generate_horizon_training_dataset(raw_df)
    
    X_base = preprocessor.transform(horizon_df)
    horizon_feature = horizon_df["horizon_hours"].values.reshape(-1, 1)
    avail_ratio_feature = (horizon_df["current_available_slots"] / horizon_df["total_slots"]).values.reshape(-1, 1)
    X = np.hstack([X_base, horizon_feature, avail_ratio_feature])
    
    y = horizon_df["target_available_slots"].values
    
    _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    rmse = np.sqrt(mean_squared_error(y_test, y_pred))
    r2 = r2_score(y_test, y_pred)
    
    print(f"\n[1] Available Slots Forecasting Metrics ({bundle.get('model_name', 'Model')}):")
    print(f"    - Mean Absolute Error (MAE)       : {mae:.4f} slots")
    print(f"    - Root Mean Squared Error (RMSE)  : {rmse:.4f} slots")
    print(f"    - Coefficient of Determination (R²): {r2:.4f}")
    
    # Benchmark against baseline
    mean_target = np.mean(y_test)
    print(f"    - Mean Test Slot Availability     : {mean_target:.2f} slots")
    print(f"    - Relative Error Percentage       : {(mae / max(1, mean_target)) * 100:.2f} %")

def run_all_evaluations():
    evaluate_demand_model()
    evaluate_availability_model()
    print("\n" + "="*70)
    print("           MODEL EVALUATION COMPLETED SUCCESSFULLY")
    print("="*70 + "\n")

if __name__ == "__main__":
    run_all_evaluations()
