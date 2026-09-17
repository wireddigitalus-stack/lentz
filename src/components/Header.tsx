'use client';

import React from 'react';
import { Target, Disc, Activity, CloudSun, BookOpen, Sparkles, Download, RefreshCw } from 'lucide-react';
import { BarrelProfile, AmmoLot } from '@/types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  activeBarrel?: BarrelProfile;
  activeAmmo?: AmmoLot;
  onOpenLogbook: () => void;
  onExport: () => void;
  onOpenVoiceHUD?: () => void;
  isEasyMode: boolean;
  onToggleEasyMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  activeBarrel,
  activeAmmo,
  onOpenLogbook,
  onExport,
  onOpenVoiceHUD,
  isEasyMode,
  onToggleEasyMode,
}) => {
  const tabs = [
    { id: 'tuner', label: 'Tuner Dial', icon: Disc },
    { id: 'harmonics', label: 'Harmonics', icon: Activity },
    { id: 'weather', label: 'Weather / DA', icon: CloudSun },
    { id: 'advisor', label: 'AI Advisor', icon: Sparkles },
    { id: 'logbook', label: 'Logbook', icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#08090C]/90 border-b border-white/[0.12] px-4 py-2.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Brand & Active Barrel Meta */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-2.5">
            {/* ── Animated Logo Mark ── */}
            <div className="relative w-10 h-10 shrink-0 flex items-center justify-center">

              {/* Glow halo — breathes slowly */}
              <div className="logo-glow absolute inset-0 rounded-full bg-sky-500/20 blur-md" />

              {/* Shimmer border layer — conic gradient spins */}
              <div className="logo-shimmer absolute inset-0 rounded-full"
                style={{ background: 'conic-gradient(from 0deg, transparent 60%, #38bdf8 80%, #bae6fd 90%, transparent 100%)', borderRadius: '50%' }} />

              {/* Dark fill ring to mask the conic background */}
              <div className="absolute inset-[2px] rounded-full bg-[#08090C]" />

              {/* SVG — all three layers stacked */}
              <svg viewBox="0 0 40 40" className="absolute inset-0 w-full h-full" fill="none">

                {/* Outer dashed ring — clockwise */}
                <circle
                  cx="20" cy="20" r="17"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeDasharray="6 4"
                  strokeLinecap="round"
                  opacity="0.5"
                  className="logo-ring-cw"
                />

                {/* Mid solid arc — counter-clockwise */}
                <circle
                  cx="20" cy="20" r="12"
                  stroke="#7dd3fc"
                  strokeWidth="1.2"
                  strokeDasharray="14 8"
                  strokeLinecap="round"
                  opacity="0.6"
                  className="logo-ring-ccw"
                />

                {/* Centre harmonic wave target lines */}
                <line x1="14" y1="20" x2="26" y2="20" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />
                <line x1="20" y1="14" x2="20" y2="26" stroke="#38bdf8" strokeWidth="1" opacity="0.4" />

                {/* Centre dot — breathing pulse */}
                <circle cx="20" cy="20" r="3.5" fill="#38bdf8" className="logo-pulse" />
                <circle cx="20" cy="20" r="1.5" fill="#e0f2fe" className="logo-pulse" />

                {/* Tiny tuner tick marks at 4 corners */}
                <rect x="19.2" y="5" width="1.6" height="4" rx="0.8" fill="#38bdf8" opacity="0.5" />
                <rect x="19.2" y="31" width="1.6" height="4" rx="0.8" fill="#38bdf8" opacity="0.5" />
                <rect x="5" y="19.2" width="4" height="1.6" rx="0.8" fill="#38bdf8" opacity="0.5" />
                <rect x="31" y="19.2" width="4" height="1.6" rx="0.8" fill="#38bdf8" opacity="0.5" />
              </svg>
            </div>

            {/* ── Wordmark ── */}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="logo-wordmark text-base font-extrabold tracking-tight font-sans">
                  LENTZ
                </span>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 whitespace-nowrap">
                  TUNER PRO
                </span>
              </div>
              <p className="text-xs text-neutral-400 font-sans font-medium truncate max-w-[150px] sm:max-w-none">
                Jeremiah Lentz Rifles
              </p>
            </div>
          </div>

          {/* Mobile Right Controls */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={onOpenLogbook}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-neutral-900 border border-white/15 text-neutral-200 active:scale-95 shadow-sm"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="truncate max-w-[80px] font-mono text-xs text-neutral-100">
                {activeBarrel ? activeBarrel.serialNumber : 'Barrels'}
              </span>
            </button>

            {/* Easy / Expert mode toggle — far right on mobile */}
            <button
              onClick={onToggleEasyMode}
              className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg border active:scale-95 shadow-sm transition-all ${
                isEasyMode
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                  : 'bg-neutral-800 border-white/15 text-neutral-300'
              }`}
              title={isEasyMode ? 'Switch to Expert Mode' : 'Switch to Easy Mode'}
            >
              {isEasyMode ? '🟢 Easy' : '⚙️ Expert'}
            </button>
          </div>
        </div>

        {/* Desktop Navigation Tabs (Hidden on mobile, uses BottomTabBar) */}
        <nav className="hidden md:flex items-center gap-1.5 p-1.5 rounded-xl bg-neutral-900/95 border border-white/10 overflow-x-auto max-w-full no-scrollbar shadow-inner">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-sky-500 text-white shadow-md font-bold scale-[1.02]'
                    : 'text-neutral-300 hover:text-white hover:bg-white/[0.06]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-neutral-300'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Desktop Active Barrel & Ammo Pill + Mode Toggle + Quick Export */}
        <div className="hidden md:flex items-center gap-2.5">
          <button
            onClick={onOpenLogbook}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-neutral-900/90 hover:bg-neutral-800/90 border border-white/15 text-left transition-colors cursor-pointer group shadow-sm"
            title="Click to view/change barrel in logbook"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <div className="text-xs font-bold text-neutral-100 group-hover:text-sky-300 transition-colors">
                {activeBarrel ? activeBarrel.name : 'No Barrel Active'}
              </div>
              <div className="text-xs text-neutral-300 font-mono">
                {activeAmmo ? `${activeAmmo.brand} ${activeAmmo.model} (#${activeAmmo.lotNumber})` : 'No Ammo Lot'}
              </div>
            </div>
          </button>

          {/* Easy / Expert mode toggle — right side of desktop */}
          <button
            onClick={onToggleEasyMode}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold text-sm transition-all active:scale-95 ${
              isEasyMode
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-neutral-800 border-white/15 text-neutral-300 hover:bg-neutral-700'
            }`}
            title={isEasyMode ? 'Switch to Expert Mode' : 'Switch to Easy Mode'}
          >
            {isEasyMode ? '🟢 Easy Mode' : '⚙️ Expert Mode'}
          </button>

          <button
            onClick={onExport}
            className="p-2.5 rounded-xl bg-neutral-900/90 hover:bg-neutral-800 border border-white/15 text-neutral-300 hover:text-white transition-colors"
            title="Export session backup (JSON)"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
