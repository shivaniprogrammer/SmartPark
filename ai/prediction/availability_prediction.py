"""
Availability Prediction module for SmartPark.
Loads the trained availability model bundle and forecasts available and occupied slots
across requested horizons (30 mins, 1 hour, 2 hours).
"""

import os
import joblib
import numpy as np
from datetime import datetime
from typing import Dict, Any, List, Optional

DEFAULT_AVAIL_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "models", "availability_model.pkl"
)

def compute_availability_level(available: int, total: int) -> str:
    if total <= 0:
        return "LOW"
    ratio = available / total
    if ratio >= 0.35:
        return "HIGH"
    elif ratio >= 0.15:
        return "MEDIUM"
    else:
        return "LOW"

class AvailabilityPredictor:
    def __init__(self, model_path: str = DEFAULT_AVAIL_MODEL_PATH):
        self.model_path = model_path
        self.bundle = None
        self.preprocessor = None
        self.model = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Availability model file not found at {self.model_path}. Train it via python ai/training/train_availability_model.py"
            )
        self.bundle = joblib.load(self.model_path)
        self.preprocessor = self.bundle["preprocessor"]
        self.model = self.bundle["model"]

    def _predict_single_horizon(self, input_data: Dict[str, Any], horizon_hours: float) -> int:
        total_slots = int(input_data.get("total_slots", 100))
        current_avail = int(input_data.get("current_available_slots", max(1, int(total_slots * 0.2))))
        
        # Prepare input data for preprocessor
        payload = input_data.copy()
        if "day_of_week" not in payload:
            payload["day_of_week"] = datetime.now().weekday()
        if "hour" not in payload:
            payload["hour"] = datetime.now().hour
            
        X_base = self.preprocessor.transform(payload)
        
        # Append horizon_hours and current_available_ratio
        horizon_val = np.array([[horizon_hours]])
        avail_ratio_val = np.array([[current_avail / max(1, total_slots)]])
        X_full = np.hstack([X_base, horizon_val, avail_ratio_val])
        
        pred_slots = float(self.model.predict(X_full)[0])
        # Bound predicted available slots within [0, total_slots]
        pred_slots = max(0, min(total_slots, int(round(pred_slots))))
        return pred_slots

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes raw dictionary:
        - location (str)
        - hour (int)
        - total_slots (int)
        - current_available_slots (int)
        - horizon_hours (float, optional, default=1.0)
        
        Returns:
        {
            "location": str,
            "total_slots": int,
            "current_available_slots": int,
            "predicted_available_slots": int,
            "predicted_occupied_slots": int,
            "availability": "HIGH" | "MEDIUM" | "LOW",
            "forecast_timeline": {
                "30_minutes": int,
                "1_hour": int,
                "2_hours": int
            }
        }
        """
        if self.bundle is None:
            self._load_model()
            
        total_slots = int(input_data.get("total_slots", 100))
        current_avail = int(input_data.get("current_available_slots", max(1, int(total_slots * 0.2))))
        horizon_hours = float(input_data.get("horizon_hours", 1.0))
        
        # Main target horizon prediction
        predicted_avail = self._predict_single_horizon(input_data, horizon_hours)
        predicted_occupied = total_slots - predicted_avail
        avail_level = compute_availability_level(predicted_avail, total_slots)
        
        # Multi-horizon timeline forecast
        timeline = {
            "30_minutes": self._predict_single_horizon(input_data, 0.5),
            "1_hour": self._predict_single_horizon(input_data, 1.0),
            "2_hours": self._predict_single_horizon(input_data, 2.0)
        }
        
        return {
            "location": input_data.get("location", "Chennai Mall"),
            "total_slots": total_slots,
            "current_available_slots": current_avail,
            "predicted_available_slots": predicted_avail,
            "predicted_occupied_slots": predicted_occupied,
            "availability": avail_level,
            "forecast_timeline": timeline
        }


# Singleton predictor instance
_avail_predictor_instance = None

def get_availability_predictor() -> AvailabilityPredictor:
    global _avail_predictor_instance
    if _avail_predictor_instance is None:
        _avail_predictor_instance = AvailabilityPredictor()
    return _avail_predictor_instance

def predict_availability(input_data: Dict[str, Any]) -> Dict[str, Any]:
    predictor = get_availability_predictor()
    return predictor.predict(input_data)
