import { ShotPoint, TargetAnalysis, TuneRun, ThermalOffsetRecommendation } from '@/types';

/**
 * 1 MOA at 100 yards is 1.047 inches.
 * At 50 yards (standard .22 LR rimfire benchrest), 1 MOA is 0.5235 inches.
 */
export const INCHES_PER_MOA_AT_50YD = 0.5235;

/**
 * Calculate distance between two 2D points
 */
export function euclideanDistance(p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Calculate Center-to-Center Target Analysis from shot coordinates and scale calibration
 */
export function calculateTargetMetrics(
  shots: ShotPoint[],
  pixelsPerInch: number,
  imageUrl?: string,
  calibration?: any
): TargetAnalysis {
  if (shots.length === 0) {
    return {
      shots: [],
      imageUrl,
      calibration,
      groupSizeInches: 0,
      verticalSpreadInches: 0,
      horizontalSpreadInches: 0,
      meanRadiusInches: 0,
      groupMoa50Yd: 0,
      centerOfImpact: { x: 0, y: 0 },
    };
  }

  // Center of impact (mean X and Y)
  const sumX = shots.reduce((acc, s) => acc + s.x, 0);
  const sumY = shots.reduce((acc, s) => acc + s.y, 0);
  const coi = { x: sumX / shots.length, y: sumY / shots.length };

  if (shots.length === 1) {
    return {
      shots,
      imageUrl,
      calibration,
      groupSizeInches: 0,
      verticalSpreadInches: 0,
      horizontalSpreadInches: 0,
      meanRadiusInches: 0,
      groupMoa50Yd: 0,
      centerOfImpact: coi,
    };
  }

  // Extreme spread (max distance between any two shots)
  let maxDistPx = 0;
  for (let i = 0; i < shots.length; i++) {
    for (let j = i + 1; j < shots.length; j++) {
      const d = euclideanDistance(shots[i], shots[j]);
      if (d > maxDistPx) maxDistPx = d;
    }
  }

  // Vertical spread: max Y - min Y
  const ys = shots.map((s) => s.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const vertSpreadPx = maxY - minY;

  // Horizontal spread: max X - min X
  const xs = shots.map((s) => s.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const horizSpreadPx = maxX - minX;

  // Mean radius: average distance of all shots to the center of impact
  const sumRadiusPx = shots.reduce((acc, s) => acc + euclideanDistance(s, coi), 0);
  const meanRadiusPx = sumRadiusPx / shots.length;

  const ppi = pixelsPerInch > 0 ? pixelsPerInch : 100;
  const groupSizeInches = Number((maxDistPx / ppi).toFixed(3));
  const verticalSpreadInches = Number((vertSpreadPx / ppi).toFixed(3));
  const horizontalSpreadInches = Number((horizSpreadPx / ppi).toFixed(3));
  const meanRadiusInches = Number((meanRadiusPx / ppi).toFixed(3));
  const groupMoa50Yd = Number((groupSizeInches / INCHES_PER_MOA_AT_50YD).toFixed(3));

  return {
    shots,
    calibration,
    imageUrl,
    groupSizeInches,
    verticalSpreadInches,
    horizontalSpreadInches,
    meanRadiusInches,
    groupMoa50Yd,
    centerOfImpact: coi,
  };
}

/**
 * 2nd to 3rd degree polynomial regression for harmonic curve fitting
 */
export function fitHarmonicCurve(runs: TuneRun[], degree = 3): (x: number) => number {
  if (runs.length < 3) {
    const avg = runs.reduce((acc, r) => acc + r.verticalSpreadInches, 0) / (runs.length || 1);
    return () => avg;
  }

  const sorted = [...runs].sort((a, b) => a.tunerClick - b.tunerClick);
  const x = sorted.map((r) => r.tunerClick);
  const y = sorted.map((r) => r.verticalSpreadInches);
  const n = x.length;
  const d = Math.min(degree, n - 1);

  // Solve normal equations for polynomial fitting via Gaussian elimination
  const matrix: number[][] = [];
  const vector: number[] = [];

  for (let i = 0; i <= d; i++) {
    matrix[i] = [];
    for (let j = 0; j <= d; j++) {
      let sumX = 0;
      for (let k = 0; k < n; k++) {
        sumX += Math.pow(x[k], i + j);
      }
      matrix[i][j] = sumX;
    }
    let sumY = 0;
    for (let k = 0; k < n; k++) {
      sumY += y[k] * Math.pow(x[k], i);
    }
    vector[i] = sumY;
  }

  // Gaussian elimination
  for (let i = 0; i <= d; i++) {
    let maxRow = i;
    for (let k = i + 1; k <= d; k++) {
      if (Math.abs(matrix[k][i]) > Math.abs(matrix[maxRow][i])) {
        maxRow = k;
      }
    }
    [matrix[i], matrix[maxRow]] = [matrix[maxRow], matrix[i]];
    [vector[i], vector[maxRow]] = [vector[maxRow], vector[i]];

    for (let k = i + 1; k <= d; k++) {
      const factor = matrix[k][i] / (matrix[i][i] || 1e-9);
      for (let j = i; j <= d; j++) {
        matrix[k][j] -= factor * matrix[i][j];
      }
      vector[k] -= factor * vector[i];
    }
  }

  const coeffs = new Array(d + 1).fill(0);
  for (let i = d; i >= 0; i--) {
    let sum = vector[i];
    for (let j = i + 1; j <= d; j++) {
      sum -= matrix[i][j] * coeffs[j];
    }
    coeffs[i] = sum / (matrix[i][i] || 1e-9);
  }

  return (val: number) => {
    let res = 0;
    for (let i = 0; i <= d; i++) {
      res += coeffs[i] * Math.pow(val, i);
    }
    return Math.max(0, res);
  };
}

/**
 * Identify the harmonic sweet spot and the "Forgiving Window"
 */
export function analyzeHarmonics(runs: TuneRun[]): {
  sweetSpotClick: number;
  minVerticalInches: number;
  forgivingWindow: { startClick: number; endClick: number; maxVerticalInches: number };
  curvePoints: { click: number; actualVertical?: number; fittedVertical: number }[];
} {
  if (runs.length === 0) {
    return {
      sweetSpotClick: 0,
      minVerticalInches: 0,
      forgivingWindow: { startClick: 0, endClick: 0, maxVerticalInches: 0 },
      curvePoints: [],
    };
  }

  const sorted = [...runs].sort((a, b) => a.tunerClick - b.tunerClick);
  const minClick = sorted[0].tunerClick;
  const maxClick = sorted[sorted.length - 1].tunerClick;
  const polyFit = fitHarmonicCurve(sorted, sorted.length >= 5 ? 3 : 2);

  // Sample fitted curve every 0.5 clicks
  const curvePoints: { click: number; actualVertical?: number; fittedVertical: number }[] = [];
  let bestClick = minClick;
  let bestVertical = Infinity;

  // Track known points
  const runMap = new Map<number, number>();
  sorted.forEach((r) => runMap.set(r.tunerClick, r.verticalSpreadInches));

  const step = Math.max(0.5, (maxClick - minClick) / 100);
  for (let c = minClick; c <= maxClick + 0.001; c += step) {
    const fitted = Number(polyFit(c).toFixed(3));
    const roundClick = Math.round(c * 10) / 10;
    const actual = runMap.get(roundClick);

    curvePoints.push({
      click: roundClick,
      actualVertical: actual,
      fittedVertical: fitted,
    });

    if (fitted < bestVertical) {
      bestVertical = fitted;
      bestClick = Math.round(c);
    }
  }

  // Also check if an actual recorded run was even lower
  sorted.forEach((r) => {
    if (r.verticalSpreadInches < bestVertical) {
      bestVertical = r.verticalSpreadInches;
      bestClick = r.tunerClick;
    }
  });

  // Calculate Forgiving Window: range where vertical <= bestVertical * 1.25 or bestVertical + 0.035"
  const windowThreshold = Math.max(bestVertical * 1.25, bestVertical + 0.035);
  let startClick = bestClick;
  let endClick = bestClick;

  // Search left
  for (let c = bestClick; c >= minClick; c -= 1) {
    if (polyFit(c) <= windowThreshold) {
      startClick = c;
    } else {
      break;
    }
  }

  // Search right
  for (let c = bestClick; c <= maxClick; c += 1) {
    if (polyFit(c) <= windowThreshold) {
      endClick = c;
    } else {
      break;
    }
  }

  return {
    sweetSpotClick: bestClick,
    minVerticalInches: Number(bestVertical.toFixed(3)),
    forgivingWindow: {
      startClick,
      endClick,
      maxVerticalInches: Number(windowThreshold.toFixed(3)),
    },
    curvePoints,
  };
}

/**
 * Calculate Density Altitude (DA) in feet
 * Standard ISA equations
 */
export function calculateDensityAltitude(
  elevationFt: number,
  tempF: number,
  pressureInHg: number
): number {
  // Pressure Altitude = (29.92 - altimeter) * 1000 + elevation
  const pressureAlt = (29.92 - pressureInHg) * 1000 + elevationFt;
  // Standard temperature at pressure altitude in Celsius
  const isaTempC = 15 - 1.98 * (pressureAlt / 1000);
  const actualTempC = (tempF - 32) * (5 / 9);
  // DA formula approx
  const da = pressureAlt + 118.8 * (actualTempC - isaTempC);
  return Math.round(da);
}

/**
 * Thermal & Environmental Shift Compensator
 * Benchrest physics rule: 416R barrel steel expands/stiffens slightly with cold,
 * and rimfire match ammo velocity rises ~1.5 - 2 fps per 10°F.
 * In Harrell tuners, this typically results in roughly 1 click adjustment per ~5°F to 7°F shift.
 */
export function calculateThermalOffset(
  baselineTempF: number,
  currentTempF: number,
  baselineClick: number,
  tunerType = 'Harrell Standard (50 clicks/rev)'
): ThermalOffsetRecommendation {
  const deltaTempF = currentTempF - baselineTempF;
  // Coefficient: ~0.18 clicks per 1 deg F (or 1 click per 5.5°F)
  const clicksPerDegF = tunerType.includes('25') ? 0.09 : 0.18;
  const rawClickAdj = deltaTempF * clicksPerDegF;
  const clickAdjustment = Math.round(rawClickAdj);
  const recommendedClick = baselineClick + clickAdjustment;

  let explanation = '';
  if (Math.abs(deltaTempF) < 3) {
    explanation = 'Temperature is nearly identical to baseline session. Maintain current tuner position.';
  } else if (deltaTempF > 0) {
    explanation = `Ambient temperature warmed by +${deltaTempF.toFixed(1)}°F. Barrels cycle faster at higher thermal states and ammo burns hotter. Recommend dialing +${clickAdjustment} click${Math.abs(clickAdjustment) === 1 ? '' : 's'} (outward) to push the muzzle node back into positive compensation timing.`;
  } else {
    explanation = `Ambient temperature cooled by ${deltaTempF.toFixed(1)}°F. Cold air slows ammo burn rate and alters barrel modulus. Recommend dialing ${clickAdjustment} click${Math.abs(clickAdjustment) === 1 ? '' : 's'} (inward) to preserve vertical suppression.`;
  }

  return {
    baselineTempF,
    currentTempF,
    deltaTempF: Number(deltaTempF.toFixed(1)),
    baselineClick,
    recommendedClick,
    clickAdjustment,
    explanation,
  };
}


// ─── Purdy Method 4 — Barrel Harmonic Tuner Calculator ──────────────────────
// Decoded from Jeremiah Lentz's "Purdy Method 4" Numbers spreadsheet.
// All five harmonic modes verified against spreadsheet data (24.241" barrel).
//
// Core formula:
//   ResonantLength    = BarrelLength × harmonicRatio
//   EndCorrection     = MuzzleOD × correctionFactor
//   TunerDimension    = ResonantLength − BarrelLength − EndCorrection

import { PurdyMode, CorrectionMethod, PurdyModeResult, VelocityClickEntry } from '@/types';

/** Harmonic mode definitions with Purdy ratios */
export const PURDY_HARMONIC_MODES: Array<{
  mode: PurdyMode;
  label: string;
  ratio: string;
  ratioValue: number;
  isRecommended: boolean;
}> = [
  { mode: 'ninth',          label: '9th Harmonic',             ratio: '9/8',   ratioValue: 9/8,   isRecommended: true  },
  { mode: 'eleventh',       label: '11th Harmonic',            ratio: '11/10', ratioValue: 11/10, isRecommended: false },
  { mode: 'third_long',     label: '3rd Harmonic (Long Tube)', ratio: '3/2',   ratioValue: 3/2,   isRecommended: false },
  { mode: 'eleventh_qtr',   label: '11th Qtr Harmonic (Short)',ratio: '11/8',  ratioValue: 11/8,  isRecommended: false },
  { mode: 'thirteenth_qtr', label: '13th Qtr Harmonic (Short)',ratio: '13/10', ratioValue: 13/10, isRecommended: false },
];

/** End correction multiplier by method */
export const CORRECTION_FACTORS: Record<CorrectionMethod, number> = {
  jmp:    0.264,  // JMP correction — matches spreadsheet exactly
  chacon: 0.295,  // Chacon correction
  purdy:  0.300,  // Purdy correction
};

/**
 * Lentz velocity-to-click table from the Purdy Method 4 spreadsheet.
 * Maps measured muzzle velocity (fps) → tuner starting click position.
 * ~3.33 fps per click. Extrapolates linearly outside this range.
 */
export const LENTZ_VELOCITY_CLICK_TABLE: VelocityClickEntry[] = [
  { velocityFps: 1053, clicks: 21 },
  { velocityFps: 1056, clicks: 22 },
  { velocityFps: 1060, clicks: 23 },
  { velocityFps: 1063, clicks: 24 },
  { velocityFps: 1066, clicks: 25 },
  { velocityFps: 1070, clicks: 26 },
  { velocityFps: 1073, clicks: 27 },
  { velocityFps: 1076, clicks: 28 },
  { velocityFps: 1079, clicks: 29 },
  { velocityFps: 1083, clicks: 30 },
];

/**
 * Calculate tuner dimension for a single Purdy harmonic mode.
 *
 * @param barrelLengthInches - Measured barrel length (e.g. 24.241)
 * @param muzzleODInches     - Muzzle outer diameter (e.g. 1.341)
 * @param mode               - Which harmonic mode to calculate
 * @param correctionMethod   - Which end-correction factor to use (default: 'jmp')
 */
export function calculatePurdyTunerDimension(
  barrelLengthInches: number,
  muzzleODInches: number,
  mode: PurdyMode,
  correctionMethod: CorrectionMethod = 'jmp'
): PurdyModeResult {
  const modeDef = PURDY_HARMONIC_MODES.find((m) => m.mode === mode)!;
  const correctionFactor = CORRECTION_FACTORS[correctionMethod];

  const resonantLength = Number((barrelLengthInches * modeDef.ratioValue).toFixed(3));
  const endCorrection  = Number((muzzleODInches * correctionFactor).toFixed(3));
  const tunerDim       = Number((resonantLength - barrelLengthInches - endCorrection).toFixed(3));

  return {
    mode: modeDef.mode,
    label: modeDef.label,
    ratio: modeDef.ratio,
    ratioValue: modeDef.ratioValue,
    resonantLength,
    endCorrection,
    tunerDimensionInches: tunerDim,
    isRecommended: modeDef.isRecommended,
  };
}

/**
 * Calculate all five Purdy harmonic modes at once.
 * Returns them in the same order as the spreadsheet rows.
 */
export function calculateAllPurdyModes(
  barrelLengthInches: number,
  muzzleODInches: number,
  correctionMethod: CorrectionMethod = 'jmp'
): PurdyModeResult[] {
  return PURDY_HARMONIC_MODES.map((m) =>
    calculatePurdyTunerDimension(barrelLengthInches, muzzleODInches, m.mode, correctionMethod)
  );
}

/**
 * Chacon reference number for a barrel length.
 * Formula derived from table: every 1" of barrel = 0.125" tuner dimension.
 * Reference: 20" barrel = 2.247"
 */
export function chaconReferenceNumber(barrelLengthInches: number): number {
  return Number(((barrelLengthInches - 20) * 0.125 + 2.247).toFixed(3));
}

/**
 * Convert measured muzzle velocity (fps) to a suggested tuner starting click
 * using Jeremiah Lentz's velocity-to-click table.
 * Interpolates linearly within the table and extrapolates beyond it.
 *
 * @returns { clicks, isInterpolated, nearestBelow, nearestAbove }
 */
export function velocityToStartingClick(velocityFps: number): {
  clicks: number;
  isInterpolated: boolean;
  nearestBelow: VelocityClickEntry | null;
  nearestAbove: VelocityClickEntry | null;
} {
  const table = LENTZ_VELOCITY_CLICK_TABLE;

  // Exact match
  const exact = table.find((e) => e.velocityFps === velocityFps);
  if (exact) {
    return { clicks: exact.clicks, isInterpolated: false, nearestBelow: exact, nearestAbove: exact };
  }

  // Below minimum — extrapolate down (~3.33 fps/click)
  if (velocityFps < table[0].velocityFps) {
    const delta = table[0].velocityFps - velocityFps;
    const clicks = Math.max(1, Math.round(table[0].clicks - delta / 3.33));
    return { clicks, isInterpolated: true, nearestBelow: null, nearestAbove: table[0] };
  }

  // Above maximum — extrapolate up
  const last = table[table.length - 1];
  if (velocityFps > last.velocityFps) {
    const delta = velocityFps - last.velocityFps;
    const clicks = Math.round(last.clicks + delta / 3.33);
    return { clicks, isInterpolated: true, nearestBelow: last, nearestAbove: null };
  }

  // Interpolate between two entries
  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i];
    const hi = table[i + 1];
    if (velocityFps >= lo.velocityFps && velocityFps <= hi.velocityFps) {
      const t = (velocityFps - lo.velocityFps) / (hi.velocityFps - lo.velocityFps);
      const clicks = Math.round(lo.clicks + t * (hi.clicks - lo.clicks));
      return { clicks, isInterpolated: true, nearestBelow: lo, nearestAbove: hi };
    }
  }

  return { clicks: 26, isInterpolated: false, nearestBelow: null, nearestAbove: null };
}

/**
 * Legacy PRX estimate — kept for backwards compatibility.
 * Prefer calculatePurdyTunerDimension() for new code.
 */
export function estimatePRXStartingClick(
  barrelLengthInches: number,
  muzzleDiameterInches: number,
  tunerWeightOz: number,
  avgVelocityFps = 1065
): {
  recommendedStartingMark: number;
  explanation: string;
} {
  const purdy = calculatePurdyTunerDimension(barrelLengthInches, muzzleDiameterInches, 'ninth', 'jmp');
  const velClick = velocityToStartingClick(avgVelocityFps);
  const estimated = velClick.clicks;

  return {
    recommendedStartingMark: estimated,
    explanation: `Purdy Method 4 (9th Harmonic, JMP): Target tuner dimension ${purdy.tunerDimensionInches}" for ${barrelLengthInches}" barrel. Velocity-based starting click: ${estimated} (${avgVelocityFps} fps). Bracket ±8 clicks in 2-click increments.`,
  };
}
