"""
Smart Parking Recommendation and Scoring Engine for SmartPark.
Computes multi-factor intelligence scores based on predicted availability,
current occupancy, distance, price, and demand level.
"""

import math
from typing import List, Dict, Any, Optional
from .demand_prediction import predict_demand
from .availability_prediction import predict_availability

class RecommendationEngine:
    def __init__(
        self,
        weight_availability: float = 0.35,
        weight_distance: float = 0.30,
        weight_price: float = 0.20,
        weight_demand: float = 0.15
    ):
        self.w_avail = weight_availability
        self.w_dist = weight_distance
        self.w_price = weight_price
        self.w_demand = weight_demand

    def _score_availability(self, predicted_available: int, total_slots: int) -> float:
        if total_slots <= 0:
            return 0.0
        ratio = predicted_available / total_slots
        # Scaled from 0.0 to 100.0 with diminishing returns past 50% free slots
        score = min(100.0, (ratio / 0.50) * 100.0)
        return max(0.0, score)

    def _score_distance(self, distance_km: Optional[float]) -> float:
        if distance_km is None or distance_km < 0:
            return 75.0  # Neutral score when distance is omitted
        # Decay function: 0 km = 100, 3 km ~ 70, 10 km ~ 33
        return 100.0 / (1.0 + (distance_km / 3.0))

    def _score_price(self, price_per_hour: Optional[float], all_prices: List[float]) -> float:
        if price_per_hour is None or price_per_hour <= 0:
            return 75.0  # Neutral score when price is omitted
        valid_prices = [p for p in all_prices if p is not None and p > 0]
        if not valid_prices:
            return 75.0
        min_p, max_p = min(valid_prices), max(valid_prices)
        if max_p == min_p:
            return 80.0
        # Invert: cheapest gets 100, most expensive gets 40
        normalized = 1.0 - ((price_per_hour - min_p) / (max_p - min_p))
        return 40.0 + (normalized * 60.0)

    def _score_demand(self, demand_level: str) -> float:
        # LOW demand means easily accessible (100), HIGH demand is crowded (40)
        mapping = {"LOW": 100.0, "MEDIUM": 70.0, "HIGH": 40.0}
        return mapping.get(demand_level.upper(), 60.0)

    def recommend(
        self,
        locations: List[Dict[str, Any]],
        user_preferences: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Ranks a list of candidate parking facilities.
        Each item in `locations` can include:
        - location (str)
        - total_slots (int)
        - current_available_slots (int)
        - distance_km (float, optional)
        - price_per_hour (float, optional)
        - hour (int, optional)
        - day_of_week (int, optional)
        
        Returns sorted recommendations with scores, reasoning, and smart tags.
        """
        if not locations:
            return {"recommendations": [], "top_recommendation": None, "total_candidates": 0}

        all_prices = [loc.get("price_per_hour") for loc in locations if loc.get("price_per_hour") is not None]
        scored_locations = []

        for loc in locations:
            loc_name = loc.get("location", "Unknown Location")
            total_slots = int(loc.get("total_slots", 100))
            current_avail = int(loc.get("current_available_slots", int(total_slots * 0.2)))
            dist_km = loc.get("distance_km")
            price_hr = loc.get("price_per_hour")
            hour = loc.get("hour", 12)
            day_of_week = loc.get("day_of_week", 0)

            # AI Demand Prediction
            try:
                demand_res = predict_demand({
                    "location": loc_name,
                    "hour": hour,
                    "day_of_week": day_of_week,
                    "total_slots": total_slots,
                    "available_slots": current_avail
                })
                demand_level = demand_res.get("demand", "MEDIUM")
            except Exception:
                demand_level = "MEDIUM"

            # AI Availability Prediction
            try:
                avail_res = predict_availability({
                    "location": loc_name,
                    "hour": hour,
                    "total_slots": total_slots,
                    "current_available_slots": current_avail
                })
                pred_avail = avail_res.get("predicted_available_slots", current_avail)
                timeline = avail_res.get("forecast_timeline", {})
            except Exception:
                pred_avail = current_avail
                timeline = {}

            # Multi-factor Component Scores
            s_avail = self._score_availability(pred_avail, total_slots)
            s_dist = self._score_distance(dist_km)
            s_price = self._score_price(price_hr, all_prices)
            s_demand = self._score_demand(demand_level)

            final_score = (
                (s_avail * self.w_avail) +
                (s_dist * self.w_dist) +
                (s_price * self.w_price) +
                (s_demand * self.w_demand)
            )
            final_score = round(final_score, 1)

            # Generate Smart Tags
            tags = []
            if pred_avail >= total_slots * 0.35:
                tags.append("HIGH_AVAILABILITY")
            if dist_km is not None and dist_km <= 1.5:
                tags.append("NEARBY")
            if demand_level == "HIGH":
                tags.append("HIGH_DEMAND_BOOK_SOON")
            if price_hr is not None and all_prices and price_hr == min(all_prices):
                tags.append("BEST_PRICE")

            scored_locations.append({
                "location": loc_name,
                "recommendation_score": final_score,
                "predicted_available_slots": pred_avail,
                "current_available_slots": current_avail,
                "total_slots": total_slots,
                "demand_level": demand_level,
                "distance_km": dist_km,
                "price_per_hour": price_hr,
                "tags": tags,
                "forecast_timeline": timeline,
                "score_breakdown": {
                    "availability_score": round(s_avail, 1),
                    "distance_score": round(s_dist, 1),
                    "price_score": round(s_price, 1),
                    "demand_score": round(s_demand, 1)
                }
            })

        # Rank descending by composite recommendation score
        scored_locations.sort(key=lambda x: x["recommendation_score"], reverse=True)
        
        # Tag top pick
        if scored_locations:
            scored_locations[0]["tags"].insert(0, "TOP_PICK")

        return {
            "total_candidates": len(scored_locations),
            "top_recommendation": scored_locations[0] if scored_locations else None,
            "ranked_recommendations": scored_locations
        }


# Singleton engine instance
_engine_instance = None

def get_recommendation_engine() -> RecommendationEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = RecommendationEngine()
    return _engine_instance

def recommend_parking(locations: List[Dict[str, Any]], user_preferences: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    engine = get_recommendation_engine()
    return engine.recommend(locations, user_preferences)
