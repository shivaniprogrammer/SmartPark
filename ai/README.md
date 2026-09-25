# SmartPark – AI + Prediction Intelligence Module

> **SmartPark** – *"Find Your Spot. Skip the Search."*  
> **Team**: Codeclashers  
> **Subsystem**: AI & Machine Learning Intelligence Layer

---

## 1. Directory Structure

```
ai/
├── data/
│   ├── parking_data.csv          # 12,960 realistic synthetic records across 6 location profiles
│   ├── generate_data.py          # Data generation script for development/demo
│   └── README.md                 # Dataset documentation and schema specifications
│
├── models/
│   ├── demand_model.pkl          # Trained Gradient Boosting & Random Forest demand bundle
│   └── availability_model.pkl    # Trained Random Forest multi-horizon availability bundle
│
├── training/
│   ├── train_demand_model.py     # Demand & occupancy regression/classification training
│   ├── train_availability_model.py # Multi-horizon future availability training
│   └── evaluate_models.py        # Comprehensive evaluation script (MAE, RMSE, R², F1, Confusion Matrix)
│
├── prediction/
│   ├── demand_prediction.py      # Demand & occupancy inference engine
│   ├── availability_prediction.py # Multi-horizon availability forecasting engine
│   └── recommendation.py         # Multi-factor smart parking scoring & ranking engine
│
├── utils/
│   ├── preprocessing.py          # Reusable Scikit-Learn ColumnTransformer & encoders
│   └── feature_engineering.py    # Cyclical trigonometric transforms, rush hour & domain flags
│
├── api/
│   └── app.py                    # Production FastAPI REST microservice
│
├── requirements.txt              # AI module dependencies
└── README.md                     # Setup, training, execution, and integration guide
```

---

## 2. Architecture & Backend Integration Flow

The AI module operates as an independent REST microservice. It provides decision intelligence to the backend and **never** connects directly to MongoDB or handles payment transactions.

```
┌─────────────────────────────────┐
│     React Frontend (User UI)    │
└────────────────┬────────────────┘
                 │ HTTP (REST)
                 ▼
┌─────────────────────────────────┐
│   Node.js / Express Backend     │  ◄── Handles Auth, DB (MongoDB), Bookings, Overstay, Payments
└────────────────┬────────────────┘
                 │ HTTP (JSON)
                 ▼
┌─────────────────────────────────┐
│     FastAPI AI Microservice     │  ◄── Runs on http://127.0.0.1:8000
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────┐
│   Scikit-Learn ML Models        │
│  - Demand Prediction            │
│  - Availability Forecasting     │
│  - Smart Ranking & Scoring      │
└─────────────────────────────────┘
```

---

## 3. Installation & Setup

### Prerequisites
- Python 3.10+ (tested on Python 3.13)
- `pip` package manager

### Step 1: Install Dependencies
Open your terminal in the project root and install the required packages:

```bash
pip install -r ai/requirements.txt
```

---

## 4. Model Training & Evaluation Commands

### Step 2 (Optional): Re-generate Dataset
To regenerate the synthetic parking dataset:
```bash
python ai/data/generate_data.py
```

### Step 3: Train Demand Prediction Model
Compares Linear Regression, Random Forest, and Gradient Boosting and exports `ai/models/demand_model.pkl`:
```bash
python ai/training/train_demand_model.py
```

### Step 4: Train Availability Prediction Model
Trains multi-horizon lookahead models (30m, 1h, 2h) and exports `ai/models/availability_model.pkl`:
```bash
python ai/training/train_availability_model.py
```

### Step 5: Evaluate Models
Computes MAE, RMSE, $R^2$, Accuracy, Precision, Recall, F1-score, and Confusion Matrices:
```bash
python ai/training/evaluate_models.py
```

---

## 5. Starting the FastAPI AI Service

Run the following command to start the FastAPI server:

```bash
uvicorn ai.api.app:app --host 0.0.0.0 --port 8000 --reload
```

- **API Base URL**: `http://localhost:8000`
- **Interactive Swagger Documentation**: `http://localhost:8000/docs`
- **Redoc Documentation**: `http://localhost:8000/redoc`
- **Health Check Endpoint**: `http://localhost:8000/health`

---

## 6. API Endpoints & Request/Response Examples

### 1. Demand Prediction (`POST /predict/demand`)

#### Request:
```json
POST http://localhost:8000/predict/demand
Content-Type: application/json

{
    "location": "Chennai Mall",
    "day_of_week": 6,
    "hour": 19,
    "historical_occupancy": 85.0,
    "total_slots": 100,
    "available_slots": 15
}
```

#### Response:
```json
{
    "demand": "HIGH",
    "predicted_occupancy": 86.95,
    "confidence": 0.88,
    "estimated_occupied_slots": 87,
    "estimated_available_slots": 13,
    "location": "Chennai Mall"
}
```

---

### 2. Future Availability Forecasting (`POST /predict/availability`)

#### Request:
```json
POST http://localhost:8000/predict/availability
Content-Type: application/json

{
    "location": "Chennai Mall",
    "hour": 19,
    "total_slots": 100,
    "current_available_slots": 15
}
```

#### Response:
```json
{
    "predicted_available_slots": 30,
    "availability": "MEDIUM",
    "location": "Chennai Mall",
    "total_slots": 100,
    "current_available_slots": 15,
    "predicted_occupied_slots": 70,
    "forecast_timeline": {
        "30_minutes": 29,
        "1_hour": 30,
        "2_hours": 33
    }
}
```

---

### 3. Smart Parking Recommendation (`POST /recommend`)

#### Request:
```json
POST http://localhost:8000/recommend
Content-Type: application/json

{
    "locations": [
        {
            "location": "Chennai Mall",
            "total_slots": 150,
            "current_available_slots": 35,
            "distance_km": 1.2,
            "price_per_hour": 50,
            "hour": 18
        },
        {
            "location": "T Nagar Commercial Hub",
            "total_slots": 120,
            "current_available_slots": 10,
            "distance_km": 0.8,
            "price_per_hour": 60,
            "hour": 18
        },
        {
            "location": "Velachery Metro Station",
            "total_slots": 200,
            "current_available_slots": 80,
            "distance_km": 3.5,
            "price_per_hour": 30,
            "hour": 18
        }
    ]
}
```

#### Response:
```json
{
    "total_candidates": 3,
    "top_recommendation": {
        "location": "Velachery Metro Station",
        "recommendation_score": 67.8,
        "predicted_available_slots": 80,
        "current_available_slots": 80,
        "total_slots": 200,
        "demand_level": "MEDIUM",
        "distance_km": 3.5,
        "price_per_hour": 30.0,
        "tags": [
            "TOP_PICK",
            "HIGH_AVAILABILITY",
            "BEST_PRICE"
        ],
        "score_breakdown": {
            "availability_score": 80.0,
            "distance_score": 46.2,
            "price_score": 100.0,
            "demand_score": 70.0
        }
    },
    "ranked_recommendations": [ ... ]
}
```

---

## 7. How Node.js / Express Backend Integrates the AI API

The Node.js developer can call the Python AI API using `axios` or standard `fetch`.

### Example Node.js Express Controller Integration:

```javascript
// backend/services/aiService.js
const axios = require('axios');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Fetch parking demand prediction from Python AI Service
 */
async function getParkingDemand(location, totalSlots, availableSlots, hour, dayOfWeek) {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/predict/demand`, {
            location: location,
            total_slots: totalSlots,
            available_slots: availableSlots,
            hour: hour !== undefined ? hour : new Date().getHours(),
            day_of_week: dayOfWeek !== undefined ? dayOfWeek : new Date().getDay()
        });
        return response.data;
    } catch (error) {
        console.error('Error contacting AI service for demand:', error.message);
        // Fallback default
        return { demand: 'MEDIUM', predicted_occupancy: 50.0, confidence: 0.5 };
    }
}

/**
 * Fetch smart ranked parking recommendations
 */
async function getSmartRecommendations(candidateLocations) {
    try {
        const response = await axios.post(`${AI_SERVICE_URL}/recommend`, {
            locations: candidateLocations
        });
        return response.data;
    } catch (error) {
        console.error('Error contacting AI service for recommendations:', error.message);
        return { ranked_recommendations: candidateLocations };
    }
}

module.exports = {
    getParkingDemand,
    getSmartRecommendations
};
```
