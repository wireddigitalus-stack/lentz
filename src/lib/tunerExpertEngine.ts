/**
 * Lentz TunerPro — Expert Knowledge Engine
 *
 * Comprehensive rule-based AI advisor that covers 20+ topic categories,
 * fetches live weather from Open-Meteo, and uses the full ballistics
 * library to generate context-aware, computed answers.
 *
 * Zero external API costs — all intelligence is baked-in domain expertise.
 */

import { TuneSession, BarrelProfile, AmmoLot, EnvironmentalConditions } from '@/types';
import {
  analyzeHarmonics,
  calculateDensityAltitude,
  calculateThermalOffset,
  calculateAllPurdyModes,
  velocityToStartingClick,
  chaconReferenceNumber,
  INCHES_PER_MOA_AT_50YD,
} from '@/lib/ballistics';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExpertContext {
  session: TuneSession;
  barrel?: BarrelProfile;
  ammo?: AmmoLot;
  currentClick: number;
}

export interface LiveWeatherData {
  tempF: number;
  humidityPercent: number;
  pressureInHg: number;
  windSpeedMph: number;
  windDirectionClock: number;
  elevationFt: number;
  densityAltitudeFt: number;
  locationName: string;
}

export interface ExpertResponse {
  text: string;
  actions?: { label: string; clickValue?: number }[];
  /** If set, the advisor fetched fresh weather — caller should update app env state */
  updatedEnvironment?: Partial<EnvironmentalConditions>;
  thinkingLabel?: string;
}

// ─── Live Weather ───────────────────────────────────────────────────────────

const PRESET_RANGES = [
  { name: 'Bristol / Blountville, TN (Lentz Home Range)', lat: 36.5334, lon: -82.3276, elevation: 1520 },
  { name: 'Kettlefoot Rod & Gun Club, VA', lat: 36.6322, lon: -82.0298, elevation: 1980 },
  { name: 'St. Louis Benchrest Club, MO', lat: 38.627, lon: -90.1994, elevation: 510 },
  { name: 'Raton Whittington Center, NM', lat: 36.9034, lon: -104.4391, elevation: 6600 },
];

async function fetchLiveWeather(env: EnvironmentalConditions): Promise<LiveWeatherData | null> {
  // Try GPS first
  let lat = 36.5334;
  let lon = -82.3276;
  let elev = env.elevationFt || 1520;
  let locName = env.locationName || 'Bristol / Blountville, TN';

  // Match by location name if we have one
  const match = PRESET_RANGES.find(
    (r) => env.locationName && env.locationName.toLowerCase().includes(r.name.split(',')[0].toLowerCase())
  );
  if (match) {
    lat = match.lat;
    lon = match.lon;
    elev = match.elevation;
    locName = match.name;
  }

  // Attempt GPS
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error('No GPS'));
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000, maximumAge: 120000 });
    });
    lat = pos.coords.latitude;
    lon = pos.coords.longitude;
    locName = `GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
  } catch {
    // Fall back to preset/session location — totally fine
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const c = data.current;

    const pressureInHg = Number((c.surface_pressure * 0.02953).toFixed(2));
    const tempF = Math.round(c.temperature_2m);
    const humidityPercent = Math.round(c.relative_humidity_2m);
    const windSpeedMph = Math.round(c.wind_speed_10m);
    const windDirectionClock = Math.round(c.wind_direction_10m / 30) || 12;
    const elevationFt = data.elevation != null ? Math.round(data.elevation * 3.28084) : elev;
    const densityAltitudeFt = calculateDensityAltitude(elevationFt, tempF, pressureInHg);

    return {
      tempF,
      humidityPercent,
      pressureInHg,
      windSpeedMph,
      windDirectionClock,
      elevationFt,
      densityAltitudeFt,
      locationName: locName,
    };
  } catch {
    return null;
  }
}

// ─── Derived Weather Calculations ───────────────────────────────────────────

function windCalcs(speedMph: number, clockDir: number) {
  const angle = (clockDir % 12) * 30;
  const crosswind = Math.abs(speedMph * Math.sin((angle * Math.PI) / 180));
  const headwind = speedMph * Math.cos((angle * Math.PI) / 180);
  const driftInches = crosswind * 0.085; // .22LR @ 50yd
  const mirage =
    speedMph <= 2
      ? 'Boil / Vertical Waves'
      : speedMph <= 6
      ? 'Walking 45° Mirage'
      : speedMph <= 10
      ? 'Flat Horizontal Stream'
      : 'Washed Out (Flag Reading Only)';
  return { crosswind, headwind, driftInches, mirage };
}

function dewPoint(tempF: number, humPct: number) {
  return Math.round(tempF - (100 - humPct) / 5);
}

function daCategory(da: number) {
  if (da < 1000) return 'Dense Air — high drag, slightly slower bullets. Tuner may need +1 click outward.';
  if (da <= 3000) return 'Standard match air. Optimal conditions for rimfire.';
  return 'Thin high-altitude air — lower drag, faster bullet exit. Watch for flatter trajectories.';
}

// ─── Topic Classifier ───────────────────────────────────────────────────────

type Topic =
  | 'sweet_spot'
  | 'thermal_drift'
  | 'weather_report'
  | 'density_altitude'
  | 'wind_mirage'
  | 'starting_click'
  | 'chacon'
  | 'barrel_info'
  | 'ammo_info'
  | 'prx_physics'
  | 'forgiving_window'
  | 'target_paper'
  | 'bracketing'
  | 'es_sd'
  | 'session_summary'
  | 'humidity_pressure'
  | 'dew_point'
  | 'match_prep'
  | 'relay_advice'
  | 'tuner_basics'
  | 'greeting'
  | 'fallback';

function classifyTopic(q: string): Topic {
  const l = q.toLowerCase();

  // Greeting
  if (/^(hello|hi|hey|thanks|thank you|good morning|good afternoon|howdy|yo)\b/.test(l)) return 'greeting';

  // Specific topics — ordered from most specific to least
  if (l.includes('sweet spot') || l.includes('diagnose') || l.includes('node health')) return 'sweet_spot';
  if (l.includes('forgiving') || l.includes('plateau') || l.includes('how wide')) return 'forgiving_window';
  if (l.includes('thermal') || l.includes('relay 2') || l.includes('temperature shift') || l.includes('temp drift')) return 'thermal_drift';
  if (l.includes('next relay') || l.includes('between relay') || l.includes('relay change') || l.includes('relay to relay')) return 'relay_advice';
  if (l.includes('density altitude') || /\bda\b/.test(l) || l.includes('air density')) return 'density_altitude';
  if (l.includes('weather') || l.includes('conditions') || l.includes('what\'s it like') || l.includes('whats it like') || l.includes('outside') || l.includes('current conditions')) return 'weather_report';
  if (l.includes('wind') || l.includes('mirage') || l.includes('flag') || l.includes('crosswind') || l.includes('drift')) return 'wind_mirage';
  if (l.includes('purdy') || l.includes('starting click') || l.includes('start click') || l.includes('what click') || l.includes('where to start') || l.includes('where should i start') || l.includes('tuner dimension')) return 'starting_click';
  if (l.includes('chacon') || l.includes('reference number')) return 'chacon';
  if (l.includes('barrel') || l.includes('my rifle') || l.includes('my gun') || l.includes('what barrel') || l.includes('rifle info')) return 'barrel_info';
  if (l.includes('ammo') || l.includes('lot') || l.includes('center-x') || l.includes('center x') || l.includes('eley') || l.includes('tenex') || l.includes('midas') || l.includes('what ammo') || l.includes('velocity')) return 'ammo_info';
  if (l.includes('prx') || l.includes('positive compensation') || l.includes('physics') || l.includes('how does the tuner') || l.includes('how tuner') || l.includes('why tuner')) return 'prx_physics';
  if (l.includes('target') || l.includes('tear') || l.includes('double hole') || l.includes('overlapping') || l.includes('paper')) return 'target_paper';
  if (l.includes('bracket') || l.includes('test') || l.includes('protocol') || l.includes('how to test') || l.includes('testing strategy')) return 'bracketing';
  if (l.includes('extreme spread') || /\bes\b/.test(l) || /\bsd\b/.test(l) || l.includes('standard deviation')) return 'es_sd';
  if (l.includes('session') || l.includes('summary') || l.includes('where am i') || l.includes('status') || l.includes('overview')) return 'session_summary';
  if (l.includes('humidity') || l.includes('barometric') || l.includes('pressure') || l.includes('baro')) return 'humidity_pressure';
  if (l.includes('dew point') || l.includes('dew') || l.includes('condensation') || l.includes('moisture')) return 'dew_point';
  if (l.includes('match') || l.includes('competition') || l.includes('ara') || l.includes('psl') || l.includes('ir50') || l.includes('prep') || l.includes('checklist')) return 'match_prep';
  if (l.includes('help') || l.includes('what can you') || l.includes('what do you') || l.includes('explain') || l.includes('how does') || l.includes('tuner basics') || l.includes('beginner')) return 'tuner_basics';

  return 'fallback';
}

// ─── Does This Topic Need Live Weather? ─────────────────────────────────────

const WEATHER_TOPICS = new Set<Topic>([
  'weather_report',
  'density_altitude',
  'wind_mirage',
  'thermal_drift',
  'relay_advice',
  'humidity_pressure',
  'dew_point',
  'match_prep',
  'session_summary',
]);

// ─── Response Builders ──────────────────────────────────────────────────────

function buildSweetSpot(ctx: ExpertContext): ExpertResponse {
  const runs = ctx.session.runs || [];
  const ha = analyzeHarmonics(runs);
  const ww = ha.forgivingWindow.endClick - ha.forgivingWindow.startClick + 1;

  if (runs.length === 0) {
    return {
      text: '**No test runs recorded yet.**\n\nTo find your sweet spot, I recommend bracketing 8-10 tuner settings across a 20-click range (e.g., Click 5 through Click 25 in 2-click increments). Shoot 5-shot groups at each setting and record the vertical spread. I\'ll find your harmonic node from the data.\n\nWant me to calculate your starting click based on the Purdy Method?',
      actions: [{ label: 'Calculate Starting Click' }],
    };
  }

  let verdict = '';
  if (ha.minVerticalInches <= 0.125) {
    verdict = `**Exceptional**: Sub-quarter-inch vertical (${ha.minVerticalInches}" = ${(ha.minVerticalInches / INCHES_PER_MOA_AT_50YD).toFixed(2)} MOA). The barrel is achieving near-optimal positive launch angle compensation. You are match-ready.`;
  } else if (ha.minVerticalInches <= 0.25) {
    verdict = `**Good node found**: ${ha.minVerticalInches}" vertical (${(ha.minVerticalInches / INCHES_PER_MOA_AT_50YD).toFixed(2)} MOA). Competitive, but fine-tuning ±1 click around the sweet spot may tighten it further.`;
  } else {
    verdict = `**Node needs refinement**: ${ha.minVerticalInches}" vertical is above the competitive threshold. Consider finer bracketing in 1-click increments around Click ${ha.sweetSpotClick}.`;
  }

  const text = `**Harmonic Node Evaluation for ${ctx.barrel?.name || 'Your Barrel'}:**\n\n` +
    `• **Sweet Spot**: **Click ${ha.sweetSpotClick}** (Min Vertical: ${ha.minVerticalInches}")\n` +
    `• **Forgiving Window**: **${ha.forgivingWindow.startClick}c to ${ha.forgivingWindow.endClick}c** (${ww} clicks wide)\n` +
    `• **Test Runs**: ${runs.length} groups recorded\n\n` +
    `**Verdict**: ${verdict}`;

  return {
    text,
    actions: [{ label: `Dial to ${ha.sweetSpotClick} Clicks`, clickValue: ha.sweetSpotClick }],
  };
}

function buildThermalDrift(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const baselineTemp = 72;
  const baselineClick = ctx.session.sweetSpotClick ?? ctx.currentClick;
  const currentTemp = weather?.tempF ?? ctx.session.environment.tempF;
  const thermal = calculateThermalOffset(baselineTemp, currentTemp, baselineClick);

  const da = weather
    ? weather.densityAltitudeFt
    : calculateDensityAltitude(ctx.session.environment.elevationFt, currentTemp, ctx.session.environment.pressureInHg);

  let weatherNote = '';
  if (weather) {
    weatherNote = `\n\n📡 *Live weather data from ${weather.locationName}*`;
  }

  const text = `**Thermal Drift Analysis:**\n\n` +
    `• **Baseline Session Temp**: ${baselineTemp}°F\n` +
    `• **Current Temp**: ${currentTemp}°F (Δ ${thermal.deltaTempF >= 0 ? '+' : ''}${thermal.deltaTempF}°F)\n` +
    `• **Density Altitude**: ${da.toLocaleString()} ft\n` +
    `• **Current Tuner Position**: Click ${ctx.currentClick}\n\n` +
    `**Recommendation**: ${thermal.explanation}\n\n` +
    `**Adjusted Tuner Setting: Click ${thermal.recommendedClick}** (${thermal.clickAdjustment >= 0 ? '+' : ''}${thermal.clickAdjustment} click shift from ${baselineClick})` +
    weatherNote;

  return {
    text,
    actions: [{ label: `Apply Thermal Shift → Click ${thermal.recommendedClick}`, clickValue: thermal.recommendedClick }],
    thinkingLabel: 'Computing thermal offset model...',
  };
}

function buildWeatherReport(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  if (!weather) {
    const env = ctx.session.environment;
    const da = calculateDensityAltitude(env.elevationFt, env.tempF, env.pressureInHg);
    const wind = windCalcs(env.windSpeedMph || 0, env.windDirectionClock || 12);
    return {
      text: `**Station Conditions** (from last session data — could not reach Open-Meteo for live update):\n\n` +
        `🌡️ **Temperature**: ${env.tempF}°F\n` +
        `💧 **Humidity**: ${env.humidityPercent}%\n` +
        `📊 **Barometric Pressure**: ${env.pressureInHg} inHg\n` +
        `🏔️ **Density Altitude**: ${da.toLocaleString()} ft — ${daCategory(da)}\n` +
        `🌬️ **Wind**: ${env.windSpeedMph || 0} mph from ${env.windDirectionClock || 12} o'clock\n` +
        `🌫️ **Mirage**: ${wind.mirage}\n` +
        `📍 **Location**: ${env.locationName || 'Unknown'}\n\n` +
        `*Tip: Check your internet connection for live weather, or manually update on the Weather tab.*`,
    };
  }

  const wind = windCalcs(weather.windSpeedMph, weather.windDirectionClock);
  const dp = dewPoint(weather.tempF, weather.humidityPercent);
  const hPa = (weather.pressureInHg / 0.02953).toFixed(1);

  const text = `**🔴 Live Atmospheric Conditions:**\n\n` +
    `🌡️ **Temperature**: ${weather.tempF}°F (${(((weather.tempF - 32) * 5) / 9).toFixed(1)}°C)\n` +
    `💧 **Humidity**: ${weather.humidityPercent}% | Dew Point: ${dp}°F\n` +
    `📊 **Barometric Pressure**: ${weather.pressureInHg} inHg (${hPa} hPa)\n` +
    `🏔️ **Density Altitude**: ${weather.densityAltitudeFt.toLocaleString()} ft — ${daCategory(weather.densityAltitudeFt)}\n` +
    `🌬️ **Wind**: ${weather.windSpeedMph} mph from ${weather.windDirectionClock} o'clock\n` +
    `  ↳ Crosswind: ${wind.crosswind.toFixed(1)} mph | Headwind: ${wind.headwind.toFixed(1)} mph\n` +
    `  ↳ Est. .22 LR Drift @ 50yd: ${wind.driftInches.toFixed(2)}"\n` +
    `🌫️ **Mirage**: ${wind.mirage}\n` +
    `📍 **Location**: ${weather.locationName}\n` +
    `🏋️ **Elevation**: ${weather.elevationFt.toLocaleString()} ft\n\n` +
    `*Live data from Open-Meteo — same source as your Weather tab.*`;

  return {
    text,
    actions: [
      { label: 'Check Thermal Drift Compensation' },
      { label: 'Wind & Mirage Deeper Analysis' },
    ],
    thinkingLabel: 'Fetching live weather from Open-Meteo...',
  };
}

function buildDensityAltitude(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const env = weather ?? ctx.session.environment;
  const da = weather
    ? weather.densityAltitudeFt
    : calculateDensityAltitude(ctx.session.environment.elevationFt, ctx.session.environment.tempF, ctx.session.environment.pressureInHg);

  const text = `**Density Altitude Analysis:**\n\n` +
    `• **Current DA**: ${da.toLocaleString()} ft\n` +
    `• **Station Elevation**: ${(weather?.elevationFt ?? ctx.session.environment.elevationFt).toLocaleString()} ft\n` +
    `• **Temperature**: ${env.tempF}°F\n` +
    `• **Barometric Pressure**: ${(weather?.pressureInHg ?? ctx.session.environment.pressureInHg)} inHg\n\n` +
    `**Impact Assessment**: ${daCategory(da)}\n\n` +
    `**Why DA matters for .22 LR**: Higher density altitude = thinner air = less aerodynamic drag on the subsonic bullet. This slightly changes time-of-flight and barrel vibration timing. At extreme DA shifts (>1,500 ft from your baseline), consider a ±1 click tuner adjustment.\n\n` +
    `The ISA formula: DA = PressureAlt + 118.8 × (ActualTemp°C − ISATemp°C)` +
    (weather ? `\n\n📡 *Live data from ${weather.locationName}*` : '');

  return {
    text,
    actions: [{ label: 'Check Full Weather Report' }, { label: 'Check Thermal Drift' }],
    thinkingLabel: 'Computing density altitude...',
  };
}

function buildWindMirage(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const ws = weather?.windSpeedMph ?? ctx.session.environment.windSpeedMph ?? 0;
  const wd = weather?.windDirectionClock ?? ctx.session.environment.windDirectionClock ?? 12;
  const wind = windCalcs(ws, wd);

  let advice = '';
  if (ws <= 2) {
    advice = 'In near-calm conditions with mirage boil, focus on your scope\'s mirage settings. The vertical "heat shimmer" actually helps confirm zero wind. **Do NOT adjust the tuner for mirage** — it\'s a horizontal/visual phenomenon only.';
  } else if (ws <= 6) {
    advice = 'Walking 45° mirage at this speed can be read through the scope to time shots between gusts. Watch for the mirage to lean, then shoot when it straightens. **Wind flags are your primary tool** — hold or favor into the wind.';
  } else if (ws <= 10) {
    advice = 'Flat horizontal mirage stream means you\'re seeing significant crosswind. At these speeds, **do not try to outshoot the wind** — wait for a true lull. If conditions cycle, pick the condition you see most often and hold for it.';
  } else {
    advice = 'Mirage is washed out — rely on wind flags only. At 10+ mph, .22 LR drift at 50 yards becomes significant. **Remember: wind creates HORIZONTAL spread, the tuner controls VERTICAL.** If you see horizontal elongation with tight vertical, your tuner is correct — just read flags better.';
  }

  const text = `**Wind & Mirage Analysis:**\n\n` +
    `🌬️ **Wind**: ${ws} mph from ${wd} o'clock\n` +
    `↳ **Crosswind Component**: ${wind.crosswind.toFixed(1)} mph\n` +
    `↳ **Head/Tailwind Component**: ${wind.headwind >= 0 ? 'Headwind' : 'Tailwind'} ${Math.abs(wind.headwind).toFixed(1)} mph\n` +
    `↳ **Est. .22 LR Drift @ 50yd**: ${wind.driftInches.toFixed(2)}" (${(wind.driftInches / INCHES_PER_MOA_AT_50YD).toFixed(2)} MOA)\n\n` +
    `🌫️ **Mirage Status**: ${wind.mirage}\n\n` +
    `**Shooting Advice**: ${advice}` +
    (weather ? `\n\n📡 *Live wind data from ${weather.locationName}*` : '');

  return { text, thinkingLabel: 'Analyzing wind vectors and mirage conditions...' };
}

function buildStartingClick(ctx: ExpertContext): ExpertResponse {
  const barrel = ctx.barrel;
  const ammo = ctx.ammo;
  const purdyModes = barrel ? calculateAllPurdyModes(barrel.lengthInches, barrel.muzzleDiameterInches, 'jmp') : null;
  const ninthMode = purdyModes?.find((m) => m.mode === 'ninth');
  const ammoVelocity = ammo?.measuredAvgFps ?? ammo?.boxMuzzleVelocityFps;
  const velClick = ammoVelocity ? velocityToStartingClick(ammoVelocity) : null;
  const chacon = barrel ? chaconReferenceNumber(barrel.lengthInches) : null;

  let text = `**Purdy Method 4 — Starting Click Calculation${barrel ? ` for ${barrel.name}` : ''}:**\n\n`;

  if (ninthMode) {
    text += `• **Target Tuner Dimension (9th Harmonic, JMP)**: **${ninthMode.tunerDimensionInches.toFixed(3)}"**\n`;
    text += `  Resonant Length: ${ninthMode.resonantLength.toFixed(3)}" | End Correction: ${ninthMode.endCorrection.toFixed(3)}"\n\n`;
  }

  if (chacon && barrel) {
    text += `• **Chacon Reference Number** (${barrel.lengthInches}" barrel): **${chacon.toFixed(3)}"**\n\n`;
  }

  if (velClick && ammoVelocity) {
    text += `• **Velocity → Starting Click**: At **${ammoVelocity} fps** (${ammo?.brand} ${ammo?.model}), start at **Click ${velClick.clicks}**\n`;
    text += `  ${velClick.isInterpolated ? '(Interpolated from Lentz velocity table)' : '(Exact match in Lentz velocity table)'}\n\n`;
  }

  text += `**Formula**: TunerDim = (BarrelLen × 9/8) − BarrelLen − (MuzzleOD × 0.264)\n\n`;
  text += `**Testing Protocol**: From your starting click, bracket ±8 clicks in 2-click increments. Shoot 5-shot groups at each setting, recording vertical spread. The U-shaped curve\'s bottom is your sweet spot.`;

  return {
    text,
    actions: velClick ? [{ label: `Set Dial to Click ${velClick.clicks}`, clickValue: velClick.clicks }] : undefined,
  };
}

function buildChacon(ctx: ExpertContext): ExpertResponse {
  const barrel = ctx.barrel;
  const chacon = barrel ? chaconReferenceNumber(barrel.lengthInches) : null;

  if (!barrel || !chacon) {
    return { text: 'I need a barrel profile to calculate the Chacon Reference Number. Please set up your barrel in the Logbook tab first.' };
  }

  const text = `**Chacon Reference Number for ${barrel.name}:**\n\n` +
    `• **Barrel Length**: ${barrel.lengthInches}"\n` +
    `• **Chacon Reference**: **${chacon.toFixed(3)}"**\n\n` +
    `**Formula**: (BarrelLength − 20) × 0.125 + 2.247\n\n` +
    `The Chacon number is an alternative reference dimension that some tuners use as a baseline. Compare it to the Purdy 9th harmonic dimension to cross-validate your starting point.`;

  return { text, actions: [{ label: 'Compare with Purdy Method' }] };
}

function buildBarrelInfo(ctx: ExpertContext): ExpertResponse {
  const b = ctx.barrel;
  if (!b) {
    return { text: 'No barrel profile is currently active. Set up your barrel in the **Logbook** tab with dimensions, contour, twist rate, and chamber info so I can provide personalized analysis.' };
  }

  const text = `**Active Barrel Profile:**\n\n` +
    `🔫 **Name**: ${b.name}\n` +
    `👨‍🔧 **Gunsmith**: ${b.gunsmith}\n` +
    `⚙️ **Action**: ${b.action}\n` +
    `📏 **Length**: ${b.lengthInches}"\n` +
    `🔘 **Muzzle OD**: ${b.muzzleDiameterInches}"\n` +
    `🌀 **Twist Rate**: ${b.twistRate}\n` +
    `📐 **Contour**: ${b.contour}\n` +
    `🔧 **Chamber Reamer**: ${b.chamberReamer}\n` +
    `🎯 **Tuner**: ${b.tunerModel} (${b.tunerWeightOz} oz)\n` +
    `${b.grooves ? `🔄 **Grooves**: ${b.grooves}\n` : ''}` +
    `🔢 **Total Rounds**: ${b.totalRounds.toLocaleString()}\n` +
    (b.tunerSetting ? `📍 **Baseline Tuner Setting**: Click ${b.tunerSetting}\n` : '') +
    `📅 **Created**: ${new Date(b.createdAt).toLocaleDateString()}\n` +
    (b.notes ? `\n📝 **Notes**: ${b.notes}` : '');

  return { text };
}

function buildAmmoInfo(ctx: ExpertContext): ExpertResponse {
  const a = ctx.ammo;
  if (!a) {
    return { text: 'No ammo lot is currently active. Add your ammo lot in the **Logbook** tab with brand, model, lot number, and velocity data.' };
  }

  let esInterpretation = '';
  if (a.extremeSpread) {
    if (a.extremeSpread <= 15) esInterpretation = '**Excellent** — top-tier match ammo consistency.';
    else if (a.extremeSpread <= 25) esInterpretation = '**Average** — typical for quality match ammo. The tuner can compensate for this ES range.';
    else esInterpretation = '**High** — consider testing a different lot. A tuner can only compensate for so much velocity variation.';
  }

  const text = `**Active Ammo Lot:**\n\n` +
    `🎯 **Brand/Model**: ${a.brand} ${a.model}\n` +
    `📦 **Lot Number**: ${a.lotNumber}\n` +
    (a.boxMuzzleVelocityFps ? `📊 **Box Velocity**: ${a.boxMuzzleVelocityFps} fps\n` : '') +
    (a.measuredAvgFps ? `🔬 **Measured Avg Velocity**: ${a.measuredAvgFps} fps\n` : '') +
    (a.standardDeviation != null ? `📈 **SD**: ${a.standardDeviation} fps\n` : '') +
    (a.extremeSpread != null ? `📏 **ES**: ${a.extremeSpread} fps ${esInterpretation ? `— ${esInterpretation}` : ''}\n` : '') +
    (a.testedTempF ? `🌡️ **Tested at**: ${a.testedTempF}°F\n` : '') +
    (a.ratingStars ? `⭐ **Rating**: ${'★'.repeat(a.ratingStars)}${'☆'.repeat(5 - a.ratingStars)}\n` : '') +
    (a.notes ? `\n📝 **Notes**: ${a.notes}` : '');

  return { text };
}

function buildPRXPhysics(): ExpertResponse {
  return {
    text: `**The Physics of .22 LR Positive Compensation (Why Tuners Work):**\n\n` +
      `Because .22 LR match ammo is factory primed and cannot be handloaded, every box has an Extreme Spread (ES) of 12–25 fps. When un-tuned, a slow bullet drops more and hits low at 50 yards.\n\n` +
      `**How a barrel tuner fixes this:**\n` +
      `1. The barrel vibrates in a standing wave pattern when fired\n` +
      `2. A Harrell-type tuner changes the barrel's resonant frequency by adding mass at the muzzle\n` +
      `3. At the correct tuner setting, the muzzle swings **upward** at the moment the bullet exits\n` +
      `4. A slower bullet takes microseconds longer to reach the crown → it exits **higher** on the upswing\n` +
      `5. This extra upward angle perfectly compensates for the velocity-related drop\n` +
      `6. Result: **fast and slow bullets from the same lot land at the same point of impact**\n\n` +
      `This is called **Positive Compensation** — the barrel literally aims the slower bullets higher to compensate for gravity.\n\n` +
      `**Key insight**: The tuner controls **vertical** spread. Wind creates **horizontal** spread. If you see horizontal elongation with tight vertical, do NOT touch the tuner — read your wind flags.`,
  };
}

function buildForgivingWindow(ctx: ExpertContext): ExpertResponse {
  const runs = ctx.session.runs || [];
  const ha = analyzeHarmonics(runs);
  const ww = ha.forgivingWindow.endClick - ha.forgivingWindow.startClick + 1;

  if (runs.length < 3) {
    return { text: 'Not enough data to analyze the forgiving window. I need at least 3 test runs at different tuner settings to map the harmonic curve. Add more runs on the Tuner tab.' };
  }

  const threshold = Math.max(ha.minVerticalInches * 1.25, ha.minVerticalInches + 0.035);

  const text = `**Forgiving Window Analysis:**\n\n` +
    `• **Sweet Spot**: Click ${ha.sweetSpotClick} (${ha.minVerticalInches}" vertical)\n` +
    `• **Window Range**: **${ha.forgivingWindow.startClick}c to ${ha.forgivingWindow.endClick}c** (${ww} clicks wide)\n` +
    `• **Window Threshold**: Vertical ≤ ${threshold.toFixed(3)}"\n\n` +
    (ww >= 6
      ? `**Excellent plateau!** A ${ww}-click wide window means this barrel/ammo combo has a broad, forgiving node. Even if conditions shift your optimal position by a click or two, you stay in the zone.`
      : ww >= 4
      ? `**Good width.** The ${ww}-click window is competitive. Park at Click ${ha.sweetSpotClick} and you have room for minor temperature or condition shifts.`
      : `**Narrow window** — only ${ww} clicks wide. This steep inflection point means small changes in conditions could push you out of the node. Fine-tune carefully and consider re-bracketing in 1-click increments.`);

  return { text };
}

function buildTargetPaper(): ExpertResponse {
  return {
    text: `**Target Paper Tear & Double-Hole Analysis:**\n\n` +
      `When shooting ARA 2500 cards or PSL 5-shot squares, cardstock backing fibers can tear irregularly. Here's how to score accurately:\n\n` +
      `**Identifying overlapping shots:**\n` +
      `1. Look for the dark outer **bullet wipe ring** — a graphite lubricant ring that every .22 LR bullet leaves\n` +
      `2. Each bullet creates exactly ONE wipe ring (.224" diameter)\n` +
      `3. If a group shows 4 holes instead of 5, inspect for a **figure-8 oval wipe ring** — two overlapping bullets\n` +
      `4. Use a 3x Magnifier Loupe to confirm the overlap\n\n` +
      `**Paper tear vs actual spread:**\n` +
      `• Soft cardboard tears outward, making holes look bigger than the actual group\n` +
      `• Always measure center-to-center between the wipe rings, NOT the torn edges\n` +
      `• The actual .22 LR bullet hole diameter is .224" — subtract this from edge-to-edge measurements`,
  };
}

function buildBracketing(ctx: ExpertContext): ExpertResponse {
  const velClick = ctx.ammo?.measuredAvgFps
    ? velocityToStartingClick(ctx.ammo.measuredAvgFps)
    : ctx.ammo?.boxMuzzleVelocityFps
    ? velocityToStartingClick(ctx.ammo.boxMuzzleVelocityFps)
    : null;

  const startClick = velClick?.clicks ?? 26;

  const text = `**Recommended Bracketing Protocol:**\n\n` +
    `**Phase 1 — Coarse Bracket (find the neighborhood):**\n` +
    `Start at Click ${startClick} (${velClick ? 'calculated from your ammo velocity' : 'default center'})\n` +
    `Test 8 settings in 3-click steps:\n` +
    `→ Click ${startClick - 9}, ${startClick - 6}, ${startClick - 3}, **${startClick}**, ${startClick + 3}, ${startClick + 6}, ${startClick + 9}, ${startClick + 12}\n` +
    `Shoot 5-shot groups. Record vertical spread only.\n\n` +
    `**Phase 2 — Fine Bracket (find the exact sweet spot):**\n` +
    `Once you identify the lowest-vertical region, re-bracket ±4 clicks around it in **1-click increments**.\n` +
    `This maps the U-shaped harmonic curve and reveals the sweet spot AND the forgiving window width.\n\n` +
    `**Phase 3 — Confirmation:**\n` +
    `At the sweet spot, shoot 3× five-shot groups. If all three show <0.15" vertical at 50 yards, you're locked in.\n\n` +
    `**Pro Tips:**\n` +
    `• Shoot all bracketing in one session to minimize environmental variables\n` +
    `• If wind shifts, restart the series — wind adds horizontal noise\n` +
    `• Record the temperature — you'll need it for thermal drift compensation on match day`;

  return {
    text,
    actions: velClick ? [{ label: `Start at Click ${startClick}`, clickValue: startClick }] : undefined,
  };
}

function buildEsSD(ctx: ExpertContext): ExpertResponse {
  const a = ctx.ammo;
  const es = a?.extremeSpread;
  const sd = a?.standardDeviation;
  const vel = a?.measuredAvgFps ?? a?.boxMuzzleVelocityFps;

  let text = `**Extreme Spread & Standard Deviation — What They Mean for Tuning:**\n\n`;

  if (a && (es || sd || vel)) {
    text += `**Your ${a.brand} ${a.model} (Lot #${a.lotNumber}):**\n`;
    if (vel) text += `• Average Velocity: ${vel} fps\n`;
    if (es) text += `• Extreme Spread: ${es} fps\n`;
    if (sd) text += `• Standard Deviation: ${sd} fps\n`;
    text += '\n';
  }

  text += `**What these numbers mean:**\n` +
    `• **ES < 15 fps**: Exceptional lot. The tuner can fully compensate for this range of velocity.\n` +
    `• **ES 15-25 fps**: Typical quality match ammo. Tuner will work well within the forgiving window.\n` +
    `• **ES > 25 fps**: High variability. The tuner works harder, and you may see occasional fliers at the extremes.\n` +
    `• **SD < 5 fps**: Outstanding consistency. Target this in lot testing.\n` +
    `• **SD 5-10 fps**: Normal for .22 LR match ammo.\n\n` +
    `**The tuner connection**: A wider forgiving window tolerates higher ES. If your window is only 2 clicks wide and your ES is 25+ fps, the velocity extremes may push the timing beyond the node — resulting in vertical fliers.`;

  return { text };
}

function buildSessionSummary(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const s = ctx.session;
  const runs = s.runs || [];
  const ha = analyzeHarmonics(runs);
  const env = weather ?? s.environment;
  const da = weather ? weather.densityAltitudeFt : s.environment.densityAltitudeFt;

  const text = `**📋 Session Status Overview:**\n\n` +
    `**Session**: ${s.title}\n` +
    `**Date**: ${s.date}\n` +
    `**Distance**: ${s.distanceYards} yards\n\n` +
    `**🔫 Barrel**: ${ctx.barrel?.name || 'Not set'}\n` +
    `**🎯 Ammo**: ${ctx.ammo ? `${ctx.ammo.brand} ${ctx.ammo.model} (Lot #${ctx.ammo.lotNumber})` : 'Not set'}\n` +
    `**📍 Current Tuner Click**: ${ctx.currentClick}\n\n` +
    `**📊 Test Runs**: ${runs.length} recorded\n` +
    (runs.length > 0
      ? `**🎯 Sweet Spot**: Click ${ha.sweetSpotClick} (${ha.minVerticalInches}" vert)\n` +
        `**📐 Forgiving Window**: ${ha.forgivingWindow.startClick}c–${ha.forgivingWindow.endClick}c (${ha.forgivingWindow.endClick - ha.forgivingWindow.startClick + 1} clicks)\n`
      : '**🎯 Sweet Spot**: Not yet determined — run bracketing tests\n') +
    `\n**🌤️ Conditions**: ${env.tempF}°F | DA: ${da.toLocaleString()} ft | Wind: ${env.windSpeedMph || 0} mph\n` +
    (weather ? `📡 *Live weather updated from ${weather.locationName}*` : '');

  return { text, thinkingLabel: 'Compiling session overview...' };
}

function buildHumidityPressure(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const env = weather ?? ctx.session.environment;
  const hPa = ((weather?.pressureInHg ?? ctx.session.environment.pressureInHg) / 0.02953).toFixed(1);
  const dp = dewPoint(env.tempF, env.humidityPercent);

  const text = `**Humidity & Barometric Pressure Analysis:**\n\n` +
    `💧 **Relative Humidity**: ${env.humidityPercent}%\n` +
    `📊 **Barometric Pressure**: ${weather?.pressureInHg ?? ctx.session.environment.pressureInHg} inHg (${hPa} hPa)\n` +
    `🌡️ **Dew Point**: ${dp}°F\n\n` +
    `**Effect on .22 LR at 50 yards:**\n` +
    `• Humidity has a **negligible** direct effect on .22 LR trajectory at 50 yards\n` +
    `• However, humidity affects **mirage visibility** — high humidity = thicker mirage waves\n` +
    `• Barometric pressure shifts directly affect Density Altitude, which changes air drag\n` +
    `• A 0.5 inHg pressure drop ≈ 500 ft DA increase → may need ±1 tuner click\n` +
    `• **Dew point close to temp** = fog risk. Moisture on the muzzle crown can cause fliers from disrupted bullet exit\n\n` +
    (Math.abs(env.tempF - dp) < 5
      ? '⚠️ **Warning**: Dew point is within 5°F of air temperature — high condensation risk. Keep barrel and muzzle dry.'
      : '✅ Dew point is well below air temp — no condensation concerns.') +
    (weather ? `\n\n📡 *Live data from ${weather.locationName}*` : '');

  return { text, thinkingLabel: 'Analyzing atmospheric moisture...' };
}

function buildDewPointTopic(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const env = weather ?? ctx.session.environment;
  const dp = dewPoint(env.tempF, env.humidityPercent);
  const spread = env.tempF - dp;

  const text = `**Dew Point Analysis:**\n\n` +
    `🌡️ **Current Temp**: ${env.tempF}°F\n` +
    `💧 **Humidity**: ${env.humidityPercent}%\n` +
    `🌫️ **Dew Point**: ${dp}°F\n` +
    `📏 **Spread**: ${spread}°F between air temp and dew point\n\n` +
    (spread < 3
      ? '⚠️ **Critical**: Air temp is within 3°F of dew point. **Active condensation likely** — moisture may form on barrel and optics. Wipe the muzzle crown before each relay. Check scope for internal fogging.'
      : spread < 8
      ? '⚠️ **Elevated moisture risk**: Temp/dew point spread is narrowing. Watch for condensation on cold barrel steel between relays. Keep your barrel cover on between strings.'
      : '✅ **No condensation risk**: Healthy spread between temp and dew point. Barrel and optics should stay dry.') +
    (weather ? `\n\n📡 *Live data from ${weather.locationName}*` : '');

  return { text };
}

function buildMatchPrep(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const env = weather ?? ctx.session.environment;
  const da = weather
    ? weather.densityAltitudeFt
    : calculateDensityAltitude(ctx.session.environment.elevationFt, ctx.session.environment.tempF, ctx.session.environment.pressureInHg);
  const thermal = calculateThermalOffset(72, env.tempF, ctx.session.sweetSpotClick ?? ctx.currentClick);
  const wind = windCalcs(env.windSpeedMph || 0, env.windDirectionClock || 12);
  const ha = analyzeHarmonics(ctx.session.runs || []);
  const dp = dewPoint(env.tempF, env.humidityPercent);

  const text = `**🏆 Competition Match Prep Checklist:**\n\n` +
    `**Conditions Assessment:**\n` +
    `🌡️ Temp: ${env.tempF}°F | DA: ${da.toLocaleString()} ft\n` +
    `🌬️ Wind: ${env.windSpeedMph || 0} mph @ ${env.windDirectionClock || 12} o'clock (${wind.mirage})\n` +
    `↳ Crosswind: ${wind.crosswind.toFixed(1)} mph | Est. drift: ${wind.driftInches.toFixed(2)}"\n` +
    `💧 Humidity: ${env.humidityPercent}% | Dew: ${dp}°F\n\n` +
    `**Tuner Setup:**\n` +
    `🎯 Sweet Spot: Click ${ha.sweetSpotClick} (from practice session)\n` +
    `🌡️ Thermal Adjustment: ${thermal.clickAdjustment === 0 ? 'None needed' : `${thermal.clickAdjustment >= 0 ? '+' : ''}${thermal.clickAdjustment} clicks → Click ${thermal.recommendedClick}`}\n` +
    `📍 **Recommended Match Setting: Click ${thermal.recommendedClick}**\n\n` +
    `**Pre-Match Checklist:**\n` +
    `☐ Verify tuner at Click ${thermal.recommendedClick}\n` +
    `☐ Clean/dry muzzle crown\n` +
    `☐ Set wind flags (4-6 flags between bench and 50yd target)\n` +
    `☐ Fire 2-3 fouling shots before first scored card\n` +
    `☐ Confirm ammo lot matches tune session (${ctx.ammo?.brand || ''} ${ctx.ammo?.model || ''} Lot #${ctx.ammo?.lotNumber || '?'})\n` +
    `☐ Check scope parallax at 50 yards\n` +
    `☐ Record starting temperature for relay-to-relay drift tracking\n\n` +
    `**Between Relays:**\n` +
    `• Note temp change → recalculate thermal offset\n` +
    `• Watch for wind direction reversals — flag switches change your hold` +
    (weather ? `\n\n📡 *Weather data live from ${weather.locationName}*` : '');

  return {
    text,
    actions: [{ label: `Set Tuner to Click ${thermal.recommendedClick}`, clickValue: thermal.recommendedClick }],
    thinkingLabel: 'Building competition prep analysis...',
  };
}

function buildRelayAdvice(ctx: ExpertContext, weather: LiveWeatherData | null): ExpertResponse {
  const env = weather ?? ctx.session.environment;
  const baseClick = ctx.session.sweetSpotClick ?? ctx.currentClick;
  const thermal = calculateThermalOffset(72, env.tempF, baseClick);

  const text = `**Relay-to-Relay Tuner Advice:**\n\n` +
    `📍 **Current Click**: ${ctx.currentClick}\n` +
    `🌡️ **Current Temp**: ${env.tempF}°F (Δ${thermal.deltaTempF >= 0 ? '+' : ''}${thermal.deltaTempF}°F from 72°F baseline)\n\n` +
    `**Rule of thumb for Harrell tuners:**\n` +
    `• 1 click adjustment per ~5.5°F temperature change\n` +
    `• Warmer → dial OUT (higher click number)\n` +
    `• Cooler → dial IN (lower click number)\n\n` +
    `**Between relays:**\n` +
    `1. Note the current temperature on your Kestrel or phone\n` +
    `2. Compare to your last relay's temperature\n` +
    `3. If the change is >5°F, adjust the tuner by the recommendation below\n` +
    `4. If the change is <3°F, leave the tuner alone\n\n` +
    `**Current Recommendation**: ${thermal.explanation}\n` +
    `→ **Adjusted setting: Click ${thermal.recommendedClick}** (${thermal.clickAdjustment >= 0 ? '+' : ''}${thermal.clickAdjustment} from baseline ${baseClick})` +
    (weather ? `\n\n📡 *Live temp from ${weather.locationName}*` : '');

  return {
    text,
    actions: thermal.clickAdjustment !== 0
      ? [{ label: `Adjust to Click ${thermal.recommendedClick}`, clickValue: thermal.recommendedClick }]
      : undefined,
    thinkingLabel: 'Calculating inter-relay thermal drift...',
  };
}

function buildTunerBasics(): ExpertResponse {
  return {
    text: `**Welcome! Here's what I can help you with:**\n\n` +
      `I'm your expert rimfire ballistics and tuning advisor. I can:\n\n` +
      `🎯 **Tuner Analysis** — Find your sweet spot, analyze the forgiving window, calculate starting clicks\n` +
      `🌡️ **Thermal Drift** — Compensate for temperature changes between relays\n` +
      `🌤️ **Live Weather** — Fetch real-time conditions and compute density altitude, wind drift, mirage status\n` +
      `📊 **Ballistics** — Purdy Method 4, Chacon reference, velocity-to-click conversion\n` +
      `🔫 **Equipment Review** — Analyze your barrel profile and ammo lot data\n` +
      `🏆 **Match Prep** — Full competition checklist with tuner recommendations\n` +
      `📖 **Education** — How tuners work, positive compensation physics, wind vs vertical diagnosis\n\n` +
      `**Just ask me anything about your tuning session!** Some examples:\n` +
      `• "What click should I start at?"\n` +
      `• "What's the weather right now?"\n` +
      `• "Check thermal drift for my next relay"\n` +
      `• "Diagnose my sweet spot quality"\n` +
      `• "Am I ready for the match?"`,
  };
}

function buildGreeting(ctx: ExpertContext): ExpertResponse {
  const runs = ctx.session.runs || [];
  const ha = runs.length > 0 ? analyzeHarmonics(runs) : null;

  let statusLine = '';
  if (ha && runs.length > 0) {
    statusLine = `Your sweet spot is at Click ${ha.sweetSpotClick} with ${ha.minVerticalInches}" vertical across ${runs.length} test runs.`;
  } else {
    statusLine = 'No test runs recorded yet — ready to start bracketing when you are.';
  }

  return {
    text: `Hello! 👋 I'm actively monitoring your **${ctx.barrel?.name || 'rimfire setup'}** shooting **${ctx.ammo?.brand || ''} ${ctx.ammo?.model || 'match ammo'}** (Lot #${ctx.ammo?.lotNumber || '—'}).\n\n${statusLine}\n\nWhat would you like to analyze today?`,
    actions: [
      { label: 'Full Weather & Conditions Report' },
      { label: 'Run Sweet Spot Diagnostics' },
      { label: 'What click should I start at?' },
    ],
  };
}

function buildFallback(): ExpertResponse {
  return {
    text: `I'm not sure I fully understood that, but here's a key principle:\n\n` +
      `**In precision rimfire benchrest**: Wind creates **horizontal** spread, the tuner controls **vertical** suppression. If you see horizontal elongation with tight vertical, do NOT move the tuner — read your wind flags instead.\n\n` +
      `**Try asking me about:**\n` +
      `• Weather & conditions ("What's the weather?")\n` +
      `• Sweet spot analysis ("Diagnose sweet spot")\n` +
      `• Starting click ("What click should I start at?")\n` +
      `• Thermal drift ("Check thermal drift")\n` +
      `• Match prep ("Competition checklist")\n` +
      `• Wind & mirage ("How's the wind?")\n` +
      `• Barrel or ammo info ("Tell me about my barrel")`,
    actions: [
      { label: 'Full Weather Report' },
      { label: 'Diagnose Sweet Spot' },
      { label: 'Calculate Starting Click' },
    ],
  };
}

// ─── Main Entry Point ───────────────────────────────────────────────────────

export async function generateExpertResponse(
  question: string,
  context: ExpertContext
): Promise<ExpertResponse> {
  const topic = classifyTopic(question);

  // Fetch live weather if this topic needs it
  let weather: LiveWeatherData | null = null;
  if (WEATHER_TOPICS.has(topic)) {
    weather = await fetchLiveWeather(context.session.environment);
  }

  // Build the environmental update to sync back to the app
  let updatedEnvironment: Partial<EnvironmentalConditions> | undefined;
  if (weather) {
    updatedEnvironment = {
      tempF: weather.tempF,
      humidityPercent: weather.humidityPercent,
      pressureInHg: weather.pressureInHg,
      windSpeedMph: weather.windSpeedMph,
      windDirectionClock: weather.windDirectionClock,
      elevationFt: weather.elevationFt,
      densityAltitudeFt: weather.densityAltitudeFt,
      locationName: weather.locationName,
      lastUpdated: new Date().toISOString(),
    };
  }

  let response: ExpertResponse;

  switch (topic) {
    case 'sweet_spot':
      response = buildSweetSpot(context);
      break;
    case 'thermal_drift':
      response = buildThermalDrift(context, weather);
      break;
    case 'weather_report':
      response = buildWeatherReport(context, weather);
      break;
    case 'density_altitude':
      response = buildDensityAltitude(context, weather);
      break;
    case 'wind_mirage':
      response = buildWindMirage(context, weather);
      break;
    case 'starting_click':
      response = buildStartingClick(context);
      break;
    case 'chacon':
      response = buildChacon(context);
      break;
    case 'barrel_info':
      response = buildBarrelInfo(context);
      break;
    case 'ammo_info':
      response = buildAmmoInfo(context);
      break;
    case 'prx_physics':
      response = buildPRXPhysics();
      break;
    case 'forgiving_window':
      response = buildForgivingWindow(context);
      break;
    case 'target_paper':
      response = buildTargetPaper();
      break;
    case 'bracketing':
      response = buildBracketing(context);
      break;
    case 'es_sd':
      response = buildEsSD(context);
      break;
    case 'session_summary':
      response = buildSessionSummary(context, weather);
      break;
    case 'humidity_pressure':
      response = buildHumidityPressure(context, weather);
      break;
    case 'dew_point':
      response = buildDewPointTopic(context, weather);
      break;
    case 'match_prep':
      response = buildMatchPrep(context, weather);
      break;
    case 'relay_advice':
      response = buildRelayAdvice(context, weather);
      break;
    case 'tuner_basics':
      response = buildTunerBasics();
      break;
    case 'greeting':
      response = buildGreeting(context);
      break;
    default:
      response = buildFallback();
  }

  // Attach updated environment if weather was fetched
  if (updatedEnvironment) {
    response.updatedEnvironment = updatedEnvironment;
  }

  return response;
}

// ─── Context-Aware Quick Ask Suggestions ────────────────────────────────────

export function getSmartQuickAsks(context: ExpertContext): string[] {
  const suggestions: string[] = [];
  const env = context.session.environment;
  const runs = context.session.runs || [];

  // Always useful
  suggestions.push('What\'s the weather right now?');

  // Temperature-based
  const deltaT = Math.abs(env.tempF - 72);
  if (deltaT > 5) {
    suggestions.push('Check Thermal Drift Compensation');
  }

  // Wind-based
  if ((env.windSpeedMph || 0) > 3) {
    suggestions.push('Wind & Mirage Analysis');
  }

  // Run-based
  if (runs.length === 0) {
    suggestions.push('What click should I start at?');
    suggestions.push('How should I bracket test?');
  } else if (runs.length < 5) {
    suggestions.push('Diagnose Sweet Spot Quality');
    suggestions.push('Bracketing Strategy');
  } else {
    suggestions.push('Run Full Diagnostics');
    suggestions.push('Am I match-ready?');
  }

  // Always add a couple extras if we have room
  if (suggestions.length < 5) suggestions.push('Tell me about my barrel');
  if (suggestions.length < 6) suggestions.push('How does the tuner work?');

  return suggestions.slice(0, 6);
}

// ─── Smart Thinking Labels ─────────────────────────────────────────────────

export function getThinkingLabel(question: string): string {
  const topic = classifyTopic(question);
  const labels: Record<Topic, string> = {
    sweet_spot: 'Analyzing harmonic node data...',
    thermal_drift: 'Computing thermal offset model...',
    weather_report: 'Fetching live atmospheric data...',
    density_altitude: 'Computing density altitude...',
    wind_mirage: 'Analyzing wind vectors & mirage...',
    starting_click: 'Running Purdy Method 4 calculations...',
    chacon: 'Computing Chacon reference...',
    barrel_info: 'Loading barrel profile data...',
    ammo_info: 'Loading ammo lot data...',
    prx_physics: 'Preparing ballistics explanation...',
    forgiving_window: 'Mapping harmonic curve plateau...',
    target_paper: 'Preparing target analysis guide...',
    bracketing: 'Building bracketing protocol...',
    es_sd: 'Evaluating velocity consistency...',
    session_summary: 'Compiling session overview...',
    humidity_pressure: 'Analyzing atmospheric moisture...',
    dew_point: 'Computing dew point analysis...',
    match_prep: 'Building competition prep checklist...',
    relay_advice: 'Calculating relay-to-relay drift...',
    tuner_basics: 'Preparing tuning guide...',
    greeting: 'Loading session context...',
    fallback: 'Processing your question...',
  };
  return labels[topic];
}
