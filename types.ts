export enum AppPhase {
  SETUP = 'SETUP',
  CALIBRATION = 'CALIBRATION',
  GAME = 'GAME'
}

export interface Dart {
  zone: string; // e.g., "Triple 20", "Bullseye"
  score: number;
  coordinates?: { x: number; y: number }; // Normalized coordinates 0-1000
}

export interface VisionResponse {
  detected: boolean;
  message: string;
  darts?: Dart[];
  totalScore?: number;
  sectorsIdentified?: boolean;
}

export interface CalibrationState {
  isStable: boolean;
  sectorsFound: boolean;
  lastCheck: number;
}

export interface LogEntry {
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'error';
}