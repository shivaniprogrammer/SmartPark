# SmartPark All-in-One Startup Script (PowerShell)
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  SmartPark - Starting All 3 Microservices" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1/3] Starting Frontend Server on http://localhost:8080 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python -m http.server 8080"

Write-Host "[2/3] Starting Backend Node API on http://localhost:5000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\Backend'; node server.js"

Write-Host "[3/3] Starting Python AI Microservice on http://localhost:8000 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot'; python -m uvicorn ai.api.app:app --host 127.0.0.1 --port 8000"

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  All 3 services are running!" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:8080" -ForegroundColor White
Write-Host "  Backend:  http://localhost:5000" -ForegroundColor White
Write-Host "  AI API:   http://localhost:8000/docs" -ForegroundColor White
Write-Host "===================================================" -ForegroundColor Green
