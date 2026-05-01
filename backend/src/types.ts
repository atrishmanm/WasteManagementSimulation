export type DustbinStatus = 'empty' | 'warning' | 'critical' | 'collecting';

export interface Location {
  latitude: number;
  longitude: number;
}

export interface DustbinData {
  id: string;
  name: string;
  location: Location;
  fillLevel: number;
  status: DustbinStatus;
  lastUpdated: Date;
  capacity: number;
  weight: number;
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
