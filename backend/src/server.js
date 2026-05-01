const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 3001;

const BILLING_RATE_PER_KG = 4.5;
const RFID_TAP_COOLDOWN_MS = 5000;
const RFID_SESSION_MS = 2 * 60 * 1000;

app.use(cors());
app.use(express.json());

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

  residents: [],
  admins: [],
  disposalEntries: [],
  payments: [],
  residentNotifications: [],
  lastRfidTapByCard: {},
  rfidSessions: {},
};

const previousStates = new Map();
let simulationInterval = null;
let wssRef = null;

const toIsoDay = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

const monthKey = (date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${month}`;
};

const todayIso = () => toIsoDay(new Date());

const deriveBlock = (flatNumber) => {
  const match = String(flatNumber || '').toUpperCase().match(/[A-Z]+/);
  return match ? match[0] : 'UNKNOWN';
};

const addResidentNotification = (residentId, type, title, message) => {
  const notification = {
    id: uuidv4(),
    residentId,
    type,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
  };
  state.residentNotifications.push(notification);

  if (wssRef) {
    wssRef.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(
          JSON.stringify({
            type: 'resident-notification',
            payload: notification,
          })
        );
      }
    });
  }

  return notification;
};

const computeDailyTrend = (entries, days) => {
  const trend = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = toIsoDay(date);
    const totalWeight = entries
      .filter((entry) => toIsoDay(entry.createdAt) === key)
      .reduce((sum, entry) => sum + entry.weightKg, 0);
    trend.push({ day: key, totalKg: Number(totalWeight.toFixed(2)) });
  }
  return trend;
};

const computeResidentRank = (residentId) => {
  const currentMonth = monthKey(new Date());
  const residentWaste = state.residents
    .map((resident) => {
      const waste = state.disposalEntries
        .filter((entry) => entry.residentId === resident.id && monthKey(entry.createdAt) === currentMonth)
        .reduce((sum, entry) => sum + entry.weightKg, 0);
      return { residentId: resident.id, wasteKg: waste };
    })
    .sort((a, b) => a.wasteKg - b.wasteKg);

  const position = residentWaste.findIndex((item) => item.residentId === residentId);
  return {
    rank: position >= 0 ? position + 1 : state.residents.length,
    totalResidents: state.residents.length,
  };
};

const computeLeaderboard = () => {
  const currentMonth = monthKey(new Date());

  return state.residents
    .map((resident) => {
      const monthlyWaste = state.disposalEntries
        .filter((entry) => entry.residentId === resident.id && monthKey(entry.createdAt) === currentMonth)
        .reduce((sum, entry) => sum + entry.weightKg, 0);

      const score = Math.max(0, 120 - monthlyWaste * 8) + resident.greenPoints;

      return {
        residentId: resident.id,
        residentName: resident.name,
        flatNumber: resident.flatNumber,
        wasteKg: Number(monthlyWaste.toFixed(2)),
        greenPoints: resident.greenPoints,
        ecoScore: Number(score.toFixed(1)),
      };
    })
    .sort((a, b) => b.ecoScore - a.ecoScore)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
};

const predictTomorrowWaste = (residentId) => {
  const recent = computeDailyTrend(
    state.disposalEntries.filter((entry) => entry.residentId === residentId),
    7
  ).map((item) => item.totalKg);

  if (!recent.length) {
    return 0;
  }

  const weighted = recent.reduce((sum, value, index) => sum + value * (index + 1), 0);
  const weightDenominator = recent.reduce((sum, _, index) => sum + (index + 1), 0);
  const prediction = weighted / weightDenominator;
  return Number(prediction.toFixed(2));
};

const getAdminOverview = () => {
  const totalWasteCollectedToday = state.disposalEntries
    .filter((entry) => toIsoDay(entry.createdAt) === todayIso())
    .reduce((sum, entry) => sum + entry.weightKg, 0);

  const activeUsers = Object.values(state.rfidSessions).filter((expiry) => expiry > Date.now()).length;

  const fullBinsList = state.dustbins
    .filter((bin) => bin.fillLevel >= 90)
    .map((bin) => ({
      id: bin.id,
      name: bin.name,
      fillLevel: Number(bin.fillLevel.toFixed(1)),
      status: bin.status,
    }));

  const revenueCollected = state.payments.reduce((sum, payment) => sum + payment.amount, 0);

  const binsNeedingPickup = [...state.dustbins]
    .filter((bin) => bin.fillLevel >= 70)
    .sort((a, b) => b.fillLevel - a.fillLevel)
    .slice(0, 6)
    .map((bin) => ({ id: bin.id, name: bin.name, fillLevel: Number(bin.fillLevel.toFixed(1)) }));

  const suggestedRoute = binsNeedingPickup.map((bin, index) => ({
    stop: index + 1,
    binId: bin.id,
    binName: bin.name,
    fillLevel: bin.fillLevel,
  }));

  return {
    totalWasteCollectedToday: Number(totalWasteCollectedToday.toFixed(2)),
    activeUsers,
    fullBinsList,
    revenueCollected: Number(revenueCollected.toFixed(2)),
    binsNeedingPickup,
    suggestedRoute,
  };
};

const getAdminAnalytics = () => {
  const dailyWasteTrend = computeDailyTrend(state.disposalEntries, 14);

  const monthlyReductionGraph = [];
  for (let i = 5; i >= 0; i -= 1) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const key = monthKey(date);
    const total = state.disposalEntries
      .filter((entry) => monthKey(entry.createdAt) === key)
      .reduce((sum, entry) => sum + entry.weightKg, 0);
    monthlyReductionGraph.push({ month: key, totalKg: Number(total.toFixed(2)) });
  }

  const topWasteProducingBlocks = Object.entries(
    state.disposalEntries.reduce((acc, entry) => {
      const block = deriveBlock(entry.flatNumber);
      acc[block] = (acc[block] || 0) + entry.weightKg;
      return acc;
    }, {})
  )
    .map(([block, totalKg]) => ({ block, totalKg: Number(totalKg.toFixed(2)) }))
    .sort((a, b) => b.totalKg - a.totalKg)
    .slice(0, 5);

  const cityPredictionKg = dailyWasteTrend.length
    ? Number(
        (
          dailyWasteTrend.reduce((sum, item) => sum + item.totalKg, 0) /
          dailyWasteTrend.length
        ).toFixed(2)
      )
    : 0;

  return {
    dailyWasteTrend,
    monthlyReductionGraph,
    topWasteProducingBlocks,
    aiWastePrediction: {
      tomorrowKg: cityPredictionKg,
      method: '7-14 day weighted average',
    },
  };
};

const getSustainabilityMetrics = () => {
  const totalWasteKg = state.disposalEntries.reduce((sum, entry) => sum + entry.weightKg, 0);
  const compostProducedKg = totalWasteKg * 0.35;
  const animalFeedGeneratedKg = totalWasteKg * 0.18;
  const co2SavedKg = totalWasteKg * 1.6;

  return {
    totalWasteKg: Number(totalWasteKg.toFixed(2)),
    compostProducedKg: Number(compostProducedKg.toFixed(2)),
    animalFeedGeneratedKg: Number(animalFeedGeneratedKg.toFixed(2)),
    co2SavedKg: Number(co2SavedKg.toFixed(2)),
    carbonFootprintMeter: {
      emissionsSavedKg: Number(co2SavedKg.toFixed(2)),
      rating: co2SavedKg > 150 ? 'High Impact' : co2SavedKg > 60 ? 'Moderate Impact' : 'Emerging Impact',
    },
  };
};

const initializeResidents = () => {
  state.admins = [
    {
      id: uuidv4(),
      username: 'admin',
      name: 'Solid Waste Admin',
      password: 'admin123',
    },
  ];

  const seedResidents = [
    { flatNumber: 'A-101', name: 'Riya Sen', rfidCardId: 'RFID-A101', password: 'pass101' },
    { flatNumber: 'A-102', name: 'Arjun Das', rfidCardId: 'RFID-A102', password: 'pass102' },
    { flatNumber: 'B-201', name: 'Neha Roy', rfidCardId: 'RFID-B201', password: 'pass201' },
    { flatNumber: 'B-202', name: 'Kabir Shah', rfidCardId: 'RFID-B202', password: 'pass202' },
    { flatNumber: 'C-301', name: 'Isha Malik', rfidCardId: 'RFID-C301', password: 'pass301' },
  ];

  state.residents = seedResidents.map((resident) => ({
    id: uuidv4(),
    ...resident,
    greenPoints: Math.floor(Math.random() * 80) + 20,
    createdAt: new Date().toISOString(),
  }));
};

const initializeSimulation = () => {
  const locations = [
    { latitude: 40.7128, longitude: -74.006 },
    { latitude: 40.758, longitude: -73.9855 },
    { latitude: 40.7484, longitude: -73.968 },
    { latitude: 40.7489, longitude: -73.968 },
    { latitude: 40.7505, longitude: -73.996 },
    { latitude: 40.7614, longitude: -73.9776 },
    { latitude: 40.7549, longitude: -73.9840 },
    { latitude: 40.7282, longitude: -73.7949 },
    { latitude: 40.7306, longitude: -73.9352 },
    { latitude: 40.7489, longitude: -73.9680 },
    { latitude: 40.7549, longitude: -73.9760 },
    { latitude: 40.7614, longitude: -73.9776 },
    { latitude: 40.7505, longitude: -73.996 },
    { latitude: 40.7484, longitude: -73.968 },
    { latitude: 40.758, longitude: -73.9855 },
  ];

  state.dustbins = locations.map((location, index) => ({
    id: uuidv4(),
    name: `Bin-${String(index + 1).padStart(3, '0')}`,
    location,
    fillLevel: Math.random() * 30,
    status: 'empty',
    lastUpdated: new Date(),
    capacity: 100,
    weight: Math.random() * 30,
    sensorActive: true,
    collectionCount: Math.floor(Math.random() * 5),
  }));

  state.authorities = [
    {
      id: uuidv4(),
      name: 'North District Authority',
      location: { latitude: 40.76, longitude: -73.97 },
      availableVehicles: 3,
    },
    {
      id: uuidv4(),
      name: 'South District Authority',
      location: { latitude: 40.72, longitude: -74.0 },
      availableVehicles: 2,
    },
    {
      id: uuidv4(),
      name: 'East District Authority',
      location: { latitude: 40.75, longitude: -73.93 },
      availableVehicles: 2,
    },
  ];

  if (!state.residents.length) {
    initializeResidents();
  }

  updateStats();
};

const updateStats = () => {
  const stats = {
    totalDustbins: 0,
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
    stats.totalDustbins += 1;

    if (dustbin.status === 'empty') stats.emptyBins += 1;
    else if (dustbin.status === 'warning') stats.warningBins += 1;
    else if (dustbin.status === 'critical') stats.criticalBins += 1;
    else if (dustbin.status === 'collecting') stats.collectingBins += 1;
  });

  stats.averageFillLevel = state.dustbins.length > 0 ? totalFill / state.dustbins.length : 0;
  stats.totalCollections = totalCollections;

  Object.assign(state.stats, stats);
};

const updateDustbinStatus = (dustbin) => {
  let status = dustbin.status;
  if (dustbin.status !== 'collecting') {
    if (dustbin.fillLevel >= 80) {
      status = 'critical';
    } else if (dustbin.fillLevel >= 50) {
      status = 'warning';
    } else {
      status = 'empty';
    }
  }
  return { ...dustbin, status };
};

const broadcastAlert = (wss, alert) => {
  if (!wss || !wss.clients || wss.clients.size === 0) return;

  wss.clients.forEach((client) => {
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
    }
  });
};

const generateAlerts = (updatedDustbins, wss) => {
  if (!state.isRunning) {
    return;
  }

  if (!wss || !wss.clients || wss.clients.size === 0) {
    return;
  }

  updatedDustbins.forEach((dustbin) => {
    const prev = previousStates.get(dustbin.id);
    const prevStatus = prev && prev.status ? prev.status : 'empty';

    if (prevStatus !== 'warning' && dustbin.status === 'warning' && dustbin.status !== 'collecting') {
      broadcastAlert(wss, {
        type: 'warning',
        title: `${dustbin.name} nearing full capacity`,
        message: `Dustbin at ${Math.round(dustbin.fillLevel)}%. Collection should be scheduled soon.`,
        dustbinId: dustbin.id,
      });
    }

    if (prevStatus !== 'critical' && dustbin.status === 'critical' && dustbin.status !== 'collecting') {
      broadcastAlert(wss, {
        type: 'critical',
        title: `${dustbin.name} is full`,
        message: `Dustbin reached ${Math.round(dustbin.fillLevel)}%. Agency dispatch started.`,
        dustbinId: dustbin.id,
      });
    }

    if (prevStatus !== 'collecting' && dustbin.status === 'collecting') {
      broadcastAlert(wss, {
        type: 'info',
        title: `${dustbin.name} collection started`,
        message: `Collection truck is now servicing the bin.`,
        dustbinId: dustbin.id,
      });
    }

    if (prevStatus === 'collecting' && dustbin.status === 'empty') {
      broadcastAlert(wss, {
        type: 'success',
        title: `${dustbin.name} emptied`,
        message: `Dustbin cleaned and ready. Collection count: ${dustbin.collectionCount}.`,
        dustbinId: dustbin.id,
      });
    }

    previousStates.set(dustbin.id, { status: dustbin.status, fillLevel: dustbin.fillLevel });
  });
};

const startSimulationLoop = () => {
  if (simulationInterval) clearInterval(simulationInterval);

  simulationInterval = setInterval(() => {
    if (!state.isRunning) {
      if (simulationInterval) clearInterval(simulationInterval);
      simulationInterval = null;
      return;
    }

    state.dustbins = state.dustbins.map((dustbin) => {
      let updated = { ...dustbin };

      if (dustbin.status === 'collecting') {
        updated.fillLevel = Math.max(0, dustbin.fillLevel - 20 * state.speed);
        updated.weight = (updated.fillLevel / 100) * dustbin.capacity;

        if (updated.fillLevel <= 0) {
          updated.fillLevel = 0;
          updated.weight = 0;
          updated.collectionCount += 1;
          updated.status = 'empty';

          const authority = state.authorities[Math.floor(Math.random() * state.authorities.length)];
          if (authority) {
            authority.availableVehicles += 1;
          }
        }
      } else {
        const fillIncrease = (Math.random() * 5 + 2) * state.speed;
        updated.fillLevel = Math.min(100, dustbin.fillLevel + fillIncrease);
        updated.weight = (updated.fillLevel / 100) * dustbin.capacity;
      }

      updated = updateDustbinStatus(updated);
      updated.lastUpdated = new Date();

      return updated;
    });

    if (wssRef) {
      generateAlerts(state.dustbins, wssRef);
    }

    state.dustbins.forEach((dustbin) => {
      if (dustbin.status === 'critical' && Math.random() > 0.8) {
        const availableAuthority = state.authorities.find((a) => a.availableVehicles > 0);
        if (availableAuthority) {
          const bin = state.dustbins.find((d) => d.id === dustbin.id);
          if (bin && bin.status !== 'collecting') {
            bin.status = 'collecting';
            availableAuthority.availableVehicles -= 1;
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

app.get('/api/dustbins', (req, res) => {
  res.json(state.dustbins);
});

app.get('/api/dustbins/:id', (req, res) => {
  const dustbin = state.dustbins.find((d) => d.id === req.params.id);
  if (!dustbin) {
    return res.status(404).json({ error: 'Dustbin not found' });
  }
  return res.json(dustbin);
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
  authority.availableVehicles -= 1;
  if (!authority.currentRoute) {
    authority.currentRoute = [];
  }
  authority.currentRoute.push(dustbin);

  return res.json({ success: true });
});

app.post('/api/simulation/start', (req, res) => {
  state.isRunning = true;
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
  state.speed = Math.max(0.5, Math.min(5, Number(speed) || 1));
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
    dustbinCount: state.dustbins.length,
  });
});

app.post('/api/simulation/reset', (req, res) => {
  state.isRunning = false;
  if (simulationInterval) {
    clearInterval(simulationInterval);
  }
  initializeSimulation();
  res.json({ success: true });
});

app.post('/api/auth/register-resident', (req, res) => {
  const { flatNumber, name, rfidCardId, password } = req.body;

  if (!flatNumber || !name || !rfidCardId || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const flatInUse = state.residents.some((resident) => resident.flatNumber === flatNumber);
  if (flatInUse) {
    return res.status(409).json({ error: 'Flat number already registered' });
  }

  const cardInUse = state.residents.some((resident) => resident.rfidCardId === rfidCardId);
  if (cardInUse) {
    return res.status(409).json({ error: 'RFID card already assigned' });
  }

  const resident = {
    id: uuidv4(),
    flatNumber,
    name,
    rfidCardId,
    password,
    greenPoints: 25,
    createdAt: new Date().toISOString(),
  };

  state.residents.push(resident);

  return res.status(201).json({
    resident: {
      id: resident.id,
      flatNumber: resident.flatNumber,
      name: resident.name,
      rfidCardId: resident.rfidCardId,
      greenPoints: resident.greenPoints,
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const { role = 'resident', username, password, rfidCardId } = req.body;

  if (role === 'admin') {
    const admin = state.admins.find((entry) => entry.username === username && entry.password === password);
    if (!admin) {
      return res.status(401).json({ error: 'Invalid admin credentials' });
    }

    return res.json({
      role: 'admin',
      user: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  }

  const resident = state.residents.find(
    (entry) => entry.rfidCardId === rfidCardId
  );

  if (!resident) {
    return res.status(401).json({ error: 'Invalid RFID card' });
  }

  return res.json({
    role: 'resident',
    user: {
      id: resident.id,
      flatNumber: resident.flatNumber,
      name: resident.name,
      rfidCardId: resident.rfidCardId,
      greenPoints: resident.greenPoints,
    },
  });
});

app.get('/api/residents', (req, res) => {
  res.json(
    state.residents.map((resident) => ({
      id: resident.id,
      flatNumber: resident.flatNumber,
      name: resident.name,
      rfidCardId: resident.rfidCardId,
      greenPoints: resident.greenPoints,
    }))
  );
});

app.post('/api/rfid/tap', (req, res) => {
  const { residentId, rfidCardId } = req.body;

  const resident = state.residents.find((entry) => entry.id === residentId);
  if (!resident) {
    return res.status(404).json({ error: 'Resident not found' });
  }

  if (resident.rfidCardId !== rfidCardId) {
    return res.status(401).json({ error: 'Unauthorized card' });
  }

  const now = Date.now();
  const previousTap = state.lastRfidTapByCard[rfidCardId] || 0;
  if (now - previousTap < RFID_TAP_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Duplicate scan blocked' });
  }

  state.lastRfidTapByCard[rfidCardId] = now;
  state.rfidSessions[residentId] = now + RFID_SESSION_MS;

  addResidentNotification(residentId, 'success', 'RFID authenticated', 'Bin opened successfully. You can dispose waste now.');

  return res.json({
    authenticated: true,
    binOpened: true,
    expiresAt: new Date(state.rfidSessions[residentId]).toISOString(),
  });
});

app.post('/api/waste/dispose', (req, res) => {
  const { residentId, weightKg, useRandomWeight } = req.body;

  const resident = state.residents.find((entry) => entry.id === residentId);
  if (!resident) {
    return res.status(404).json({ error: 'Resident not found' });
  }

  const sessionExpiry = state.rfidSessions[residentId] || 0;
  if (sessionExpiry < Date.now()) {
    return res.status(401).json({ error: 'RFID session expired. Tap card again.' });
  }

  const resolvedWeight = useRandomWeight
    ? Number((Math.random() * 2.8 + 0.2).toFixed(2))
    : Number(weightKg);

  if (!resolvedWeight || Number.isNaN(resolvedWeight) || resolvedWeight <= 0) {
    return res.status(400).json({ error: 'Weight must be greater than 0' });
  }

  const billAmount = Number((resolvedWeight * BILLING_RATE_PER_KG).toFixed(2));

  const entry = {
    id: uuidv4(),
    residentId,
    residentName: resident.name,
    flatNumber: resident.flatNumber,
    weightKg: resolvedWeight,
    ratePerKg: BILLING_RATE_PER_KG,
    billAmount,
    createdAt: new Date().toISOString(),
  };

  state.disposalEntries.push(entry);

  const selectedBin = state.dustbins[Math.floor(Math.random() * state.dustbins.length)];
  if (selectedBin) {
    selectedBin.fillLevel = Math.min(100, selectedBin.fillLevel + (resolvedWeight / selectedBin.capacity) * 100 * 2.2);
    selectedBin.weight = (selectedBin.fillLevel / 100) * selectedBin.capacity;
    selectedBin.lastUpdated = new Date();
    const updated = updateDustbinStatus(selectedBin);
    selectedBin.status = updated.status;
  }

  if (resolvedWeight <= 1) {
    resident.greenPoints += 12;
  } else if (resolvedWeight <= 2) {
    resident.greenPoints += 7;
  } else {
    resident.greenPoints += 3;
  }

  addResidentNotification(
    residentId,
    'info',
    'Bill generated',
    `Waste logged: ${resolvedWeight.toFixed(2)} kg. Bill amount: ${billAmount.toFixed(2)}.`
  );

  const residentMonthlyAverage =
    state.disposalEntries
      .filter((item) => item.residentId === residentId)
      .reduce((sum, item) => sum + item.weightKg, 0) /
    Math.max(
      1,
      state.disposalEntries.filter((item) => item.residentId === residentId).length
    );

  if (resolvedWeight < residentMonthlyAverage * 0.8) {
    addResidentNotification(
      residentId,
      'success',
      'Waste reduction achieved',
      'You reduced waste by about 20% compared to your average entry.'
    );
  }

  updateStats();

  return res.status(201).json({ entry });
});

app.get('/api/residents/:id/dashboard', (req, res) => {
  const resident = state.residents.find((entry) => entry.id === req.params.id);
  if (!resident) {
    return res.status(404).json({ error: 'Resident not found' });
  }

  const currentMonth = monthKey(new Date());
  const residentEntries = state.disposalEntries.filter((entry) => entry.residentId === resident.id);
  const monthlyEntries = residentEntries.filter((entry) => monthKey(entry.createdAt) === currentMonth);
  const monthlyWasteKg = monthlyEntries.reduce((sum, entry) => sum + entry.weightKg, 0);
  const currentBillAmount = monthlyEntries.reduce((sum, entry) => sum + entry.billAmount, 0);
  const previousPayments = state.payments
    .filter((payment) => payment.residentId === resident.id)
    .slice(-6)
    .reverse();

  const dailyDisposalHistory = computeDailyTrend(residentEntries, 14);
  const rankInfo = computeResidentRank(resident.id);

  const leaderboard = computeLeaderboard();
  const award = leaderboard.length ? leaderboard[0] : null;

  const payload = {
    resident: {
      id: resident.id,
      name: resident.name,
      flatNumber: resident.flatNumber,
      rfidCardId: resident.rfidCardId,
      greenPoints: resident.greenPoints,
    },
    totalWasteThisMonthKg: Number(monthlyWasteKg.toFixed(2)),
    currentBillAmount: Number(currentBillAmount.toFixed(2)),
    dailyDisposalHistory,
    rankAmongResidents: rankInfo,
    aiWastePredictionTomorrowKg: predictTomorrowWaste(resident.id),
    monthlyBestResidentAward: award
      ? {
          residentName: award.residentName,
          flatNumber: award.flatNumber,
          ecoScore: award.ecoScore,
        }
      : null,
    previousPayments,
    notifications: state.residentNotifications
      .filter((notification) => notification.residentId === resident.id)
      .slice(-20)
      .reverse(),
    ratePerKg: BILLING_RATE_PER_KG,
  };

  return res.json(payload);
});

app.post('/api/residents/:id/pay', (req, res) => {
  const resident = state.residents.find((entry) => entry.id === req.params.id);
  if (!resident) {
    return res.status(404).json({ error: 'Resident not found' });
  }

  const currentMonth = monthKey(new Date());
  const dueAmount = state.disposalEntries
    .filter((entry) => entry.residentId === resident.id && monthKey(entry.createdAt) === currentMonth)
    .reduce((sum, entry) => sum + entry.billAmount, 0);

  if (dueAmount <= 0) {
    return res.status(400).json({ error: 'No due amount for this month' });
  }

  const payment = {
    id: uuidv4(),
    residentId: resident.id,
    amount: Number(dueAmount.toFixed(2)),
    paidAt: new Date().toISOString(),
  };

  state.payments.push(payment);
  addResidentNotification(resident.id, 'success', 'Payment received', `Payment of ${payment.amount.toFixed(2)} was recorded.`);

  return res.json({ payment });
});

app.get('/api/admin/overview', (req, res) => {
  res.json(getAdminOverview());
});

app.get('/api/admin/analytics', (req, res) => {
  res.json(getAdminAnalytics());
});

app.get('/api/admin/leaderboard', (req, res) => {
  res.json({ leaderboard: computeLeaderboard() });
});

app.get('/api/admin/sustainability', (req, res) => {
  res.json(getSustainabilityMetrics());
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wssRef = wss;

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({
      type: 'dustbin-update',
      dustbins: state.dustbins,
    })
  );

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
          client.send(
            JSON.stringify({
              type: 'admin-overview',
              payload: getAdminOverview(),
            })
          );
        }
      });
    }
  }, 500);

  ws.on('close', () => {
    clearInterval(updateBroadcast);
  });
});

initializeResidents();
initializeSimulation();

server.listen(PORT, () => {
  state.isRunning = false;
  console.log(`SERVER STARTED on http://localhost:${PORT}`);
});

module.exports = app;
