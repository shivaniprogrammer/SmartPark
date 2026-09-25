"""
Data preprocessing utilities for SmartPark AI module.
Ensures identical data cleaning, encoding, and scaling across training and inference.
"""

import os
import joblib
import numpy as np
import pandas as pd
from typing import Tuple, List, Optional, Union, Dict, Any
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

from .feature_engineering import engineer_features

# Demand label mappings
DEMAND_LABELS = ["LOW", "MEDIUM", "HIGH"]
DEMAND_LABEL_TO_INT = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}
INT_TO_DEMAND_LABEL = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}

SUPPORTED_LOCATIONS = [
    "Chennai Mall",
    "T Nagar Commercial Hub",
    "Velachery Metro Station",
    "OMR IT Park",
    "Anna Nagar Center",
    "Guindy Corporate Park"
]

NUMERICAL_FEATURES = [
    "hour",
    "day_of_week",
    "total_slots",
    "historical_occupancy",
    "hour_sin",
    "hour_cos",
    "day_sin",
    "day_cos",
    "is_weekend",
    "is_rush_hour",
    "is_night"
]

CATEGORICAL_FEATURES = [
    "location"
]


class ParkingDataPreprocessor:
    """
    Reusable Preprocessor for SmartPark models.
    Can fit on training DataFrames and transform inference request payloads.
    """
    def __init__(self):
        self.column_transformer: Optional[ColumnTransformer] = None
        self.is_fitted: bool = False
        self.feature_names: List[str] = []

    def _build_pipeline(self) -> ColumnTransformer:
        numeric_pipeline = Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler())
        ])
        
        categorical_pipeline = Pipeline([
            ('imputer', SimpleImputer(strategy='constant', fill_value='Chennai Mall')),
            ('ohe', OneHotEncoder(
                categories=[SUPPORTED_LOCATIONS],
                handle_unknown='ignore',
                sparse_output=False
            ))
        ])
        
        preprocessor = ColumnTransformer(
            transformers=[
                ('num', numeric_pipeline, NUMERICAL_FEATURES),
                ('cat', categorical_pipeline, CATEGORICAL_FEATURES)
            ],
            remainder='drop'
        )
        return preprocessor

    def prepare_raw_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Cleans and sets up input DataFrame before transformation.
        """
        data = df.copy()
        
        # Parse date if present
        if 'date' in data.columns and not pd.api.types.is_datetime64_any_dtype(data['date']):
            data['date'] = pd.to_datetime(data['date'], errors='coerce')
            if 'day_of_week' not in data.columns:
                data['day_of_week'] = data['date'].dt.dayofweek
        
        # If historical_occupancy is present, use it; otherwise compute default baseline
        if 'historical_occupancy' not in data.columns:
            if 'occupied_slots' in data.columns and 'total_slots' in data.columns and 'occupancy_rate' not in data.columns:
                data['historical_occupancy'] = (data['occupied_slots'] / data['total_slots']) * 100.0
            else:
                data['historical_occupancy'] = 50.0

        # Run feature engineering
        data = engineer_features(data)
        
        return data

    def fit(self, df: pd.DataFrame):
        """
        Fits the preprocessor on raw training data.
        """
        processed_df = self.prepare_raw_dataframe(df)
        self.column_transformer = self._build_pipeline()
        self.column_transformer.fit(processed_df)
        self.is_fitted = True
        return self

    def transform(self, data: Union[pd.DataFrame, Dict[str, Any]]) -> np.ndarray:
        """
        Transforms raw data into model-ready numpy array.
        """
        if not self.is_fitted or self.column_transformer is None:
            raise ValueError("Preprocessor has not been fitted yet. Call fit() or load a saved preprocessor.")
            
        if isinstance(data, dict):
            df = pd.DataFrame([data])
        else:
            df = data.copy()
            
        processed_df = self.prepare_raw_dataframe(df)
        
        # Ensure all required features exist
        for col in NUMERICAL_FEATURES + CATEGORICAL_FEATURES:
            if col not in processed_df.columns:
                if col in NUMERICAL_FEATURES:
                    processed_df[col] = 0.0
                else:
                    processed_df[col] = SUPPORTED_LOCATIONS[0]
                    
        return self.column_transformer.transform(processed_df)

    def fit_transform(self, df: pd.DataFrame) -> np.ndarray:
        """
        Fits and transforms in a single call.
        """
        self.fit(df)
        return self.transform(df)

    def save(self, file_path: str):
        """
        Saves fitted preprocessor to disk.
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        joblib.dump(self, file_path)

    @classmethod
    def load(cls, file_path: str) -> "ParkingDataPreprocessor":
        """
        Loads fitted preprocessor from disk.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Preprocessor file not found at: {file_path}")
        return joblib.load(file_path)


def encode_demand_target(demand_series: pd.Series) -> np.ndarray:
    """
    Converts 'LOW', 'MEDIUM', 'HIGH' to 0, 1, 2.
    """
    return demand_series.map(DEMAND_LABEL_TO_INT).fillna(0).astype(int).values


def decode_demand_target(pred_array: np.ndarray) -> List[str]:
    """
    Converts 0, 1, 2 to 'LOW', 'MEDIUM', 'HIGH'.
    """
    return [INT_TO_DEMAND_LABEL.get(val, "LOW") for val in pred_array]
