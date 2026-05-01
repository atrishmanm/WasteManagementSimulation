import React from 'react';
import { useSimulationStore } from '../store/simulationStore';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

export const Dashboard: React.FC = () => {
  const stats = useSimulationStore((state) => state.stats);
  const dustbins = useSimulationStore((state) => state.dustbins);

  const statusData = [
    { name: 'Empty', value: stats.emptyBins, color: '#16a34a' },
    { name: 'Warning', value: stats.warningBins, color: '#d97706' },
    { name: 'Critical', value: stats.criticalBins, color: '#dc2626' },
    { name: 'Collecting', value: stats.collectingBins, color: '#2563eb' },
  ];

  const fillLevelData = dustbins.slice(0, 10).map((db) => ({
    name: db.name.substring(0, 8),
    level: db.fillLevel,
  }));

  const kpis = [
    { label: 'Total Dustbins', value: stats.totalDustbins, tone: 'teal' },
    { label: 'Average Fill Level', value: stats.averageFillLevel.toFixed(1), unit: '%', tone: 'blue' },
    { label: 'Critical Bins', value: stats.criticalBins, tone: 'orange' },
    { label: 'Total Collections', value: stats.totalCollections, tone: 'green' },
    { label: 'Compost Generated', value: (stats.totalCollections * 12.5).toFixed(1), unit: 'kg', tone: 'teal' },
    { label: 'CO2 Saved', value: (stats.totalCollections * 5.2).toFixed(1), unit: 'kg', tone: 'green' },
  ];

  const lastUpdated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h3>Live Performance Snapshot</h3>
        <p>Updated at {lastUpdated}</p>
      </div>

      <div className="kpi-section">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`kpi-card kpi-${kpi.tone}`}>
            <span className="kpi-label">{kpi.label}</span>
            <span className="kpi-value">
              {kpi.value}
              {kpi.unit ?? ''}
            </span>
          </div>
        ))}
      </div>

      <div className="charts-section">
        <div className="chart-container">
          <h3>Dustbin Status Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid rgba(19, 37, 57, 0.12)',
                  boxShadow: '0 10px 24px rgba(15, 34, 52, 0.15)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container">
          <h3>Top 10 Fill Levels</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={fillLevelData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(19, 37, 57, 0.16)" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip
                contentStyle={{
                  borderRadius: '10px',
                  border: '1px solid rgba(19, 37, 57, 0.12)',
                  boxShadow: '0 10px 24px rgba(15, 34, 52, 0.15)',
                }}
              />
              <Bar dataKey="level" fill="#0f766e" radius={[6, 6, 0, 0]} name="Fill Level %" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-container span-all">
          <h3>Collection Efficiency Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={[
              { day: 'Mon', collections: 12, target: 15 },
              { day: 'Tue', collections: 19, target: 15 },
              { day: 'Wed', collections: 15, target: 15 },
              { day: 'Thu', collections: 22, target: 15 },
              { day: 'Fri', collections: 30, target: 15 },
              { day: 'Sat', collections: 10, target: 15 },
              { day: 'Sun', collections: 8, target: 15 },
            ]}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(19, 37, 57, 0.16)" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="collections" fill="#2563eb" name="Actual Collections" />
              <Bar dataKey="target" fill="#94a3b8" name="Target" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
