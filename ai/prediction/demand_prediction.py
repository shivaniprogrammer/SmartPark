"""
Demand Prediction module for SmartPark.
Loads the trained demand model bundle and infers occupancy & demand category.
"""

import os
import joblib
import numpy as np
from typing import Dict, Any, Union
from ai.utils.preprocessing import INT_TO_DEMAND_LABEL, DEMAND_LABEL_TO_INT

DEFAULT_MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "models", "demand_model.pkl"
)

class DemandPredictor:
    def __init__(self, model_path: str = DEFAULT_MODEL_PATH):
        self.model_path = model_path
        self.bundle = None
        self.preprocessor = None
        self.regressor = None
        self.classifier = None
        self._load_model()

    def _load_model(self):
        if not os.path.exists(self.model_path):
            raise FileNotFoundError(
                f"Demand model file not found at {self.model_path}. Please train the model first using python ai/training/train_demand_model.py"
            )
        self.bundle = joblib.load(self.model_path)
        self.preprocessor = self.bundle["preprocessor"]
        self.regressor = self.bundle["regressor"]
        self.classifier = self.bundle["classifier"]

    def predict(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Takes raw dictionary with keys:
        - location (str)
        - hour (int)
        - day_of_week (int, optional if date provided)
        - date (str, optional)
        - historical_occupancy (float, optional)
        - total_slots (int, optional, default=100)
        - available_slots (int, optional)
        
        Returns:
        {
            "demand": "LOW" | "MEDIUM" | "HIGH",
            "predicted_occupancy": float (%),
            "confidence": float (0.0 to 1.0),
            "estimated_occupied_slots": int,
            "estimated_available_slots": int
        }
        """
        if self.bundle is None:
            self._load_model()

        # Transform input using the fitted preprocessor
        X_input = self.preprocessor.transform(input_data)
        
        # Predict continuous occupancy rate %
        pred_occupancy = float(self.regressor.predict(X_input)[0])
        pred_occupancy = max(0.0, min(100.0, round(pred_occupancy, 2)))
        
        # Predict classification label & confidence
        pred_class_idx = int(self.classifier.predict(X_input)[0])
        pred_demand = INT_TO_DEMAND_LABEL.get(pred_class_idx, "MEDIUM")
        
        # Confidence score from predicted class probabilities
        if hasattr(self.classifier, "predict_proba"):
            probs = self.classifier.predict_proba(X_input)[0]
            confidence = float(np.max(probs))
        else:
            confidence = 0.85
            
        confidence = round(confidence, 2)
        
        # Calculate slot counts if total_slots is provided
        total_slots = int(input_data.get("total_slots", 100))
        estimated_occupied = int(round((pred_occupancy / 100.0) * total_slots))
        estimated_occupied = max(0, min(estimated_occupied, total_slots))
        estimated_available = total_slots - estimated_occupied

        return {
            "demand": pred_demand,
            "predicted_occupancy": pred_occupancy,
            "confidence": confidence,
            "estimated_occupied_slots": estimated_occupied,
            "estimated_available_slots": estimated_available,
            "location": input_data.get("location", "Chennai Mall")
        }


# Singleton predictor instance for efficient in-memory API usage
_predictor_instance = None

def get_demand_predictor() -> DemandPredictor:
    global _predictor_instance
    if _predictor_instance is None:
        _predictor_instance = DemandPredictor()
    return _predictor_instance

def predict_demand(input_data: Dict[str, Any]) -> Dict[str, Any]:
    predictor = get_demand_predictor()
    return predictor.predict(input_data)
