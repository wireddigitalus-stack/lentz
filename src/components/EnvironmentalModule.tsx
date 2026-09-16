'use client';

import React, { useState, useEffect } from 'react';
import { CloudSun, Wind, Thermometer, Gauge, MapPin, RefreshCw, ArrowUpRight, Compass, Sparkles, Target } from 'lucide-react';
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

  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

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
      const elevationFt = (updateElevationFromAPI && data.elevation != null)
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
      setGpsStatus(`Weather fetch note: Could not reach Open-Meteo online (${err?.message || 'offline'}). Manual values preserved.`);
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
        setGpsStatus(`GPS Location Access Denied or Timed Out (${err.message}). You can select a preset range or enter readings manually.`);
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

  // Auto-fetch on mount (every time user enters the Weather tab).
  // Tries GPS silently first; falls back to the selected preset range.
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
          // GPS denied/unavailable — fall back to selected preset silently
          const range = PRESET_RANGES.find((r) => r.name === selectedRange) ?? PRESET_RANGES[0];
          fetchLiveWeather(range.lat, range.lon, range.name, false);
        },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
      );
    } else {
      // No geolocation support — use preset
      const range = PRESET_RANGES.find((r) => r.name === selectedRange) ?? PRESET_RANGES[0];
      fetchLiveWeather(range.lat, range.lon, range.name, false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">

      {/* Velocity → Click Suggestion Banner */}
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
              <p className="text-xs font-mono text-sky-400/70">Lentz velocity table</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onApplyClick && (
              <button
                onClick={() => { onApplyClick(velSuggestion.clicks); setVelBannerDismissed(true); }}
                className="px-3 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-bold text-xs transition-all active:scale-95 whitespace-nowrap"
              >
                Set Dial
              </button>
            )}
            <button onClick={() => setVelBannerDismissed(true)} className="p-1.5 rounded-lg text-neutral-400 hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>
        </div>
      )}

      {/* Top Range Selector & Live Weather Controls */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-glass flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <MapPin className="w-5 h-5 text-sky-400 shrink-0" />
            <span className="text-sm font-bold text-neutral-200">Location Source:</span>
            <select
              value={selectedRange}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="bg-neutral-900 border border-white/15 rounded-xl px-3.5 py-2 text-xs md:text-sm text-white font-bold focus:outline-none"
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

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={fetchDeviceGPSLocation}
              disabled={loadingWeather}
              title="Use your phone or tablet's onboard GPS chip to fetch live hyper-local weather"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>Use Device GPS Location</span>
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
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-all shadow-sm active:scale-95"
            >
              <RefreshCw className={`w-4 h-4 ${loadingWeather ? 'animate-spin' : ''}`} />
              <span>{loadingWeather ? 'Updating Weather...' : 'Fetch Live Weather'}</span>
            </button>
          </div>
        </div>

        {/* Dynamic Status / GPS Banner */}
        {gpsStatus && (
          <div className="text-xs md:text-sm font-mono text-sky-300 bg-sky-950/40 border border-sky-500/30 rounded-xl px-3.5 py-2 animate-fadeIn flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping shrink-0" />
            <span>{gpsStatus}</span>
          </div>
        )}
      </div>

      {/* Atmospheric Dashboard Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Density Altitude */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-sky-300 font-bold tracking-wider">
              Density Altitude
            </span>
            <Gauge className="w-5 h-5 text-sky-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">
              {computedDA}
            </span>
            <span className="text-sm font-mono font-bold text-neutral-300">FT</span>
          </div>
          <p className="text-sm text-neutral-300 font-medium mt-1.5">
            Standard ISA calculated from pressure &amp; temperature.
          </p>
        </div>

        {/* Ambient Temperature */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-amber-300 font-bold tracking-wider">
              Temperature
            </span>
            <Thermometer className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">
              {env.tempF}
            </span>
            <span className="text-sm font-mono font-bold text-neutral-300">°F</span>
          </div>
          <p className="text-sm text-neutral-300 font-medium mt-1.5">
            {(((env.tempF - 32) * 5) / 9).toFixed(1)}°C station ambient
          </p>
        </div>

        {/* Station Barometric Pressure */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-200 font-bold tracking-wider">
              Station Pressure
            </span>
            <CloudSun className="w-5 h-5 text-neutral-300" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">
              {env.pressureInHg}
            </span>
            <span className="text-sm font-mono font-bold text-neutral-300">inHg</span>
          </div>
          <p className="text-sm text-neutral-300 font-medium mt-1.5">
            {(env.pressureInHg * 33.8639).toFixed(1)} hPa baro
          </p>
        </div>

        {/* Wind & Direction */}
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-neutral-200 font-bold tracking-wider">
              Wind / Mirage
            </span>
            <Wind className="w-5 h-5 text-neutral-300" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">
              {env.windSpeedMph || 0}
            </span>
            <span className="text-sm font-mono font-bold text-neutral-300">MPH</span>
          </div>
          <p className="text-sm text-neutral-300 font-medium mt-1.5 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-sky-400" />
            <span>Direction: {env.windDirectionClock || 12} o&apos;clock</span>
          </p>
        </div>
      </div>

      {/* Dynamic Thermal Shift Compensator Banner */}
      <div className="bg-gradient-to-br from-[#10131A] to-[#141924] border border-amber-500/30 rounded-2xl p-6 backdrop-blur-xl shadow-glass relative overflow-hidden">
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
                Relay Temperature Compensation Engine
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

      {/* Manual Condition Adjusters */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-4">
        <h4 className="text-base font-bold text-white">Manual Range Condition Sliders</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
