import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Pane } from 'react-leaflet';
import L from 'leaflet';
import { useSimulationStore } from '../store/simulationStore';
import { DustbinData, DustbinStatus } from '../types';
import './MapView.css';

// Custom icons for different dustbin statuses
const getMarkerIcon = (status: DustbinStatus) => {
  const colors: Record<DustbinStatus, string> = {
    empty: '#4CAF50',
    warning: '#FFC107',
    critical: '#F44336',
    collecting: '#2196F3',
  };

  return L.divIcon({
    className: 'dustbin-marker',
    html: `
      <div class="marker-content" style="background-color: ${colors[status]}; border-color: ${colors[status]}">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-9l-1 1H5v2h14V4z"/>
        </svg>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

export const MapView: React.FC = () => {
  const dustbins = useSimulationStore((state) => state.dustbins);
  const authorities = useSimulationStore((state) => state.authorities);
  const [selectedDustbin, setSelectedDustbin] = useState<DustbinData | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const criticalCount = dustbins.filter((dustbin) => dustbin.status === 'critical').length;
  const collectingCount = dustbins.filter((dustbin) => dustbin.status === 'collecting').length;

  const getStatusColor = (fillLevel: number): string => {
    if (fillLevel >= 80) return '#F44336';
    if (fillLevel >= 50) return '#FFC107';
    return '#4CAF50';
  };

  const getRadius = (fillLevel: number): number => {
    return Math.max(50, (fillLevel / 100) * 200);
  };

  return (
    <div className="map-view">
      <div className="map-toolbar">
        <div className="map-metric">
          <span>Dustbins</span>
          <strong>{dustbins.length}</strong>
        </div>
        <div className="map-metric">
          <span>Critical</span>
          <strong>{criticalCount}</strong>
        </div>
        <div className="map-metric">
          <span>Collecting</span>
          <strong>{collectingCount}</strong>
        </div>
        <div className="map-selected">
          {selectedDustbin ? (
            <div className="selected-info">
              <span>Selected: {selectedDustbin.name}</span>
              <div className="arduino-pill">Arduino ID: {selectedDustbin.id.substring(0, 6).toUpperCase()}</div>
              <div className="reading-pill">Gas: {Math.floor(Math.random() * 200 + 100)} ppm</div>
            </div>
          ) : 'Select a marker to inspect details'}
        </div>
        <button 
          className={`map-btn ${showHeatmap ? 'active' : ''}`}
          onClick={() => setShowHeatmap(!showHeatmap)}
        >
          {showHeatmap ? 'Hide Heatmap' : 'Show IoT Heatmap'}
        </button>
      </div>

      <div className="map-canvas">
        <MapContainer
          center={[37.5665, 126.978]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
          className="leaflet-map"
        >
          <Pane name="heatmap" style={{ zIndex: 450 }} />
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Render dustbins */}
          {dustbins.map((dustbin) => (
            <React.Fragment key={dustbin.id}>
              {/* Fill level indicator circle */}
              {showHeatmap && (
                <Circle
                  center={[dustbin.location.latitude, dustbin.location.longitude]}
                  radius={getRadius(dustbin.fillLevel)}
                  pane="heatmap"
                  pathOptions={{
                    fillColor: getStatusColor(dustbin.fillLevel),
                    color: getStatusColor(dustbin.fillLevel),
                    fillOpacity: 0.4,
                    opacity: 0.6,
                    weight: 1,
                  }}
                />
              )}

              {/* Dustbin marker */}
              <Marker
                position={[dustbin.location.latitude, dustbin.location.longitude]}
                icon={getMarkerIcon(dustbin.status)}
                eventHandlers={{
                  click: () => setSelectedDustbin(dustbin),
                }}
              >
                <Popup>
                  <div className="popup-content">
                    <h3>{dustbin.name}</h3>
                    <p>
                      <strong>Fill Level:</strong> {dustbin.fillLevel}%
                    </p>
                    <p>
                      <strong>Weight:</strong> {dustbin.weight.toFixed(1)} / {dustbin.capacity} kg
                    </p>
                    <p>
                      <strong>Status:</strong> <span className={`status-badge ${dustbin.status}`}>{dustbin.status}</span>
                    </p>
                    <p>
                      <strong>Sensor:</strong> {dustbin.sensorActive ? 'Active' : 'Inactive'}
                    </p>
                    <p>
                      <strong>Collections:</strong> {dustbin.collectionCount}
                    </p>
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          ))}

          {/* Render authorities */}
          {authorities.map((authority) => (
            <Marker
              key={authority.id}
              position={[authority.location.latitude, authority.location.longitude]}
              icon={L.icon({
                iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0Ij48cGF0aCBmaWxsPSIjMjU2M2ViIiBkPSJNMTIgMmMtNS4zMyAwLTkuNiAzLjI4LTkuNiA3LjMzYzAgNy41IDkuNiAxMi42NyA5LjYgMTIuNjdzOS42LTUuMTcgOS42LTEyLjY3YzAtNC4wNS00LjI3LTcuMzMtOS42LTcuMzN6bTAgOS41Yy0xLjEgMC0yLTAuOS0yLTJzMC45LTIgMi0yIDIgMC45IDIgMi0wLjkgMi0yIDJ6Ii8+PC9zdmc+',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -32],
              })}
            >
              <Popup>
                <div className="popup-content">
                  <h3>{authority.name}</h3>
                  <p>
                    <strong>Available Vehicles:</strong> {authority.availableVehicles}
                  </p>
                  {authority.currentRoute && (
                    <p>
                      <strong>Current Route:</strong> {authority.currentRoute.length} stops
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
};

export default MapView;
