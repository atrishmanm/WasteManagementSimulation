# Start the Waste Management Simulation

Write-Host "🚀 Starting Smart Waste Management Simulator..." -ForegroundColor Cyan

# Start Backend
Write-Host "📦 Starting Backend Server on http://localhost:3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; npm run dev"

# Start Frontend
Write-Host "🎨 Starting Frontend Development Server on http://localhost:5173..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "✅ Both servers are starting in separate windows." -ForegroundColor Yellow
Write-Host "Happy Simulating!" -ForegroundColor Cyan
