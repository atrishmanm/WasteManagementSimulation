import React, { useEffect, useState } from 'react';
import { useSimulationStore } from './store/simulationStore';
import simulationService from './services/simulationService';
import { MapView } from './components/MapView';
import { Dashboard } from './components/Dashboard';
import { NotificationPanel } from './components/NotificationPanel';
import { ControlPanel } from './components/ControlPanel';
import { SmartDustbin } from './components/SmartDustbin';
import { ResidentAdminPortal } from './components/ResidentAdminPortal';
import 'leaflet/dist/leaflet.css';
import './App.css';

function App() {
  const [loading, setLoading] = useState(true);
  const [activeFeature, setActiveFeature] = useState<'map' | 'dustbin' | 'portal'>('map');
  const isRunning = useSimulationStore((state) => state.isRunning);
  const notifications = useSimulationStore((state) => state.notifications);
  const setDustbins = useSimulationStore((state) => state.setDustbins);
  const setAuthorities = useSimulationStore((state) => state.setAuthorities);
  const setStats = useSimulationStore((state) => state.setStats);
  const addNotification = useSimulationStore((state) => state.addNotification);
  const setSimulationRunning = useSimulationStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useSimulationStore((state) => state.setSimulationSpeed);
  const unreadAlerts = notifications.filter((notification) => !notification.read).length;

  // Fetch initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [dustbins, authorities, stats, simState] = await Promise.all([
          simulationService.getDustbins(),
          simulationService.getAuthorities(),
          simulationService.getStats(),
          simulationService.getSimulationState(),
        ]);

        setDustbins(dustbins);
        setAuthorities(authorities);
        setStats(stats);
        setLoading(false);

        setSimulationRunning(simState.isRunning);
        setSimulationSpeed(simState.speed);
      } catch (error) {
        console.error('Failed to load initial data:', error);
        addNotification({
          id: Date.now().toString(),
          type: 'critical',
          title: 'Connection Error',
          message: 'Failed to connect to server. Make sure the backend is running.',
          timestamp: new Date(),
          read: false,
        });
        setLoading(false);
      }
    };

    loadInitialData();
  }, [setDustbins, setAuthorities, setStats, setSimulationRunning, setSimulationSpeed, addNotification]);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    if (loading) return;

    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connectWebSocket = () => {
      try {
        ws = new WebSocket(simulationService.getWebSocketUrl());

        ws.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'dustbin-update') {
              setDustbins(data.dustbins);
            } else if (data.type === 'stats-update') {
              setStats(data.stats);
            } else if (data.type === 'notification') {
              console.log('[DEBUG] Received notification from WebSocket:', data);
              addNotification({
                id: data.id,
                type: data.notificationType,
                title: data.title,
                message: data.message,
                timestamp: new Date(),
                dustbinId: data.dustbinId,
                read: false,
              });
            } else if (data.type === 'authorities-update') {
              setAuthorities(data.authorities);
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket closed, attempting to reconnect...');
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            setTimeout(connectWebSocket, 2000 * reconnectAttempts);
          }
        };
      } catch (error) {
        console.error('Failed to establish WebSocket connection:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [loading, setDustbins, setAuthorities, setStats, addNotification]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Initializing Smart Waste Management System...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <p className="header-eyebrow">Smart City Command Center</p>
        <div className="header-row">
          <div className="header-copy">
            <h1>Smart Waste Operations Console</h1>
            <p>Live telemetry, route visibility, and proactive collection decisions in one workspace.</p>
          </div>
          <div className="header-stats">
            <div className="header-chip">
              <span>Simulation</span>
              <strong>{isRunning ? 'Live' : 'Paused'}</strong>
            </div>
            <div className="header-chip">
              <span>Unread Alerts</span>
              <strong>{unreadAlerts}</strong>
            </div>
            <div className="header-chip">
              <span>Workspace</span>
              <strong>
                {activeFeature === 'map'
                  ? 'Map Feature'
                  : activeFeature === 'dustbin'
                    ? 'Dustbin Feature'
                    : 'Resident/Admin Portal'}
              </strong>
            </div>
          </div>
        </div>

        <div className="feature-tabs">
          <button
            className={`tab-button ${activeFeature === 'map' ? 'active' : ''}`}
            onClick={() => setActiveFeature('map')}
          >
            Map Feature
          </button>
          <button
            className={`tab-button ${activeFeature === 'dustbin' ? 'active' : ''}`}
            onClick={() => setActiveFeature('dustbin')}
          >
            Dustbin Feature
          </button>
          <button
            className={`tab-button ${activeFeature === 'portal' ? 'active' : ''}`}
            onClick={() => setActiveFeature('portal')}
          >
            Resident/Admin Portal
          </button>
        </div>
      </header>

      <main className="app-main">
        {activeFeature === 'map' ? (
          <div className="layout">
            <div className="left-panel">
              <section className="panel-shell panel-shell--controls">
                <h2 className="panel-title">Command Controls</h2>
                <ControlPanel />
              </section>
              <section className="panel-shell panel-shell--notifications">
                <h2 className="panel-title">Alert Feed</h2>
                <NotificationPanel />
              </section>
            </div>

            <div className="center-panel">
              <section className="panel-shell panel-shell--map">
                <h2 className="panel-title">City Coverage Map</h2>
                <MapView />
              </section>
            </div>

            <div className="right-panel">
              <section className="panel-shell panel-shell--dashboard">
                <h2 className="panel-title">System Analytics</h2>
                <Dashboard />
              </section>
            </div>
          </div>
        ) : activeFeature === 'dustbin' ? (
          <div className="full-width-panel">
            <section className="panel-shell panel-shell--lab">
              <h2 className="panel-title">IoT Waste Detection Lab</h2>
              <SmartDustbin />
            </section>
          </div>
        ) : (
          <div className="full-width-panel">
            <section className="panel-shell panel-shell--portal">
              <h2 className="panel-title">Resident and Admin Operations</h2>
              <ResidentAdminPortal />
            </section>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Industrial Simulator • Smart Waste Intelligence Platform</p>
      </footer>
    </div>
  );
}

export default App;
