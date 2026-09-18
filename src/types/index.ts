export type TunerType = 
  | 'Harrell Standard (50 clicks/rev)'
  | 'Harrell 25-Click'
  | 'Ezell Precision PDMT'
  | 'Gorham Custom'
  | 'Pappas Precision'
  | 'Hoehn 25'
  | 'Custom Weight / Slide';

export interface BarrelProfile {
  id: string;
  serialNumber: string;
  name: string;
  gunsmith: string; // e.g. "Jeremiah Lentz - Lentz Precision Rifles"
  action: string; // e.g. "Stiller 2500X", "Turbo V-1", "RimX", "Vudoo V-22"
  contour: string; // e.g. "Straight Cylinder 0.900", "Lentz Heavy Benchrest"
  lengthInches: number;
  muzzleDiameterInches: number;
  twistRate: string; // e.g. "1:16 Ratchet 5R"
  chamberReamer: string; // e.g. "Lentz Match Calfee 2°", "Eley EPS", "JGS 2500"
  tunerModel: TunerType;
  tunerWeightOz: number;
  totalRounds: number;
  grooves?: string; // e.g. "8-Groove", "5R", "Ratchet"
  tunerSetting?: number; // baseline tuner setting clicks
  tunerWithTubeSetting?: number; // tuner with bloop tube setting clicks
  notes?: string;
  createdAt: string;
}

export interface AmmoLot {
  id: string;
  brand: string; // "Lapua", "Eley", "RWS", "SK"
  model: string; // "Center-X", "Midas+", "Tenex", "R50"
  lotNumber: string;
  boxMuzzleVelocityFps?: number;
  measuredAvgFps?: number;
  standardDeviation?: number;
  extremeSpread?: number;
  testedTempF?: number;
  notes?: string;
  ratingStars?: number; // 1-5
}

export interface ShotPoint {
  id: string;
  x: number; // pixel X on original canvas/image
  y: number; // pixel Y on original canvas/image
  isAutoDetected?: boolean;
}

export interface TargetCalibration {
  refType: 'quarter' | 'dime' | 'one_inch_square' | 'ara_ring_100' | 'custom';
  pointA: { x: number; y: number };
  pointB: { x: number; y: number };
  realDistanceInches: number; // calculated or preset
  pixelsPerInch: number;
}

export interface TargetAnalysis {
  shots: ShotPoint[];
  calibration?: TargetCalibration;
  imageUrl?: string;
  groupSizeInches: number;
  verticalSpreadInches: number;
  horizontalSpreadInches: number;
  meanRadiusInches: number;
  groupMoa50Yd: number;
  centerOfImpact: { x: number; y: number };
}

export interface TuneRun {
  id: string;
  tunerClick: number; // e.g., 0, 5, 10, 15, 20...
  shotCount: number; // e.g., 3, 5, or 10 shots
  verticalSpreadInches: number;
  horizontalSpreadInches: number;
  groupSizeInches: number;
  groupMoa50Yd: number;
  meanRadiusInches?: number;
  notes?: string;
  targetAnalysis?: TargetAnalysis;
}

export interface EnvironmentalConditions {
  tempF: number;
  humidityPercent: number;
  pressureInHg: number;
  elevationFt: number;
  densityAltitudeFt: number;
  windSpeedMph?: number;
  windDirectionClock?: number; // 1-12
  locationName?: string;
  lastUpdated?: string;
}

export interface TuneSession {
  id: string;
  title: string;
  date: string;
  barrelId: string;
  ammoLotId: string;
  distanceYards: number; // standard 50y
  environment: EnvironmentalConditions;
  runs: TuneRun[];
  sweetSpotClick?: number;
  sweetSpotWindow?: { startClick: number; endClick: number; maxVerticalInches: number };
  notes?: string;
}

export interface HarmonicCurvePoint {
  click: number;
  actualVertical?: number;
  fittedVertical: number;
  isSweetSpot?: boolean;
}

export interface ThermalOffsetRecommendation {
  baselineTempF: number;
  currentTempF: number;
  deltaTempF: number;
  baselineClick: number;
  recommendedClick: number;
  clickAdjustment: number;
  explanation: string;
}

// ─── Purdy Method 4 Types ───────────────────────────────────────────────────

export type PurdyMode =
  | 'ninth'
  | 'eleventh'
  | 'third_long'
  | 'eleventh_qtr'
  | 'thirteenth_qtr';

export type CorrectionMethod = 'jmp' | 'chacon' | 'purdy';

export interface PurdyModeResult {
  mode: PurdyMode;
  label: string;
  ratio: string;          // human-readable, e.g. "9/8"
  ratioValue: number;     // numeric, e.g. 1.125
  resonantLength: number; // inches
  endCorrection: number;  // inches
  tunerDimensionInches: number;
  isRecommended: boolean; // true for the most common benchrest mode
}

export interface VelocityClickEntry {
  velocityFps: number;
  clicks: number;
}

// ─── Match Day & Snapshot Types ─────────────────────────────────────────────

/** A single relay within a match day */
export interface MatchRelay {
  id: string;
  relayNumber: number;
  score?: number;
  xCount?: number;
  tunerClick: number;
  conditions: EnvironmentalConditions;
  notes?: string;
  timestamp: string;
}

/** Match type presets */
export type MatchType = 'ARA 2500' | 'PSL' | 'IR50/50' | 'Practice' | 'Lot Test' | 'Other';

/** A full match day log */
export interface MatchDayLog {
  id: string;
  date: string;
  venue: string;
  matchType: MatchType;
  barrelId: string;
  ammoLotId: string;
  relays: MatchRelay[];
  totalScore?: number;
  totalXCount?: number;
  startingConditions: EnvironmentalConditions;
  tunerClickUsed: number;
  notes?: string;
  createdAt: string;
}

/** A quick condition snapshot */
export interface ConditionSnapshot {
  id: string;
  timestamp: string;
  conditions: EnvironmentalConditions;
  tunerClick: number;
  note?: string;
  matchDayId?: string;
  score?: number;
}

