@echo off

echo 🚀 Installing Smart Waste Management Simulator...

REM Install backend dependencies
echo 📦 Installing backend dependencies...
cd backend
call npm install
echo ✅ Backend dependencies installed

REM Install frontend dependencies
echo 📦 Installing frontend dependencies...
cd ..\frontend
call npm install
echo ✅ Frontend dependencies installed

echo.
echo ✅ Setup complete!
echo.
echo To start the simulator:
echo 1. Terminal 1: cd backend ^&^& npm run dev
echo 2. Terminal 2: cd frontend ^&^& npm run dev
echo 3. Open http://localhost:5173 in your browser
