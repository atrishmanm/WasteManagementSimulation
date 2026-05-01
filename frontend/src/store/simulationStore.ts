import { create } from 'zustand';
import { DustbinData, Notification, Authority, SimulationStats } from '../types';

interface SimulationStore {
  dustbins: DustbinData[];
  authorities: Authority[];
  notifications: Notification[];
  isRunning: boolean;
  speed: number;
  stats: SimulationStats;
  
  // Actions
  setDustbins: (dustbins: DustbinData[]) => void;
  updateDustbin: (dustbin: DustbinData) => void;
  setAuthorities: (authorities: Authority[]) => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
  markNotificationAsRead: (id: string) => void;
  setSimulationRunning: (running: boolean) => void;
  setSimulationSpeed: (speed: number) => void;
  setStats: (stats: SimulationStats) => void;
  clearNotifications: () => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  dustbins: [],
  authorities: [],
  notifications: [],
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

  setDustbins: (dustbins) => set({ dustbins }),
  updateDustbin: (dustbin) =>
    set((state) => ({
      dustbins: state.dustbins.map((d) => (d.id === dustbin.id ? dustbin : d)),
    })),
  setAuthorities: (authorities) => set({ authorities }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  markNotificationAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    })),
  setSimulationRunning: (running) => set({ isRunning: running }),
  setSimulationSpeed: (speed) => set({ speed }),
  setStats: (stats) => set({ stats }),
  clearNotifications: () => set({ notifications: [] }),
}));
