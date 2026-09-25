@echo off
echo ===================================================
echo   SmartPark - Starting All 3 Microservices
echo ===================================================
echo.
echo [1/3] Starting Frontend Server on http://localhost:8080 ...
start "SmartPark Frontend (Port 8080)" cmd /k "python -m http.server 8080"

echo [2/3] Starting Backend Node API on http://localhost:5000 ...
start "SmartPark Backend API (Port 5000)" cmd /k "cd Backend && node server.js"

echo [3/3] Starting Python AI Microservice on http://localhost:8000 ...
start "SmartPark AI Service (Port 8000)" cmd /k "python -m uvicorn ai.api.app:app --host 127.0.0.1 --port 8000"

echo.
echo ===================================================
echo   All 3 services are running!
echo   Frontend: http://localhost:8080
echo   Backend:  http://localhost:5000
echo   AI API:   http://localhost:8000/docs
echo ===================================================
pause
