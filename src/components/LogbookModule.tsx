'use client';

import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, CheckCircle, Disc, Layers, Download, Upload, RefreshCw, Star, Info } from 'lucide-react';
import { BarrelProfile, AmmoLot, TuneSession, TunerType } from '@/types';
import { resetToJeremiahLentzDefaults } from '@/lib/storage';
import { VoiceInputButton } from '@/components/VoiceInputButton';
import { calculatePurdyTunerDimension } from '@/lib/ballistics';

interface LogbookModuleProps {
  barrels: BarrelProfile[];
  ammoLots: AmmoLot[];
  sessions: TuneSession[];
  activeBarrelId: string;
  activeAmmoId: string;
  onSelectBarrel: (id: string) => void;
  onSelectAmmo: (id: string) => void;
  onSaveBarrel: (barrel: BarrelProfile) => void;
  onDeleteBarrel: (id: string) => void;
  onSaveAmmoLot: (lot: AmmoLot) => void;
  onDeleteAmmoLot: (id: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReloadData: () => void;
}

export const LogbookModule: React.FC<LogbookModuleProps> = ({
  barrels,
  ammoLots,
  sessions,
  activeBarrelId,
  activeAmmoId,
  onSelectBarrel,
  onSelectAmmo,
  onSaveBarrel,
  onDeleteBarrel,
  onSaveAmmoLot,
  onDeleteAmmoLot,
  onExport,
  onImport,
  onReloadData,
}) => {
  const [subTab, setSubTab] = useState<'barrels' | 'ammo' | 'backup'>('barrels');
  const [isAddingBarrel, setIsAddingBarrel] = useState(false);
  const [isAddingAmmo, setIsAddingAmmo] = useState(false);

  // New barrel form state
  const [newBarrel, setNewBarrel] = useState<Partial<BarrelProfile>>({
    serialNumber: `LP-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    name: 'Lentz Custom 2500X',
    gunsmith: 'Jeremiah Lentz (Lentz Precision Rifles)',
    action: 'Stiller 2500X',
    contour: 'Heavy Benchrest 0.900"',
    lengthInches: 24.5,
    muzzleDiameterInches: 0.900,
    twistRate: '1:16.5 5R',
    chamberReamer: 'Lentz Match Calfee 2°',
    tunerModel: 'Harrell Standard (50 clicks/rev)',
    tunerWeightOz: 7.2,
    totalRounds: 0,
    notes: 'New Lentz custom chambered match barrel.',
  });

  // New ammo form state
  const [newAmmo, setNewAmmo] = useState<Partial<AmmoLot>>({
    brand: 'Lapua',
    model: 'Center-X',
    lotNumber: '31555/22800',
    boxMuzzleVelocityFps: 1073,
    measuredAvgFps: 1068,
    standardDeviation: 6.0,
    extremeSpread: 16.0,
    testedTempF: 72,
    ratingStars: 5,
    notes: 'Match reserve lot.',
  });

  const handleCreateBarrel = (e: React.FormEvent) => {
    e.preventDefault();
    const created: BarrelProfile = {
      id: `barrel-${Date.now()}`,
      serialNumber: newBarrel.serialNumber || 'LP-CUSTOM',
      name: newBarrel.name || 'Lentz Custom',
      gunsmith: newBarrel.gunsmith || 'Jeremiah Lentz',
      action: newBarrel.action || 'Custom',
      contour: newBarrel.contour || 'Straight',
      lengthInches: Number(newBarrel.lengthInches) || 24.5,
      muzzleDiameterInches: Number(newBarrel.muzzleDiameterInches) || 0.900,
      twistRate: newBarrel.twistRate || '1:16',
      chamberReamer: newBarrel.chamberReamer || 'Lentz Match',
      tunerModel: (newBarrel.tunerModel as TunerType) || 'Harrell Standard (50 clicks/rev)',
      tunerWeightOz: Number(newBarrel.tunerWeightOz) || 7.2,
      totalRounds: Number(newBarrel.totalRounds) || 0,
      notes: newBarrel.notes,
      createdAt: new Date().toISOString(),
    };
    onSaveBarrel(created);
    setIsAddingBarrel(false);
  };

  const handleCreateAmmo = (e: React.FormEvent) => {
    e.preventDefault();
    const created: AmmoLot = {
      id: `ammo-${Date.now()}`,
      brand: newAmmo.brand || 'Lapua',
      model: newAmmo.model || 'Center-X',
      lotNumber: newAmmo.lotNumber || 'LOT-NEW',
      boxMuzzleVelocityFps: Number(newAmmo.boxMuzzleVelocityFps) || 1070,
      measuredAvgFps: Number(newAmmo.measuredAvgFps) || 1065,
      standardDeviation: Number(newAmmo.standardDeviation) || 6.5,
      extremeSpread: Number(newAmmo.extremeSpread) || 18.0,
      testedTempF: Number(newAmmo.testedTempF) || 72,
      ratingStars: Number(newAmmo.ratingStars) || 5,
      notes: newAmmo.notes,
    };
    onSaveAmmoLot(created);
    setIsAddingAmmo(false);
  };

  const handleResetDefaults = () => {
    if (confirm('Reset all barrels, ammo lots, and sessions to Jeremiah Lentz workshop defaults?')) {
      resetToJeremiahLentzDefaults();
      onReloadData();
    }
  };

  return (
    <div className="flex flex-col gap-6">

      {/* Sub navigation — scrollable on mobile, wraps Add button below on small screens */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Tab switcher */}
        <div className="flex bg-neutral-900 rounded-xl p-1 border border-white/15 text-xs md:text-sm shadow-sm overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSubTab('barrels')}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              subTab === 'barrels' ? 'bg-sky-500 text-white font-bold shadow' : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" />
            {/* Short label on mobile, full label on sm+ */}
            <span className="sm:hidden">Barrels ({barrels.length})</span>
            <span className="hidden sm:inline">Lentz Barrels ({barrels.length})</span>
          </button>
          <button
            onClick={() => setSubTab('ammo')}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              subTab === 'ammo' ? 'bg-sky-500 text-white font-bold shadow' : 'text-neutral-300 hover:text-white'
            }`}
          >
            <Disc className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Ammo ({ammoLots.length})</span>
            <span className="hidden sm:inline">Ammo Lots ({ammoLots.length})</span>
          </button>
          <button
            onClick={() => setSubTab('backup')}
            className={`flex items-center gap-1.5 md:gap-2 px-3 md:px-3.5 py-2 rounded-lg transition-all whitespace-nowrap ${
              subTab === 'backup' ? 'bg-sky-500 text-white font-bold shadow' : 'text-neutral-300 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0" />
            <span>Backup</span>
          </button>
        </div>

        {/* Add button — full width on its own row when nav wraps */}
        {subTab === 'barrels' && (
          <button
            onClick={() => setIsAddingBarrel(!isAddingBarrel)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Register Barrel</span>
          </button>
        )}

        {subTab === 'ammo' && (
          <button
            onClick={() => setIsAddingAmmo(!isAddingAmmo)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-sm font-bold transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span>Log Ammo Lot</span>
          </button>
        )}
      </div>

      {/* SUBTAB: BARRELS */}
      {subTab === 'barrels' && (
        <div className="flex flex-col gap-4">
          {/* Add Barrel Modal / Inline Form */}
          {isAddingBarrel && (
            <form
              onSubmit={handleCreateBarrel}
              className="bg-[#10131A]/95 border border-sky-500/40 rounded-2xl p-6 backdrop-blur-xl shadow-glass grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              <div className="md:col-span-3 pb-3 border-b border-white/10 flex justify-between items-center">
                <h4 className="text-base font-bold text-white">Register Lentz Custom Barrel</h4>
                <button
                  type="button"
                  onClick={() => setIsAddingBarrel(false)}
                  className="text-sm font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Serial Number</label>
                <input
                  type="text"
                  value={newBarrel.serialNumber}
                  onChange={(e) => setNewBarrel({ ...newBarrel, serialNumber: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Rifle / Barrel Name</label>
                <input
                  type="text"
                  value={newBarrel.name}
                  onChange={(e) => setNewBarrel({ ...newBarrel, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Gunsmith</label>
                <input
                  type="text"
                  value={newBarrel.gunsmith}
                  onChange={(e) => setNewBarrel({ ...newBarrel, gunsmith: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Action</label>
                <input
                  type="text"
                  value={newBarrel.action}
                  onChange={(e) => setNewBarrel({ ...newBarrel, action: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Length (Inches)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBarrel.lengthInches}
                  onChange={(e) => setNewBarrel({ ...newBarrel, lengthInches: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Muzzle Diameter (in)</label>
                <input
                  type="number"
                  step="0.005"
                  value={newBarrel.muzzleDiameterInches}
                  onChange={(e) => setNewBarrel({ ...newBarrel, muzzleDiameterInches: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Chamber Reamer</label>
                <input
                  type="text"
                  value={newBarrel.chamberReamer}
                  onChange={(e) => setNewBarrel({ ...newBarrel, chamberReamer: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Tuner Model</label>
                <select
                  value={newBarrel.tunerModel}
                  onChange={(e) => setNewBarrel({ ...newBarrel, tunerModel: e.target.value as any })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                >
                  <option value="Harrell Standard (50 clicks/rev)">Harrell Standard (50 clicks/rev)</option>
                  <option value="Harrell 25-Click">Harrell 25-Click</option>
                  <option value="Ezell Precision PDMT">Ezell Precision PDMT</option>
                  <option value="Gorham Custom">Gorham Custom</option>
                  <option value="Pappas Precision">Pappas Precision</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Grooves (e.g. 8-Groove / 5R)</label>
                <input
                  type="text"
                  value={newBarrel.grooves || ''}
                  onChange={(e) => setNewBarrel({ ...newBarrel, grooves: e.target.value })}
                  placeholder="8-Groove, 5R, Ratchet"
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Tuner Setting (Clicks)</label>
                <input
                  type="number"
                  value={newBarrel.tunerSetting ?? ''}
                  onChange={(e) => setNewBarrel({ ...newBarrel, tunerSetting: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g. 26"
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Tuner w/ Tube Setting</label>
                <input
                  type="number"
                  value={newBarrel.tunerWithTubeSetting ?? ''}
                  onChange={(e) => setNewBarrel({ ...newBarrel, tunerWithTubeSetting: e.target.value ? Number(e.target.value) : undefined })}
                  placeholder="e.g. 24"
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Tuner Weight (oz)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newBarrel.tunerWeightOz}
                  onChange={(e) => setNewBarrel({ ...newBarrel, tunerWeightOz: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-bold text-neutral-300">
                    Barrel Notes &amp; Observations
                  </label>
                  <VoiceInputButton
                    onTranscript={(spoken) =>
                      setNewBarrel((prev) => ({
                        ...prev,
                        notes: prev.notes ? `${prev.notes} ${spoken}` : spoken,
                      }))
                    }
                    title="Dictate barrel notes"
                  />
                </div>
                <textarea
                  rows={2}
                  value={newBarrel.notes || ''}
                  onChange={(e) => setNewBarrel({ ...newBarrel, notes: e.target.value })}
                  placeholder="Dictate or type chambering details, sweet spot history, barrel wear..."
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingBarrel(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 text-sm font-bold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold shadow-md"
                >
                  Save Barrel
                </button>
              </div>
            </form>
          )}

          {/* Barrels List Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {barrels.map((b) => {
              const isActive = b.id === activeBarrelId;
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl p-6 backdrop-blur-xl border transition-all relative flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#121620] border-sky-500/50 shadow-glow-blue'
                      : 'bg-[#10131A]/90 border-white/15 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-neutral-800 text-neutral-200 border border-white/10">
                        {b.serialNumber}
                      </span>
                      {isActive && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40 flex items-center gap-1.5 shadow-sm">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Active Rifle</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white tracking-tight">{b.name}</h3>
                    <p className="text-sm font-semibold text-neutral-300 mt-0.5">{b.gunsmith}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-sm font-mono">
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold uppercase tracking-wide">Action</span>
                        <span className="text-white font-bold text-sm mt-0.5 block">{b.action}</span>
                      </div>
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold uppercase tracking-wide">Length / Muzzle</span>
                        <span className="text-white font-bold text-sm mt-0.5 block">{b.lengthInches}&quot; / {b.muzzleDiameterInches}&quot;</span>
                      </div>
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold uppercase tracking-wide">Twist</span>
                        <span className="text-white font-bold text-sm mt-0.5 block">{b.twistRate}</span>
                      </div>
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold uppercase tracking-wide">Round Count</span>
                        <span className="text-emerald-400 font-black text-sm mt-0.5 block">{b.totalRounds} rds</span>
                      </div>
                    </div>

                    <div className="mt-3.5 p-2.5 rounded-xl bg-neutral-900/70 border border-white/5 text-xs text-neutral-200 flex flex-col gap-1">
                      <div><strong className="text-white">Tuner:</strong> {b.tunerModel} ({b.tunerWeightOz} oz)</div>
                      {(b.grooves || b.tunerSetting !== undefined || b.tunerWithTubeSetting !== undefined) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 pt-1.5 border-t border-white/5 font-mono text-[11px]">
                          {b.grooves && <span className="text-neutral-300">Grooves: <strong className="text-white">{b.grooves}</strong></span>}
                          {b.tunerSetting !== undefined && <span className="text-sky-300">Tuner: <strong className="text-sky-200">Click {b.tunerSetting}</strong></span>}
                          {b.tunerWithTubeSetting !== undefined && <span className="text-emerald-300">w/ Tube: <strong className="text-emerald-200">Click {b.tunerWithTubeSetting}</strong></span>}
                        </div>
                      )}
                    </div>

                    {/* Purdy Method 4 target dimension */}
                    {(() => {
                      const purdy = calculatePurdyTunerDimension(b.lengthInches, b.muzzleDiameterInches, 'ninth', 'jmp');
                      return (
                        <div className="mt-2 p-2.5 rounded-xl bg-sky-500/8 border border-sky-500/20 flex items-center justify-between">
                          <span className="text-xs font-mono font-bold text-sky-400">
                            Purdy Target
                          </span>
                          <span className="text-xs font-mono font-bold text-sky-200">
                            {purdy.tunerDimensionInches.toFixed(3)}&quot; <span className="text-sky-400/60">(9th·JMP)</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/10 gap-2">
                    {!isActive ? (
                      <button
                        onClick={() => onSelectBarrel(b.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-sm font-bold transition-colors active:scale-95 min-h-[44px]"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Set as Active
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold px-2 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Active Rifle
                      </span>
                    )}

                    {barrels.length > 1 && (
                      <button
                        onClick={() => onDeleteBarrel(b.id)}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                        title="Delete barrel"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB: AMMO LOTS */}
      {subTab === 'ammo' && (
        <div className="flex flex-col gap-4">
          {/* Add Ammo Form */}
          {isAddingAmmo && (
            <form
              onSubmit={handleCreateAmmo}
              className="bg-[#10131A]/95 border border-sky-500/40 rounded-2xl p-6 backdrop-blur-xl shadow-glass grid grid-cols-1 md:grid-cols-3 gap-5"
            >
              <div className="md:col-span-3 pb-3 border-b border-white/10 flex justify-between items-center">
                <h4 className="text-base font-bold text-white">Log Match Ammo Lot Number</h4>
                <button
                  type="button"
                  onClick={() => setIsAddingAmmo(false)}
                  className="text-sm font-semibold text-neutral-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Brand</label>
                <input
                  type="text"
                  value={newAmmo.brand}
                  onChange={(e) => setNewAmmo({ ...newAmmo, brand: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Model / Grade</label>
                <input
                  type="text"
                  value={newAmmo.model}
                  onChange={(e) => setNewAmmo({ ...newAmmo, model: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Lot Number</label>
                <input
                  type="text"
                  value={newAmmo.lotNumber}
                  onChange={(e) => setNewAmmo({ ...newAmmo, lotNumber: e.target.value })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Measured Avg MV (fps)</label>
                <input
                  type="number"
                  value={newAmmo.measuredAvgFps}
                  onChange={(e) => setNewAmmo({ ...newAmmo, measuredAvgFps: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Standard Dev (SD fps)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newAmmo.standardDeviation}
                  onChange={(e) => setNewAmmo({ ...newAmmo, standardDeviation: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-neutral-200 block mb-1.5">Extreme Spread (ES fps)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newAmmo.extremeSpread}
                  onChange={(e) => setNewAmmo({ ...newAmmo, extremeSpread: Number(e.target.value) })}
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white font-mono font-bold"
                />
              </div>

              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-mono font-bold text-neutral-300">
                    Ammo Lot Notes &amp; Observations
                  </label>
                  <VoiceInputButton
                    onTranscript={(spoken) =>
                      setNewAmmo((prev) => ({
                        ...prev,
                        notes: prev.notes ? `${prev.notes} ${spoken}` : spoken,
                      }))
                    }
                    title="Dictate ammo lot notes"
                  />
                </div>
                <textarea
                  rows={2}
                  value={newAmmo.notes || ''}
                  onChange={(e) => setNewAmmo({ ...newAmmo, notes: e.target.value })}
                  placeholder="Dictate or type consistency notes, temperature sensitivity, match reserve status..."
                  className="w-full bg-neutral-950 border border-white/20 rounded-xl px-3.5 py-2 text-sm text-white font-medium focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAmmo(false)}
                  className="px-4 py-2.5 rounded-xl bg-neutral-800 text-sm font-bold text-neutral-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-sm font-bold shadow-md"
                >
                  Save Ammo Lot
                </button>
              </div>
            </form>
          )}

          {/* Ammo Lots Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {ammoLots.map((l) => {
              const isActive = l.id === activeAmmoId;
              return (
                <div
                  key={l.id}
                  className={`rounded-2xl p-6 backdrop-blur-xl border transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-[#121620] border-sky-500/50 shadow-glow-blue'
                      : 'bg-[#10131A]/90 border-white/15 hover:border-white/25'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono uppercase text-sky-300 font-bold tracking-wider">
                        {l.brand}
                      </span>
                      {isActive && (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/40">
                          Active
                        </span>
                      )}
                    </div>

                    <h3 className="text-lg font-black text-white">{l.model}</h3>
                    <p className="text-xs font-mono font-bold text-neutral-200 mt-0.5">Lot #{l.lotNumber}</p>

                    <div className="grid grid-cols-3 gap-2 mt-4 text-sm font-mono">
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl text-center border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold">AVG MV</span>
                        <span className="text-white font-black text-sm mt-0.5 block">{l.measuredAvgFps || l.boxMuzzleVelocityFps}</span>
                      </div>
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl text-center border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold">SD</span>
                        <span className="text-emerald-400 font-black text-sm mt-0.5 block">{l.standardDeviation || '--'}</span>
                      </div>
                      <div className="bg-neutral-900/90 p-2.5 rounded-xl text-center border border-white/5">
                        <span className="text-neutral-400 block text-xs font-bold">ES</span>
                        <span className="text-sky-300 font-black text-sm mt-0.5 block">{l.extremeSpread || '--'}</span>
                      </div>
                    </div>

                    {l.notes && (
                      <p className="text-sm text-neutral-300 mt-3 line-clamp-2 font-medium">
                        {l.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/10 gap-2">
                    {!isActive ? (
                      <button
                        onClick={() => onSelectAmmo(l.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-sm font-bold transition-colors active:scale-95 min-h-[44px]"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Select Lot
                      </button>
                    ) : (
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono font-bold px-2 py-1.5">
                        <CheckCircle className="w-3.5 h-3.5" />
                        In Chamber
                      </span>
                    )}

                    {ammoLots.length > 1 && (
                      <button
                        onClick={() => onDeleteAmmoLot(l.id)}
                        className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors border border-transparent hover:border-red-500/20"
                        title="Delete ammo lot"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUBTAB: BACKUP & EXPORT */}
      {subTab === 'backup' && (
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-glass flex flex-col gap-5">
          <div>
            <h3 className="text-base font-bold text-white">Data Management &amp; Offline Backups</h3>
            <p className="text-sm text-neutral-400 mt-1">
              All records, target calibrations, and tuner sweet spots are stored client-side in your device&apos;s high-speed local database. Export JSON backups to keep safe copies between match seasons.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Export JSON */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
              <div>
                <Download className="w-5 h-5 text-sky-400 mb-2" />
                <h4 className="text-sm font-semibold text-white">Export Match Data</h4>
                <p className="text-sm text-neutral-400 mt-1">
                  Download complete JSON file containing all barrels, ammo lots, and tuning runs.
                </p>
              </div>
              <button
                onClick={onExport}
                className="mt-4 py-2 px-3 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON File</span>
              </button>
            </div>

            {/* Import JSON */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
              <div>
                <Upload className="w-5 h-5 text-emerald-400 mb-2" />
                <h4 className="text-sm font-semibold text-white">Import Match Data</h4>
                <p className="text-sm text-neutral-400 mt-1">
                  Restore an existing session file or transfer data from your bench tablet to your workshop PC.
                </p>
              </div>
              <label className="mt-4 py-2 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>Select JSON Backup</span>
                <input type="file" accept=".json" onChange={onImport} className="hidden" />
              </label>
            </div>

            {/* Factory Reset */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-col justify-between">
              <div>
                <RefreshCw className="w-5 h-5 text-amber-400 mb-2" />
                <h4 className="text-sm font-semibold text-white">Jeremiah Lentz Defaults</h4>
                <p className="text-sm text-neutral-400 mt-1">
                  Reset database to preloaded Jeremiah Lentz custom benchrest rifle and match lot profiles.
                </p>
              </div>
              <button
                onClick={handleResetDefaults}
                className="mt-4 py-2 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset to Lentz Defaults</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
