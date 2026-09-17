'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { TunerDial } from '@/components/TunerDial';
import { TargetScanner } from '@/components/TargetScanner';
import { HarmonicChart } from '@/components/HarmonicChart';
import { EnvironmentalModule } from '@/components/EnvironmentalModule';
import { LogbookModule } from '@/components/LogbookModule';
import { LentzAIAdvisor } from '@/components/LentzAIAdvisor';
import { BottomTabBar } from '@/components/BottomTabBar';
import { BenchVoiceHUD } from '@/components/BenchVoiceHUD';
import { ChronoImportCard } from '@/components/ChronoImportCard';
import { JMPQuickCalculator } from '@/components/JMPQuickCalculator';

import { BarrelProfile, AmmoLot, TuneSession, TuneRun, EnvironmentalConditions } from '@/types';
import {
  getStoredBarrels,
  setStoredBarrels,
  saveBarrel,
  deleteBarrel,
  getStoredAmmoLots,
  setStoredAmmoLots,
  saveAmmoLot,
  deleteAmmoLot,
  getStoredSessions,
  setStoredSessions,
  saveSession,
  getActiveBarrelId,
  setActiveBarrelId,
  getActiveAmmoId,
  setActiveAmmoId,
  exportAllDataAsJSON,
  importAllDataFromJSON,
} from '@/lib/storage';
import { analyzeHarmonics } from '@/lib/ballistics';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('tuner');
  const [previousTab, setPreviousTab] = useState<string>('tuner');
  const [advisorOpenSignal, setAdvisorOpenSignal] = useState<number>(1);

  const handleSwitchTab = (newTab: string) => {
    if (newTab === 'advisor') {
      setAdvisorOpenSignal((prev) => prev + 1);
    }
    if (newTab !== activeTab && activeTab !== 'advisor') {
      setPreviousTab(activeTab);
    }
    setActiveTab(newTab);
  };

  const handleTabReselect = (tab: string) => {
    if (tab === 'advisor') {
      setAdvisorOpenSignal((prev) => prev + 1);
    }
  };

  // Easy vs Expert mode — Easy is default for new users
  const [isEasyMode, setIsEasyMode] = useState<boolean>(true);

  // Core state
  const [barrels, setBarrels] = useState<BarrelProfile[]>([]);
  const [ammoLots, setAmmoLots] = useState<AmmoLot[]>([]);
  const [sessions, setSessions] = useState<TuneSession[]>([]);
  const [activeBarrelIdState, setActiveBarrelIdState] = useState<string>('');
  const [activeAmmoIdState, setActiveAmmoIdState] = useState<string>('');

  // Tuner interactive dial click state
  const [currentClick, setCurrentClick] = useState<number>(13);

  // Always scroll to top whenever switching tabs
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Prevent browser scroll restoration from retaining previous tab's scroll offset
      if ('scrollRestoration' in window.history) {
        window.history.scrollRestoration = 'manual';
      }
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [activeTab]);

  // Load storage on client mount
  useEffect(() => {
    setMounted(true);
    // Restore mode preference
    const savedMode = typeof window !== 'undefined' ? localStorage.getItem('lentz-easy-mode') : null;
    if (savedMode !== null) setIsEasyMode(savedMode !== 'false');
    refreshData();
  }, []);

  const toggleEasyMode = () => {
    setIsEasyMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem('lentz-easy-mode', String(next));
      return next;
    });
  };

  const refreshData = () => {
    const loadedBarrels = getStoredBarrels();
    const loadedAmmo = getStoredAmmoLots();
    const loadedSessions = getStoredSessions();
    const activeBId = getActiveBarrelId();
    const activeAId = getActiveAmmoId();

    setBarrels(loadedBarrels);
    setAmmoLots(loadedAmmo);
    setSessions(loadedSessions);
    setActiveBarrelIdState(activeBId);
    setActiveAmmoIdState(activeAId);

    // If active session has sweet spot, set dial
    if (loadedSessions.length > 0 && loadedSessions[0].sweetSpotClick !== undefined) {
      setCurrentClick(loadedSessions[0].sweetSpotClick);
    }
  };

  const activeBarrel = barrels.find((b) => b.id === activeBarrelIdState) || barrels[0];
  const activeAmmo = ammoLots.find((a) => a.id === activeAmmoIdState) || ammoLots[0];
  const activeSession = sessions[0] || {
    id: 'default-session',
    title: 'Precision Tuner Session',
    date: new Date().toISOString(),
    barrelId: activeBarrel?.id || '',
    ammoLotId: activeAmmo?.id || '',
    distanceYards: 50,
    environment: {
      tempF: 74,
      humidityPercent: 55,
      pressureInHg: 29.92,
      elevationFt: 1520,
      densityAltitudeFt: 2150,
    },
    runs: [],
  };

  const harmonicAnalysis = analyzeHarmonics(activeSession.runs || []);

  const handleSetClick = (click: number) => {
    setCurrentClick(click);
  };

  const handleNudgeClick = (delta: number) => {
    setCurrentClick((prev) => Math.max(0, Math.min(50, prev + delta)));
  };

  const handleVoiceAddRun = (click: number, vertical: number, group: number) => {
    const runs = activeSession.runs || [];
    const newRun: TuneRun = {
      id: `run-${Date.now()}`,
      tunerClick: click,
      shotCount: 5,
      verticalSpreadInches: vertical,
      horizontalSpreadInches: Number((group * 0.7).toFixed(3)),
      groupSizeInches: group,
      groupMoa50Yd: Number((group / 0.5235).toFixed(3)),
      notes: `Voice logged at ${click} clicks`,
    };
    const updatedRuns = [...runs, newRun].sort((a, b) => a.tunerClick - b.tunerClick);
    handleUpdateRuns(updatedRuns);
    setActiveTab('harmonics');
  };

  const handleVoiceSetTemp = (tempF: number) => {
    handleUpdateEnvironment({
      ...activeSession.environment,
      tempF,
    });
  };

  const handleUpdateRuns = (runs: TuneRun[]) => {
    const analysis = analyzeHarmonics(runs);
    const updated: TuneSession = {
      ...activeSession,
      runs,
      sweetSpotClick: analysis.sweetSpotClick,
      sweetSpotWindow: analysis.forgivingWindow,
    };
    saveSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleSaveRunFromTarget = (runPartial: Partial<TuneRun>) => {
    const runs = activeSession.runs || [];
    const newRun: TuneRun = {
      id: `run-${Date.now()}`,
      tunerClick: currentClick,
      shotCount: runPartial.shotCount || 5,
      verticalSpreadInches: runPartial.verticalSpreadInches || 0.15,
      horizontalSpreadInches: runPartial.horizontalSpreadInches || 0.15,
      groupSizeInches: runPartial.groupSizeInches || 0.2,
      groupMoa50Yd: runPartial.groupMoa50Yd || 0.38,
      meanRadiusInches: runPartial.meanRadiusInches || 0.08,
      targetAnalysis: runPartial.targetAnalysis,
      notes: `Target Scan at ${currentClick} clicks`,
    };

    const updatedRuns = [...runs, newRun].sort((a, b) => a.tunerClick - b.tunerClick);
    handleUpdateRuns(updatedRuns);
    setActiveTab('harmonics'); // Switch to harmonics to see the updated curve
  };

  const handleUpdateEnvironment = (env: EnvironmentalConditions) => {
    const updated: TuneSession = {
      ...activeSession,
      environment: env,
    };
    saveSession(updated);
    setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleExportJSON = () => {
    const jsonStr = exportAllDataAsJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lentz-tuner-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (importAllDataFromJSON(text)) {
        refreshData();
        alert('Match data successfully imported!');
      } else {
        alert('Invalid JSON match file.');
      }
    };
    reader.readAsText(file);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#08090C] flex items-center justify-center text-neutral-400 font-mono text-sm">
        Initializing Lentz TunerPro Engine...
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen w-full max-w-full overflow-x-hidden flex flex-col transition-all duration-300 selection:bg-sky-500 selection:text-white ${
        !isEasyMode ? 'bg-expert-camo' : 'bg-easy-clean'
      }`}
    >
      {/* App Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleSwitchTab}
        onTabReselect={handleTabReselect}
        activeBarrel={activeBarrel}
        activeAmmo={activeAmmo}
        onOpenLogbook={() => handleSwitchTab('logbook')}
        onExport={handleExportJSON}
        isEasyMode={isEasyMode}
        onToggleEasyMode={toggleEasyMode}
      />

      {/* Main Content Viewport with mobile bottom bar clearance */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 pb-32 md:pb-8 overflow-x-hidden">
        {/* TAB 1: TUNER ROTARY DIAL */}
        {activeTab === 'tuner' && (
          <div className="flex flex-col items-center gap-6 max-w-2xl mx-auto">
            <div className="text-center">
              <span className={`text-xs md:text-sm font-mono font-bold px-3.5 py-1.5 rounded-full border shadow-sm transition-colors ${
                !isEasyMode
                  ? 'bg-sky-500/20 text-sky-200 border-sky-400/40 shadow-glow-blue'
                  : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              }`}>
                {activeBarrel?.name || 'Lentz Custom 2500X'} {!isEasyMode && '• Expert Tactical Mode'}
              </span>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white mt-3 font-sans">
                {isEasyMode ? 'Tuner Click Position' : 'Precision Barrel Tuner'}
              </h1>
              {!isEasyMode && (
                <p className="text-xs md:text-sm text-sky-200/70 mt-1.5 font-medium">
                  Harrell Precision 50-Click Rotary Dial • Drag bezel or use steppers to calibrate muzzle harmonics
                </p>
              )}
              {isEasyMode && (
                <p className="text-sm text-neutral-300 mt-1.5 font-medium">
                  Adjust clicks below — tap <strong className="text-sky-300">Ask Lentz</strong> if you need help
                </p>
              )}
            </div>

            {/* In EXPERT MODE: Wheel is FIRST! */}
            {!isEasyMode && (
              <div className="w-full">
                <TunerDial
                  currentClick={currentClick}
                  onSetClick={handleSetClick}
                  sweetSpotClick={harmonicAnalysis.sweetSpotClick}
                  forgivingWindow={harmonicAnalysis.forgivingWindow}
                  tunerType={activeBarrel?.tunerModel}
                  barrelName={activeBarrel?.name}
                  onGoToPurdy={() => setActiveTab('harmonics')}
                  isEasyMode={isEasyMode}
                  onAskLentz={() => setActiveTab('advisor')}
                />
              </div>
            )}

            {/* ⚡ JMP TUNER CALCULATOR (In Easy Mode it is first, in Expert Mode it sits below the interactive dial) */}
            <div className="w-full">
              <JMPQuickCalculator
                barrel={activeBarrel}
                activeAmmo={activeAmmo}
                activeTunerClick={currentClick}
                onApplyClick={handleSetClick}
                onSaveBarrelSetting={(click, isTube) => {
                  if (activeBarrel) {
                    saveBarrel({
                      ...activeBarrel,
                      tunerSetting: !isTube ? click : activeBarrel.tunerSetting,
                      tunerWithTubeSetting: isTube ? click : activeBarrel.tunerWithTubeSetting,
                    });
                    refreshData();
                  }
                }}
              />
            </div>

            {/* In EASY MODE: Simple Stepper & Status Card */}
            {isEasyMode && (
              <div className="w-full">
                <TunerDial
                  currentClick={currentClick}
                  onSetClick={handleSetClick}
                  sweetSpotClick={harmonicAnalysis.sweetSpotClick}
                  forgivingWindow={harmonicAnalysis.forgivingWindow}
                  tunerType={activeBarrel?.tunerModel}
                  barrelName={activeBarrel?.name}
                  onGoToPurdy={() => setActiveTab('harmonics')}
                  isEasyMode={isEasyMode}
                  onAskLentz={() => setActiveTab('advisor')}
                />
              </div>
            )}

            {/* Quick action bar */}
            <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <button
                onClick={() => setActiveTab('harmonics')}
                className="py-3.5 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-500/40 text-sky-200 text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
              >
                <span>View Full Harmonic Curve</span>
              </button>

              <button
                onClick={() => setActiveTab('weather')}
                className="py-3.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-white/15 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
              >
                <span>Weather &amp; Density Altitude</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: TARGET COMPUTER VISION SCANNER (Temporarily hidden per request) */}
        {/* activeTab === 'scanner' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Target CV Scanner &amp; Dispersion Analyzer
                </h2>
                <p className="text-xs md:text-sm text-neutral-300 font-medium">
                  Sub-millimeter bullet wipe ring detection, coin calibration, and 3x loupe precision placement
                </p>
              </div>

              <div className="text-xs md:text-sm font-mono font-bold px-3 py-1.5 rounded-lg bg-neutral-900 border border-white/15 text-neutral-200 shadow-sm">
                Testing at: <strong className="text-sky-400 font-mono text-base">{currentClick} Clicks</strong>
              </div>
            </div>

            <TargetScanner
              onSaveRun={handleSaveRunFromTarget}
              activeTunerClick={currentClick}
            />
          </div>
        ) */}

        {/* TAB 3: HARMONIC CURVE & SWEET SPOT */}
        {activeTab === 'harmonics' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Harmonic Sweet Spot &amp; Forgiving Window Engine
              </h2>
              <p className="text-xs md:text-sm text-neutral-300 font-medium">
                Polynomial regression curve fitting on vertical dispersion to identify forgiving launch angle nodes
              </p>
            </div>

            <HarmonicChart
              session={activeSession}
              barrel={activeBarrel}
              activeAmmo={activeAmmo}
              activeTunerClick={currentClick}
              onUpdateRuns={handleUpdateRuns}
              onSelectSweetSpot={(click) => {
                setCurrentClick(click);
                setActiveTab('tuner');
              }}
              onApplyClick={(click) => {
                setCurrentClick(click);
                setActiveTab('tuner');
              }}
            />
          </div>
        )}

        {/* TAB 4: WEATHER & DENSITY ALTITUDE */}
        {activeTab === 'weather' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Atmospheric &amp; Density Altitude Tracking
              </h2>
              <p className="text-xs md:text-sm text-neutral-300 font-medium">
                Dynamic thermal expansion &amp; ammunition velocity shift compensation for match relays
              </p>
            </div>

            <EnvironmentalModule
              session={activeSession}
              activeAmmo={activeAmmo}
              onUpdateEnvironment={handleUpdateEnvironment}
              activeTunerClick={currentClick}
              onApplyClick={(click) => setCurrentClick(click)}
            />

            {/* Chrono Import — at bottom, after weather data */}
            <ChronoImportCard
              onApplyToAmmo={(result) => {
                if (activeAmmo) {
                  saveAmmoLot({
                    ...activeAmmo,
                    measuredAvgFps: result.avgVelocity,
                    extremeSpread: result.extremeSpread,
                    standardDeviation: result.stdDev,
                  });
                  refreshData();
                }
              }}
              onApplyClick={(click) => {
                setCurrentClick(click);
                setActiveTab('tuner');
              }}
            />
          </div>
        )}

        {/* TAB 5: AI BALLISTIC ADVISOR */}
        {activeTab === 'advisor' && (
          <div className="flex flex-col gap-4 pb-24 md:pb-0">
            {!isEasyMode && (
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                  Lentz Precision Ballistic Advisor
                </h2>
                <p className="text-xs md:text-sm text-neutral-300 font-medium">
                  Domain-specific rimfire harmonic diagnostic engine &amp; paper tear / double-hole consultant
                </p>
              </div>
            )}

            <LentzAIAdvisor
              session={activeSession}
              barrel={activeBarrel}
              ammo={activeAmmo}
              isEasyMode={isEasyMode}
              advisorOpenSignal={advisorOpenSignal}
              onClose={() => {
                handleSwitchTab(previousTab && previousTab !== 'advisor' ? previousTab : 'tuner');
              }}
              onApplyClick={(c) => {
                setCurrentClick(c);
                handleSwitchTab('tuner');
              }}
            />
          </div>
        )}

        {/* TAB 6: GUNSMITH & AMMO LOGBOOK */}
        {activeTab === 'logbook' && (
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                Lentz Precision Rifles Registry &amp; Ammo Logbook
              </h2>
              <p className="text-xs md:text-sm text-neutral-300 font-medium">
                Manage custom chambered barrels, match ammo lot numbers, round counts, and offline backups
              </p>
            </div>

            <LogbookModule
              barrels={barrels}
              ammoLots={ammoLots}
              sessions={sessions}
              activeBarrelId={activeBarrelIdState}
              activeAmmoId={activeAmmoIdState}
              onSelectBarrel={(id) => {
                setActiveBarrelIdState(id);
                setActiveBarrelId(id);
              }}
              onSelectAmmo={(id) => {
                setActiveAmmoIdState(id);
                setActiveAmmoId(id);
              }}
              onSaveBarrel={(b) => {
                saveBarrel(b);
                refreshData();
              }}
              onDeleteBarrel={(id) => {
                deleteBarrel(id);
                refreshData();
              }}
              onSaveAmmoLot={(lot) => {
                saveAmmoLot(lot);
                refreshData();
              }}
              onDeleteAmmoLot={(id) => {
                deleteAmmoLot(id);
                refreshData();
              }}
              onExport={handleExportJSON}
              onImport={handleImportJSON}
              onReloadData={refreshData}
            />
          </div>
        )}
      </main>

      {/* Apple Pro Footer */}
      <footer className="border-t border-white/10 py-5 px-6 text-center text-xs md:text-sm text-neutral-300 font-mono font-medium mb-16 md:mb-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            Lentz TunerPro v1.0 • Dedicated to Jeremiah Lentz Precision Rifles
          </span>
          <span className="text-neutral-400">
            ARA • PSL • IR50/50 Match Grade Harmonics
          </span>
        </div>
      </footer>

      {/* Bench Voice Dictation & Command HUD */}
      <BenchVoiceHUD
        activeTab={activeTab}
        activeTunerClick={currentClick}
        onSetTunerClick={handleSetClick}
        onNudgeTuner={handleNudgeClick}
        onNavigateTab={(tab) => handleSwitchTab(tab)}
        onAddRun={handleVoiceAddRun}
        onAskAI={(q) => {
          handleSwitchTab('advisor');
        }}
        onSetTemp={handleVoiceSetTemp}
      />

      {/* iOS Mobile Bottom Tab Bar */}
      <BottomTabBar
        activeTab={activeTab}
        setActiveTab={handleSwitchTab}
        onTabReselect={handleTabReselect}
      />
    </div>
  );
}
