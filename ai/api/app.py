"""
SmartPark AI Prediction Service - FastAPI Application.
Exposes RESTful endpoints for parking demand prediction, availability forecasting,
and intelligent parking recommendations.
"""

import os
import sys
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from ai.prediction.demand_prediction import get_demand_predictor, predict_demand
from ai.prediction.availability_prediction import get_availability_predictor, predict_availability
from ai.prediction.recommendation import recommend_parking

app = FastAPI(
    title="SmartPark AI Intelligence API",
    description="Machine Learning service for SmartPark demand prediction, future availability forecasting, and smart recommendations.",
    version="1.0.0"
)

# Enable CORS for frontend / backend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================================
# PYDANTIC SCHEMAS
# =====================================================================

class DemandRequest(BaseModel):
    location: str = Field(..., example="Chennai Mall", description="Name of the parking location")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, example=6, description="0=Monday, 6=Sunday")
    hour: Optional[int] = Field(None, ge=0, le=23, example=19, description="Hour of the day (0-23)")
    date: Optional[str] = Field(None, example="2026-06-01", description="Date string YYYY-MM-DD")
    historical_occupancy: Optional[float] = Field(None, ge=0.0, le=100.0, example=85.0, description="Past occupancy percentage")
    total_slots: Optional[int] = Field(100, gt=0, example=100, description="Total parking capacity")
    available_slots: Optional[int] = Field(None, ge=0, example=15, description="Current available slots")


class DemandResponse(BaseModel):
    demand: str = Field(..., example="HIGH", description="Demand level: LOW | MEDIUM | HIGH")
    predicted_occupancy: float = Field(..., example=92.0, description="Predicted occupancy percentage (0-100%)")
    confidence: float = Field(..., example=0.87, description="Model prediction confidence (0.0 to 1.0)")
    estimated_occupied_slots: Optional[int] = Field(None, example=92)
    estimated_available_slots: Optional[int] = Field(None, example=8)
    location: Optional[str] = Field(None, example="Chennai Mall")


class AvailabilityRequest(BaseModel):
    location: str = Field(..., example="Chennai Mall", description="Name of the parking location")
    hour: Optional[int] = Field(None, ge=0, le=23, example=19, description="Hour of the day (0-23)")
    day_of_week: Optional[int] = Field(None, ge=0, le=6, example=6, description="0=Monday, 6=Sunday")
    total_slots: int = Field(100, gt=0, example=100, description="Total slot capacity")
    current_available_slots: int = Field(..., ge=0, example=15, description="Current number of free slots")
    horizon_hours: Optional[float] = Field(1.0, gt=0, le=24.0, example=1.0, description="Lookahead horizon in hours")

    @field_validator("current_available_slots")
    def validate_available_slots(cls, v, info):
        total = info.data.get("total_slots", 100)
        if v > total:
            raise ValueError(f"current_available_slots ({v}) cannot exceed total_slots ({total})")
        return v


class AvailabilityResponse(BaseModel):
    predicted_available_slots: int = Field(..., example=8, description="Forecasted free slots")
    availability: str = Field(..., example="LOW", description="Availability category: HIGH | MEDIUM | LOW")
    location: Optional[str] = Field(None, example="Chennai Mall")
    total_slots: Optional[int] = Field(None, example=100)
    current_available_slots: Optional[int] = Field(None, example=15)
    predicted_occupied_slots: Optional[int] = Field(None, example=92)
    forecast_timeline: Optional[Dict[str, int]] = Field(
        None,
        example={"30_minutes": 15, "1_hour": 8, "2_hours": 5},
        description="Multi-horizon availability timeline"
    )


class LocationCandidate(BaseModel):
    location: str = Field(..., example="Chennai Mall")
    total_slots: int = Field(100, gt=0, example=150)
    current_available_slots: int = Field(..., ge=0, example=35)
    distance_km: Optional[float] = Field(None, ge=0.0, example=1.2)
    price_per_hour: Optional[float] = Field(None, ge=0.0, example=50.0)
    hour: Optional[int] = Field(None, ge=0, le=23, example=18)
    day_of_week: Optional[int] = Field(None, ge=0, le=6, example=5)


class RecommendationRequest(BaseModel):
    locations: List[LocationCandidate] = Field(..., min_length=1, description="List of parking locations to evaluate")
    user_preferences: Optional[Dict[str, Any]] = Field(None, description="Optional user weighting preferences")


class RankedLocation(BaseModel):
    location: str
    recommendation_score: float
    predicted_available_slots: int
    current_available_slots: int
    total_slots: int
    demand_level: str
    distance_km: Optional[float] = None
    price_per_hour: Optional[float] = None
    tags: List[str]
    forecast_timeline: Optional[Dict[str, int]] = None
    score_breakdown: Dict[str, float]


class RecommendationResponse(BaseModel):
    total_candidates: int
    top_recommendation: Optional[RankedLocation]
    ranked_recommendations: List[RankedLocation]


# =====================================================================
# API ENDPOINTS
# =====================================================================

@app.get("/", tags=["System"])
def root():
    return {
        "service": "SmartPark AI Prediction API",
        "status": "online",
        "docs_url": "/docs",
        "endpoints": [
            "POST /predict/demand",
            "POST /predict/availability",
            "POST /recommend",
            "GET /health"
        ]
    }


@app.get("/health", tags=["System"])
def health_check():
    models_status = {}
    try:
        get_demand_predictor()
        models_status["demand_model"] = "loaded"
    except Exception as e:
        models_status["demand_model"] = f"unavailable ({str(e)})"

    try:
        get_availability_predictor()
        models_status["availability_model"] = "loaded"
    except Exception as e:
        models_status["availability_model"] = f"unavailable ({str(e)})"

    all_ready = all(v == "loaded" for v in models_status.values())
    return {
        "status": "healthy" if all_ready else "degraded",
        "models": models_status
    }


@app.post("/predict/demand", response_model=DemandResponse, tags=["Prediction"])
def api_predict_demand(payload: DemandRequest):
    """
    Predicts parking demand level (LOW/MEDIUM/HIGH), occupancy percentage, and model confidence.
    """
    try:
        result = predict_demand(payload.model_dump())
        return DemandResponse(
            demand=result["demand"],
            predicted_occupancy=result["predicted_occupancy"],
            confidence=result["confidence"],
            estimated_occupied_slots=result.get("estimated_occupied_slots"),
            estimated_available_slots=result.get("estimated_available_slots"),
            location=result.get("location")
        )
    except FileNotFoundError as fnf:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(fnf)
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Prediction error: {str(ex)}"
        )


@app.post("/predict/availability", response_model=AvailabilityResponse, tags=["Prediction"])
def api_predict_availability(payload: AvailabilityRequest):
    """
    Predicts future parking slot availability and multi-horizon timeline.
    """
    try:
        result = predict_availability(payload.model_dump())
        return AvailabilityResponse(
            predicted_available_slots=result["predicted_available_slots"],
            availability=result["availability"],
            location=result.get("location"),
            total_slots=result.get("total_slots"),
            current_available_slots=result.get("current_available_slots"),
            predicted_occupied_slots=result.get("predicted_occupied_slots"),
            forecast_timeline=result.get("forecast_timeline")
        )
    except FileNotFoundError as fnf:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(fnf)
        )
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Availability prediction error: {str(ex)}"
        )


@app.post("/recommend", response_model=RecommendationResponse, tags=["Recommendation"])
def api_recommend_parking(payload: RecommendationRequest):
    """
    Ranks candidate parking locations using composite AI scoring.
    """
    try:
        locations_data = [loc.model_dump() for loc in payload.locations]
        result = recommend_parking(locations_data, payload.user_preferences)
        return result
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Recommendation scoring error: {str(ex)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
