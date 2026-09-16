'use client';

import React, { useState, useEffect, useRef } from 'react';
import { RotateCcw, Check, Sparkles, Volume2, VolumeX, HelpCircle } from 'lucide-react';
import { TunerType } from '@/types';
import { TunerHelpModal } from '@/components/TunerHelpModal';
import { VoiceInputButton } from '@/components/VoiceInputButton';

interface TunerDialProps {
  currentClick: number;
  onSetClick: (click: number) => void;
  sweetSpotClick?: number;
  forgivingWindow?: { startClick: number; endClick: number; maxVerticalInches: number };
  tunerType?: TunerType;
  barrelName?: string;
  onGoToPurdy?: () => void;
  isEasyMode?: boolean;
  onAskLentz?: () => void;
}

export const TunerDial: React.FC<TunerDialProps> = ({
  currentClick,
  onSetClick,
  sweetSpotClick,
  forgivingWindow,
  tunerType = 'Harrell Standard (50 clicks/rev)',
  barrelName,
  onGoToPurdy,
  isEasyMode = false,
  onAskLentz,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const dialRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clicksPerRev = tunerType.includes('25') ? 25 : 50;
  const maxClicks = 500; // standard 10 revolutions on a Harrell 50-click

  // Synthesize realistic precision metal mechanical click using Web Audio API
  const playClickSound = (isMajor = false, isSweet = false) => {
    if (!soundEnabled) return;
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // 1. High frequency mechanical metallic tick
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = isSweet ? 'sine' : 'triangle';
      const baseFreq = isSweet ? 4200 : isMajor ? 3600 : 3100;
      osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.015);

      gain.gain.setValueAtTime(isSweet ? 0.18 : isMajor ? 0.15 : 0.11, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.018);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.02);

      // 2. iOS Taptic Acoustic Sub-Bass Pulse:
      // iOS Safari blocks the Vibration API, but an ultra-low frequency (55Hz) sharp wave
      // through mobile phone stereo transducers creates a tangible physical tactile bump felt in the fingertips!
      const bassOsc = ctx.createOscillator();
      const bassGain = ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(isSweet ? 65 : 52, ctx.currentTime);

      bassGain.gain.setValueAtTime(0.65, ctx.currentTime);
      bassGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);

      bassOsc.connect(bassGain);
      bassGain.connect(ctx.destination);

      bassOsc.start();
      bassOsc.stop(ctx.currentTime + 0.03);
    } catch (e) {
      // Audio context might be restricted before first interaction
    }
  };

  // Mobile Taptic / Vibration Engine
  const triggerHaptic = (isMajor = false, isSweet = false) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        if (isSweet) {
          navigator.vibrate([25, 35, 25]); // Distinctive double-tap for sweet spot
        } else if (isMajor) {
          navigator.vibrate(16); // Firmer tap for 10-click marks
        } else {
          navigator.vibrate(8); // Crisp micro-tick for standard click
        }
      } catch (err) {
        // Safe fallback
      }
    }
  };

  const updateClick = (newVal: number) => {
    const clamped = Math.max(0, Math.min(maxClicks, Math.round(newVal)));
    if (clamped !== currentClick) {
      const isMajor = clamped % 10 === 0;
      const isSweet = sweetSpotClick !== undefined && clamped === sweetSpotClick;

      playClickSound(isMajor, isSweet);
      triggerHaptic(isMajor, isSweet);
      onSetClick(clamped);
    }
  };

  // Pointer drag math
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    handlePointerMove(e);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging && e.buttons !== 1) return;
    if (!dialRef.current) return;

    const rect = dialRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    // Angle from 12 o'clock in degrees [0, 360)
    let angleRad = Math.atan2(dy, dx) + Math.PI / 2;
    if (angleRad < 0) angleRad += 2 * Math.PI;
    const angleDeg = (angleRad * 180) / Math.PI;

    // Position within current revolution
    const currentRev = Math.floor(currentClick / clicksPerRev);
    const clickInRev = (angleDeg / 360) * clicksPerRev;
    const targetClick = currentRev * clicksPerRev + clickInRev;

    updateClick(targetClick);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {}
  };

  // Current dial orientation
  const angleInRev = ((currentClick % clicksPerRev) / clicksPerRev) * 360;
  const currentRevolution = Math.floor(currentClick / clicksPerRev);
  const markNumber = currentClick % clicksPerRev;

  // Approximate micrometer travel (each click = ~0.0005" on a 40 TPI / 50-mark Harrell)
  const micrometerInches = (currentClick * 0.0005).toFixed(4);

  // Check if current position is within forgiving window
  const isInSweetSpotWindow =
    forgivingWindow &&
    currentClick >= forgivingWindow.startClick &&
    currentClick <= forgivingWindow.endClick;

  const isExactSweetSpot = sweetSpotClick !== undefined && currentClick === sweetSpotClick;

  // ── Easy Mode — Simple full-card layout ──────────────────────────────────
  if (isEasyMode) {
    const statusMsg = isExactSweetSpot
      ? { text: '✅ Perfect! You are at the sweet spot.', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' }
      : isInSweetSpotWindow
      ? { text: `✅ Good — inside the sweet spot window (${forgivingWindow?.startClick}–${forgivingWindow?.endClick} clicks)`, color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' }
      : sweetSpotClick !== undefined
      ? {
          text: currentClick < sweetSpotClick
            ? `⬆  Turn ${sweetSpotClick - currentClick} more clicks to reach sweet spot`
            : `⬇  Back off ${currentClick - sweetSpotClick} clicks to reach sweet spot`,
          color: 'text-amber-300',
          bg: 'bg-amber-500/10 border-amber-500/30',
        }
      : { text: 'No sweet spot recorded yet — use Harmonics tab to find it', color: 'text-neutral-400', bg: 'bg-neutral-900 border-white/10' };

    return (
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col items-center gap-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-radial-gradient from-blue-500/5 via-transparent to-transparent pointer-events-none" />

        {/* Help pill */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold text-xs transition-all active:scale-95"
          >
            <HelpCircle className="w-4 h-4" />
            <span>How to Read</span>
          </button>
        </div>

        {/* Giant click number */}
        <div className="flex flex-col items-center gap-1 mt-2">
          <span className="text-sm font-mono font-bold text-neutral-400 uppercase tracking-widest">Current Click</span>
          <span
            className={`font-black font-mono tracking-tight leading-none transition-all duration-150 ${
              isExactSweetSpot ? 'text-emerald-400' : isInSweetSpotWindow ? 'text-emerald-300' : 'text-white'
            }`}
            style={{ fontSize: 88 }}
          >
            {currentClick}
          </span>
          {sweetSpotClick !== undefined && (
            <span className="text-sm font-mono text-neutral-400">
              Sweet spot: <span className="text-emerald-300 font-bold">{sweetSpotClick}</span>
            </span>
          )}
        </div>

        {/* Status banner */}
        <div className={`w-full px-4 py-3 rounded-xl border text-center text-sm font-bold ${statusMsg.color} ${statusMsg.bg}`}>
          {statusMsg.text}
        </div>

        {/* 4 large step buttons */}
        <div className="w-full grid grid-cols-4 gap-3">
          {[
            { label: '−5', delta: -5 },
            { label: '−1', delta: -1 },
            { label: '+1', delta: 1 },
            { label: '+5', delta: 5 },
          ].map(({ label, delta }) => (
            <button
              key={label}
              onClick={() => updateClick(currentClick + delta)}
              className={`py-4 rounded-2xl font-black text-xl font-mono border transition-all active:scale-95 shadow-md ${
                delta > 0
                  ? 'bg-sky-500/20 hover:bg-sky-500/30 border-sky-500/40 text-sky-200'
                  : 'bg-neutral-800 hover:bg-neutral-700 border-white/15 text-white'
              }`}
              style={{ minHeight: 64 }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Voice command mic */}
        <div className="w-full flex flex-col items-center gap-2">
          <p className="text-xs font-mono text-neutral-500 uppercase tracking-widest">Or speak a command</p>
          <VoiceInputButton
            onTranscript={(text) => {
              const lower = text.toLowerCase();
              const setMatch = lower.match(/(?:set|go to|dial to|click)\s*(\d+)/);
              const addMatch = lower.match(/(?:add|up|increase)\s*(\d+)/);
              const subMatch = lower.match(/(?:back|down|decrease|subtract|minus)\s*(\d+)/);
              const sweetMatch = lower.includes('sweet spot');
              const zeroMatch = lower.includes('zero') || lower.includes('reset');
              if (setMatch) updateClick(parseInt(setMatch[1]));
              else if (addMatch) updateClick(currentClick + parseInt(addMatch[1]));
              else if (subMatch) updateClick(currentClick - parseInt(subMatch[1]));
              else if (sweetMatch && sweetSpotClick !== undefined) updateClick(sweetSpotClick);
              else if (zeroMatch) updateClick(0);
            }}
            className="w-16 h-16 rounded-2xl text-2xl"
            title="Say: 'Set click to 26' · 'Add 2 clicks' · 'Go to sweet spot'"
          />
          <p className="text-xs font-mono text-neutral-500 text-center max-w-[220px]">
            Try: <em>"Set click to 26"</em> or <em>"Add 2 clicks"</em>
          </p>
        </div>

        {/* Ask Lentz big button */}
        {onAskLentz && (
          <button
            onClick={onAskLentz}
            className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-lg flex items-center justify-center gap-3 shadow-glow-blue transition-all active:scale-[0.98]"
            style={{ minHeight: 72 }}
          >
            <span className="text-2xl">🎙</span>
            Ask Lentz Advisor
          </button>
        )}

        {/* Sound toggle — small, tucked */}
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={`self-center flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
            soundEnabled ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-neutral-900 border-white/10 text-neutral-500'
          }`}
        >
          {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          {soundEnabled ? 'Click sound on' : 'Click sound off'}
        </button>

        {/* Help Modal */}
        <TunerHelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} onGoToPurdy={onGoToPurdy} />
      </div>
    );
  }

  return (
    <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col items-center relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-radial-gradient from-blue-500/5 via-transparent to-transparent pointer-events-none" />

      {/* Header info */}
      <div className="w-full flex items-start justify-between mb-4 gap-3">
        {/* Left — Title block */}
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">
            Rotary Barrel Weight
          </span>
          <h2 className="text-lg md:text-xl font-black text-white tracking-tight leading-tight">
            Harrell Precision Dial
          </h2>
          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-sky-300 border border-blue-500/40 font-mono self-start">
            {clicksPerRev} Clicks / Rev
          </span>
        </div>

        {/* Right — Controls */}
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {/* Sound toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl border transition-colors ${
              soundEnabled
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-white/[0.04] border-white/15 text-neutral-400'
            }`}
            title={soundEnabled ? 'Click audio on' : 'Click audio off'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* How to Read pill */}
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 text-sky-300 font-bold text-xs transition-all active:scale-95 whitespace-nowrap"
            title="Tuner Reference Guide — How to read your Harrell"
          >
            <HelpCircle className="w-4 h-4 shrink-0" />
            <span>How to Read</span>
          </button>
        </div>
      </div>

      {/* Dial Container */}
      <div className="relative my-2 select-none flex items-center justify-center">
        {/* Outer decorative rim with machined knurling simulation */}
        <div
          ref={dialRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="relative w-64 h-64 md:w-72 md:h-72 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center p-3 shadow-2xl transition-transform active:scale-[0.99]"
          style={{
            background:
              'radial-gradient(circle at 30% 30%, #2A303C 0%, #171A21 55%, #0B0D12 100%)',
            boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0,0,0,0.8)',
          }}
        >
          {/* Circular SVG scale ticks */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 300 300">
            {/* Outer graduated track */}
            <circle
              cx="150"
              cy="150"
              r="135"
              fill="none"
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="2.5"
            />

            {/* Render 50 / 25 ticks around the ring */}
            {Array.from({ length: clicksPerRev }).map((_, i) => {
              const tickAngle = (i / clicksPerRev) * 360 - 90;
              const rad = (tickAngle * Math.PI) / 180;
              const isMajor = i % 5 === 0;
              const isMark10 = i % 10 === 0;
              const length = isMark10 ? 15 : isMajor ? 10 : 6;
              const r1 = 135;
              const r2 = r1 - length;

              const x1 = 150 + r1 * Math.cos(rad);
              const y1 = 150 + r1 * Math.sin(rad);
              const x2 = 150 + r2 * Math.cos(rad);
              const y2 = 150 + r2 * Math.sin(rad);

              // Text label for major marks (0, 10, 20, 30, 40...)
              const textR = 106;
              const textX = 150 + textR * Math.cos(rad);
              const textY = 150 + textR * Math.sin(rad);

              return (
                <g key={i}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isMajor ? '#38BDF8' : 'rgba(255, 255, 255, 0.35)'}
                    strokeWidth={isMajor ? 2.5 : 1.5}
                  />
                  {isMark10 && (
                    <text
                      x={textX}
                      y={textY}
                      fill="#FFFFFF"
                      fontSize="11"
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {i}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Sweet Spot Arc Indicator if calculated */}
            {forgivingWindow && (
              <circle
                cx="150"
                cy="150"
                r="135"
                fill="none"
                stroke="#10B981"
                strokeWidth="5"
                strokeDasharray="8 4"
                opacity="0.8"
              />
            )}
          </svg>

          {/* Rotating Pointer Hub */}
          <div
            className="absolute inset-4 rounded-full flex items-center justify-center transition-transform duration-75"
            style={{ transform: `rotate(${angleInRev}deg)` }}
          >
            {/* Top Indicator Needle */}
            <div className="absolute top-2 w-2 h-7 bg-gradient-to-b from-sky-400 to-blue-600 rounded-full shadow-glow-blue" />
            <div className="absolute top-1 w-3 h-3 bg-white rounded-full shadow" />
          </div>

          {/* Center Digital Core readout */}
          <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-[#0E1117] border border-white/20 flex flex-col items-center justify-center shadow-inner z-10 select-none">
            <span className="text-xs uppercase font-mono font-bold text-neutral-300 tracking-wider">
              Rev {currentRevolution}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl md:text-5xl font-black font-mono tracking-tight text-white">
                {currentClick}
              </span>
              <span className="text-xs font-mono font-bold text-neutral-400">CLK</span>
            </div>
            <span className="text-xs font-mono font-bold text-sky-300 mt-1">
              Mark {markNumber}
            </span>
            <span className="text-xs font-mono font-medium text-neutral-300 mt-0.5">
              +{micrometerInches}&quot;
            </span>
          </div>
        </div>
      </div>

      {/* ── Animated CSS Barrel Tuner Drum ── */}
      <div className="w-full mt-5 mb-1">
        <p className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-wider mb-2.5 text-center">
          Physical Tuner Position
        </p>

        {/* Drum wrapper — outer aluminium body */}
        <div
          className="relative mx-auto flex items-stretch rounded-2xl overflow-hidden shadow-2xl select-none"
          style={{
            maxWidth: 380,
            background: 'linear-gradient(180deg, #d4d8df 0%, #b8bdc6 18%, #9da3ae 35%, #b8bdc6 52%, #d4d8df 70%, #c4c8d0 100%)',
            boxShadow: 'inset 0 2px 6px rgba(255,255,255,0.6), inset 0 -2px 6px rgba(0,0,0,0.35), 0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {/* Left barrel body cap */}
          <div
            className="w-[28%] shrink-0 flex items-center justify-center"
            style={{
              background: 'linear-gradient(180deg, #e0e4ea 0%, #c4c8d0 30%, #a8adb6 60%, #c4c8d0 80%, #d8dce2 100%)',
              borderRight: '1px solid rgba(0,0,0,0.18)',
            }}
          >
            {/* Brushed highlight stripe */}
            <div className="w-full h-[2px] bg-white/40 absolute" style={{ top: '30%' }} />
            <div className="w-full h-[1px] bg-white/25 absolute" style={{ top: '65%' }} />
          </div>

          {/* Knurled centre adjustment band */}
          <div
            className="w-[28%] shrink-0 relative"
            style={{
              background: `
                repeating-linear-gradient(
                  45deg,
                  rgba(0,0,0,0.18) 0px,
                  rgba(0,0,0,0.18) 2px,
                  transparent 2px,
                  transparent 7px
                ),
                repeating-linear-gradient(
                  -45deg,
                  rgba(0,0,0,0.18) 0px,
                  rgba(0,0,0,0.18) 2px,
                  transparent 2px,
                  transparent 7px
                ),
                linear-gradient(180deg, #9ba0aa 0%, #7c818a 30%, #6b7078 55%, #7c818a 80%, #9ba0aa 100%)
              `,
              boxShadow: 'inset 2px 0 4px rgba(0,0,0,0.3), inset -2px 0 4px rgba(0,0,0,0.3)',
            }}
          >
            {/* Setscrew */}
            <div
              className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #555 0%, #222 60%, #111 100%)',
                boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.15), 0 1px 2px rgba(0,0,0,0.8)',
              }}
            >
              {/* Allen slot */}
              <div className="absolute inset-[3px] flex items-center justify-center">
                <div className="w-full h-[1.5px] bg-black/60 rounded-full" />
              </div>
            </div>
          </div>

          {/* Click scale column — the scrolling numbered scale */}
          <div
            className="w-[28%] relative overflow-hidden"
            style={{
              background: 'linear-gradient(180deg, #dde0e5 0%, #f0f2f4 15%, #f8f9fa 40%, #f0f2f4 85%, #dde0e5 100%)',
              borderLeft: '1px solid rgba(0,0,0,0.15)',
            }}
          >
            {/* The scrolling scale — each number is ~48px tall */}
            <div
              className="absolute inset-x-0"
              style={{
                // centre the current click number at the hairline (mid = 3 rows visible each side)
                // ROWS: [click-4, click-3, click-2, click-1, ACTIVE, click+1, click+2, click+3, click+4]
                // each row is 48px, hairline is at 50% = 4 rows * 48px = 192px offset
                top: `calc(50% - ${currentClick * 48 + 24}px)`,
                transition: 'top 0.25s cubic-bezier(0.34, 1.42, 0.64, 1)',
              }}
            >
              {Array.from({ length: Math.max(60, currentClick + 20) }, (_, i) => {
                const dist = Math.abs(i - currentClick);
                const isActive = dist === 0;
                const isMajor = i % 5 === 0;
                const opacity = dist === 0 ? 1 : dist === 1 ? 0.65 : dist === 2 ? 0.35 : dist <= 4 ? 0.15 : 0;
                return (
                  <div
                    key={i}
                    className="relative flex items-center"
                    style={{ height: 48, opacity }}
                  >
                    {/* Major tick line */}
                    <div
                      className="absolute left-0"
                      style={{
                        width: isMajor ? '40%' : '25%',
                        height: isMajor ? 1.5 : 1,
                        background: isActive ? '#0ea5e9' : '#555',
                      }}
                    />
                    {/* Number */}
                    <span
                      className="absolute left-[45%] font-mono font-black"
                      style={{
                        fontSize: isActive ? 18 : isMajor ? 14 : 11,
                        color: isActive ? '#0284c7' : '#1e293b',
                        letterSpacing: '-0.02em',
                        lineHeight: 1,
                      }}
                    >
                      {i}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Top & bottom gradient fade masks */}
            <div className="absolute inset-x-0 top-0 h-[38%] pointer-events-none" style={{ background: 'linear-gradient(180deg, #dde0e5 0%, transparent 100%)' }} />
            <div className="absolute inset-x-0 bottom-0 h-[38%] pointer-events-none" style={{ background: 'linear-gradient(0deg, #dde0e5 0%, transparent 100%)' }} />
          </div>

          {/* Right cap / muzzle end body */}
          <div
            className="flex-1 flex items-center justify-end pr-3 relative"
            style={{
              background: 'linear-gradient(180deg, #d8dce4 0%, #bcc0ca 30%, #a6aab4 60%, #bcc0ca 80%, #d4d8e0 100%)',
              borderLeft: '1px solid rgba(0,0,0,0.18)',
            }}
          >
            {/* Reference hairline — the fixed indicator */}
            <div
              className="absolute inset-x-0"
              style={{
                top: '50%',
                height: 2,
                background: 'linear-gradient(90deg, transparent 0%, #ef4444 20%, #ef4444 80%, transparent 100%)',
                boxShadow: '0 0 6px rgba(239,68,68,0.7)',
              }}
            />
            {/* Hairline label */}
            <span className="text-xs font-mono font-black text-red-500 tracking-widest opacity-80 mt-6 z-10 pr-1">
              ←REF
            </span>
          </div>
        </div>

        {/* Drum caption */}
        <p className="text-center text-xs font-mono text-neutral-500 mt-2">
          <span className="text-sky-400 font-bold">{currentClick}</span> clicks selected&nbsp;·&nbsp;Mark <span className="text-sky-300 font-bold">{markNumber}</span> on Rev <span className="text-sky-300 font-bold">{currentRevolution}</span>&nbsp;·&nbsp;
          <span className="text-red-400 font-bold">━</span> = reference hairline
        </p>
      </div>

      {/* Sweet Spot Status Banner */}
      <div className="w-full mt-4">
        {isExactSweetSpot ? (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center gap-2.5 text-sm font-bold text-emerald-300 animate-pulse">
            <Sparkles className="w-5 h-5" />
            <span>Optimal Harmonic Sweet Spot Locked ({currentClick} Clicks)</span>
          </div>
        ) : isInSweetSpotWindow ? (
          <div className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center gap-2.5 text-sm font-bold text-emerald-300">
            <Check className="w-5 h-5" />
            <span>
              Inside Forgiving Window ({forgivingWindow?.startClick}–{forgivingWindow?.endClick} Clicks)
            </span>
          </div>
        ) : (
          <div className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 border border-white/10 flex items-center justify-between text-sm font-semibold text-neutral-300">
            <span className="font-mono">
              Travel: {(currentClick * 0.0005 * 25.4).toFixed(3)} mm
            </span>
            {sweetSpotClick !== undefined && (
              <button
                onClick={() => updateClick(sweetSpotClick)}
                className="text-sky-300 hover:text-white underline text-sm font-bold"
              >
                Jump to Sweet Spot ({sweetSpotClick})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stepper Controls & Presets */}
      <div className="w-full mt-4 grid grid-cols-5 gap-2.5">
        <button
          onClick={() => updateClick(currentClick - 5)}
          className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-sm md:text-base font-mono font-black border border-white/15 transition-all flex items-center justify-center shadow-sm"
        >
          -5
        </button>
        <button
          onClick={() => updateClick(currentClick - 1)}
          className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-sm md:text-base font-mono font-black border border-white/15 transition-all flex items-center justify-center shadow-sm"
        >
          -1
        </button>

        <button
          onClick={() => updateClick(0)}
          className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-neutral-300 hover:text-white text-sm font-mono border border-white/15 transition-all flex items-center justify-center shadow-sm"
          title="Reset to 0 clicks (bottomed out)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          onClick={() => updateClick(currentClick + 1)}
          className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-sm md:text-base font-mono font-black border border-white/15 transition-all flex items-center justify-center shadow-sm"
        >
          +1
        </button>
        <button
          onClick={() => updateClick(currentClick + 5)}
          className="py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-sm md:text-base font-mono font-black border border-white/15 transition-all flex items-center justify-center shadow-sm"
        >
          +5
        </button>
      </div>

      {/* Quick Direct Slider */}
      <div className="w-full mt-4 flex items-center gap-3">
        <span className="text-xs font-mono font-bold text-neutral-300 w-8 text-left">0</span>
        <input
          type="range"
          min="0"
          max={clicksPerRev * 2} // default range 0-100 clicks
          value={currentClick}
          onChange={(e) => updateClick(Number(e.target.value))}
          className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
        />
        <span className="text-xs font-mono font-bold text-neutral-300 w-8 text-right">
          {clicksPerRev * 2}
        </span>
      </div>

      {/* Help Modal */}
      <TunerHelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        onGoToPurdy={onGoToPurdy}
      />
    </div>
  );
};
