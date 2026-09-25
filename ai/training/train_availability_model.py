"""
Training script for SmartPark Availability Prediction Models.
Models future parking slot availability across different time horizons (e.g. 30m, 1h, 2h).
Saves the trained model bundle to ai/models/availability_model.pkl.
"""

import os
import sys
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import Ridge, LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai.utils.preprocessing import ParkingDataPreprocessor

def generate_horizon_training_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """
    Creates multi-step time series lookahead training instances from the hourly dataset.
    For each record at hour t, pairs with future records at t+1 and t+2 hours.
    """
    df = df.sort_values(by=["location", "date", "hour"]).reset_index(drop=True)
    records = []
    
    # Group by location and date
    grouped = df.groupby(["location", "date"])
    
    for (loc, date_val), group in grouped:
        group_records = group.to_dict('records')
        n = len(group_records)
        
        for i in range(n):
            current = group_records[i]
            
            # Forecast horizons: 0.5h (interpolated), 1.0h, 2.0h
            horizons = [0.5, 1.0, 2.0]
            
            for h in horizons:
                if h == 0.5:
                    if i + 1 < n:
                        next_row = group_records[i + 1]
                        future_occupied = (current["occupied_slots"] + next_row["occupied_slots"]) / 2.0
                    else:
                        future_occupied = current["occupied_slots"]
                elif h == 1.0:
                    if i + 1 < n:
                        future_occupied = group_records[i + 1]["occupied_slots"]
                    else:
                        future_occupied = current["occupied_slots"]
                elif h == 2.0:
                    if i + 2 < n:
                        future_occupied = group_records[i + 2]["occupied_slots"]
                    elif i + 1 < n:
                        future_occupied = group_records[i + 1]["occupied_slots"]
                    else:
                        future_occupied = current["occupied_slots"]
                        
                future_occupied = int(round(future_occupied))
                total = current["total_slots"]
                future_available = max(0, total - future_occupied)
                
                # Availability category
                avail_ratio = future_available / max(1, total)
                if avail_ratio >= 0.35:
                    avail_level = "HIGH"
                elif avail_ratio >= 0.15:
                    avail_level = "MEDIUM"
                else:
                    avail_level = "LOW"
                    
                records.append({
                    "location": current["location"],
                    "date": current["date"],
                    "hour": current["hour"],
                    "day_of_week": current["day_of_week"],
                    "total_slots": current["total_slots"],
                    "current_available_slots": current["available_slots"],
                    "current_occupied_slots": current["occupied_slots"],
                    "historical_occupancy": current.get("historical_occupancy", current["occupancy_rate"]),
                    "horizon_hours": h,
                    "target_available_slots": future_available,
                    "target_occupied_slots": future_occupied,
                    "target_availability_level": avail_level
                })
                
    return pd.DataFrame(records)

def train_availability_models():
    data_path = os.path.join(os.path.dirname(__file__), "..", "data", "parking_data.csv")
    models_dir = os.path.join(os.path.dirname(__file__), "..", "models")
    os.makedirs(models_dir, exist_ok=True)
    
    print(f"Loading dataset from: {data_path}")
    raw_df = pd.read_csv(data_path)
    
    print("Building multi-horizon lookahead dataset...")
    horizon_df = generate_horizon_training_dataset(raw_df)
    print(f"Lookahead dataset generated with {len(horizon_df)} instances.")
    
    # Preprocessing
    preprocessor = ParkingDataPreprocessor()
    X_base = preprocessor.fit_transform(horizon_df)
    
    # Append horizon_hours and current_available_ratio to feature matrix
    horizon_feature = horizon_df["horizon_hours"].values.reshape(-1, 1)
    avail_ratio_feature = (horizon_df["current_available_slots"] / horizon_df["total_slots"]).values.reshape(-1, 1)
    X = np.hstack([X_base, horizon_feature, avail_ratio_feature])
    
    y = horizon_df["target_available_slots"].values
    
    # Train / Test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    print("\n" + "="*50)
    print("EVALUATING AVAILABILITY FORECASTING MODELS")
    print("="*50)
    
    candidates = {
        "Ridge Regression": Ridge(alpha=1.0),
        "Random Forest Regressor": RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1),
        "Gradient Boosting Regressor": GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42)
    }
    
    best_name = None
    best_model = None
    best_r2 = -float('inf')
    best_metrics = {}
    
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        mae = mean_absolute_error(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        r2 = r2_score(y_test, y_pred)
        
        print(f"[{name}]")
        print(f"  MAE  : {mae:.2f} slots")
        print(f"  RMSE : {rmse:.2f} slots")
        print(f"  R²   : {r2:.4f}")
        
        if r2 > best_r2:
            best_r2 = r2
            best_name = name
            best_model = model
            best_metrics = {"MAE": mae, "RMSE": rmse, "R2": r2}
            
    print(f"\n--> Selected Best Model: {best_name} (R² = {best_r2:.4f}, MAE = {best_metrics['MAE']:.2f} slots)")
    
    # Save bundle
    avail_bundle = {
        "preprocessor": preprocessor,
        "model": best_model,
        "model_name": best_name,
        "metrics": best_metrics
    }
    
    output_path = os.path.join(models_dir, "availability_model.pkl")
    joblib.dump(avail_bundle, output_path)
    print("\n" + "="*50)
    print(f"Successfully saved trained availability model bundle to:\n{output_path}")
    print("="*50)
    
    return avail_bundle

if __name__ == "__main__":
    train_availability_models()
