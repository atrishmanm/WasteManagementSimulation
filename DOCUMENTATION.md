# Smart Waste Management Simulator - Project Documentation

## 📋 System Overview
This project is a comprehensive full-stack simulation system designed to monitor urban waste management. It simulates dustbin fill levels across a city and coordinates authority dispatch for collection operations in real-time.

---

## ✨ Core Features

### 🗺️ Interactive Map Visualization
- Real-time map showing dustbin locations using Leaflet.
- Color-coded markers (Green/Yellow/Red/Blue) representing fill levels.
- Authority (collection vehicle) locations and routes.
- Clickable markers for detailed bin information.

### 📊 Comprehensive Dashboard
- **KPI Cards**: Real-time counts of total bins, average fill level, critical bins, and total collections.
- **Visual Analytics**: Status distribution pie charts and top 10 fill level bar charts.
- **Dynamic Updates**: All charts update every 500ms via WebSockets.

### 🚨 Smart Notification System
- Real-time alerts for bins reaching critical levels (≥80%).
- Success notifications for completed collections.
- Notification history with timestamps and unread badges.

### 🎮 Simulation Controls
- **Play/Pause**: Start or halt the simulation engine.
- **Speed Control**: Adjust simulation speed from 0.5x to 5x.
- **Reset**: Restore the system to its initial state.

### 🤖 Autonomous Authority Dispatch
- Automatic detection of critical dustbins.
- Intelligent vehicle assignment and route management.
- Dynamic emptying of bins upon vehicle arrival.

---

## 🏗️ System Architecture

### Frontend Architecture (React + TypeScript)
- **Component Hierarchy**:
    - `MapView`: Central panel rendering the Leaflet map.
    - `Dashboard`: Right panel displaying KPIs and Recharts.
    - `ControlPanel`: Left top panel for simulation state and speed.
    - `NotificationPanel`: Left bottom panel for real-time alerts.
- **State Management**: Uses **Zustand** to manage global state (dustbins, authorities, notifications, simulation status).
- **Real-time Sync**: Connects to the backend via WebSockets for sub-second data synchronization.

### Backend Architecture (Node.js + Express)
- **Simulation Engine**: A core loop that runs in-memory, incrementally filling bins and managing vehicle dispatches.
- **REST API**: Handles initial data fetching and control commands.
- **WebSocket Server**: Broadcasts state changes to all connected clients.
- **Status Lifecycle**:
    - `Empty` (0-49%) 🟢
    - `Warning` (50-79%) 🟡
    - `Critical` (80-100%) 🔴 → Dispatches Authority
    - `Collecting` 🔵 → Bin emptied → Returns to `Empty`.

---

## 🛠️ Technical Stack
- **Frontend**: React 18, TypeScript, Vite, Leaflet, Zustand, Recharts, Axios, Lucide React.
- **Backend**: Node.js, Express, TypeScript, WebSocket, UUID.

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### 1. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 2. Run the Application
1. **Start Backend**: `cd backend && npm run dev` (Runs on http://localhost:3001)
2. **Start Frontend**: `cd frontend && npm run dev` (Runs on http://localhost:5173)

---

## ⚙️ Customization Guide

### Adjusting Locations
Edit `backend/src/server.ts` and modify the `locations` array to change the simulation coordinates.

### Modifying Fill Rates
In `backend/src/server.ts`, adjust the `fillIncrease` multiplier in the simulation loop.

### UI Styling
Each component has a corresponding CSS module (e.g., `MapView.css`, `Dashboard.css`). Modify these to change the look and feel.

---

## 🔮 Future Roadmap
- **Persistence**: Integration with MongoDB/PostgreSQL for historical data.
- **Optimization**: AI-based route optimization for collection vehicles.
- **Mobile**: Dedicated React Native app for collection drivers.
- **IoT**: Integration with real hardware sensors via MQTT.
