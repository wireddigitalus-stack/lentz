'use client';

import React, { useState } from 'react';
import { Calculator, Sparkles, Check, Info, ChevronDown, ChevronUp, Zap, HelpCircle } from 'lucide-react';
import { BarrelProfile, AmmoLot } from '@/types';
import { calculatePurdyTunerDimension, velocityToStartingClick } from '@/lib/ballistics';

interface JMPQuickCalculatorProps {
  barrel?: BarrelProfile;
  activeAmmo?: AmmoLot;
  activeTunerClick: number;
  onApplyClick: (click: number) => void;
  onSaveBarrelSetting?: (tunerClick: number, isTube: boolean) => void;
}

export const JMPQuickCalculator: React.FC<JMPQuickCalculatorProps> = ({
  barrel,
  activeAmmo,
  activeTunerClick,
  onApplyClick,
  onSaveBarrelSetting,
}) => {
  const [barrelLength, setBarrelLength] = useState<string>(
    barrel?.lengthInches ? String(barrel.lengthInches) : '21.750'
  );
  const [tunerDiameter, setTunerDiameter] = useState<string>('1.341');
  const [deviceType, setDeviceType] = useState<'tuner' | 'tube' | 'custom'>('tuner');
  const [showAbout, setShowAbout] = useState(false);
  const [applied, setApplied] = useState(false);

  // Fast preset switch
  const handleSelectDevice = (type: 'tuner' | 'tube' | 'custom') => {
    setDeviceType(type);
    if (type === 'tuner') {
      setTunerDiameter('1.341');
    } else if (type === 'tube') {
      setTunerDiameter('1.500');
    }
  };

  const lenNum = parseFloat(barrelLength) || 0;
  const diaNum = parseFloat(tunerDiameter) || 0;

  // Calculate JMP 9th Harmonic target dimension
  const purdyResult = lenNum > 0 && diaNum > 0
    ? calculatePurdyTunerDimension(lenNum, diaNum, 'ninth', 'jmp')
    : null;

  // Baseline velocity for starting click recommendation
  const ammoVelocity = activeAmmo?.measuredAvgFps ?? activeAmmo?.boxMuzzleVelocityFps ?? 1070;
  const velClick = velocityToStartingClick(ammoVelocity);

  // Calculated starting click
  const targetDimension = purdyResult ? purdyResult.tunerDimensionInches : 0;

  // On Harrell 50-click (0.0005" per click):
  // Fraction of revolution can be mapped to dial marks
  const recommendedClick = velClick.clicks;

  const handleApply = () => {
    onApplyClick(recommendedClick);
    if (onSaveBarrelSetting) {
      onSaveBarrelSetting(recommendedClick, deviceType === 'tube');
    }
    setApplied(true);
    setTimeout(() => setApplied(false), 2200);
  };

  return (
    <div className="w-full bg-[#10131A]/95 border border-sky-500/30 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-glass relative overflow-hidden transition-all">
      {/* Background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase tracking-wide">
              ⚡ JMP Foundation Engine
            </span>
            <span className="text-xs font-mono text-emerald-400 font-semibold hidden sm:inline">
              ±10 Click Window
            </span>
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight mt-1 flex items-center gap-2">
            JMP Harmonic Calculator
          </h2>
        </div>

        <button
          onClick={() => setShowAbout(!showAbout)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/15 text-xs text-neutral-300 font-bold transition-all active:scale-95 shrink-0"
          title="About JMP Harmonic Method"
        >
          <Info className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">About</span>
        </button>
      </div>

      {/* About Box (Inspired by original JMP tool) */}
      {showAbout && (
        <div className="mb-5 p-4 rounded-xl bg-neutral-900/90 border border-sky-500/30 text-xs md:text-sm text-neutral-300 leading-relaxed flex flex-col gap-2 animate-fadeIn shadow-inner">
          <div className="flex items-center justify-between font-bold text-sky-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-sky-400" />
              The JMP Harmonic Method
            </span>
            <span className="font-mono text-xs text-neutral-400">Purdy 9th Harmonic • JMP Refined</span>
          </div>
          <p>
            This is a very refined variation of the <strong>Purdy Method</strong> and typically produces results within <strong className="text-emerald-400">±10 clicks</strong> of optimal match tune.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1 pt-2 border-t border-white/10 text-xs font-mono">
            <div>• Tuner default end diameter: <strong className="text-white">1.341"</strong></div>
            <div>• Bloop tube default diameter: <strong className="text-white">1.500"</strong></div>
            <div>• More precise measurements produce more accurate results.</div>
            <div>• Calculations rounded to 3 decimal places.</div>
          </div>
        </div>
      )}

      {/* Main 2-Input Form (From the original screen) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Input 1: Barrel Length */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-neutral-200">Barrel Length (Inches)</label>
            <span className="text-xs font-mono text-neutral-400">e.g. 21.750</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              value={barrelLength}
              onChange={(e) => setBarrelLength(e.target.value)}
              placeholder="21.750"
              className="w-full bg-neutral-950 border border-white/20 focus:border-sky-500 rounded-xl px-4 py-3 text-base md:text-lg font-mono font-bold text-white focus:outline-none transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-neutral-500 pointer-events-none">
              in
            </span>
          </div>
        </div>

        {/* Input 2: Tuner End Diameter + Type Toggle */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-bold text-neutral-200">Tuner End Diameter (Inches)</label>
            <span className="text-xs font-mono text-neutral-400">Default: 1.341 / 1.500</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.001"
              value={tunerDiameter}
              onChange={(e) => {
                setTunerDiameter(e.target.value);
                setDeviceType('custom');
              }}
              placeholder="1.341"
              className="w-full bg-neutral-950 border border-white/20 focus:border-sky-500 rounded-xl px-4 py-3 text-base md:text-lg font-mono font-bold text-white focus:outline-none transition-colors"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-neutral-500 pointer-events-none">
              in
            </span>
          </div>

          {/* Device Type Select Pills */}
          <div className="flex gap-2 mt-1">
            <button
              type="button"
              onClick={() => handleSelectDevice('tuner')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                deviceType === 'tuner'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                  : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              🎯 Tuner (1.341")
            </button>
            <button
              type="button"
              onClick={() => handleSelectDevice('tube')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all border ${
                deviceType === 'tube'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                  : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              🔭 Tube (1.500")
            </button>
            <button
              type="button"
              onClick={() => setDeviceType('custom')}
              className={`py-1.5 px-2.5 rounded-lg text-xs font-bold transition-all border ${
                deviceType === 'custom'
                  ? 'bg-sky-500 text-white border-sky-400 shadow-sm'
                  : 'bg-white/[0.04] text-neutral-400 border-white/10 hover:text-white'
              }`}
            >
              Custom
            </button>
          </div>
        </div>
      </div>

      {/* Output / Results Banner */}
      {purdyResult && (
        <div className="rounded-2xl bg-gradient-to-r from-sky-950/40 via-neutral-900 to-sky-950/40 border border-sky-500/30 p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 mt-2">
          {/* Left metrics */}
          <div className="flex items-center gap-6 w-full md:w-auto justify-around md:justify-start">
            <div>
              <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider block">
                Target Dimension
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-3xl md:text-4xl font-black font-mono text-white">
                  {targetDimension.toFixed(3)}
                </span>
                <span className="text-sm font-mono text-neutral-400">in</span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                Resonant: {purdyResult.resonantLength.toFixed(3)}"
              </span>
            </div>

            <div className="h-10 w-px bg-white/10" />

            <div>
              <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block">
                Starting Click
              </span>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-3xl md:text-4xl font-black font-mono text-emerald-300">
                  {recommendedClick}
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                  ±10 Clicks
                </span>
              </div>
              <span className="text-xs font-mono text-neutral-400">
                @ {ammoVelocity} fps
              </span>
            </div>
          </div>

          {/* Right CTA Button */}
          <button
            onClick={handleApply}
            className="w-full md:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-sm md:text-base flex items-center justify-center gap-2.5 shadow-glow-blue transition-all active:scale-95 shrink-0"
          >
            {applied ? (
              <>
                <Check className="w-5 h-5 text-emerald-300" />
                <span>Dial Set to Click {recommendedClick}!</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 text-white" />
                <span>Set Dial to Click {recommendedClick}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
