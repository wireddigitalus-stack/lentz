'use client';

import React, { useState, useRef } from 'react';
import { Camera, Zap, CheckCircle, Loader2, X, Mic } from 'lucide-react';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { velocityToStartingClick } from '@/lib/ballistics';

interface ChronoResult {
  avgVelocity: number;
  extremeSpread: number;
  stdDev: number;
  shots: number;
}

interface ChronoImportCardProps {
  /** Called when user taps "Apply to Ammo Lot" */
  onApplyToAmmo?: (result: ChronoResult) => void;
  /** Called when user confirms "Set Tuner to Click X" — auto-sets dial AND switches tab */
  onApplyClick?: (click: number) => void;
}

export const ChronoImportCard: React.FC<ChronoImportCardProps> = ({
  onApplyToAmmo,
  onApplyClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [applied, setApplied] = useState(false);

  const [avgVelocity, setAvgVelocity] = useState('');
  const [extremeSpread, setExtremeSpread] = useState('');
  const [stdDev, setStdDev] = useState('');
  const [shots, setShots] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived starting click from Lentz velocity table
  const parsedVel = parseFloat(avgVelocity);
  const suggestedClick = !isNaN(parsedVel) && parsedVel > 0 ? velocityToStartingClick(parsedVel) : null;

  // ── Photo scan via Gemini Vision API ──────────────────────────────────
  const handlePhotoScan = async (file: File) => {
    setScanning(true);
    setScanError('');
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string).split(',')[1];
        const mimeType = file.type || 'image/jpeg';

        const res = await fetch('/api/vision', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64,
            mimeType,
            mode: 'chrono',
          }),
        });

        if (!res.ok) throw new Error(`Vision API error ${res.status}`);
        const data = await res.json();

        if (data.avgVelocity) setAvgVelocity(String(data.avgVelocity));
        if (data.extremeSpread) setExtremeSpread(String(data.extremeSpread));
        if (data.stdDev) setStdDev(String(data.stdDev));
        if (data.shots) setShots(String(data.shots));

        setScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setScanError('Could not read photo — please enter values manually.');
      setScanning(false);
    }
  };

  // ── Voice number extraction helper ───────────────────────────────────
  const extractNumber = (text: string): string => {
    const match = text.match(/[\d]+(?:[.,]\d+)?/);
    return match ? match[0].replace(',', '.') : '';
  };

  const handleApply = () => {
    const result: ChronoResult = {
      avgVelocity: parseFloat(avgVelocity) || 0,
      extremeSpread: parseFloat(extremeSpread) || 0,
      stdDev: parseFloat(stdDev) || 0,
      shots: parseInt(shots) || 0,
    };
    onApplyToAmmo?.(result);
    setApplied(true);
    setTimeout(() => setApplied(false), 2500);
  };

  const handleApplyAndSetDial = () => {
    handleApply();
    if (suggestedClick !== null) {
      onApplyClick?.(suggestedClick.clicks);
    }
  };

  const hasData = avgVelocity.trim().length > 0;

  return (
    <div className="w-full">
      {/* Collapsed trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-[#10131A]/80 border border-sky-500/20 hover:border-sky-500/40 text-left transition-all active:scale-[0.99] shadow-sm group"
        >
          <div className="w-10 h-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center shrink-0 group-hover:bg-sky-500/25 transition-colors">
            <Zap className="w-5 h-5 text-sky-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Import Chrono Session</p>
            <p className="text-xs text-neutral-400 mt-0.5">Garmin Xero / any chronograph — photo scan or voice entry</p>
          </div>
          <Camera className="w-5 h-5 text-sky-400 shrink-0" />
        </button>
      )}

      {/* Expanded card */}
      {isOpen && (
        <div className="w-full rounded-2xl bg-[#10131A]/90 border border-sky-500/30 p-5 shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-sky-400" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white">Chrono Session Import</h3>
                <p className="text-xs text-neutral-400">Garmin Xero · Magneto Speed · Lab Radar</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Photo scan button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-violet-500/20 to-sky-500/20 border border-violet-500/30 hover:from-violet-500/30 hover:to-sky-500/30 text-white font-bold text-sm transition-all active:scale-[0.98] mb-4 disabled:opacity-50"
          >
            {scanning ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Reading photo with AI…</>
            ) : (
              <><Camera className="w-5 h-5 text-violet-300" /> 📷 Scan Screen or Notebook Photo</>
            )}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoScan(file);
            }}
          />

          {scanError && (
            <p className="text-sm text-amber-400 mb-3 text-center font-medium">{scanError}</p>
          )}

          <p className="text-xs text-center text-neutral-500 mb-4">— or enter manually / speak each value —</p>

          {/* Input fields */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: 'Avg Velocity', unit: 'fps', value: avgVelocity, set: setAvgVelocity, highlight: true },
              { label: 'Extreme Spread', unit: 'fps', value: extremeSpread, set: setExtremeSpread },
              { label: 'Std Deviation', unit: 'fps', value: stdDev, set: setStdDev },
              { label: 'Shot Count', unit: 'shots', value: shots, set: setShots },
            ].map(({ label, unit, value, set, highlight }) => (
              <div key={label} className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-wide">{label}</label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      inputMode="decimal"
                      value={value}
                      onChange={(e) => set(e.target.value)}
                      placeholder="—"
                      className={`w-full bg-neutral-900 border rounded-xl px-3 py-3 text-base font-mono font-bold text-white placeholder-neutral-600 focus:outline-none transition-colors ${
                        highlight && value
                          ? 'border-sky-500/60 focus:border-sky-400'
                          : 'border-white/10 focus:border-sky-500/40'
                      }`}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-neutral-500 pointer-events-none font-mono">
                      {unit}
                    </span>
                  </div>
                  <VoiceInputButton
                    onTranscript={(t) => set(extractNumber(t))}
                    className="shrink-0 !p-2.5"
                    title={`Say ${label}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Velocity → Click suggestion */}
          {suggestedClick !== null && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-xs font-mono text-emerald-400 font-bold uppercase tracking-wide">
                  Lentz Velocity Table Recommendation
                </span>
                <span className="text-base font-black text-emerald-300 mt-0.5">
                  Start at Click {suggestedClick.clicks}
                  <span className="text-sm font-mono text-emerald-500 ml-2">@ {parsedVel} fps</span>
                </span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2.5">
            {suggestedClick !== null && (
              <button
                onClick={handleApplyAndSetDial}
                disabled={!hasData}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-black text-base flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-40"
              >
                <Zap className="w-5 h-5" />
                Apply to Ammo Lot + Set Dial to Click {suggestedClick.clicks}
              </button>
            )}

            <button
              onClick={handleApply}
              disabled={!hasData}
              className="w-full py-3.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            >
              {applied ? (
                <><CheckCircle className="w-4 h-4 text-emerald-400" /> Applied to Ammo Lot!</>
              ) : (
                <>Save Chrono Data to Active Ammo Lot</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
