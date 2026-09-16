'use client';

import React, { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronRight, BookOpen, Calculator } from 'lucide-react';

interface TunerHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToPurdy?: () => void;
}

const CALLOUTS = [
  {
    id: 1,
    label: 'Barrel Body',
    color: 'bg-sky-500',
    // position on image as % from left/top
    left: '22%',
    top: '38%',
    description:
      'The free-floating aluminium barrel that vibrates like a tuning fork when fired. The tuner mass sits at the muzzle end, shifting the resonant node. The goal: the muzzle is swinging upward (Positive Launch Angle) at the exact moment the bullet exits.',
  },
  {
    id: 2,
    label: 'Knurled Adjustment Ring',
    color: 'bg-amber-400',
    left: '48%',
    top: '55%',
    description:
      'Diamond-pattern knurling for a secure grip even with gloves. Turn clockwise to increase click number (mass moves outward, tuner extends). Counter-clockwise to decrease. You will feel and hear a distinct detent click at each position — that is one click.',
  },
  {
    id: 3,
    label: 'Click Scale',
    color: 'bg-emerald-400',
    left: '75%',
    top: '30%',
    description:
      'The numbered graduation engraved on the sliding scale collar. On a Harrell Standard: 50 clicks per full revolution. On a Harrell 25-Click: 25 per revolution. Each click ≈ 0.0005" of tuner travel (about 0.013 mm). The Purdy Method 4 converts your barrel dimensions directly into a target click number.',
  },
  {
    id: 4,
    label: 'Reference Hairline',
    color: 'bg-rose-400',
    left: '85%',
    top: '50%',
    description:
      'The fixed witness line scribed on the barrel body — it never moves. Read whichever scale number is aligned to this line. That is your current click position. If the hairline is between two numbers, you are on a half-click — valid and repeatable.',
  },
  {
    id: 5,
    label: 'Setscrew Lock',
    color: 'bg-purple-400',
    left: '47%',
    top: '28%',
    description:
      'Allen-head locking setscrew. Always loosen (2–3 turns) before adjusting click position. Re-snug finger-tight after setting. Never over-torque — it will mar the threads. Some shooters leave it loose during a bracketing session and lock only after confirming the sweet spot.',
  },
];

const ACCORDIONS = [
  {
    title: 'How to Read Your Click Position',
    content: `1. Look at the fixed reference hairline on the barrel body (it never moves).
2. Find the number on the knurled scale ring that aligns with the hairline — that is your current click.
3. If you are between numbers, count the fine graduation marks: each small mark = 1 click on a 50-click Harrell.
4. Record this number in the app. The app tracks revolutions too — Rev 0 Click 25 is different from Rev 1 Click 25.
5. After adjusting, always verify the hairline before shooting the next group.`,
  },
  {
    title: 'What the Tuner Actually Does',
    content: `The barrel vibrates like a tuning fork at high frequency when fired. The tuner adds a precise mass to the muzzle end, shifting when the barrel completes each vibration cycle.

The goal: at the exact microsecond the bullet exits the crown, the muzzle should be travelling upward (Positive Launch Angle / PRX node).

Slower bullets take fractionally longer to travel the barrel length — they exit later in the wave cycle. A properly tuned position means slower bullets exit higher on the upswing, compensating for their lower velocity. That is what produces vertical suppression and tight groups despite ammo velocity variation (ES/SD).`,
  },
  {
    title: 'Finding Your Starting Click — Purdy Method 4',
    content: `Before firing a single shot, Jeremiah Lentz uses Purdy Method 4 to calculate the predicted optimal tuner dimension from barrel geometry alone.

Formula: TunerDim = (BarrelLength × 9/8) − BarrelLength − (MuzzleOD × 0.264)

The Purdy Calculator (inside the Harmonics tab) shows all 5 harmonic modes and converts your ammo velocity directly to a starting click using the Lentz range table.

Use the Purdy starting click as your bracket centre, then test ±8 clicks in 2-click steps to confirm the empirical sweet spot.`,
  },
];

export const TunerHelpModal: React.FC<TunerHelpModalProps> = ({ isOpen, onClose, onGoToPurdy }) => {
  const [activeCallout, setActiveCallout] = useState<number | null>(null);
  const [openAccordion, setOpenAccordion] = useState<number | null>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) { document.body.style.overflow = 'hidden'; }
    else { document.body.style.overflow = ''; }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const active = CALLOUTS.find((c) => c.id === activeCallout);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#06080D] animate-fadeIn">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0B0D14] shrink-0">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-sky-400" />
          <div>
            <h2 className="text-base font-black text-white tracking-tight">Tuner Reference Guide</h2>
            <p className="text-xs font-mono text-neutral-400">Jeremiah Lentz — Precision Barrel Tuner</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-sm transition-all active:scale-95 min-w-[44px] min-h-[44px]"
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Image section with callout dots ── */}
        <div className="px-4 pt-5 pb-3">
          <p className="text-xs font-mono text-sky-400 font-bold uppercase tracking-wider mb-3">
            Tap a dot to learn about each part
          </p>

          {/* Image container — relative for dot positioning */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-neutral-900">
            <img
              src="/tuner-reference.jpg"
              alt="Harrell Precision Barrel Tuner — Lentz reference"
              className="w-full h-auto object-contain select-none"
              draggable={false}
            />

            {/* Callout dots overlaid on image */}
            {CALLOUTS.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCallout(activeCallout === c.id ? null : c.id)}
                className={`absolute flex items-center justify-center w-8 h-8 rounded-full font-black text-sm text-white border-2 border-white/80 shadow-lg transition-all active:scale-90 ${c.color} ${activeCallout === c.id ? 'scale-125 ring-4 ring-white/30' : 'hover:scale-110'}`}
                style={{ left: c.left, top: c.top, transform: activeCallout === c.id ? 'translate(-50%,-50%) scale(1.25)' : 'translate(-50%,-50%)' }}
              >
                {c.id}
              </button>
            ))}
          </div>

          {/* Callout detail panel — slides in below image */}
          {active && (
            <div className={`mt-3 p-4 rounded-2xl border transition-all animate-fadeIn ${
              active.color.replace('bg-', 'border-').replace('-500', '-500/40').replace('-400', '-400/40')
            } bg-white/[0.04]`}>
              <div className="flex items-center gap-2.5 mb-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${active.color}`}>
                  {active.id}
                </span>
                <h3 className="text-sm font-extrabold text-white">{active.label}</h3>
              </div>
              <p className="text-sm text-neutral-200 leading-relaxed font-medium">{active.description}</p>
            </div>
          )}

          {/* Dot legend */}
          {!active && (
            <div className="mt-3 flex flex-wrap gap-2">
              {CALLOUTS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCallout(c.id)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.05] border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-black text-white ${c.color}`}>{c.id}</span>
                  <span className="text-sm font-semibold text-neutral-200">{c.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Accordion sections ── */}
        <div className="px-4 pb-6 flex flex-col gap-2">
          {ACCORDIONS.map((a, idx) => (
            <div key={idx} className="rounded-2xl border border-white/10 bg-[#10131A]/80 overflow-hidden">
              <button
                onClick={() => setOpenAccordion(openAccordion === idx ? null : idx)}
                className="w-full flex items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-bold text-white">{a.title}</span>
                {openAccordion === idx
                  ? <ChevronDown className="w-4 h-4 text-sky-400 shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />
                }
              </button>
              {openAccordion === idx && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-line font-medium">{a.content}</p>
                </div>
              )}
            </div>
          ))}

          {/* Purdy link */}
          {onGoToPurdy && (
            <button
              onClick={() => { onClose(); onGoToPurdy(); }}
              className="mt-2 w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white font-bold text-sm flex items-center justify-center gap-3 shadow-glow-blue transition-all active:scale-[0.98]"
            >
              <Calculator className="w-5 h-5" />
              Open Purdy Method 4 Calculator →
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
