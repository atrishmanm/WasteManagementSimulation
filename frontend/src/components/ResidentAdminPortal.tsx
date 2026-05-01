import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AdminAnalyticsData,
  AdminOverviewData,
  LeaderboardEntry,
  ResidentDashboardData,
  ResidentProfile,
  SustainabilityMetrics,
} from '../types';
import simulationService from '../services/simulationService';
import { SmartDustbin } from './SmartDustbin';
import './ResidentAdminPortal.css';

type PortalMode = 'resident' | 'admin';

const defaultAdminOverview: AdminOverviewData = {
  totalWasteCollectedToday: 0,
  activeUsers: 0,
  fullBinsList: [],
  revenueCollected: 0,
  binsNeedingPickup: [],
  suggestedRoute: [],
};

const defaultAdminAnalytics: AdminAnalyticsData = {
  dailyWasteTrend: [],
  monthlyReductionGraph: [],
  topWasteProducingBlocks: [],
  aiWastePrediction: {
    tomorrowKg: 0,
    method: 'n/a',
  },
};

const defaultSustainability: SustainabilityMetrics = {
  totalWasteKg: 0,
  compostProducedKg: 0,
  animalFeedGeneratedKg: 0,
  co2SavedKg: 0,
  carbonFootprintMeter: {
    emissionsSavedKg: 0,
    rating: 'Emerging Impact',
  },
};

const errorText = (error: unknown): string => {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    return response?.data?.error || 'Request failed';
  }
  return 'Request failed';
};

export const ResidentAdminPortal: React.FC = () => {
  const [mode, setMode] = useState<PortalMode>('resident');

  const [residents, setResidents] = useState<ResidentProfile[]>([]);
  const [residentUser, setResidentUser] = useState<ResidentProfile | null>(null);
  const [adminUser, setAdminUser] = useState<{ id: string; name: string } | null>(null);

  const [residentDashboard, setResidentDashboard] = useState<ResidentDashboardData | null>(null);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewData>(defaultAdminOverview);
  const [adminAnalytics, setAdminAnalytics] = useState<AdminAnalyticsData>(defaultAdminAnalytics);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [sustainability, setSustainability] = useState<SustainabilityMetrics>(defaultSustainability);

  const [residentLogin, setResidentLogin] = useState({ rfidCardId: '' });
  const [adminLogin, setAdminLogin] = useState({ username: 'admin', password: 'admin123' });
  const [registerForm, setRegisterForm] = useState({
    flatNumber: '',
    name: '',
    rfidCardId: '',
    password: '',
  });

  const [manualWeight, setManualWeight] = useState('0.5');
  const [rfidCardInput, setRfidCardInput] = useState('');
  const [rfidStatus, setRfidStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [binOpen, setBinOpen] = useState(false);
  const [arduinoLog, setArduinoLog] = useState<string[]>(['[SYS] Arduino Mega 2560 Ready', '[SYS] All Sensors Initialized']);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const currentBillFormula = useMemo(() => {
    const rate = residentDashboard?.ratePerKg ?? 0;
    const weight = Number(manualWeight || 0);
    const bill = rate * weight;
    return `${rate.toFixed(2)} x ${weight.toFixed(2)} = ${bill.toFixed(2)}`;
  }, [residentDashboard, manualWeight]);

  const loadResidents = async () => {
    const list = await simulationService.getResidents();
    setResidents(list);
  };

  const loadResidentDashboard = async (residentId: string) => {
    const data = await simulationService.getResidentDashboard(residentId);
    setResidentDashboard(data);
    setRfidCardInput(data.resident.rfidCardId);
  };

  const loadAdminData = async () => {
    const [overview, analytics, board, metrics] = await Promise.all([
      simulationService.getAdminOverview(),
      simulationService.getAdminAnalytics(),
      simulationService.getLeaderboard(),
      simulationService.getSustainabilityMetrics(),
    ]);

    setAdminOverview(overview);
    setAdminAnalytics(analytics);
    setLeaderboard(board);
    setSustainability(metrics);
  };

  useEffect(() => {
    loadResidents().catch(() => {
      setMessage('Unable to load residents. Ensure backend is running.');
    });
  }, []);

  useEffect(() => {
    if (!residentUser) {
      return;
    }

    loadResidentDashboard(residentUser.id).catch(() => {
      setMessage('Failed to load resident dashboard.');
    });

    const timer = setInterval(() => {
      loadResidentDashboard(residentUser.id).catch(() => undefined);
      simulationService.getLeaderboard().then(setLeaderboard).catch(() => undefined);
      simulationService.getSustainabilityMetrics().then(setSustainability).catch(() => undefined);
    }, 5000);

    return () => clearInterval(timer);
  }, [residentUser]);

  useEffect(() => {
    if (!adminUser) {
      return;
    }

    loadAdminData().catch(() => {
      setMessage('Failed to load admin analytics.');
    });

    const timer = setInterval(() => {
      loadAdminData().catch(() => undefined);
    }, 4000);

    return () => clearInterval(timer);
  }, [adminUser]);

  const handleRegisterResident = async () => {
    setLoading(true);
    setMessage('');
    try {
      await simulationService.registerResident(registerForm);
      setRegisterForm({ flatNumber: '', name: '', rfidCardId: '', password: '' });
      await loadResidents();
      setMessage('Resident registration successful.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const handleResidentLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await simulationService.login({
        role: 'resident',
        rfidCardId: residentLogin.rfidCardId,
      });

      const selected = residents.find((resident) => resident.id === result.user.id);
      if (selected) {
        setResidentUser(selected);
        await loadResidentDashboard(selected.id);
      }
      setMessage(`Resident login successful: ${result.user.name}`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await simulationService.login({
        role: 'admin',
        username: adminLogin.username,
        password: adminLogin.password,
      });
      setAdminUser({ id: result.user.id, name: result.user.name });
      setMessage(`Admin login successful: ${result.user.name}`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRfidTap = async () => {
    if (!residentUser) {
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      await simulationService.tapRfidCard({
        residentId: residentUser.id,
        rfidCardId: rfidCardInput,
      });
      setRfidStatus('ok');
      setBinOpen(true);
      setArduinoLog(prev => [...prev.slice(-4), `[RFID] Card Detected: ${rfidCardInput}`, '[RFID] Auth SUCCESS', '[SERVO] Bin Lid Opened']);
      setTimeout(() => setBinOpen(false), 1800);
      await loadResidentDashboard(residentUser.id);
      setMessage('RFID authenticated. Bin opened.');
    } catch (error) {
      setRfidStatus('error');
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const submitWaste = async (useRandomWeight: boolean) => {
    if (!residentUser) {
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await simulationService.submitWasteDisposal({
        residentId: residentUser.id,
        weightKg: useRandomWeight ? undefined : Number(manualWeight),
        useRandomWeight,
      });
      await loadResidentDashboard(residentUser.id);
      await simulationService.getSustainabilityMetrics().then(setSustainability);
      setArduinoLog(prev => [...prev.slice(-4), `[LOAD] Weight Detected: ${useRandomWeight ? 'Auto' : manualWeight}kg`, '[SCAN] Waste Categorized', '[SYS] Entry Logged']);
      setMessage(useRandomWeight ? 'Random waste entry submitted.' : 'Waste entry submitted.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!residentUser) {
      return;
    }

    setLoading(true);
    setMessage('');
    try {
      await simulationService.payMonthlyBill(residentUser.id);
      await loadResidentDashboard(residentUser.id);
      await loadAdminData();
      setMessage('Monthly bill payment recorded.');
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="resident-admin-portal">
      <div className="portal-topbar">
        <div className="portal-tabs">
          <button className={mode === 'resident' ? 'active' : ''} onClick={() => setMode('resident')}>
            Resident Portal
          </button>
          <button className={mode === 'admin' ? 'active' : ''} onClick={() => setMode('admin')}>
            Admin Console
          </button>
        </div>
        <div className="portal-message">{message || 'Live smart waste operations and billing module'}</div>
      </div>

      {mode === 'resident' && (
        <div className="portal-grid resident-grid">
          <section className="portal-card">
            <h3>Resident Registration</h3>
            <div className="form-grid">
              <input
                placeholder="Flat Number"
                value={registerForm.flatNumber}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, flatNumber: event.target.value }))}
              />
              <input
                placeholder="Resident Name"
                value={registerForm.name}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
              />
              <input
                placeholder="RFID Card ID"
                value={registerForm.rfidCardId}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, rfidCardId: event.target.value }))}
              />
              <input
                placeholder="Password"
                type="password"
                value={registerForm.password}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
            <button className="portal-btn" disabled={loading} onClick={handleRegisterResident}>
              Register Resident
            </button>
            <p className="hint">Residents available: {residents.length}</p>
          </section>

          <section className="portal-card">
            <h3>Resident Login</h3>
            <div className="form-grid">
              <input
                placeholder="RFID Card ID"
                value={residentLogin.rfidCardId}
                onChange={(event) => setResidentLogin((prev) => ({ ...prev, rfidCardId: event.target.value }))}
              />
            </div>
            <button className="portal-btn" disabled={loading} onClick={handleResidentLogin}>
              Login Resident
            </button>
            <p className="hint">
              Demo: RFID-A101, RFID-A102, RFID-B201
            </p>
          </section>

          <section className="portal-card span-all">
            <h3>RFID Card Scan Simulation</h3>
            {!residentUser && <p className="hint">Login as resident to tap RFID card.</p>}
            {residentUser && (
              <>
                <div className="arduino-serial-monitor">
                  <div className="monitor-header">Arduino Serial Monitor - COM3</div>
                  <div className="monitor-content">
                    {arduinoLog.map((log, i) => <div key={i}>{log}</div>)}
                  </div>
                </div>
                <div className="rfid-row">
                  <input
                    placeholder="RFID Card ID"
                    value={rfidCardInput}
                    onChange={(event) => setRfidCardInput(event.target.value)}
                  />
                  <button className="portal-btn" disabled={loading} onClick={handleRfidTap}>
                    Tap RFID Card
                  </button>
                </div>
                <div className={`bin-anim ${binOpen ? 'open' : ''} ${rfidStatus}`}>
                  <span>{binOpen ? 'Bin Opened' : 'Bin Closed'}</span>
                </div>
              </>
            )}
          </section>

          <section className="portal-card span-all">
            <h3>Waste Disposal Entry</h3>
            {residentUser ? (
              <SmartDustbin 
                residentId={residentUser.id} 
                onWasteSubmitted={async () => {
                  await loadResidentDashboard(residentUser.id);
                  await simulationService.getSustainabilityMetrics().then(setSustainability);
                  setMessage('Smart Waste entry submitted and categorized.');
                }}
              />
            ) : (
              <p className="hint">Please login and tap your RFID card to start waste disposal.</p>
            )}
            
            <div style={{ marginTop: '20px' }}>
              <h4>Manual Override</h4>
              <div className="disposal-row">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={manualWeight}
                  onChange={(event) => setManualWeight(event.target.value)}
                />
                <button className="portal-btn" disabled={loading || !residentUser} onClick={() => submitWaste(false)}>
                  Submit Manual Waste
                </button>
                <button className="portal-btn ghost" disabled={loading || !residentUser} onClick={() => submitWaste(true)}>
                  Auto Random Weight
                </button>
              </div>
              <p className="hint">Billing formula: Bill = Rate x Weight, now {currentBillFormula}</p>
            </div>
          </section>

          {residentDashboard && (
            <>
              <section className="portal-card">
                <h3>User Dashboard</h3>
                <div className="kpi-grid">
                  <div>
                    <span>Total Waste This Month</span>
                    <strong>{residentDashboard.totalWasteThisMonthKg.toFixed(2)} kg</strong>
                  </div>
                  <div>
                    <span>Current Bill Amount</span>
                    <strong>{residentDashboard.currentBillAmount.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Resident Rank</span>
                    <strong>
                      {residentDashboard.rankAmongResidents.rank} / {residentDashboard.rankAmongResidents.totalResidents}
                    </strong>
                  </div>
                  <div>
                    <span>Green Points</span>
                    <strong>{residentDashboard.resident.greenPoints}</strong>
                  </div>
                  <div>
                    <span>AI Waste Prediction</span>
                    <strong>{residentDashboard.aiWastePredictionTomorrowKg.toFixed(2)} kg</strong>
                  </div>
                </div>
                <button className="portal-btn" disabled={loading} onClick={handlePayment}>
                  Pay Current Month Bill
                </button>
              </section>

              <section className="portal-card">
                <h3>Daily Disposal History</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={residentDashboard.dailyDisposalHistory}>
                    <CartesianGrid strokeDasharray="4 4" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="totalKg" stroke="#21a067" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </section>

              <section className="portal-card span-all">
                <h3>Notifications and Previous Payments</h3>
                <div className="split-list">
                  <div>
                    <h4>Resident Notifications</h4>
                    <ul>
                      {residentDashboard.notifications.map((item) => (
                        <li key={item.id}>
                          <strong>{item.title}</strong>
                          <span>{item.message}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Previous Payments</h4>
                    <ul>
                      {residentDashboard.previousPayments.map((payment) => (
                        <li key={payment.id}>
                          <strong>{payment.amount.toFixed(2)}</strong>
                          <span>{new Date(payment.paidAt).toLocaleString()}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section className="portal-card span-all">
                <h3>Leaderboard and Sustainability</h3>
                <div className="split-list">
                  <div>
                    <h4>Top Eco-Friendly Residents</h4>
                    <ol className="leader-list">
                      {leaderboard.slice(0, 5).map((entry) => (
                        <li key={entry.residentId}>
                          <span>
                            #{entry.rank} {entry.residentName} ({entry.flatNumber})
                          </span>
                          <strong>{entry.ecoScore.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div>
                    <h4>Recycling Output</h4>
                    <ul>
                      <li>
                        <strong>Compost Produced</strong>
                        <span>{sustainability.compostProducedKg.toFixed(2)} kg</span>
                      </li>
                      <li>
                        <strong>Animal Feed Generated</strong>
                        <span>{sustainability.animalFeedGeneratedKg.toFixed(2)} kg</span>
                      </li>
                      <li>
                        <strong>CO2 Saved</strong>
                        <span>{sustainability.co2SavedKg.toFixed(2)} kg</span>
                      </li>
                      <li>
                        <strong>Carbon Footprint Meter</strong>
                        <span>{sustainability.carbonFootprintMeter.rating}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}

      {mode === 'admin' && (
        <div className="portal-grid admin-grid">
          {!adminUser && (
            <section className="portal-card span-all">
              <h3>Admin Role Login</h3>
              <div className="form-grid">
                <input
                  placeholder="Admin Username"
                  value={adminLogin.username}
                  onChange={(event) => setAdminLogin((prev) => ({ ...prev, username: event.target.value }))}
                />
                <input
                  type="password"
                  placeholder="Admin Password"
                  value={adminLogin.password}
                  onChange={(event) => setAdminLogin((prev) => ({ ...prev, password: event.target.value }))}
                />
              </div>
              <button className="portal-btn" disabled={loading} onClick={handleAdminLogin}>
                Login Admin
              </button>
            </section>
          )}

          {adminUser && (
            <>
              <section className="portal-card span-all">
                <h3>Real-Time Admin Dashboard</h3>
                <div className="kpi-grid">
                  <div>
                    <span>Total Waste Collected Today</span>
                    <strong>{adminOverview.totalWasteCollectedToday.toFixed(2)} kg</strong>
                  </div>
                  <div>
                    <span>Users Active</span>
                    <strong>{adminOverview.activeUsers}</strong>
                  </div>
                  <div>
                    <span>Revenue Collected</span>
                    <strong>{adminOverview.revenueCollected.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span>Full Bins</span>
                    <strong>{adminOverview.fullBinsList.length}</strong>
                  </div>
                  <div>
                    <span>Predicted Tomorrow Waste</span>
                    <strong>{adminAnalytics.aiWastePrediction.tomorrowKg.toFixed(2)} kg</strong>
                  </div>
                </div>
              </section>

              <section className="portal-card">
                <h3>Collection Truck Route Simulation</h3>
                <ul>
                  {adminOverview.suggestedRoute.map((route) => (
                    <li key={route.binId}>
                      <strong>Stop {route.stop}: {route.binName}</strong>
                      <span>{route.fillLevel.toFixed(1)}% fill level</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="portal-card">
                <h3>Full Bin Alerts</h3>
                <ul>
                  {adminOverview.fullBinsList.map((bin) => (
                    <li key={bin.id}>
                      <strong>{bin.name}</strong>
                      <span>{bin.fillLevel.toFixed(1)}% ({bin.status})</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="portal-card span-all">
                <h3>Analytics Graphs</h3>
                <div className="chart-grid">
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={adminAnalytics.dailyWasteTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="totalKg" stroke="#2985d0" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>

                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={adminAnalytics.monthlyReductionGraph}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalKg" fill="#21a067" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="portal-card span-all">
                <h3>Top Waste-Producing Blocks and Leaderboard</h3>
                <div className="split-list">
                  <div>
                    <h4>Top Waste-Producing Blocks</h4>
                    <ul>
                      {adminAnalytics.topWasteProducingBlocks.map((block) => (
                        <li key={block.block}>
                          <strong>{block.block}</strong>
                          <span>{block.totalKg.toFixed(2)} kg</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4>Leaderboard</h4>
                    <ol className="leader-list">
                      {leaderboard.map((entry) => (
                        <li key={entry.residentId}>
                          <span>
                            #{entry.rank} {entry.residentName} ({entry.flatNumber})
                          </span>
                          <strong>{entry.ecoScore.toFixed(1)}</strong>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </section>

              <section className="portal-card span-all">
                <h3>Sustainability and Carbon Footprint</h3>
                <div className="kpi-grid">
                  <div>
                    <span>Compost Produced</span>
                    <strong>{sustainability.compostProducedKg.toFixed(2)} kg</strong>
                  </div>
                  <div>
                    <span>Animal Feed Generated</span>
                    <strong>{sustainability.animalFeedGeneratedKg.toFixed(2)} kg</strong>
                  </div>
                  <div>
                    <span>CO2 Saved</span>
                    <strong>{sustainability.co2SavedKg.toFixed(2)} kg</strong>
                  </div>
                  <div>
                    <span>Carbon Footprint Meter</span>
                    <strong>{sustainability.carbonFootprintMeter.rating}</strong>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ResidentAdminPortal;
