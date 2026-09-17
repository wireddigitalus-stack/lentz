'use client';

import React, { useState } from 'react';
import { Activity, Plus, Trash2, Sparkles, Check, ChevronDown, ChevronUp, AlertCircle, Calculator } from 'lucide-react';
import { TuneRun, TuneSession, BarrelProfile, AmmoLot } from '@/types';
import { analyzeHarmonics, estimatePRXStartingClick, INCHES_PER_MOA_AT_50YD } from '@/lib/ballistics';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { parseBenchVoiceCommand } from '@/lib/speechRecognition';
import { PurdyCalculator } from '@/components/PurdyCalculator';

interface HarmonicChartProps {
  session: TuneSession;
  barrel?: BarrelProfile;
  activeAmmo?: AmmoLot;
  activeTunerClick: number;
  onUpdateRuns: (runs: TuneRun[]) => void;
  onSelectSweetSpot: (click: number) => void;
  onApplyClick: (click: number) => void;
}

export const HarmonicChart: React.FC<HarmonicChartProps> = ({
  session,
  barrel,
  activeAmmo,
  activeTunerClick,
  onUpdateRuns,
  onSelectSweetSpot,
  onApplyClick,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'curve' | 'purdy'>('curve');
  const [newClick, setNewClick] = useState<number>(18);
  const [newVertical, setNewVertical] = useState<string>('0.150');
  const [newGroupSize, setNewGroupSize] = useState<string>('0.210');
  const [isAddingRun, setIsAddingRun] = useState<boolean>(false);

  const runs = session.runs || [];
  const analysis = analyzeHarmonics(runs);

  const prxInfo = barrel
    ? estimatePRXStartingClick(barrel.lengthInches, barrel.muzzleDiameterInches, barrel.tunerWeightOz)
    : null;

  const handleAddManualRun = (e: React.FormEvent) => {
    e.preventDefault();
    const v = parseFloat(newVertical);
    const g = parseFloat(newGroupSize);
    if (isNaN(v) || isNaN(g)) return;

    const newRun: TuneRun = {
      id: `run-${Date.now()}`,
      tunerClick: newClick,
      shotCount: 5,
      verticalSpreadInches: v,
      horizontalSpreadInches: Number((g * 0.7).toFixed(3)),
      groupSizeInches: g,
      groupMoa50Yd: Number((g / INCHES_PER_MOA_AT_50YD).toFixed(3)),
      notes: `Bench entry at ${newClick} clicks`,
    };

    const updated = [...runs, newRun].sort((a, b) => a.tunerClick - b.tunerClick);
    onUpdateRuns(updated);
    setIsAddingRun(false);
  };

  const handleDeleteRun = (id: string) => {
    const updated = runs.filter((r) => r.id !== id);
    onUpdateRuns(updated);
  };

  // SVG Chart Dimensions
  const chartWidth = 700;
  const chartHeight = 280;
  const padding = { top: 30, right: 40, bottom: 40, left: 55 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const clicks = runs.map((r) => r.tunerClick);
  const minClick = clicks.length > 0 ? Math.min(...clicks) : 0;
  const maxClick = clicks.length > 0 ? Math.max(...clicks) : 50;
  const clickSpan = Math.max(10, maxClick - minClick);

  const verticals = runs.map((r) => r.verticalSpreadInches);
  const maxVertical = verticals.length > 0 ? Math.max(...verticals, 0.45) : 0.5;

  const getX = (click: number) => {
    return padding.left + ((click - minClick) / clickSpan) * innerWidth;
  };

  const getY = (vert: number) => {
    const clamped = Math.max(0, Math.min(maxVertical * 1.1, vert));
    return padding.top + innerHeight - (clamped / (maxVertical * 1.1)) * innerHeight;
  };

  // Construct SVG path for fitted harmonic curve
  const curvePoints = analysis.curvePoints || [];
  let pathD = '';
  if (curvePoints.length > 1) {
    pathD = curvePoints.reduce((acc, pt, i) => {
      const x = getX(pt.click);
      const y = getY(pt.fittedVertical);
      return i === 0 ? `M ${x} ${y}` : `${acc} L ${x} ${y}`;
    }, '');
  }

  // Calculate Forgiving Window SVG X coordinates
  const windowStartX = getX(analysis.forgivingWindow.startClick);
  const windowEndX = getX(analysis.forgivingWindow.endClick);
  const windowWidth = Math.max(8, windowEndX - windowStartX);

  return (
    <div className="flex flex-col gap-6">

      {/* Sub-tab switcher */}
      <div className="flex items-center gap-3">
        <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/15 text-sm shadow-sm">
          <button
            onClick={() => setActiveSubTab('curve')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
              activeSubTab === 'curve' ? 'bg-sky-500 text-white shadow' : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            Harmonic Curve
          </button>
          <button
            onClick={() => setActiveSubTab('purdy')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all ${
              activeSubTab === 'purdy' ? 'bg-sky-500 text-white shadow' : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            Purdy Method 4
          </button>
        </div>
      </div>

      {/* Purdy Calculator tab */}
      {activeSubTab === 'purdy' && (
        <PurdyCalculator
          barrel={barrel}
          activeAmmo={activeAmmo}
          activeTunerClick={activeTunerClick}
          onApplyClick={onApplyClick}
        />
      )}

      {/* Harmonic Curve tab */}
      {activeSubTab === 'curve' && <>
      {/* Harmonic Analysis Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Sweet Spot Card */}
        <div className="bg-[#10131A]/90 border border-emerald-500/30 rounded-2xl p-6 backdrop-blur-xl relative overflow-hidden shadow-glass">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase font-mono text-emerald-300 font-bold tracking-wider">
              Harmonic Sweet Spot
            </span>
            <Sparkles className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-5xl font-black font-mono tracking-tight text-white">
              {analysis.sweetSpotClick}
            </span>
            <span className="text-sm font-mono text-emerald-300 font-bold">CLICKS</span>
          </div>
          <p className="text-sm text-neutral-200 mt-2 font-medium">
            Minimum vertical dispersion: <strong className="text-white font-mono text-base">{analysis.minVerticalInches}&quot;</strong>
          </p>
          <button
            onClick={() => onSelectSweetSpot(analysis.sweetSpotClick)}
            className="mt-4 w-full py-2.5 rounded-xl bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border border-emerald-500/40 text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Rotary Dial</span>
          </button>
        </div>

        {/* Forgiving Window Card */}
        <div className="bg-[#10131A]/90 border border-white/15 rounded-2xl p-6 backdrop-blur-xl shadow-glass">
          <span className="text-xs uppercase font-mono text-sky-300 font-bold tracking-wider block">
            Forgiving Window
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono tracking-tight text-white">
              {analysis.forgivingWindow.startClick} – {analysis.forgivingWindow.endClick}
            </span>
            <span className="text-sm font-mono text-sky-300 font-bold">CLICKS</span>
          </div>
          <p className="text-sm text-neutral-200 mt-2 font-medium">
            Span of <strong className="text-white font-mono text-base">{analysis.forgivingWindow.endClick - analysis.forgivingWindow.startClick + 1} clicks</strong> where vertical stringing stays below {analysis.forgivingWindow.maxVerticalInches}&quot;.
          </p>
          <div className="mt-3 py-1.5 px-3 rounded-lg bg-sky-500/15 border border-sky-500/30 text-xs text-sky-200 font-medium">
            Wide window = velocity variance won&apos;t produce fliers.
          </div>
        </div>

        {/* PRX Theoretical Model */}
        <div className="bg-[#10131A]/90 border border-white/15 rounded-2xl p-6 backdrop-blur-xl shadow-glass">
          <span className="text-xs uppercase font-mono text-purple-300 font-bold tracking-wider block">
            Purdy (PRX) Theory
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-black font-mono tracking-tight text-white">
              ~{prxInfo?.recommendedStartingMark ?? 12}
            </span>
            <span className="text-sm font-mono text-purple-300 font-bold">EST. CLICK</span>
          </div>
          <p className="text-sm text-neutral-200 mt-2 font-medium">
            Calculated for Lentz barrel geometry ({barrel?.lengthInches || 24.5}&quot; / {barrel?.tunerWeightOz || 7.2}oz tuner).
          </p>
          <div className="mt-3 text-xs text-neutral-300 line-clamp-2 font-medium">
            {prxInfo?.explanation}
          </div>
        </div>
      </div>

      {/* Main Harmonic Spline Curve Chart */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              Muzzle Harmonic Dispersion Curve
            </h3>
            <p className="text-xs text-neutral-300 font-mono mt-0.5 font-medium">
              Vertical Spread (Inches) vs. Tuner Position (Clicks)
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded-full bg-red-400 inline-block" />
              <span className="text-neutral-200">Fired Runs</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-1 bg-sky-400 inline-block rounded" />
              <span className="text-neutral-200">Harmonic Fit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-500/60 inline-block" />
              <span className="text-emerald-300">Forgiving Plateau</span>
            </div>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="w-full overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto max-h-[350px]"
          >
            {/* Background grid */}
            {[0, 0.1, 0.2, 0.3, 0.4].map((v) => {
              const y = getY(v);
              return (
                <g key={v}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={chartWidth - padding.right}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.1)"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding.left - 10}
                    y={y + 4}
                    fill="#94A3B8"
                    fontSize="12"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="end"
                  >
                    {v.toFixed(2)}&quot;
                  </text>
                </g>
              );
            })}

            {/* X-axis click grid lines */}
            {Array.from({ length: 6 }).map((_, i) => {
              const clickVal = Math.round(minClick + (clickSpan / 5) * i);
              const x = getX(clickVal);
              return (
                <g key={i}>
                  <line
                    x1={x}
                    y1={padding.top}
                    x2={x}
                    y2={chartHeight - padding.bottom}
                    stroke="rgba(255, 255, 255, 0.08)"
                  />
                  <text
                    x={x}
                    y={chartHeight - padding.bottom + 20}
                    fill="#FFFFFF"
                    fontSize="12"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {clickVal}c
                  </text>
                </g>
              );
            })}

            {/* Forgiving Window Highlight Band */}
            {runs.length >= 3 && (
              <g>
                <rect
                  x={windowStartX}
                  y={padding.top}
                  width={windowWidth}
                  height={innerHeight}
                  fill="rgba(16, 185, 129, 0.15)"
                  stroke="rgba(16, 185, 129, 0.4)"
                  strokeDasharray="4 2"
                />
                <text
                  x={windowStartX + windowWidth / 2}
                  y={padding.top + 16}
                  fill="#10B981"
                  fontSize="12"
                  fontFamily="monospace"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  FORGIVING WINDOW
                </text>
              </g>
            )}

            {/* Fitted Harmonic Curve Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="3"
                strokeLinecap="round"
                className="drop-shadow-md"
              />
            )}

            {/* Actual Recorded Run Data Points */}
            {runs.map((r) => {
              const cx = getX(r.tunerClick);
              const cy = getY(r.verticalSpreadInches);
              const isBest = r.tunerClick === analysis.sweetSpotClick;

              return (
                <g key={r.id} className="cursor-pointer group">
                  {/* Point aura */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isBest ? 12 : 8}
                    fill={isBest ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.25)'}
                  />
                  {/* Core Point */}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isBest ? 7 : 5}
                    fill={isBest ? '#10B981' : '#EF4444'}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  {/* Text on hover/point */}
                  <text
                    x={cx}
                    y={cy - 14}
                    fill="#FFFFFF"
                    fontSize="11"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {r.verticalSpreadInches}&quot;
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Bench Run Log & Quick Add */}
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-white">Tuning Test Runs</h4>
            <p className="text-xs text-neutral-300 font-medium">
              {runs.length} runs recorded across {minClick}c to {maxClick}c
            </p>
          </div>

          <button
            onClick={() => setIsAddingRun(!isAddingRun)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Manual Bench Run</span>
          </button>
        </div>

        {/* Quick Add Form */}
        {isAddingRun && (
          <form
            onSubmit={handleAddManualRun}
            className="p-4 rounded-xl bg-neutral-900/90 border border-white/15 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
          >
            <div>
              <label className="text-xs uppercase font-mono font-bold text-neutral-300 block mb-1">
                Tuner Click
              </label>
              <input
                type="number"
                value={newClick}
                onChange={(e) => setNewClick(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase font-mono font-bold text-red-300 block mb-1">
                Vertical Spread (in)
              </label>
              <input
                type="number"
                step="0.001"
                value={newVertical}
                onChange={(e) => setNewVertical(e.target.value)}
                className="w-full bg-neutral-950 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div>
              <label className="text-xs uppercase font-mono font-bold text-neutral-300 block mb-1">
                Group Size / ES (in)
              </label>
              <input
                type="number"
                step="0.001"
                value={newGroupSize}
                onChange={(e) => setNewGroupSize(e.target.value)}
                className="w-full bg-neutral-950 border border-white/20 rounded-lg px-3 py-2 text-sm text-white font-mono font-bold focus:outline-none focus:border-sky-500"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <VoiceInputButton
                onTranscript={(spoken) => {
                  const action = parseBenchVoiceCommand(spoken);
                  if (action.type === 'ADD_RUN') {
                    setNewClick(action.tunerClick);
                    setNewVertical(action.verticalInches.toString());
                    setNewGroupSize(action.groupSizeInches.toString());
                  } else {
                    const match = spoken.match(/([0-9\.]+)/g);
                    if (match && match.length >= 1) {
                      setNewVertical(match[0]);
                    }
                  }
                }}
                title="Dictate run stats (e.g. 'Click 15 vertical 0.08 group 0.14')"
              />
              <button
                type="submit"
                className="flex-1 py-2.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold transition-colors shadow-sm"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsAddingRun(false)}
                className="px-3 py-2.5 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-sm font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Mobile View: High-contrast stacked Run Cards (Zero side-scroll) */}
        <div className="md:hidden flex flex-col gap-3">
          {runs.map((r) => {
            const isBest = r.tunerClick === analysis.sweetSpotClick;
            const inWindow =
              r.tunerClick >= analysis.forgivingWindow.startClick &&
              r.tunerClick <= analysis.forgivingWindow.endClick;

            return (
              <div
                key={r.id}
                className={`p-4 rounded-2xl border transition-all relative flex flex-col gap-3 ${
                  isBest
                    ? 'bg-emerald-950/20 border-emerald-500/50 shadow-md'
                    : inWindow
                    ? 'bg-sky-950/20 border-sky-500/40 shadow-sm'
                    : 'bg-[#10131A]/90 border-white/10'
                }`}
              >
                {/* Header: Setting badge + Status badge + Delete */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-black font-mono text-white px-3 py-1 rounded-xl bg-neutral-800 border border-white/15">
                      {r.tunerClick} Clicks
                    </span>
                    {isBest ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-300 text-xs font-black font-mono border border-emerald-500/40">
                        SWEET SPOT
                      </span>
                    ) : inWindow ? (
                      <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold font-mono border border-sky-500/30">
                        IN WINDOW
                      </span>
                    ) : (
                      <span className="text-neutral-400 text-xs font-mono font-medium">
                        Off Node
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => handleDeleteRun(r.id)}
                    className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete run"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Metrics 3-up grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-black/40 border border-red-500/20">
                    <span className="text-[11px] font-mono text-red-400 uppercase font-bold block">
                      Vertical
                    </span>
                    <span className="text-lg font-black font-mono text-red-200 mt-0.5 block">
                      {r.verticalSpreadInches}&quot;
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold block">
                      Group (ES)
                    </span>
                    <span className="text-lg font-black font-mono text-white mt-0.5 block">
                      {r.groupSizeInches}&quot;
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                    <span className="text-[11px] font-mono text-neutral-400 uppercase font-bold block">
                      MOA @ 50y
                    </span>
                    <span className="text-lg font-black font-mono text-sky-300 mt-0.5 block">
                      {r.groupMoa50Yd}
                    </span>
                  </div>
                </div>

                {/* Optional Note or Action */}
                {onApplyClick && (
                  <button
                    onClick={() => onApplyClick(r.tunerClick)}
                    className="w-full py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/10 text-xs font-mono font-bold text-sky-300 flex items-center justify-center gap-1.5 transition-all active:scale-98"
                  >
                    <span>Dial Tuner to {r.tunerClick} Clicks</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Desktop View: Full Data Table */}
        <div className="hidden md:block overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-left text-sm text-neutral-200 font-mono">
            <thead className="bg-neutral-900/90 text-neutral-300 uppercase text-xs font-bold tracking-wider border-b border-white/10">
              <tr>
                <th className="px-4 py-3">Setting</th>
                <th className="px-4 py-3 text-red-300 font-bold">Vertical Spread</th>
                <th className="px-4 py-3">Group (ES)</th>
                <th className="px-4 py-3">MOA @ 50y</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {runs.map((r) => {
                const isBest = r.tunerClick === analysis.sweetSpotClick;
                const inWindow =
                  r.tunerClick >= analysis.forgivingWindow.startClick &&
                  r.tunerClick <= analysis.forgivingWindow.endClick;

                return (
                  <tr
                    key={r.id}
                    className={`hover:bg-white/[0.03] transition-colors ${
                      isBest ? 'bg-emerald-500/[0.1]' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-white flex items-center gap-1.5">
                      <span className="text-base">{r.tunerClick} Clicks</span>
                    </td>
                    <td className="px-4 py-3 font-black text-red-300 text-base">
                      {r.verticalSpreadInches}&quot;
                    </td>
                    <td className="px-4 py-3 text-neutral-100 font-bold">{r.groupSizeInches}&quot;</td>
                    <td className="px-4 py-3 text-neutral-300 font-medium">{r.groupMoa50Yd}</td>
                    <td className="px-4 py-3">
                      {isBest ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/40">
                          SWEET SPOT
                        </span>
                      ) : inWindow ? (
                        <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-bold border border-sky-500/30">
                          IN WINDOW
                        </span>
                      ) : (
                        <span className="text-neutral-400 text-xs font-medium">Off Node</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteRun(r.id)}
                        className="p-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded text-neutral-400 hover:text-red-400 transition-colors"
                        title="Delete run"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
};
