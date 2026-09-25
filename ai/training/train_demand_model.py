"""
Training script for SmartPark Demand Prediction Models.
Compares Linear/Logistic Regression, Random Forest, and Gradient Boosting.
Saves the best preprocessor and models into ai/models/demand_model.pkl.
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier, GradientBoostingRegressor, GradientBoostingClassifier
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score, accuracy_score, f1_score, classification_report

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai.utils.preprocessing import (
    ParkingDataPreprocessor,
    encode_demand_target,
    decode_demand_target,
    DEMAND_LABELS
)

def train_demand_models():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "parking_data.csv")
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    print(f"Loading dataset from: {data_path}")
    df = pd.read_csv(data_path)
    
    # Preprocessing
    preprocessor = ParkingDataPreprocessor()
    X = preprocessor.fit_transform(df)
    
    # Target variables
    y_reg = df['occupancy_rate'].values
    y_clf = encode_demand_target(df['demand_level'])
    
    # Train/Test Split
    X_train, X_test, y_train_reg, y_test_reg, y_train_clf, y_test_clf = train_test_split(
        X, y_reg, y_clf, test_size=0.2, random_state=42, stratify=y_clf
    )
    
    print("\n" + "="*50)
    print("1. EVALUATING REGRESSION MODELS (Occupancy Rate %)")
    print("="*50)
    
    reg_candidates = {
        "Linear Regression": LinearRegression(),
        "Random Forest Regressor": RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1),
        "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
    }
    
    best_reg_name = None
    best_reg_model = None
    best_reg_r2 = -float('inf')
    best_reg_metrics = {}
    
    for name, model in reg_candidates.items():
        model.fit(X_train, y_train_reg)
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test_reg, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test_reg, y_pred))
        r2 = r2_score(y_test_reg, y_pred)
        
        print(f"[{name}]")
        print(f"  MAE  : {mae:.3f}%")
        print(f"  RMSE : {rmse:.3f}%")
        print(f"  R²   : {r2:.4f}")
        
        if r2 > best_reg_r2:
            best_reg_r2 = r2
            best_reg_name = name
            best_reg_model = model
            best_reg_metrics = {"MAE": mae, "RMSE": rmse, "R2": r2}
            
    print(f"\n--> Selected Best Regressor: {best_reg_name} (R² = {best_reg_r2:.4f})")
    
    print("\n" + "="*50)
    print("2. EVALUATING CLASSIFICATION MODELS (Demand Level)")
    print("="*50)
    
    clf_candidates = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Random Forest Classifier": RandomForestClassifier(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1),
        "Gradient Boosting Classifier": GradientBoostingClassifier(n_estimators=100, max_depth=5, random_state=42)
    }
    
    best_clf_name = None
    best_clf_model = None
    best_clf_f1 = -float('inf')
    best_clf_metrics = {}
    
    for name, model in clf_candidates.items():
        model.fit(X_train, y_train_clf)
        y_pred = model.predict(X_test)
        acc = accuracy_score(y_test_clf, y_pred)
        f1 = f1_score(y_test_clf, y_pred, average='weighted')
        
        print(f"[{name}]")
        print(f"  Accuracy : {acc * 100:.2f}%")
        print(f"  F1-Score : {f1:.4f}")
        
        if f1 > best_clf_f1:
            best_clf_f1 = f1
            best_clf_name = name
            best_clf_model = model
            best_clf_metrics = {"Accuracy": acc, "F1_weighted": f1}
            
    print(f"\n--> Selected Best Classifier: {best_clf_name} (F1 = {best_clf_f1:.4f})")
    
    # Save the bundle
    demand_bundle = {
        "preprocessor": preprocessor,
        "regressor": best_reg_model,
        "classifier": best_clf_model,
        "regressor_name": best_reg_name,
        "classifier_name": best_clf_name,
        "reg_metrics": best_reg_metrics,
        "clf_metrics": best_clf_metrics
    }
    
    output_model_path = os.path.join(models_dir, "demand_model.pkl")
    joblib.dump(demand_bundle, output_model_path)
    print("\n" + "="*50)
    print(f"Successfully saved trained demand model bundle to:\n{output_model_path}")
    print("="*50)
    
    return demand_bundle

if __name__ == "__main__":
    train_demand_models()
