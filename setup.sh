#!/bin/bash

echo "🚀 Installing Smart Waste Management Simulator..."

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install
echo "✅ Backend dependencies installed"

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd ../frontend
npm install
echo "✅ Frontend dependencies installed"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the simulator:"
echo "1. Terminal 1: cd backend && npm run dev"
echo "2. Terminal 2: cd frontend && npm run dev"
echo "3. Open http://localhost:5173 in your browser"
