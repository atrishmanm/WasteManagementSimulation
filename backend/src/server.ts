const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { DustbinData, Authority, Notification, SimulationStats, Location } = require('./types');

const app = express();
const PORT = process.env.PORT || 3001;

const BILLING_RATE_PER_KG = 4.5;
const GREEN_POINTS_BASE = 10;
const GREEN_POINTS_WEIGHT_FACTOR = 2;

app.use(cors());
app.use(express.json());

// Simulation state
const state = {
  dustbins: [],
  authorities: [],
  isRunning: false,
  speed: 1,
  stats: {
    totalDustbins: 0,
    emptyBins: 0,
    warningBins: 0,
    criticalBins: 0,
    collectingBins: 0,
    averageFillLevel: 0,
    totalCollections: 0,
  },
  notifications: [],
};

const calculateGreenPoints = (weightKg: number): number =>
  Math.max(1, Math.round(GREEN_POINTS_BASE - weightKg * GREEN_POINTS_WEIGHT_FACTOR));

// Initialize dustbins and authorities
const initializeSimulation = () => {
  // Create dustbins at various locations in Seoul, South Korea
  const locations: Location[] = [
    { latitude: 37.5665, longitude: 126.978 },
    { latitude: 37.5704, longitude: 126.992 },
    { latitude: 37.5512, longitude: 126.9882 },
    { latitude: 37.5796, longitude: 126.977 },
    { latitude: 37.5663, longitude: 127.0017 },
    { latitude: 37.5759, longitude: 126.9768 },
    { latitude: 37.5563, longitude: 126.9266 },
    { latitude: 37.541, longitude: 127.0161 },
    { latitude: 37.5172, longitude: 127.0413 },
    { latitude: 37.5121, longitude: 127.1024 },
    { latitude: 37.531, longitude: 126.914 },
    { latitude: 37.498, longitude: 127.0276 },
    { latitude: 37.6091, longitude: 126.995 },
    { latitude: 37.5837, longitude: 127.0109 },
    { latitude: 37.5145, longitude: 126.8988 },
  ];

  state.dustbins = locations.map((location, index) => ({
    id: uuidv4(),
    name: `Bin-${String(index + 1).padStart(3, '0')}`,
    location,
    fillLevel: Math.random() * 30, // Lowered initial fill to prevent immediate alerts
    status: 'empty' as const,
    lastUpdated: new Date(),
    capacity: 100,
    weight: Math.random() * 30,
    sensorActive: true,
    collectionCount: Math.floor(Math.random() * 5),
  }));

  // Create authorities
  state.authorities = [
    {
      id: uuidv4(),
      name: 'Seoul Central Authority',
      location: { latitude: 37.5665, longitude: 126.978 },
      availableVehicles: 3,
    },
    {
      id: uuidv4(),
      name: 'Seoul South Authority',
      location: { latitude: 37.5172, longitude: 127.0413 },
      availableVehicles: 2,
    },
    {
      id: uuidv4(),
      name: 'Seoul East Authority',
      location: { latitude: 37.541, longitude: 127.0161 },
      availableVehicles: 2,
    },
  ];

  updateStats();
};

// Update statistics
const updateStats = () => {
  const stats: SimulationStats = {
    totalDustbins: state.dustbins.length,
    emptyBins: 0,
    warningBins: 0,
    criticalBins: 0,
    collectingBins: 0,
    averageFillLevel: 0,
    totalCollections: 0,
  };

  let totalFill = 0;
  let totalCollections = 0;

  state.dustbins.forEach((dustbin) => {
    totalFill += dustbin.fillLevel;
    totalCollections += dustbin.collectionCount;

    if (dustbin.status === 'empty') stats.emptyBins++;
    else if (dustbin.status === 'warning') stats.warningBins++;
    else if (dustbin.status === 'critical') stats.criticalBins++;
    else if (dustbin.status === 'collecting') stats.collectingBins++;
  });

  stats.averageFillLevel = state.dustbins.length > 0 ? totalFill / state.dustbins.length : 0;
  stats.totalCollections = totalCollections;

  state.stats = stats;
};

// Update dustbin status based on fill level
const updateDustbinStatus = (dustbin: DustbinData): DustbinData => {
  let status = dustbin.status;
  if (dustbin.status !== 'collecting') {
    if (dustbin.fillLevel >= 75) {
      status = 'critical' as const;
    } else if (dustbin.fillLevel >= 40) {
      status = 'warning' as const;
    } else {
      status = 'empty' as const;
    }
  }
  return { ...dustbin, status };
};

// Track previous state for alert generation
const previousStates = new Map<string, { status: string; fillLevel: number }>();

// Generate alerts based on state changes
const generateAlerts = (updatedDustbins: DustbinData[], wss: any) => {
  if (!state.isRunning) {
    return;
  }

  if (!wss || !wss.clients || wss.clients.size === 0) {
    console.log('[DEBUG] No WebSocket clients connected, skipping alerts');
    return;
  }

  updatedDustbins.forEach((dustbin) => {
    const prev = previousStates.get(dustbin.id);
    const prevStatus = prev?.status || 'empty';

    // Alert for reaching warning level (40%)
    if (prevStatus !== 'warning' && dustbin.status === 'warning' && dustbin.status !== 'collecting') {
      console.log(`[ALERT] ${dustbin.name} reached WARNING (${Math.round(dustbin.fillLevel)}%)`);
      broadcastAlert(wss, {
        type: 'warning',
        title: `⚠️ ${dustbin.name} Reaching Capacity`,
        message: `Dustbin is now at ${Math.round(dustbin.fillLevel)}% capacity. Please schedule collection soon.`,
        dustbinId: dustbin.id,
      });
    }

    // Alert for reaching critical level (75%)
    if (prevStatus !== 'critical' && dustbin.status === 'critical' && dustbin.status !== 'collecting') {
      console.log(`[ALERT] ${dustbin.name} reached CRITICAL (${Math.round(dustbin.fillLevel)}%) - Calling agency`);
      broadcastAlert(wss, {
        type: 'critical',
        title: `🚨 ${dustbin.name} Critical - Calling Agency for Cleaning`,
        message: `Dustbin reached critical capacity at ${Math.round(dustbin.fillLevel)}%. Waste collection agency has been contacted for immediate pickup.`,
        dustbinId: dustbin.id,
      });
    }

    // Alert for collection started (status changed to collecting)
    if (prevStatus !== 'collecting' && dustbin.status === 'collecting') {
      console.log(`[ALERT] ${dustbin.name} COLLECTION STARTED`);
      broadcastAlert(wss, {
        type: 'info',
        title: `🚚 ${dustbin.name} - Collection Service Dispatched`,
        message: `Agency has dispatched a waste collection vehicle. Dustbin cleaning in progress.`,
        dustbinId: dustbin.id,
      });
    }

    // Alert for collection completed (status changed from collecting to empty)
    if (prevStatus === 'collecting' && dustbin.status === 'empty') {
      console.log(`[ALERT] ${dustbin.name} COLLECTION COMPLETED - Dustbin cleaned`);
      broadcastAlert(wss, {
        type: 'success',
        title: `✓ ${dustbin.name} - Dustbin Cleaned & Ready`,
        message: `Dustbin has been emptied and is ready for new waste. Total collections: ${dustbin.collectionCount}`,
        dustbinId: dustbin.id,
      });
    }

    // Update previous state
    previousStates.set(dustbin.id, { status: dustbin.status, fillLevel: dustbin.fillLevel });
  });
};

// Broadcast alert to all connected WebSocket clients
const broadcastAlert = (wss: any, alert: any) => {
  console.log(`[BROADCAST] Sending alert to ${wss.clients.size} clients: ${alert.title}`);
  let sentCount = 0;
  wss.clients.forEach((client: any) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          type: 'notification',
          id: Date.now().toString() + Math.random(),
          title: alert.title,
          message: alert.message,
          notificationType: alert.type,
          dustbinId: alert.dustbinId,
        })
      );
      sentCount++;
    }
  });
  console.log(`[BROADCAST] Alert sent to ${sentCount}/${wss.clients.size} clients`);
};

// Simulation loop
let simulationInterval: NodeJS.Timeout | null = null;
let wssRef: any = null;

const startSimulationLoop = () => {
  if (simulationInterval) clearInterval(simulationInterval);

  // Initialize previous states - start all as 'empty' so first transitions generate alerts
  state.dustbins.forEach((dustbin) => {
    previousStates.set(dustbin.id, { status: 'empty', fillLevel: 0 });
  });

  simulationInterval = setInterval(() => {
    if (!state.isRunning) {
      console.log(`[DEBUG] Simulation loop detected running while isRunning=false. Cleaning up interval.`);
      if (simulationInterval) clearInterval(simulationInterval);
      simulationInterval = null;
      return;
    }

    state.dustbins = state.dustbins.map((dustbin) => {
      let updated = { ...dustbin };

      if (dustbin.status === 'collecting') {
        // Empty the bin
        updated.fillLevel = Math.max(0, dustbin.fillLevel - 20 * state.speed);
        updated.weight = (updated.fillLevel / 100) * dustbin.capacity;

        if (updated.fillLevel <= 0) {
          updated.fillLevel = 0;
          updated.weight = 0;
          updated.collectionCount++;
          updated.status = 'empty' as const;
          
          // Dispatch authority update
          const authority = state.authorities[Math.floor(Math.random() * state.authorities.length)];
          if (authority) {
            authority.availableVehicles++;
          }
        }
      } else {
        // Normal fill increase
        const fillIncrease = (Math.random() * 5 + 2) * state.speed;
        updated.fillLevel = Math.min(100, dustbin.fillLevel + fillIncrease);
        updated.weight = (updated.fillLevel / 100) * dustbin.capacity;
      }

      updated = updateDustbinStatus(updated);
      updated.lastUpdated = new Date();

      return updated;
    });

    // Generate alerts for state changes
    if (wssRef) {
      generateAlerts(state.dustbins, wssRef);
    }

    // Check for critical bins and dispatch authorities
    state.dustbins.forEach((dustbin) => {
      if (dustbin.status === 'critical' && Math.random() > 0.75) {
        const availableAuthority = state.authorities.find((a) => a.availableVehicles > 0);
        if (availableAuthority) {
          const bin = state.dustbins.find((d) => d.id === dustbin.id);
          if (bin && bin.status !== 'collecting') {
            bin.status = 'collecting' as const;
            availableAuthority.availableVehicles--;
            if (!availableAuthority.currentRoute) {
              availableAuthority.currentRoute = [];
            }
            availableAuthority.currentRoute.push(bin);
          }
        }
      }
    });

    updateStats();
  }, 1000 / state.speed);
};

// API Routes
app.get('/api/dustbins', (req, res) => {
  res.json(state.dustbins);
});

app.get('/api/dustbins/:id', (req, res) => {
  const dustbin = state.dustbins.find((d) => d.id === req.params.id);
  if (!dustbin) {
    return res.status(404).json({ error: 'Dustbin not found' });
  }
  res.json(dustbin);
});

app.get('/api/authorities', (req, res) => {
  res.json(state.authorities);
});

app.post('/api/authorities/dispatch', (req, res) => {
  const { dustbinId } = req.body;
  const dustbin = state.dustbins.find((d) => d.id === dustbinId);
  const authority = state.authorities.find((a) => a.availableVehicles > 0);

  if (!dustbin || !authority) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  dustbin.status = 'collecting';
  authority.availableVehicles--;
  if (!authority.currentRoute) {
    authority.currentRoute = [];
  }
  authority.currentRoute.push(dustbin);

  res.json({ success: true });
});

app.post('/api/simulation/start', (req, res) => {
  state.isRunning = true;
  // Initialize previousStates to current values so alerts only trigger for transitions AFTER start
  previousStates.clear();
  state.dustbins.forEach((dustbin) => {
    previousStates.set(dustbin.id, { status: dustbin.status, fillLevel: dustbin.fillLevel });
  });
  startSimulationLoop();
  res.json({ success: true });
});

app.post('/api/simulation/stop', (req, res) => {
  state.isRunning = false;
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }
  res.json({ success: true });
});

app.post('/api/simulation/speed', (req, res) => {
  const { speed } = req.body;
  state.speed = Math.max(0.5, Math.min(5, speed));
  if (state.isRunning) {
    if (simulationInterval) clearInterval(simulationInterval);
    startSimulationLoop();
  }
  res.json({ success: true, speed: state.speed });
});

app.get('/api/simulation/stats', (req, res) => {
  res.json(state.stats);
});

app.get('/api/simulation/state', (req, res) => {
  res.json({
    isRunning: state.isRunning,
    speed: state.speed,
    dustbinCount: state.dustbins.length
  });
});

// Test endpoint for alert broadcasting
app.post('/api/test-alert', (req, res) => {
  console.log('[TEST] Triggering test alert');
  const testAlert = {
    type: 'info',
    title: '🧪 TEST ALERT - System Check',
    message: 'This is a test alert to verify WebSocket broadcasting is working correctly.',
    dustbinId: 'test',
  };
  broadcastAlert(wssRef, testAlert);
  res.json({ success: true, message: 'Test alert sent' });
});

app.post('/api/simulation/reset', (req, res) => {
  state.isRunning = false;
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }
  initializeSimulation();
  res.json({ success: true });
});

// WebSocket support for real-time updates
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wssRef = wss;

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send initial state
  ws.send(
    JSON.stringify({
      type: 'dustbin-update',
      dustbins: state.dustbins,
    })
  );

  // Broadcast updates to all connected clients
  const updateBroadcast = setInterval(() => {
    if (state.isRunning) {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(
            JSON.stringify({
              type: 'dustbin-update',
              dustbins: state.dustbins,
            })
          );
          client.send(
            JSON.stringify({
              type: 'stats-update',
              stats: state.stats,
            })
          );
        }
      });
    }
  }, 500);

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    clearInterval(updateBroadcast);
  });
});

// Initialize and start
initializeSimulation();

server.listen(PORT, () => {
  state.isRunning = false; // Explicitly ensure false on start
  console.log(`🌍 SERVER STARTED [PID: ${process.pid}] on http://localhost:${PORT}`);
  console.log(`📊 Current State: isRunning=${state.isRunning}`);
});

module.exports = app;
