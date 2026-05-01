# Smart Waste Management Simulator

A comprehensive smart waste management system with real-time monitoring and sensor-based dustbin collection coordination.

## Features

### Frontend
- **Interactive Map Visualization**: Real-time map showing dustbin locations with fill level indicators
- **Responsive Dashboard**: Statistics, KPIs, and analytics with charts
- **Notification Panel**: Real-time alerts for critical dustbin levels and collection status
- **Control Panel**: Simulation controls with speed adjustment
- **Status Legend**: Color-coded dustbin status indicators
- **Real-time Updates**: WebSocket integration for live data sync

### Backend
- **REST API**: Complete API for dustbin management and authority coordination
- **WebSocket Server**: Real-time data streaming to connected clients
- **Simulation Engine**: Dynamic dustbin fill level simulation
- **Authority Dispatch System**: Automatic dispatch of collection vehicles for critical bins
- **Statistics Tracking**: Real-time system statistics and metrics

## Project Structure

```
IndustrialSimulator/
├── frontend/              # React + TypeScript frontend application
│   ├── src/
│   │   ├── components/   # React components (Map, Dashboard, Controls)
│   │   ├── services/     # API service layer
│   │   ├── store/        # Zustand state management
│   │   ├── App.tsx       # Main application component
│   │   └── types.ts      # TypeScript interfaces
│   ├── index.html        # HTML entry point
│   ├── vite.config.ts    # Vite configuration
│   ├── tsconfig.json     # TypeScript configuration
│   └── package.json      # Dependencies
│
└── backend/              # Node.js + Express backend
    ├── src/
    │   ├── server.ts     # Express server and simulation engine
    │   ├── types.ts      # TypeScript interfaces
    │   └── utils.ts      # Utility functions
    ├── tsconfig.json     # TypeScript configuration
    └── package.json      # Dependencies
```

## Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Install Frontend Dependencies**
```bash
cd frontend
npm install
```

2. **Install Backend Dependencies**
```bash
cd ../backend
npm install
```

## Running the Application

### Start Backend Server
```bash
cd backend
npm run dev
```
The backend will start on `http://localhost:3001`

### Start Frontend Development Server
In a new terminal:
```bash
cd frontend
npm run dev
```
The frontend will start on `http://localhost:5173`

Open your browser and navigate to `http://localhost:5173` to access the simulator.

## API Endpoints

### Dustbins
- `GET /api/dustbins` - Get all dustbins
- `GET /api/dustbins/:id` - Get specific dustbin

### Authorities
- `GET /api/authorities` - Get all authorities
- `POST /api/authorities/dispatch` - Dispatch authority to dustbin

### Simulation
- `POST /api/simulation/start` - Start simulation
- `POST /api/simulation/stop` - Stop simulation
- `POST /api/simulation/speed` - Set simulation speed
- `GET /api/simulation/stats` - Get simulation statistics
- `POST /api/simulation/reset` - Reset simulation

## WebSocket Events

The application uses WebSocket for real-time updates:
- `dustbin-update` - Updated dustbin data
- `stats-update` - Updated statistics
- `notification` - New notification
- `authorities-update` - Updated authority status

## How the Simulator Works

1. **Dustbin Monitoring**: Dustbins fill up at a variable rate based on simulated sensor data
2. **Status Levels**:
   - **Empty** (0-49%): Green - Normal operation
   - **Warning** (50-79%): Yellow - Monitor required
   - **Critical** (80-100%): Red - Collection needed
   - **Collecting**: Blue - Currently being emptied

3. **Authority Dispatch**: When a bin reaches critical level, the system automatically assigns an available collection vehicle
4. **Collection**: The assigned authority vehicle empties the bin, and it becomes available for other locations
5. **Real-time Updates**: All changes are broadcast to connected clients via WebSocket

## Technologies Used

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Leaflet** - Map library
- **React-Leaflet** - React wrapper for Leaflet
- **Zustand** - State management
- **Recharts** - Chart library
- **Axios** - HTTP client
- **Lucide React** - Icons

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **WebSocket** - Real-time communication
- **UUID** - ID generation
- **CORS** - Cross-origin support

## Customization

### Adjust Simulation Parameters
Edit `backend/src/server.ts` to modify:
- Number of dustbins
- Dustbin locations
- Fill rate
- Authority count
- Fill level thresholds

### Modify Map Center
Edit `frontend/src/components/MapView.tsx` to change the default map center location.

### Customize Styling
All components use CSS modules. Edit the corresponding `.css` files to customize appearance.

## Performance Considerations

- **Real-time Updates**: Updates are sent at 500ms intervals when simulation is running
- **Map Optimization**: Uses efficient Leaflet markers with custom SVG icons
- **State Management**: Zustand for lightweight, efficient state updates
- **Backend**: Uses in-memory state for fast operations

## Future Enhancements

- [ ] Historical data and analytics
- [ ] Predictive fill level forecasting
- [ ] Multi-city support
- [ ] Route optimization for collection vehicles
- [ ] Mobile app version
- [ ] Integration with real IoT sensors
- [ ] Machine learning for pattern detection
- [ ] 3D visualization

## License

MIT License - Feel free to use this project for educational and commercial purposes.

## Support

For issues or questions, please refer to the code documentation or create an issue in the repository.
