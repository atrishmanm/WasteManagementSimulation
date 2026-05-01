// Types and interfaces for the waste management system

export type DustbinStatus = 'empty' | 'warning' | 'critical' | 'collecting';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface DustbinData {
  id: string;
  name: string;
  location: Location;
  fillLevel: number; // 0-100
  status: DustbinStatus;
  lastUpdated: Date;
  capacity: number; // in kg
  weight: number; // current weight in kg
  sensorActive: boolean;
  collectionCount: number;
}

export interface Authority {
  id: string;
  name: string;
  location: Location;
  availableVehicles: number;
  currentRoute?: DustbinData[];
}

export interface Notification {
  id: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  dustbinId?: string;
  read: boolean;
}

export interface SimulationStats {
  totalDustbins: number;
  emptyBins: number;
  warningBins: number;
  criticalBins: number;
  collectingBins: number;
  averageFillLevel: number;
  totalCollections: number;
}

export interface ResidentProfile {
  id: string;
  flatNumber: string;
  name: string;
  rfidCardId: string;
  greenPoints: number;
}

export interface LoginResponse {
  role: 'resident' | 'admin';
  user: {
    id: string;
    name: string;
    username?: string;
    flatNumber?: string;
    rfidCardId?: string;
    greenPoints?: number;
  };
}

export interface DailyWastePoint {
  day: string;
  totalKg: number;
}

export interface PaymentRecord {
  id: string;
  residentId: string;
  amount: number;
  paidAt: string;
}

export interface ResidentSystemNotification {
  id: string;
  residentId: string;
  type: 'critical' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface ResidentDashboardData {
  resident: ResidentProfile;
  totalWasteThisMonthKg: number;
  currentBillAmount: number;
  dailyDisposalHistory: DailyWastePoint[];
  rankAmongResidents: {
    rank: number;
    totalResidents: number;
  };
  aiWastePredictionTomorrowKg: number;
  monthlyBestResidentAward: {
    residentName: string;
    flatNumber: string;
    ecoScore: number;
  } | null;
  previousPayments: PaymentRecord[];
  notifications: ResidentSystemNotification[];
  ratePerKg: number;
}

export interface AdminOverviewData {
  totalWasteCollectedToday: number;
  activeUsers: number;
  fullBinsList: Array<{
    id: string;
    name: string;
    fillLevel: number;
    status: DustbinStatus;
  }>;
  revenueCollected: number;
  binsNeedingPickup: Array<{
    id: string;
    name: string;
    fillLevel: number;
  }>;
  suggestedRoute: Array<{
    stop: number;
    binId: string;
    binName: string;
    fillLevel: number;
  }>;
}

export interface AdminAnalyticsData {
  dailyWasteTrend: DailyWastePoint[];
  monthlyReductionGraph: Array<{
    month: string;
    totalKg: number;
  }>;
  topWasteProducingBlocks: Array<{
    block: string;
    totalKg: number;
  }>;
  aiWastePrediction: {
    tomorrowKg: number;
    method: string;
  };
}

export interface LeaderboardEntry {
  residentId: string;
  residentName: string;
  flatNumber: string;
  wasteKg: number;
  greenPoints: number;
  ecoScore: number;
  rank: number;
}

export interface SustainabilityMetrics {
  totalWasteKg: number;
  compostProducedKg: number;
  animalFeedGeneratedKg: number;
  co2SavedKg: number;
  carbonFootprintMeter: {
    emissionsSavedKg: number;
    rating: string;
  };
}
