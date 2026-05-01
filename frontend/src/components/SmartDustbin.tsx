import React, { useState } from 'react';
import { Trash2, RotateCcw, Zap, Radio } from 'lucide-react';
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
  { id: '5', emoji: '📰', name: 'Newspaper', category: 'paper', sensorSignature: 432 },
  { id: '6', emoji: '📄', name: 'Office Paper', category: 'paper', sensorSignature: 428 },
  { id: '7', emoji: '📦', name: 'Cardboard Box', category: 'paper', sensorSignature: 445 },
  { id: '8', emoji: '📕', name: 'Old Magazine', category: 'paper', sensorSignature: 438 },
  { id: '9', emoji: '🛍️', name: 'Plastic Bag', category: 'plastic', sensorSignature: 612 },
  { id: '10', emoji: '🥤', name: 'Plastic Cup', category: 'plastic', sensorSignature: 628 },
  { id: '11', emoji: '🧴', name: 'Plastic Bottle', category: 'plastic', sensorSignature: 645 },
  { id: '12', emoji: '🎮', name: 'Broken Toy', category: 'plastic', sensorSignature: 618 },
  { id: '13', emoji: '🥫', name: 'Aluminum Can', category: 'metal', sensorSignature: 785 },
  { id: '14', emoji: '⚙️', name: 'Metal Gear', category: 'metal', sensorSignature: 798 },
  { id: '15', emoji: '🪛', name: 'Bent Bolt', category: 'metal', sensorSignature: 812 },
  { id: '16', emoji: '🔧', name: 'Rusty Wrench', category: 'metal', sensorSignature: 805 },
  { id: '17', emoji: '🍷', name: 'Wine Bottle', category: 'glass', sensorSignature: 925 },
  { id: '18', emoji: '🥛', name: 'Glass Jar', category: 'glass', sensorSignature: 932 },
  { id: '19', emoji: '🪟', name: 'Broken Glass', category: 'glass', sensorSignature: 945 },
  { id: '20', emoji: '🔬', name: 'Glass Flask', category: 'glass', sensorSignature: 938 },
];

const categoryColors: Record<string, string> = {
  organic: '#16a34a',
  paper: '#d97706',
  plastic: '#2563eb',
  metal: '#64748b',
  glass: '#0284c7',
};

const categoryNames: Record<string, string> = {
  organic: 'Organic Waste',
  paper: 'Paper Waste',
  plastic: 'Plastic Waste',
  metal: 'Metal Waste',
  glass: 'Glass Waste',
};

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
    organic: detectionHistory.filter(d => d.item.category === 'organic').length,
    paper: detectionHistory.filter(d => d.item.category === 'paper').length,
    plastic: detectionHistory.filter(d => d.item.category === 'plastic').length,
    metal: detectionHistory.filter(d => d.item.category === 'metal').length,
    glass: detectionHistory.filter(d => d.item.category === 'glass').length,
    avgConfidence: detectionHistory.length > 0 
      ? Math.round(detectionHistory.reduce((sum, d) => sum + d.confidence, 0) / detectionHistory.length)
      : 0,
  };

  return (
    <div className="smart-dustbin-container">
      <div className="dustbin-game">
        <h2>Smart IoT Dustbin Waste Detection</h2>
        <p className="sd-subtitle">Insert waste items to simulate sensor scans and real-time material classification.</p>

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
          {sensorReading.length > 0 && (
            <div className="sensor-display">
              <div className="sensor-header">
                <Radio size={16} /> IoT Sensor Readings
              </div>
              <div className="sensor-graph">
                {sensorReading.map((reading, idx) => {
                  const percentage = (reading / 1000) * 100;
                  return (
                    <div key={idx} className="sensor-bar-container">
                      <div className="sensor-bar">
                        <div 
                          className="sensor-bar-fill"
                          style={{ height: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="sensor-label">S{idx + 1}</div>
                    </div>
                  );
                })}
              </div>
              <div className="sensor-avg">
                Avg: {Math.round(sensorReading.reduce((a, b) => a + b, 0) / sensorReading.length)}
              </div>
            </div>
          )}
        </div>
          <div className="dustbin-right-panel">
            <div className="items-section-vertical">
              <h3>Available Waste (Drag & Drop)</h3>
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
          <div className="stat-box">
            <span className="stat-icon">📊</span>
            <span className="stat-label">Total Detected</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat-box">
            <span className="stat-icon">🎯</span>
            <span className="stat-label">Avg Confidence</span>
            <span className="stat-value">{stats.avgConfidence}%</span>
          </div>
          <div className="stat-box" style={{ borderColor: categoryColors.organic }}>
            <span className="stat-icon">🌱</span>
            <span className="stat-label">Organic</span>
            <span className="stat-value">{stats.organic}</span>
          </div>
          <div className="stat-box" style={{ borderColor: categoryColors.paper }}>
            <span className="stat-icon">📰</span>
            <span className="stat-label">Paper</span>
            <span className="stat-value">{stats.paper}</span>
          </div>
          <div className="stat-box" style={{ borderColor: categoryColors.plastic }}>
            <span className="stat-icon">🛍️</span>
            <span className="stat-label">Plastic</span>
            <span className="stat-value">{stats.plastic}</span>
          </div>
          <div className="stat-box" style={{ borderColor: categoryColors.metal }}>
            <span className="stat-icon">⚙️</span>
            <span className="stat-label">Metal</span>
            <span className="stat-value">{stats.metal}</span>
          </div>
          <div className="stat-box" style={{ borderColor: categoryColors.glass }}>
            <span className="stat-icon">🔬</span>
            <span className="stat-label">Glass</span>
            <span className="stat-value">{stats.glass}</span>
          </div>
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

