'use client';

import React from 'react';
import { EnvironmentalConditions, BarrelProfile, AmmoLot, MatchDayLog } from '@/types';
import { calculateThermalOffset } from '@/lib/ballistics';
import { MapPin, Thermometer, Mountain, Wind, Loader2, RefreshCw, Camera, Trophy, MessageCircle } from 'lucide-react';

interface RangeCompanionProps {
  environment: EnvironmentalConditions;
  barrel?: BarrelProfile;
  ammo?: AmmoLot;
  currentClick: number;
  sweetSpotClick?: number;
  lastMatchDay?: MatchDayLog;
  onFetchWeather: () => void;
  onStartMatch: () => void;
  onTakeSnapshot: () => void;
  onOpenAdvisor: () => void;
  loadingWeather?: boolean;
}

export function RangeCompanion({
  environment,
  barrel,
  ammo,
  currentClick,
  sweetSpotClick,
  lastMatchDay,
  onFetchWeather,
  onStartMatch,
  onTakeSnapshot,
  onOpenAdvisor,
  loadingWeather
}: RangeCompanionProps) {
  const hasWeather = environment.tempF > 0 || environment.lastUpdated;
  const baselineClick = sweetSpotClick !== undefined ? sweetSpotClick : currentClick;
  const thermalRec = calculateThermalOffset(72, environment.tempF || 72, baselineClick);

  return (
    <div className="flex flex-col gap-4 pb-safe">
      {/* 1. Big "I'm at the Range" button */}
      <button
        onClick={onFetchWeather}
        disabled={loadingWeather}
        className="w-full py-6 rounded-2xl bg-gradient-to-r from-sky-500 to-sky-600 text-white font-bold text-xl flex items-center justify-center gap-2 min-h-[44px] shadow-lg disabled:opacity-70"
      >
        {loadingWeather ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : hasWeather ? (
          <>
            <RefreshCw className="w-6 h-6" /> Refresh Conditions ↻
          </>
        ) : (
          <>
            <MapPin className="w-6 h-6" /> I'm at the Range
          </>
        )}
      </button>

      {/* 2. Conditions Hero */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center">
          <Thermometer className="w-6 h-6 text-sky-500 mb-2" />
          <div className="text-4xl font-black text-white">{Math.round(environment.tempF || 0)}°</div>
          <div className="text-sm text-neutral-400">
            {Math.round(((environment.tempF || 0) - 32) * 5 / 9)}°C
          </div>
        </div>
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center">
          <Mountain className="w-6 h-6 text-emerald-500 mb-2" />
          <div className="text-4xl font-black text-white">{Math.round(environment.densityAltitudeFt || 0)}</div>
          <div className="text-sm text-neutral-400">ft DA</div>
        </div>
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center text-center">
          <Wind className="w-6 h-6 text-amber-500 mb-2" />
          <div className="text-2xl font-black text-white mb-1">
            {environment.windSpeedMph || 0} mph
          </div>
          <div className="text-sm text-neutral-400">
            {environment.windDirectionClock ? `${environment.windDirectionClock} o'clock` : '--'}
          </div>
        </div>
      </div>

      {/* 3. Tuner Recommendation Card */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 flex flex-col items-center text-center">
        <div className="text-sm font-bold text-sky-500 tracking-wider mb-2">YOUR TUNER</div>
        <div className="text-6xl font-black text-white mb-4">
          {thermalRec.recommendedClick}
        </div>
        <div className="text-sm text-neutral-400 max-w-xs">
          {thermalRec.clickAdjustment === 0
            ? "No thermal adjustment needed — matching baseline conditions"
            : `Adjusted ${thermalRec.clickAdjustment > 0 ? '+' : ''}${thermalRec.clickAdjustment} clicks from baseline ${baselineClick} for ${thermalRec.deltaTempF > 0 ? '+' : ''}${thermalRec.deltaTempF}°F temp shift`}
        </div>
      </div>

      {/* 4. Two Action Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onTakeSnapshot}
          className="bg-neutral-800 border border-white/10 rounded-2xl py-4 flex flex-col items-center justify-center font-bold text-base text-white min-h-[44px]"
        >
          <Camera className="w-5 h-5 mb-1" />
          📸 Snapshot
        </button>
        <button
          onClick={onStartMatch}
          className="bg-emerald-600 border border-white/10 rounded-2xl py-4 flex flex-col items-center justify-center font-bold text-base text-white min-h-[44px]"
        >
          <Trophy className="w-5 h-5 mb-1" />
          🏆 Start Match
        </button>
      </div>

      {/* 5. Quick Status Strip */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
        <div className="flex flex-col overflow-hidden">
          <div className="text-sm font-medium text-white truncate">
            {barrel?.name || "No barrel selected"}
          </div>
          <div className="text-xs text-neutral-400 truncate">
            {ammo ? `${ammo.brand} ${ammo.model} (${ammo.lotNumber})` : "No ammo selected"}
          </div>
        </div>
        <button
          onClick={onOpenAdvisor}
          className="ml-4 shrink-0 flex items-center gap-1 bg-sky-500/20 text-sky-400 px-3 py-1.5 rounded-full text-sm font-medium min-h-[44px]"
        >
          <MessageCircle className="w-4 h-4" />
          Ask Advisor
        </button>
      </div>

      {/* 6. Last Match Quick Glance */}
      {lastMatchDay && (
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex flex-col">
            <div className="text-xs text-neutral-400 mb-1">Last Match</div>
            <div className="text-sm font-medium text-white truncate max-w-[150px]">
              {new Date(lastMatchDay.date).toLocaleDateString()} • {lastMatchDay.venue}
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="bg-white/10 text-white text-xs px-2 py-0.5 rounded mb-1">
              {lastMatchDay.matchType}
            </span>
            <span className="font-bold text-sky-400">
              {lastMatchDay.totalScore !== undefined ? lastMatchDay.totalScore : '--'}
              {lastMatchDay.totalXCount !== undefined ? ` / ${lastMatchDay.totalXCount}X` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
