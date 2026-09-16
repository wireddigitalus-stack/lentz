'use client';

import React, { useState, useEffect } from 'react';
import { Calculator, ChevronDown, Zap, Target, Info, CheckCircle2 } from 'lucide-react';
import { BarrelProfile, AmmoLot, CorrectionMethod } from '@/types';
import {
  calculateAllPurdyModes,
  chaconReferenceNumber,
  velocityToStartingClick,
  CORRECTION_FACTORS,
} from '@/lib/ballistics';

interface PurdyCalculatorProps {
  barrel?: BarrelProfile;
  activeAmmo?: AmmoLot;
  activeTunerClick: number;
  onApplyClick: (click: number) => void;
}

export const PurdyCalculator: React.FC<PurdyCalculatorProps> = ({
  barrel,
  activeAmmo,
  activeTunerClick,
  onApplyClick,
}) => {
  const [barrelLength, setBarrelLength] = useState<number>(barrel?.lengthInches ?? 24.241);
  const [muzzleOD, setMuzzleOD] = useState<number>(barrel?.muzzleDiameterInches ?? 0.900);
  const [correctionMethod, setCorrectionMethod] = useState<CorrectionMethod>('jmp');
  const [velocityFps, setVelocityFps] = useState<number>(
    activeAmmo?.measuredAvgFps ?? activeAmmo?.boxMuzzleVelocityFps ?? 1070
  );
  const [appliedClick, setAppliedClick] = useState<number | null>(null);

  useEffect(() => {
    if (barrel) { setBarrelLength(barrel.lengthInches); setMuzzleOD(barrel.muzzleDiameterInches); }
  }, [barrel?.id]);

  useEffect(() => {
    if (activeAmmo) { const v = activeAmmo.measuredAvgFps ?? activeAmmo.boxMuzzleVelocityFps; if (v) setVelocityFps(v); }
  }, [activeAmmo?.id]);

  const modes = calculateAllPurdyModes(barrelLength, muzzleOD, correctionMethod);
  const chacon = chaconReferenceNumber(barrelLength);
  const velResult = velocityToStartingClick(velocityFps);
  const ninthMode = modes.find((m) => m.mode === 'ninth')!;

  const handleApply = (click: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) { try { navigator.vibrate([20, 30, 20]); } catch (e) {} }
    onApplyClick(click);
    setAppliedClick(click);
    setTimeout(() => setAppliedClick(null), 2500);
  };

  const correctionLabel: Record<CorrectionMethod, string> = { jmp: 'JMP (0.264)', chacon: 'Chacon (0.295)', purdy: 'Purdy (0.300)' };
  const TABLE = [{v:1053,c:21},{v:1056,c:22},{v:1060,c:23},{v:1063,c:24},{v:1066,c:25},{v:1070,c:26},{v:1073,c:27},{v:1076,c:28},{v:1079,c:29},{v:1083,c:30}];

  return (
    <div className="flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2.5">
            <Calculator className="w-5 h-5 text-sky-400" />
            Purdy Method 4
          </h2>
          <p className="text-xs text-neutral-400 font-medium mt-0.5 font-mono">
            Jeremiah Lentz harmonic tuner dimension calculator
          </p>
        </div>
        <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
          {barrel ? barrel.serialNumber : 'No Barrel'}
        </span>
      </div>

      {/* Input Panel */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-glass">
        <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-4">Barrel Parameters</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-mono font-bold text-neutral-300 block mb-1.5">Barrel Length (inches)</label>
            <input type="number" step="0.001" min="18" max="30" value={barrelLength}
              onChange={(e) => setBarrelLength(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500 transition-colors" />
            {barrel && <p className="text-xs text-neutral-500 mt-1 font-mono">Profile: {barrel.lengthInches}"</p>}
          </div>
          <div>
            <label className="text-xs font-mono font-bold text-neutral-300 block mb-1.5">Muzzle OD (inches)</label>
            <input type="number" step="0.001" min="0.500" max="2.000" value={muzzleOD}
              onChange={(e) => setMuzzleOD(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500 transition-colors" />
            {barrel && <p className="text-xs text-neutral-500 mt-1 font-mono">Profile: {barrel.muzzleDiameterInches}"</p>}
          </div>
          <div>
            <label className="text-xs font-mono font-bold text-neutral-300 block mb-1.5">End Correction Method</label>
            <select value={correctionMethod} onChange={(e) => setCorrectionMethod(e.target.value as CorrectionMethod)}
              className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-sky-500 transition-colors">
              <option value="jmp">JMP — 0.264 (Lentz default)</option>
              <option value="chacon">Chacon — 0.295</option>
              <option value="purdy">Purdy — 0.300</option>
            </select>
            <p className="text-xs text-neutral-500 mt-1 font-mono">End Corr = Muzzle OD × {CORRECTION_FACTORS[correctionMethod]}</p>
          </div>
        </div>
      </div>

      {/* Results — 5-Mode Cards */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">Harmonic Mode Results</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {modes.map((m) => (
            <div key={m.mode} className={`rounded-2xl p-4 border backdrop-blur-xl relative overflow-hidden transition-all ${
              m.isRecommended ? 'bg-[#0d1520] border-sky-500/50 shadow-glow-blue' : 'bg-[#10131A]/90 border-white/10'}`}>
              {m.isRecommended && <div className="absolute top-0 right-0 w-20 h-20 bg-sky-500/10 rounded-full blur-xl pointer-events-none" />}
              <div className="flex items-start justify-between mb-3 gap-1">
                <span className={`text-xs font-mono font-bold uppercase tracking-wide leading-tight ${m.isRecommended ? 'text-sky-300' : 'text-neutral-300'}`}>{m.label}</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded shrink-0 ${m.isRecommended ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40' : 'bg-neutral-800 text-neutral-300 border border-white/10'}`}>×{m.ratio}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-3">
                <span className={`text-3xl font-black font-mono tracking-tight ${m.isRecommended ? 'text-white' : 'text-neutral-100'}`}>{m.tunerDimensionInches.toFixed(3)}</span>
                <span className="text-xs font-mono font-bold text-neutral-400">in</span>
              </div>
              <div className="flex flex-col gap-1 text-xs font-mono">
                <div className="flex justify-between text-neutral-400"><span>Resonant L</span><span className="text-neutral-200 font-bold">{m.resonantLength.toFixed(3)}"</span></div>
                <div className="flex justify-between text-neutral-400"><span>End Corr</span><span className="text-neutral-200 font-bold">{m.endCorrection.toFixed(3)}"</span></div>
              </div>
              {m.isRecommended && (
                <div className="mt-3 pt-2.5 border-t border-sky-500/20">
                  <span className="text-xs font-bold text-sky-400 flex items-center gap-1"><Zap className="w-3 h-3" />Recommended</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Chacon Reference */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-glass">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">Chacon Reference Numbers</h3>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono"><Info className="w-3.5 h-3.5" /><span>±0.125" per inch of barrel</span></div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {[20,21,22,23,24,25,26,27].map((len) => {
            const isClose = Math.abs(len - barrelLength) < 0.5;
            return (
              <div key={len} className={`flex flex-col items-center px-3 py-2 rounded-xl border font-mono text-center ${isClose ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' : 'bg-neutral-900 border-white/10 text-neutral-300'}`}>
                <span className="text-xs font-bold text-neutral-400">{len}"</span>
                <span className="text-sm font-black">{chaconReferenceNumber(len).toFixed(3)}"</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3 bg-neutral-900/60 rounded-xl p-3 border border-white/5">
          <div className="text-center"><span className="text-xs font-mono font-bold text-neutral-400 block">Chacon Ref</span><span className="text-lg font-black font-mono text-amber-300">{chacon.toFixed(3)}"</span></div>
          <div className="text-center"><span className="text-xs font-mono font-bold text-neutral-400 block">Purdy 9th (JMP)</span><span className="text-lg font-black font-mono text-sky-300">{ninthMode.tunerDimensionInches.toFixed(3)}"</span></div>
          <div className="text-center">
            <span className="text-xs font-mono font-bold text-neutral-400 block">Delta</span>
            <span className={`text-lg font-black font-mono ${Math.abs(chacon - ninthMode.tunerDimensionInches) < 0.05 ? 'text-emerald-400' : 'text-neutral-200'}`}>
              {(chacon - ninthMode.tunerDimensionInches >= 0 ? '+' : '')}{(chacon - ninthMode.tunerDimensionInches).toFixed(3)}"
            </span>
          </div>
        </div>
      </div>

      {/* Velocity → Starting Click */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-5 backdrop-blur-xl shadow-glass">
        <h3 className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider mb-4">Velocity → Starting Click (Lentz Range Table)</h3>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1">
            <label className="text-xs font-mono font-bold text-neutral-300 block mb-1.5">Measured Avg Velocity (fps)</label>
            <input type="number" step="1" min="900" max="1200" value={velocityFps}
              onChange={(e) => setVelocityFps(Number(e.target.value))}
              className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-base text-white font-mono font-bold focus:outline-none focus:border-sky-500 transition-colors" />
            {activeAmmo && (
              <p className="text-xs text-neutral-500 mt-1 font-mono">
                {activeAmmo.brand} {activeAmmo.model} Lot #{activeAmmo.lotNumber}
                {activeAmmo.measuredAvgFps ? ` — ${activeAmmo.measuredAvgFps} fps` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-col items-center px-6 py-4 rounded-2xl bg-sky-500/10 border border-sky-500/40 min-w-[130px]">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider">Start at Click</span>
            <span className="text-5xl font-black font-mono text-white mt-1 tracking-tight">{velResult.clicks}</span>
            {velResult.isInterpolated && <span className="text-xs font-mono text-sky-300/70 mt-1">interpolated</span>}
          </div>
        </div>

        {/* Bracketing context */}
        {velResult.nearestBelow && velResult.nearestAbove && velResult.nearestBelow !== velResult.nearestAbove && (
          <div className="mt-3 flex items-center gap-3 text-xs font-mono text-neutral-400">
            <span>↓ {velResult.nearestBelow.velocityFps} fps = {velResult.nearestBelow.clicks} clicks</span>
            <span className="text-neutral-600">|</span>
            <span>↑ {velResult.nearestAbove.velocityFps} fps = {velResult.nearestAbove.clicks} clicks</span>
          </div>
        )}

        {/* Full table collapsible */}
        <details className="mt-4 group">
          <summary className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-400 hover:text-neutral-200 cursor-pointer list-none transition-colors">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            Show full Lentz velocity table
          </summary>
          <div className="mt-3 grid grid-cols-5 sm:grid-cols-10 gap-1.5">
            {TABLE.map((entry) => {
              const isActive = Math.abs(velocityFps - entry.v) <= 2;
              return (
                <div key={entry.v} className={`rounded-xl p-2 text-center border font-mono ${isActive ? 'bg-sky-500/20 border-sky-500/50 text-sky-200' : 'bg-neutral-900/80 border-white/5 text-neutral-300'}`}>
                  <div className="text-xs font-bold">{entry.v}</div>
                  <div className="text-sm font-black text-white">{entry.c}c</div>
                </div>
              );
            })}
          </div>
        </details>

        <button onClick={() => handleApply(velResult.clicks)}
          className="mt-4 w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm shadow-glow-blue flex items-center justify-center gap-2.5 transition-all active:scale-[0.98]">
          {appliedClick !== null ? (
            <><CheckCircle2 className="w-5 h-5" />Applied! Dial set to {appliedClick} clicks</>
          ) : (
            <><Target className="w-5 h-5" />Apply {velResult.clicks} Clicks to Tuner Dial</>
          )}
        </button>
      </div>

      {/* Formula footer */}
      <div className="bg-neutral-900/40 border border-white/5 rounded-xl p-4 text-xs font-mono text-neutral-500 leading-relaxed">
        <strong className="text-neutral-300">Formula: </strong>
        TunerDim = (BarrelLen × ratio) − BarrelLen − (MuzzleOD × {CORRECTION_FACTORS[correctionMethod]})
        {'  '}·{'  '}
        <strong className="text-neutral-400">Correction: </strong>{correctionLabel[correctionMethod]}
        {'  '}·{'  '}
        <strong className="text-neutral-400">Source: </strong>Jeremiah Lentz / Purdy Method 4
      </div>
    </div>
  );
};
