import axios from 'axios';
import {
  DustbinData,
  Authority,
  SimulationStats,
  LoginResponse,
  ResidentProfile,
  ResidentDashboardData,
  AdminOverviewData,
  AdminAnalyticsData,
  LeaderboardEntry,
  SustainabilityMetrics,
} from '../types';

const API_BASE = 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 5000,
});

export const simulationService = {
  // Dustbin operations
  getDustbins: async (): Promise<DustbinData[]> => {
    const response = await api.get('/dustbins');
    return response.data;
  },

  getDustbin: async (id: string): Promise<DustbinData> => {
    const response = await api.get(`/dustbins/${id}`);
    return response.data;
  },

  // Authority operations
  getAuthorities: async (): Promise<Authority[]> => {
    const response = await api.get('/authorities');
    return response.data;
  },

  dispatchAuthority: async (dustbinId: string): Promise<void> => {
    await api.post('/authorities/dispatch', { dustbinId });
  },

  // Simulation controls
  startSimulation: async (): Promise<void> => {
    await api.post('/simulation/start');
  },

  stopSimulation: async (): Promise<void> => {
    await api.post('/simulation/stop');
  },

  setSimulationSpeed: async (speed: number): Promise<void> => {
    await api.post('/simulation/speed', { speed });
  },

  getStats: async (): Promise<SimulationStats> => {
    const response = await api.get('/simulation/stats');
    return response.data;
  },

  getSimulationState: async (): Promise<{ isRunning: boolean; speed: number }> => {
    const response = await api.get('/simulation/state');
    return response.data;
  },

  resetSimulation: async (): Promise<void> => {
    await api.post('/simulation/reset');
  },

  // Resident/admin auth and profile
  registerResident: async (payload: {
    flatNumber: string;
    name: string;
    rfidCardId: string;
    password: string;
  }): Promise<{ resident: ResidentProfile }> => {
    const response = await api.post('/auth/register-resident', payload);
    return response.data;
  },

  login: async (payload: {
    role: 'resident' | 'admin';
    username?: string;
    password?: string;
    rfidCardId?: string;
  }): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', payload);
    return response.data;
  },

  getResidents: async (): Promise<ResidentProfile[]> => {
    const response = await api.get('/residents');
    return response.data;
  },

  tapRfidCard: async (payload: {
    residentId: string;
    rfidCardId: string;
  }): Promise<{ authenticated: boolean; binOpened: boolean; expiresAt: string }> => {
    const response = await api.post('/rfid/tap', payload);
    return response.data;
  },

  submitWasteDisposal: async (payload: {
    residentId: string;
    weightKg?: number;
    useRandomWeight?: boolean;
    allowSimulated?: boolean;
  }): Promise<{ entry: unknown }> => {
    const response = await api.post('/waste/dispose', payload);
    return response.data;
  },

  getResidentDashboard: async (residentId: string): Promise<ResidentDashboardData> => {
    const response = await api.get(`/residents/${residentId}/dashboard`);
    return response.data;
  },

  payMonthlyBill: async (residentId: string): Promise<{ payment: unknown }> => {
    const response = await api.post(`/residents/${residentId}/pay`);
    return response.data;
  },

  // Admin APIs
  getAdminOverview: async (): Promise<AdminOverviewData> => {
    const response = await api.get('/admin/overview');
    return response.data;
  },

  getAdminAnalytics: async (): Promise<AdminAnalyticsData> => {
    const response = await api.get('/admin/analytics');
    return response.data;
  },

  getLeaderboard: async (): Promise<LeaderboardEntry[]> => {
    const response = await api.get('/admin/leaderboard');
    return response.data.leaderboard;
  },

  getSustainabilityMetrics: async (): Promise<SustainabilityMetrics> => {
    const response = await api.get('/admin/sustainability');
    return response.data;
  },

  // WebSocket event subscription (for real-time updates)
  getWebSocketUrl: (): string => {
    return 'ws://localhost:3001/ws';
  },
};

export default simulationService;
