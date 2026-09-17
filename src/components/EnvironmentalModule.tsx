'use client';

import React, { useState, useEffect } from 'react';
import {
  CloudSun,
  Wind,
  Thermometer,
  Gauge,
  MapPin,
  RefreshCw,
  Compass,
  Sparkles,
  Target,
  Droplets,
  Navigation,
  Sliders,
  ArrowRight,
} from 'lucide-react';
import { EnvironmentalConditions, TuneSession, ThermalOffsetRecommendation, AmmoLot } from '@/types';
import { calculateDensityAltitude, calculateThermalOffset, velocityToStartingClick } from '@/lib/ballistics';

interface EnvironmentalModuleProps {
  session: TuneSession;
  activeAmmo?: AmmoLot;
  onUpdateEnvironment: (env: EnvironmentalConditions) => void;
  activeTunerClick: number;
  onApplyClick?: (click: number) => void;
}

const PRESET_RANGES = [
  { name: 'Bristol / Blountville, TN (Lentz Home Range)', lat: 36.5334, lon: -82.3276, elevation: 1520 },
  { name: 'Kettlefoot Rod & Gun Club, VA', lat: 36.6322, lon: -82.0298, elevation: 1980 },
  { name: 'St. Louis Benchrest Club, MO', lat: 38.6270, lon: -90.1994, elevation: 510 },
  { name: 'Raton Whittington Center, NM', lat: 36.9034, lon: -104.4391, elevation: 6600 },
];

export const EnvironmentalModule: React.FC<EnvironmentalModuleProps> = ({
  session,
  activeAmmo,
  onUpdateEnvironment,
  activeTunerClick,
  onApplyClick,
}) => {
  const env = session.environment;
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [selectedRange, setSelectedRange] = useState(PRESET_RANGES[0].name);
  const [velBannerDismissed, setVelBannerDismissed] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  // Auto calculate DA whenever temp, elevation, or pressure changes
  const computedDA = calculateDensityAltitude(env.elevationFt, env.tempF, env.pressureInHg);

  // Baseline session comparison for thermal drift
  const baselineTemp = 72; // baseline recorded session
  const baselineClick = session.sweetSpotClick ?? 13;
  const thermalRec: ThermalOffsetRecommendation = calculateThermalOffset(
    baselineTemp,
    env.tempF,
    baselineClick
  );

  // Velocity → click suggestion from active ammo
  const ammoVelocity = activeAmmo?.measuredAvgFps ?? activeAmmo?.boxMuzzleVelocityFps;
  const velSuggestion = ammoVelocity ? velocityToStartingClick(ammoVelocity) : null;

  // Temperature math
  const tempCelsius = (((env.tempF - 32) * 5) / 9).toFixed(1);
  const deltaT = env.tempF - baselineTemp;
  const tempPercent = Math.max(4, Math.min(96, ((env.tempF - 30) / 75) * 100));

  // Density Altitude spectrum (typical -500 ft to +6,500 ft)
  const daPercent = Math.max(4, Math.min(96, ((computedDA + 500) / 7000) * 100));
  const daCategory =
    computedDA < 1000
      ? { label: 'Dense Air (High Drag)', color: 'text-cyan-300', bg: 'bg-cyan-500/20 border-cyan-500/40' }
      : computedDA <= 3000
      ? { label: 'Standard Match Air', color: 'text-emerald-300', bg: 'bg-emerald-500/20 border-emerald-500/40' }
      : { label: 'Thin High Altitude', color: 'text-amber-300', bg: 'bg-amber-500/20 border-amber-500/40' };

  // Wind & Mirage calculations
  const windMph = env.windSpeedMph || 0;
  const windClock = env.windDirectionClock || 12;
  const windClockAngle = (windClock % 12) * 30; // 12 -> 0°, 1 -> 30°, 2 -> 60°, 3 -> 90°
  const crosswindMph = Math.abs(windMph * Math.sin((windClockAngle * Math.PI) / 180));
  const headwindMph = windMph * Math.cos((windClockAngle * Math.PI) / 180);
  // Estimated .22LR drift at 50 yards (approx 0.085" per mph crosswind for 1070 fps standard match ammo)
  const estimatedDriftInches = (crosswindMph * 0.085).toFixed(2);

  const mirageStatus =
    windMph <= 2
      ? 'Boil / Vertical Waves'
      : windMph <= 6
      ? 'Walking 45° Mirage'
      : windMph <= 10
      ? 'Flat Horizontal Stream'
      : 'Washed Out (Flag Reading)';

  // Pressure & Humidity math
  const hPa = (env.pressureInHg * 33.8639).toFixed(1);
  const pressurePercent = Math.max(4, Math.min(96, ((env.pressureInHg - 28.0) / 3.0) * 100));
  const dewPointF = Math.round(env.tempF - ((100 - env.humidityPercent) / 5));

  const handleUpdate = (partial: Partial<EnvironmentalConditions>) => {
    const updated = {
      ...env,
      ...partial,
      lastUpdated: new Date().toISOString(),
    };
    updated.densityAltitudeFt = calculateDensityAltitude(
      updated.elevationFt,
      updated.tempF,
      updated.pressureInHg
    );
    onUpdateEnvironment(updated);
  };

  const fetchLiveWeather = async (
    lat = 36.5334,
    lon = -82.3276,
    locationName = 'Bristol / Blountville, TN',
    updateElevationFromAPI = false
  ) => {
    setLoadingWeather(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch live weather from Open-Meteo');
      const data = await res.json();
      const current = data.current;

      const pressureInHg = Number((current.surface_pressure * 0.02953).toFixed(2));
      const tempF = Math.round(current.temperature_2m);
      const humidityPercent = Math.round(current.relative_humidity_2m);
      const windSpeedMph = Math.round(current.wind_speed_10m);
      const windDir = Math.round(current.wind_direction_10m / 30) || 12;
      const elevationFt =
        updateElevationFromAPI && data.elevation != null
          ? Math.round(data.elevation * 3.28084)
          : env.elevationFt;

      handleUpdate({
        tempF,
        humidityPercent,
        pressureInHg,
        windSpeedMph,
        windDirectionClock: windDir,
        elevationFt,
        locationName,
      });
      setGpsStatus(`Live atmospheric data updated for ${locationName}`);
      setTimeout(() => setGpsStatus(null), 5000);
    } catch (err: any) {
      console.warn('Could not fetch online weather, using manual settings:', err);
      setGpsStatus(
        `Weather fetch note: Could not reach Open-Meteo online (${err?.message || 'offline'}). Manual values preserved.`
      );
      setTimeout(() => setGpsStatus(null), 6000);
    } finally {
      setLoadingWeather(false);
    }
  };

  const fetchDeviceGPSLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsStatus('Device geolocation is not supported by your current browser.');
      return;
    }
    setLoadingWeather(true);
    setGpsStatus('Requesting high-accuracy device GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lon = Number(pos.coords.longitude.toFixed(4));
        const deviceLocationName = `Current Device Location (${lat}°, ${lon}°)`;
        setSelectedRange(deviceLocationName);
        setGpsStatus(`GPS coordinates locked: Lat ${lat}, Lon ${lon}. Fetching live atmosphere...`);
        await fetchLiveWeather(lat, lon, deviceLocationName, true);
      },
      (err) => {
        setLoadingWeather(false);
        setGpsStatus(
          `GPS Location Access Denied or Timed Out (${err.message}). You can select a preset range or enter readings manually.`
        );
        setTimeout(() => setGpsStatus(null), 7000);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  };

  const handlePresetSelect = (presetName: string) => {
    setSelectedRange(presetName);
    const range = PRESET_RANGES.find((r) => r.name === presetName);
    if (range) {
      handleUpdate({ elevationFt: range.elevation });
      fetchLiveWeather(range.lat, range.lon, range.name, false);
    }
  };

  // Auto-fetch on mount silently
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(4));
          const lon = Number(pos.coords.longitude.toFixed(4));
          const name = `Current Location (${lat}°, ${lon}°)`;
          setSelectedRange(name);
          await fetchLiveWeather(lat, lon, name, true);
        },
        () => {
          const range = PRESET_RANGES.find((r) => r.name === selectedRange) ?? PRESET_RANGES[0];
          fetchLiveWeather(range.lat, range.lon, range.name, false);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
      );
    } else {
      const range = PRESET_RANGES.find((r) => r.name === selectedRange) ?? PRESET_RANGES[0];
      fetchLiveWeather(range.lat, range.lon, range.name, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* ──────────────────────────────────────────────
          VELOCITY → CLICK SUGGESTION BANNER
      ────────────────────────────────────────────── */}
      {velSuggestion && !velBannerDismissed && activeAmmo && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-sky-500/10 border border-sky-500/30 animate-fadeIn">
          <div className="flex items-center gap-3 min-w-0">
            <Target className="w-5 h-5 text-sky-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-sky-200 truncate">
                {activeAmmo.brand} {activeAmmo.model} @ {ammoVelocity} fps
                <span className="text-neutral-300"> → Start at </span>
                <span className="text-white font-black">Click {velSuggestion.clicks}</span>
              </p>
              <p className="text-xs font-mono text-sky-400/70">Lentz empirical velocity table</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onApplyClick && (
              <button
                onClick={() => {
                  onApplyClick(velSuggestion.clicks);
                  setVelBannerDismissed(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-all active:scale-95 whitespace-nowrap"
              >
                Set Dial
              </button>
            )}
            <button
              onClick={() => setVelBannerDismissed(true)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────
          HERO LIVE WEATHER SPOTLIGHT (FRONT & CENTER)
      ────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0e1626] via-[#0b101c] to-[#070a12] border border-sky-500/30 p-6 md:p-8 shadow-2xl shadow-sky-950/30">
        {/* Animated Background Ambience Glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-sky-500/15 blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Top Header Row: Live Status & Location */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono font-extrabold uppercase tracking-widest text-emerald-300">
              Live Atmosphere
            </span>
            <span className="text-white/20">•</span>
            <span className="text-xs md:text-sm font-semibold text-neutral-200 truncate max-w-[220px] sm:max-w-md">
              {env.locationName || selectedRange}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-neutral-400">
              {env.elevationFt ? `${env.elevationFt.toLocaleString()} ft MSL` : ''}
            </span>
            {env.lastUpdated && (
              <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-neutral-300">
                {new Date(env.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>

        {/* Hero Atmospheric Big Numbers Spotlight */}
        <div className="relative z-10 mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Main Temperature & Weather Graphic */}
          <div className="md:col-span-5 flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-amber-500/20 via-sky-500/20 to-blue-600/20 border border-white/15 flex items-center justify-center shadow-lg">
                <CloudSun className="w-11 h-11 md:w-13 md:h-13 text-amber-300 animate-pulse" />
              </div>
              <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-md bg-neutral-900 border border-white/20 text-[10px] font-mono font-bold text-sky-300">
                {tempCelsius}°C
              </div>
            </div>

            <div>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl md:text-7xl font-black font-mono tracking-tighter text-white drop-shadow-sm">
                  {env.tempF}
                </span>
                <span className="text-2xl md:text-3xl font-mono font-black text-amber-300">°F</span>
              </div>
              <p className="text-xs md:text-sm font-semibold text-neutral-300 mt-1">
                Dew Pt: <span className="text-white font-mono">{dewPointF}°F</span> • Humidity:{' '}
                <span className="text-white font-mono">{env.humidityPercent}%</span>
              </p>
            </div>
          </div>

          {/* Quick-Glance Ballistic Pills */}
          <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Density Altitude Pill */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-sky-500/30 backdrop-blur-md flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-400">
                <span>DENSITY ALT</span>
                <Gauge className="w-3.5 h-3.5" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black font-mono text-white">
                  {computedDA.toLocaleString()}
                </span>
                <span className="text-xs font-mono font-bold text-neutral-400">FT</span>
              </div>
              <span className="text-[11px] font-medium text-sky-200/80 truncate mt-0.5">
                {daCategory.label}
              </span>
            </div>

            {/* Wind Vector Pill */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-emerald-500/30 backdrop-blur-md flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-400">
                <span>WIND / CLOCK</span>
                <Wind className="w-3.5 h-3.5" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black font-mono text-white">{windMph}</span>
                <span className="text-xs font-mono font-bold text-neutral-400">MPH</span>
              </div>
              <span className="text-[11px] font-medium text-emerald-200/80 truncate mt-0.5">
                @{windClock} o&apos;clock ({crosswindMph.toFixed(1)} cross)
              </span>
            </div>

            {/* Station Barometer Pill */}
            <div className="p-3.5 rounded-2xl bg-neutral-900/80 border border-purple-500/30 backdrop-blur-md col-span-2 sm:col-span-1 flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-purple-300">
                <span>STATION BARO</span>
                <CloudSun className="w-3.5 h-3.5" />
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-2xl md:text-3xl font-black font-mono text-white">
                  {env.pressureInHg.toFixed(2)}
                </span>
                <span className="text-xs font-mono font-bold text-neutral-400">inHg</span>
              </div>
              <span className="text-[11px] font-medium text-purple-200/80 truncate mt-0.5">
                {hPa} hPa pressure
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          ANIMATED GRAPHICAL CARDS GRID (THE HERO DATA)
      ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: DENSITY ALTITUDE GRAPHICAL GAUGE */}
        <div className="bg-[#10131A]/95 border border-sky-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-glass flex flex-col justify-between hover:border-sky-400/50 transition-all duration-300 group">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 group-hover:scale-110 transition-transform">
                  <Gauge className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono uppercase text-sky-300 font-bold tracking-wider">
                  Density Altitude
                </span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${daCategory.bg} ${daCategory.color}`}>
                ISA
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                {computedDA.toLocaleString()}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">FT</span>
            </div>
          </div>

          <div className="mt-4">
            {/* Graphical DA Spectrum Gauge Bar */}
            <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
              <span>0 ft</span>
              <span className="text-sky-300 font-bold">Standard</span>
              <span>6,500 ft</span>
            </div>
            <div className="relative w-full h-3 rounded-full bg-neutral-900 border border-white/10 overflow-hidden shadow-inner">
              {/* Colored spectrum segments */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 via-emerald-400 via-amber-400 to-rose-500 opacity-60" />
              {/* Dynamic Indicator Bead */}
              <div
                className="absolute top-0 bottom-0 w-3 bg-white rounded-full shadow-lg border border-neutral-900 transform -translate-x-1/2 transition-all duration-500"
                style={{ left: `${daPercent}%` }}
              />
            </div>
            <p className="text-xs text-neutral-300 font-medium mt-2 leading-relaxed">
              {computedDA < env.elevationFt
                ? `Heavy air: DA is ${Math.abs(computedDA - env.elevationFt)} ft below physical elevation.`
                : `Expanded air: DA is ${computedDA - env.elevationFt} ft above physical elevation.`}
            </p>
          </div>
        </div>

        {/* CARD 2: AMBIENT TEMPERATURE & THERMAL DRIFT */}
        <div className="bg-[#10131A]/95 border border-amber-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-glass flex flex-col justify-between hover:border-amber-400/50 transition-all duration-300 group">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 group-hover:scale-110 transition-transform">
                  <Thermometer className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono uppercase text-amber-300 font-bold tracking-wider">
                  Temperature
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-900 border border-white/15 text-neutral-300">
                Base 72°F
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                {env.tempF}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">°F</span>
              <span className="ml-2 text-xs font-mono text-neutral-400">({tempCelsius}°C)</span>
            </div>
          </div>

          <div className="mt-4">
            {/* Graphical Thermal Gauge Bar */}
            <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
              <span>30°F</span>
              <span className="text-amber-300 font-bold">Relay Amb</span>
              <span>105°F</span>
            </div>
            <div className="relative w-full h-3 rounded-full bg-neutral-900 border border-white/10 overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-sky-400 via-amber-400 to-red-500 opacity-60" />
              <div
                className="absolute top-0 bottom-0 w-3 bg-white rounded-full shadow-lg border border-neutral-900 transform -translate-x-1/2 transition-all duration-500"
                style={{ left: `${tempPercent}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">
                {deltaT === 0 ? 'Exact Baseline Temp' : deltaT > 0 ? `+${deltaT}°F warm shift` : `${deltaT}°F cool shift`}
              </span>
              <span className="font-mono font-bold text-amber-300">
                {thermalRec.clickAdjustment >= 0 ? `+${thermalRec.clickAdjustment}` : thermalRec.clickAdjustment} clicks
              </span>
            </div>
          </div>
        </div>

        {/* CARD 3: ANIMATED WIND & MIRAGE COMPASS */}
        <div className="bg-[#10131A]/95 border border-emerald-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-glass flex flex-col justify-between hover:border-emerald-400/50 transition-all duration-300 group">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                  <Wind className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono uppercase text-emerald-300 font-bold tracking-wider">
                  Wind Vector
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {windClock}:00
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                {windMph}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">MPH</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            {/* Graphical Wind Compass Dial */}
            <div className="relative w-14 h-14 rounded-full bg-neutral-900 border border-white/20 flex items-center justify-center shrink-0 shadow-inner">
              {/* 12 o'clock target indicator */}
              <div className="absolute top-1 text-[8px] font-mono font-bold text-neutral-400 leading-none">12</div>
              <div className="absolute right-1 text-[8px] font-mono font-bold text-neutral-400 leading-none">3</div>
              <div className="absolute bottom-1 text-[8px] font-mono font-bold text-neutral-400 leading-none">6</div>
              <div className="absolute left-1 text-[8px] font-mono font-bold text-neutral-400 leading-none">9</div>
              {/* Rotating Direction Needle */}
              <div
                className="absolute inset-0 flex items-center justify-center transition-transform duration-700"
                style={{ transform: `rotate(${windClockAngle}deg)` }}
              >
                <div className="w-1 h-5 bg-gradient-to-t from-emerald-400 to-cyan-300 rounded-full shadow-glow-emerald transform -translate-y-2" />
              </div>
              {/* Center Crosshair Pin */}
              <div className="w-2 h-2 rounded-full bg-white shadow" />
            </div>

            <div className="min-w-0 text-xs">
              <div className="font-bold text-white truncate">{mirageStatus}</div>
              <div className="font-mono text-emerald-300 mt-0.5">
                50y Drift: ~{estimatedDriftInches}&quot;
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                Cross: {crosswindMph.toFixed(1)}m | Head: {headwindMph.toFixed(1)}m
              </div>
            </div>
          </div>
        </div>

        {/* CARD 4: STATION BARO & MOISTURE */}
        <div className="bg-[#10131A]/95 border border-purple-500/30 rounded-2xl p-5 backdrop-blur-xl shadow-glass flex flex-col justify-between hover:border-purple-400/50 transition-all duration-300 group">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 group-hover:scale-110 transition-transform">
                  <Droplets className="w-4 h-4" />
                </div>
                <span className="text-xs font-mono uppercase text-purple-300 font-bold tracking-wider">
                  Baro &amp; Humidity
                </span>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-neutral-900 border border-white/15 text-neutral-300">
                {env.humidityPercent}% RH
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-4xl lg:text-5xl font-black font-mono tracking-tight text-white">
                {env.pressureInHg.toFixed(2)}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">inHg</span>
            </div>
          </div>

          <div className="mt-4">
            {/* Graphical Pressure Gauge Bar */}
            <div className="flex justify-between text-[10px] font-mono text-neutral-400 mb-1">
              <span>28.0 Low</span>
              <span className="text-purple-300 font-bold">{hPa} hPa</span>
              <span>31.0 High</span>
            </div>
            <div className="relative w-full h-3 rounded-full bg-neutral-900 border border-white/10 overflow-hidden shadow-inner">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-indigo-400 to-sky-400 opacity-60" />
              <div
                className="absolute top-0 bottom-0 w-3 bg-white rounded-full shadow-lg border border-neutral-900 transform -translate-x-1/2 transition-all duration-500"
                style={{ left: `${pressurePercent}%` }}
              />
            </div>
            <p className="text-xs text-neutral-300 font-medium mt-2 leading-relaxed">
              Dew Point: <span className="text-white font-mono">{dewPointF}°F</span> • Air Mass:{' '}
              <span className="text-purple-300 font-mono">
                {(env.pressureInHg / 29.92).toFixed(3)}x sea-level
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          DYNAMIC THERMAL SHIFT COMPENSATOR ADVISOR
      ────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#10131A] to-[#141924] border border-amber-500/30 rounded-3xl p-6 backdrop-blur-xl shadow-glass relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-white tracking-tight">
                Lentz Thermal Harmonic Shift Advisor
              </h3>
              <p className="text-xs font-mono font-bold text-neutral-300">
                Relay Temperature Compensation Engine (416R Barrel Steel)
              </p>
            </div>
          </div>

          <div className="px-3.5 py-1.5 rounded-full bg-neutral-900 border border-white/15 text-xs md:text-sm font-mono font-bold text-neutral-200 shadow-sm">
            Baseline: {baselineTemp}°F @ {baselineClick} Clicks
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center mt-4">
          <div className="md:col-span-1 p-5 rounded-2xl bg-neutral-900/90 border border-white/15 flex flex-col items-center justify-center text-center shadow-inner">
            <span className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
              Recommended Setting
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-5xl font-black font-mono text-amber-300">
                {thermalRec.recommendedClick}
              </span>
              <span className="text-sm font-mono font-bold text-neutral-300">CLICKS</span>
            </div>
            <span className="text-sm font-mono font-black text-white mt-2 px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/30">
              {thermalRec.clickAdjustment >= 0 ? `+${thermalRec.clickAdjustment}` : thermalRec.clickAdjustment} clicks shift
            </span>
            {onApplyClick && (
              <button
                onClick={() => onApplyClick(thermalRec.recommendedClick)}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-amber-500/25 hover:bg-amber-500/35 text-amber-200 border border-amber-500/40 text-xs font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 shadow-sm"
              >
                <span>Apply to Harrell Dial</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-2">
            <p className="text-sm text-neutral-100 font-medium leading-relaxed">
              {thermalRec.explanation}
            </p>
            <div className="mt-3.5 flex items-center gap-2 text-sm font-semibold text-neutral-300">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
              <span>Benchrest Rule: approx 1 click per 5°F to 6°F temperature variation.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────
          LOCATION, GPS & FETCH BUTTONS (UNDER THE HERO DATA)
      ────────────────────────────────────────────── */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/40">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Range Location &amp; Live Atmospheric Feed</h4>
              <p className="text-xs text-neutral-400">Sync with on-range GPS coordinates or preset match facilities</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {/* Preset Location Dropdown */}
          <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
            <MapPin className="w-5 h-5 text-sky-400 shrink-0" />
            <select
              value={selectedRange}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="w-full bg-neutral-900 border border-white/15 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-white font-bold focus:outline-none focus:border-sky-500"
            >
              {selectedRange.startsWith('Current Device Location') && (
                <option value={selectedRange}>{selectedRange}</option>
              )}
              {PRESET_RANGES.map((r) => (
                <option key={r.name} value={r.name}>
                  {r.name} ({r.elevation} ft)
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons: Device GPS & Fetch Live */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            <button
              onClick={fetchDeviceGPSLocation}
              disabled={loadingWeather}
              title="Use your phone or tablet's onboard GPS chip to fetch live hyper-local weather"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Use Device GPS</span>
            </button>

            <button
              onClick={() => {
                const r = PRESET_RANGES.find((item) => item.name === selectedRange);
                if (r) {
                  fetchLiveWeather(r.lat, r.lon, r.name, false);
                } else {
                  fetchDeviceGPSLocation();
                }
              }}
              disabled={loadingWeather}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWeather ? 'animate-spin' : ''}`} />
              <span>{loadingWeather ? 'Updating...' : 'Fetch Live Weather'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Status / GPS Banner */}
        {gpsStatus && (
          <div className="text-xs md:text-sm font-mono text-sky-300 bg-sky-950/40 border border-sky-500/30 rounded-xl px-3.5 py-2 animate-fadeIn flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
            <span>{gpsStatus}</span>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────
          MANUAL RANGE CONDITION SLIDERS
      ────────────────────────────────────────────── */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-neutral-800 text-neutral-300 border border-white/10">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Manual Condition Adjusters</h4>
            <p className="text-xs text-neutral-400">Fine-tune readings from hand-held Kestrel weather meters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Temperature Slider */}
          <div>
            <div className="flex justify-between text-sm font-mono font-bold mb-2">
              <span className="text-neutral-300">Temperature</span>
              <span className="text-white text-base font-black">{env.tempF}°F</span>
            </div>
            <input
              type="range"
              min="30"
              max="110"
              value={env.tempF}
              onChange={(e) => handleUpdate({ tempF: Number(e.target.value) })}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />
          </div>

          {/* Elevation Slider */}
          <div>
            <div className="flex justify-between text-sm font-mono font-bold mb-2">
              <span className="text-neutral-300">Elevation</span>
              <span className="text-white text-base font-black">{env.elevationFt} ft</span>
            </div>
            <input
              type="range"
              min="0"
              max="7000"
              step="50"
              value={env.elevationFt}
              onChange={(e) => handleUpdate({ elevationFt: Number(e.target.value) })}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Barometric Pressure Slider */}
          <div>
            <div className="flex justify-between text-sm font-mono font-bold mb-2">
              <span className="text-neutral-300">Barometric Pressure</span>
              <span className="text-white text-base font-black">{env.pressureInHg} inHg</span>
            </div>
            <input
              type="range"
              min="28.0"
              max="31.0"
              step="0.01"
              value={env.pressureInHg}
              onChange={(e) => handleUpdate({ pressureInHg: Number(e.target.value) })}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
          </div>

          {/* Relative Humidity Slider */}
          <div>
            <div className="flex justify-between text-sm font-mono font-bold mb-2">
              <span className="text-neutral-300">Relative Humidity</span>
              <span className="text-white text-base font-black">{env.humidityPercent}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={env.humidityPercent}
              onChange={(e) => handleUpdate({ humidityPercent: Number(e.target.value) })}
              className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
