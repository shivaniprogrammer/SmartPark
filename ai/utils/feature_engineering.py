"""
Feature Engineering utilities for SmartPark AI module.
Extracts temporal, cyclical, and domain-specific features for parking prediction.
"""

import numpy as np
import pandas as pd
from typing import Union, Dict, Any


def add_cyclical_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms hour and day_of_week into cyclical sine and cosine components.
    Ensures that 23:00 is close to 00:00 and Sunday (6) is close to Monday (0).
    """
    df = df.copy()
    if 'hour' in df.columns:
        hour_numeric = pd.to_numeric(df['hour'], errors='coerce').fillna(12.0).astype(float)
        df['hour_sin'] = np.sin(2.0 * np.pi * hour_numeric / 24.0)
        df['hour_cos'] = np.cos(2.0 * np.pi * hour_numeric / 24.0)
        
    if 'day_of_week' in df.columns:
        day_numeric = pd.to_numeric(df['day_of_week'], errors='coerce').fillna(0.0).astype(float)
        df['day_sin'] = np.sin(2.0 * np.pi * day_numeric / 7.0)
        df['day_cos'] = np.cos(2.0 * np.pi * day_numeric / 7.0)
        
    return df


def add_domain_flags(df: pd.DataFrame) -> pd.DataFrame:
    """
    Adds domain indicators such as is_weekend, is_rush_hour, and is_night.
    """
    df = df.copy()
    if 'day_of_week' in df.columns:
        day_numeric = pd.to_numeric(df['day_of_week'], errors='coerce').fillna(0).astype(int)
        df['is_weekend'] = day_numeric.isin([5, 6]).astype(int)
        
    if 'hour' in df.columns:
        hour_numeric = pd.to_numeric(df['hour'], errors='coerce').fillna(12).astype(int)
        # Rush hours: morning (8-10) and evening (17-20)
        df['is_rush_hour'] = hour_numeric.apply(
            lambda h: 1 if (8 <= h <= 10 or 17 <= h <= 20) else 0
        )
        # Night hours: 22:00 to 06:00
        df['is_night'] = hour_numeric.apply(
            lambda h: 1 if (h >= 22 or h <= 6) else 0
        )
        
    return df


def engineer_features(data: Union[pd.DataFrame, Dict[str, Any]]) -> pd.DataFrame:
    """
    Full feature engineering pipeline applicable to DataFrame or single record dictionary.
    """
    if isinstance(data, dict):
        df = pd.DataFrame([data])
    else:
        df = data.copy()
        
    df = add_cyclical_time_features(df)
    df = add_domain_flags(df)
    
    # Fill any missing historical features with safe defaults
    if 'historical_occupancy' in df.columns and 'occupancy_rate' in df.columns:
        df['historical_occupancy'] = df['historical_occupancy'].fillna(df['occupancy_rate'])
    elif 'historical_occupancy' not in df.columns and 'occupancy_rate' in df.columns:
        df['historical_occupancy'] = df['occupancy_rate']
        
    return df
