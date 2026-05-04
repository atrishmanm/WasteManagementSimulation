import React, { useState } from 'react';
import { RotateCcw, Radio } from 'lucide-react';
import './SmartDustbin.css';

interface WasteItem {
  id: string;
  emoji: string;
  name: string;
  category: 'organic' | 'paper' | 'plastic' | 'metal' | 'glass';
  sensorSignature: number; // 0-1000 for sensor value simulation
}

interface DetectedItem {
  item: WasteItem;
  detectedAt: number;
  confidence: number;
  sensorReadings: number[];
}

export interface SmartDustbinProps {
  residentId?: string;
  onWasteSubmitted?: () => void;
}

const wasteItems: WasteItem[] = [
  { id: '1', emoji: '🍎', name: 'Apple Core', category: 'organic', sensorSignature: 245 },
  { id: '2', emoji: '🥕', name: 'Carrot Peels', category: 'organic', sensorSignature: 238 },
  { id: '3', emoji: '🌽', name: 'Corn Cob', category: 'organic', sensorSignature: 252 },
  { id: '4', emoji: '🍌', name: 'Banana Peel', category: 'organic', sensorSignature: 258 },
  { id: '5', emoji: '🥚', name: 'Egg Shells', category: 'organic', sensorSignature: 266 },
  { id: '6', emoji: '🍵', name: 'Tea Leaves', category: 'organic', sensorSignature: 232 },
  { id: '7', emoji: '☕', name: 'Coffee Grounds', category: 'organic', sensorSignature: 241 },
  { id: '8', emoji: '🍞', name: 'Bread Crust', category: 'organic', sensorSignature: 268 },
  { id: '9', emoji: '🥬', name: 'Leafy Greens', category: 'organic', sensorSignature: 236 },
  { id: '10', emoji: '🍚', name: 'Rice Leftovers', category: 'organic', sensorSignature: 255 },
];

const categoryColors: Record<string, string> = {
  organic: '#16a34a',
};

const categoryNames: Record<string, string> = {
  organic: 'Food Waste',
};

interface SensorDefinition {
  id: string;
  name: string;
  unit: string;
  min: number;
  max: number;
  decimals: number;
  description: string;
}

const sensorDefinitions: SensorDefinition[] = [
  {
    id: 'S1',
    name: 'Methane (CH4)',
    unit: 'ppm',
    min: 0,
    max: 2000,
    decimals: 0,
    description: 'Gas output from decomposition activity.',
  },
  {
    id: 'S2',
    name: 'Ammonia (NH3)',
    unit: 'ppm',
    min: 0,
    max: 500,
    decimals: 0,
    description: 'Odor intensity and protein breakdown indicator.',
  },
  {
    id: 'S3',
    name: 'Moisture',
    unit: '%',
    min: 0,
    max: 100,
    decimals: 0,
    description: 'Wetness level inside the organic waste stack.',
  },
  {
    id: 'S4',
    name: 'Temperature',
    unit: 'C',
    min: 10,
    max: 55,
    decimals: 1,
    description: 'Internal bin temperature for compost activity.',
  },
  {
    id: 'S5',
    name: 'VOC Index',
    unit: 'idx',
    min: 0,
    max: 500,
    decimals: 0,
    description: 'Volatile organic compound intensity proxy.',
  },
];

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const scaleReading = (value: number, min: number, max: number) =>
  min + (value / 1000) * (max - min);

import simulationService from '../services/simulationService';

export const SmartDustbin: React.FC<SmartDustbinProps> = ({ residentId, onWasteSubmitted }) => {
  const [detectionHistory, setDetectionHistory] = useState<DetectedItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [sensorReading, setSensorReading] = useState<number[]>([]);
  const [lastDetection, setLastDetection] = useState<DetectedItem | null>(null);

  // IoT Sensor simulation - generates sensor readings
  const simulateSensorReading = (item: WasteItem): number[] => {
    const readings: number[] = [];
    const baseSignature = item.sensorSignature;
    
    // Simulate 5 sensor readings with noise
    for (let i = 0; i < 5; i++) {
      const noise = (Math.random() - 0.5) * 50;
      readings.push(Math.max(0, Math.min(1000, baseSignature + noise)));
    }
    return readings;
  };

  // Detect waste type based on sensor readings
  const detectWasteType = (readings: number[]): { item: WasteItem; confidence: number } => {
    const avgReading = readings.reduce((a, b) => a + b, 0) / readings.length;
    
    // Find closest match based on sensor signature
    let closestItem = wasteItems[0];
    let minDiff = Math.abs(avgReading - wasteItems[0].sensorSignature);

    for (const item of wasteItems) {
      const diff = Math.abs(avgReading - item.sensorSignature);
      if (diff < minDiff) {
        minDiff = diff;
        closestItem = item;
      }
    }

    // Calculate confidence (100% when perfect match, decreases with difference)
    const confidence = Math.max(0, 100 - (minDiff / 10));
    
    return { item: closestItem, confidence };
  };

  // Handle item insertion
  const handleInsertItem = async (item: WasteItem) => {
    setIsScanning(true);
    setSensorReading([]);

    // Simulate sensor scanning animation
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const readings = simulateSensorReading(item);
      setSensorReading(readings);
    }

    // Detect waste type
    const readings = simulateSensorReading(item);
    const { item: detectedItem, confidence } = detectWasteType(readings);
    
    const detection: DetectedItem = {
      item: detectedItem,
      detectedAt: Date.now(),
      confidence,
      sensorReadings: readings,
    };

    setDetectionHistory((history) => [detection, ...history]);
    setLastDetection(detection);
    setIsScanning(false);

    if (residentId) {
      // Simulate weight based on item type (0.1 to 2.5kg)
      const simulatedWeight = Number((Math.random() * 2.4 + 0.1).toFixed(2));
      try {
        await simulationService.submitWasteDisposal({
          residentId,
          weightKg: simulatedWeight,
          allowSimulated: true,
        });
        if (onWasteSubmitted) onWasteSubmitted();
      } catch (e) {
        console.error('Failed to submit waste for resident', e);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, item: WasteItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (isScanning) return;
    try {
      const data = e.dataTransfer.getData('application/json');
      if (data) {
        const item = JSON.parse(data) as WasteItem;
        handleInsertItem(item);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReset = () => {
    setDetectionHistory([]);
    setLastDetection(null);
    setSensorReading([]);
  };

  // Calculate statistics
  const stats = {
    total: detectionHistory.length,
    organic: detectionHistory.length,
    avgConfidence: detectionHistory.length > 0
      ? Math.round(detectionHistory.reduce((sum, d) => sum + d.confidence, 0) / detectionHistory.length)
      : 0,
  };

  const activeReadings = sensorReading.length > 0
    ? sensorReading
    : lastDetection?.sensorReadings ?? [];

  const sensorDetails = sensorDefinitions.map((sensor, index) => {
    const raw = activeReadings[index];
    const scaled = raw !== undefined ? scaleReading(raw, sensor.min, sensor.max) : null;
    return {
      ...sensor,
      raw,
      scaledValue: scaled,
      displayValue: scaled !== null ? scaled.toFixed(sensor.decimals) : '--',
      rangeLabel: `${sensor.min}-${sensor.max}${sensor.unit}`,
    };
  });

  const averageReading = activeReadings.length > 0
    ? activeReadings.reduce((sum, value) => sum + value, 0) / activeReadings.length
    : 0;

  const readingSpread = activeReadings.length > 0
    ? Math.max(...activeReadings) - Math.min(...activeReadings)
    : 0;

  const signalStability = activeReadings.length > 0
    ? clampValue(Math.round(100 - readingSpread / 8), 0, 100)
    : null;

  const moistureValue = sensorDetails[2]?.scaledValue ?? null;
  const temperatureValue = sensorDetails[3]?.scaledValue ?? null;
  const vocValue = sensorDetails[4]?.scaledValue ?? null;

  const methaneValue = sensorDetails[0]?.scaledValue ?? null;
  const ammoniaValue = sensorDetails[1]?.scaledValue ?? null;

  const gasIndex = methaneValue !== null && ammoniaValue !== null
    ? Math.round(
        ((methaneValue / sensorDetails[0].max) * 0.7 +
          (ammoniaValue / sensorDetails[1].max) * 0.3) * 100
      )
    : null;

  const activeConfidence = lastDetection
    ? Math.round(lastDetection.confidence)
    : stats.avgConfidence;

  const moistureScore = moistureValue !== null
    ? clampValue(Math.round(100 - Math.abs(moistureValue - 60) * 1.6), 0, 100)
    : null;

  const compostScore = moistureScore !== null
    ? clampValue(Math.round(moistureScore * 0.45 + activeConfidence * 0.55), 0, 100)
    : null;

  const estimatedWeight = activeReadings.length > 0
    ? Number(((averageReading / 1000) * 2.5 + 0.15).toFixed(2))
    : null;

  const infoCards = [
    { label: 'Total Detected', value: String(stats.total) },
    { label: 'Avg Confidence', value: `${stats.avgConfidence}%` },
    { label: 'Organic Items', value: String(stats.organic) },
    { label: 'Moisture', value: moistureValue !== null ? `${moistureValue.toFixed(0)}%` : '--' },
    { label: 'Gas Index', value: gasIndex !== null ? `${gasIndex}%` : '--' },
    { label: 'Signal Stability', value: signalStability !== null ? `${signalStability}%` : '--' },
    { label: 'Est. Weight', value: estimatedWeight !== null ? `${estimatedWeight} kg` : '--' },
    { label: 'Compost Score', value: compostScore !== null ? `${compostScore}%` : '--' },
  ];

  return (
    <div className="smart-dustbin-container">
      <div className="dustbin-game">
        <h2>Smart IoT Dustbin Waste Detection</h2>
        <p className="sd-subtitle">Insert food waste items to simulate sensor scans and organic classification.</p>

        {/* Main Dustbin Display */}
        <div className="dustbin-layout-split">
          <div className="dustbin-left-panel">
            <div 
              className={`realistic-dustbin-container ${isScanning ? 'scanning' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <div className="dustbin-lid-back"></div>
              <div className="dustbin-body">
                <div className="dustbin-lines"></div>
                <div className="dustbin-lines"></div>
                <div className="dustbin-lines"></div>
                <div className="dustbin-symbol">♻️</div>
                {isScanning ? (
                  <div className="scanning-overlay">
                    <div className="sensor-waves"></div>
                    <div className="scanning-text">🔍 Scanning</div>
                  </div>
                ) : lastDetection ? (
                  <div className="detection-overlay">
                     <div className="detected-emoji">{lastDetection.item.emoji}</div>
                     <div className="detected-name">
                        {lastDetection.item.name}
                     </div>
                     <div className="detected-category" style={{ backgroundColor: categoryColors[lastDetection.item.category] }}>
                        {categoryNames[lastDetection.item.category]}
                     </div>
                  </div>
                ) : (
                  <div className="drop-hint">Drop Waste Here</div>
                )}
              </div>
              <div className="dustbin-lid-front"></div>
            </div>

            {/* Sensor Display */}
          {sensorDefinitions.length > 0 && (
            <div className="sensor-display">
              <div className="sensor-header">
                <Radio size={16} /> IoT Sensor Readings (0-1000 raw scale)
              </div>
              <div className="sensor-graph">
                {sensorDetails.map((sensor, idx) => {
                  const rawValue = sensor.raw ?? 0;
                  const percentage = (rawValue / 1000) * 100;
                  return (
                    <div key={idx} className="sensor-bar-container">
                      <div className="sensor-bar">
                        <div 
                          className="sensor-bar-fill"
                          style={{ height: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="sensor-label">{sensor.id}</div>
                      <div className="sensor-value">
                        {sensor.displayValue}{sensor.displayValue === '--' ? '' : ` ${sensor.unit}`}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="sensor-avg">
                Avg Raw: {activeReadings.length > 0 ? Math.round(averageReading) : '--'}
                {temperatureValue !== null && (
                  <span> | Temp: {temperatureValue.toFixed(1)} C</span>
                )}
                {vocValue !== null && (
                  <span> | VOC: {vocValue.toFixed(0)} idx</span>
                )}
              </div>
            </div>
          )}

          <div className="sensor-details">
            <div className="sensor-details-header">
              Sensor Channels (S1-S5)
              <span>Each channel maps raw 0-1000 to real-world units.</span>
            </div>
            <div className="sensor-detail-grid">
              {sensorDetails.map((sensor) => (
                <div key={sensor.id} className="sensor-detail-card">
                  <div className="sensor-detail-top">
                    <span className="sensor-tag">{sensor.id}</span>
                    <span className="sensor-name">{sensor.name}</span>
                  </div>
                  <div className="sensor-detail-value">
                    {sensor.displayValue}{sensor.displayValue === '--' ? '' : ` ${sensor.unit}`}
                  </div>
                  <p className="sensor-detail-desc">{sensor.description}</p>
                  <div className="sensor-detail-range">Range: {sensor.rangeLabel}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
          <div className="dustbin-right-panel">
            <div className="items-section-vertical">
              <h3>Available Food Waste (Drag & Drop)</h3>
              <div className="items-grid-vertical">
                {wasteItems.map((item) => (
                  <div
                    key={item.id}
                    className="item-draggable"
                    draggable={!isScanning}
                    onDragStart={(e) => handleDragStart(e, item)}
                    onClick={() => !isScanning && handleInsertItem(item)}
                    title={`${item.name} - ${categoryNames[item.category]}`}
                  >
                    <span className="item-emoji">{item.emoji}</span>
                    <span className="item-label">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics */}
        <div className="stats-grid">
          {infoCards.map((card) => (
            <div key={card.label} className="stat-box">
              <span className="stat-label">{card.label}</span>
              <span className="stat-value">{card.value}</span>
            </div>
          ))}
        </div>

        {/* Detection History */}
        {detectionHistory.length > 0 && (
          <div className="history-section">
            <h3>Detection History</h3>
            <div className="history-list">
              {detectionHistory.map((detection, idx) => (
                <div key={idx} className="history-item">
                  <div className="history-emoji">{detection.item.emoji}</div>
                  <div className="history-info">
                    <div className="history-name">{detection.item.name}</div>
                    <div className="history-category" style={{ color: categoryColors[detection.item.category] }}>
                      {categoryNames[detection.item.category]}
                    </div>
                  </div>
                  <div className="history-confidence">
                    <div className="confidence-badge" style={{ 
                      backgroundColor: detection.confidence > 80 ? '#4caf50' : 
                                      detection.confidence > 60 ? '#ff9800' : '#f44336'
                    }}>
                      {Math.round(detection.confidence)}%
                    </div>
                  </div>
                  <div className="history-time">
                    {new Date(detection.detectedAt).toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="sd-controls">
          <button className="sd-btn sd-btn-primary" onClick={handleReset} disabled={isScanning}>
            <RotateCcw size={18} /> Reset
          </button>
        </div>
      </div>
    </div>
  );
};

