import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import simulationService from '../services/simulationService';
import { Play, Pause, RotateCcw, Zap } from 'lucide-react';
import './ControlPanel.css';

export const ControlPanel: React.FC = () => {
  const isRunning = useSimulationStore((state) => state.isRunning);
  const speed = useSimulationStore((state) => state.speed);
  const setSimulationRunning = useSimulationStore((state) => state.setSimulationRunning);
  const setSimulationSpeed = useSimulationStore((state) => state.setSimulationSpeed);

  const handleToggleSimulation = async () => {
    try {
      if (isRunning) {
        await simulationService.stopSimulation();
      } else {
        await simulationService.startSimulation();
      }
      setSimulationRunning(!isRunning);
    } catch (error) {
      console.error('Failed to toggle simulation:', error);
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    try {
      await simulationService.setSimulationSpeed(newSpeed);
      setSimulationSpeed(newSpeed);
    } catch (error) {
      console.error('Failed to change simulation speed:', error);
    }
  };

  const handleReset = async () => {
    try {
      await simulationService.resetSimulation();
      setSimulationRunning(false);
    } catch (error) {
      console.error('Failed to reset simulation:', error);
    }
  };

  return (
    <div className="control-panel">
      <div className="control-panel-header">
        <h3>Simulation Orchestration</h3>
        <p>Start or pause telemetry and tune simulation speed in real time.</p>
      </div>

      <div className="control-group">
        <label>Simulation Control</label>
        <div className="button-group">
          <button
            className={`cp-btn cp-btn-primary ${isRunning ? 'active' : ''}`}
            onClick={handleToggleSimulation}
            title={isRunning ? 'Pause' : 'Play'}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
            {isRunning ? 'Running' : 'Start'}
          </button>
          <button className="cp-btn cp-btn-secondary" onClick={handleReset} title="Reset">
            <RotateCcw size={18} />
            Reset
          </button>
        </div>
      </div>

      <div className="control-group">
        <label>Simulation Speed</label>
        <div className="speed-control">
          <div className="speed-display">
            <Zap size={16} />
            <span>{speed}x</span>
          </div>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.5"
            value={speed}
            onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
            className="speed-slider"
          />
          <div className="speed-labels">
            <span>0.5x</span>
            <span>5x</span>
          </div>
        </div>
      </div>

      <div className="control-group arduino-sim-section">
        <label>IoT Sensor Simulation (Arduino Nodes)</label>
        <div className="arduino-grid">
          <div className="sensor-node">
            <div className="sensor-tag">Node-01: Ultrasonic</div>
            <div className="sensor-reading">
              <span className="reading-value">{Math.floor(Math.random() * 80 + 20)} cm</span>
              <div className="sensor-status status-ok">OK</div>
            </div>
          </div>
          <div className="sensor-node">
            <div className="sensor-tag">Node-02: Load Cell</div>
            <div className="sensor-reading">
              <span className="reading-value">{(Math.random() * 5 + 1).toFixed(2)} kg</span>
              <div className="sensor-status status-ok">OK</div>
            </div>
          </div>
          <div className="sensor-node">
            <div className="sensor-tag">Node-03: MQ-135 (Gas)</div>
            <div className="sensor-reading">
              <span className="reading-value">{Math.floor(Math.random() * 100 + 150)} ppm</span>
              <div className="sensor-status status-warning">WARM</div>
            </div>
          </div>
          <div className="sensor-node">
            <div className="sensor-tag">Node-04: RFID RC522</div>
            <div className="sensor-reading">
              <span className="reading-value">ID: RFID-A101</span>
              <div className="sensor-status status-ok">READY</div>
            </div>
          </div>
        </div>
      </div>

      <div className="control-group">
        <label>Legend</label>
        <div className="legend">
          <div className="legend-item">
            <div className="legend-color status-empty"></div>
            <span>Empty</span>
          </div>
          <div className="legend-item">
            <div className="legend-color status-warning"></div>
            <span>Warning</span>
          </div>
          <div className="legend-item">
            <div className="legend-color status-critical"></div>
            <span>Critical</span>
          </div>
          <div className="legend-item">
            <div className="legend-color status-collecting"></div>
            <span>Collecting</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
