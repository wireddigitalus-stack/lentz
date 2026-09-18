'use client';

import React, { useState } from 'react';
import { ArrowUpDown, Star, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { AmmoLot, TuneSession } from '@/types';

interface AmmoLotComparisonProps {
  ammoLots: AmmoLot[];
  sessions: TuneSession[];
  activeAmmoId: string;
  isEasyMode?: boolean;
}

type SortField = 'rating' | 'velocity' | 'es' | 'sd' | 'lot';

export const AmmoLotComparison: React.FC<AmmoLotComparisonProps> = ({
  ammoLots,
  sessions,
  activeAmmoId,
  isEasyMode = false,
}) => {
  const [sortBy, setSortBy] = useState<SortField>('rating');
  const [expandedLot, setExpandedLot] = useState<string | null>(null);

  if (ammoLots.length === 0) {
    return (
      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-6 text-center">
        <Package className="w-10 h-10 text-neutral-500 mx-auto mb-3" />
        <p className="text-neutral-300 font-medium">No ammo lots recorded yet.</p>
        <p className="text-sm text-neutral-500 mt-1">Add lots in the Logbook tab to compare performance.</p>
      </div>
    );
  }

  // Count sessions per lot
  const sessionCountByLot = (lotId: string) =>
    sessions.filter((s) => s.ammoLotId === lotId).length;

  // Get best group from sessions with this lot
  const bestGroupForLot = (lotId: string): number | null => {
    const lotSessions = sessions.filter((s) => s.ammoLotId === lotId);
    let best: number | null = null;
    lotSessions.forEach((s) => {
      s.runs?.forEach((r) => {
        if (best === null || r.verticalSpreadInches < best) {
          best = r.verticalSpreadInches;
        }
      });
    });
    return best;
  };

  const sortedLots = [...ammoLots].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return (b.ratingStars || 0) - (a.ratingStars || 0);
      case 'velocity':
        return (b.measuredAvgFps || b.boxMuzzleVelocityFps || 0) - (a.measuredAvgFps || a.boxMuzzleVelocityFps || 0);
      case 'es':
        return (a.extremeSpread || 999) - (b.extremeSpread || 999);
      case 'sd':
        return (a.standardDeviation || 999) - (b.standardDeviation || 999);
      case 'lot':
        return a.lotNumber.localeCompare(b.lotNumber);
      default:
        return 0;
    }
  });

  const esGrade = (es?: number) => {
    if (!es) return null;
    if (es <= 15) return { label: 'Excellent', color: 'text-emerald-400' };
    if (es <= 25) return { label: 'Average', color: 'text-amber-300' };
    return { label: 'High', color: 'text-rose-400' };
  };

  return (
    <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl backdrop-blur-xl shadow-glass overflow-hidden">
      {/* Header */}
      <div className="p-4 md:p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Ammo Lot Comparison</h3>
          <p className="text-xs text-neutral-400 font-medium">{ammoLots.length} lots tracked</p>
        </div>
        {!isEasyMode && (
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-medium focus:outline-none focus:border-sky-500"
            >
              <option value="rating">Rating</option>
              <option value="velocity">Velocity</option>
              <option value="es">Best ES</option>
              <option value="sd">Best SD</option>
              <option value="lot">Lot #</option>
            </select>
          </div>
        )}
      </div>

      {/* Lot List */}
      <div className="divide-y divide-white/5">
        {sortedLots.map((lot) => {
          const isActive = lot.id === activeAmmoId;
          const isExpanded = expandedLot === lot.id;
          const vel = lot.measuredAvgFps || lot.boxMuzzleVelocityFps;
          const bestGroup = bestGroupForLot(lot.id);
          const sessCount = sessionCountByLot(lot.id);
          const esInfo = esGrade(lot.extremeSpread);

          return (
            <div key={lot.id} className="relative">
              <button
                onClick={() => setExpandedLot(isExpanded ? null : lot.id)}
                className="w-full text-left p-4 md:px-5 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white truncate">
                        {lot.brand} {lot.model}
                      </span>
                      <span className="text-xs font-mono text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded-md shrink-0">
                        Lot #{lot.lotNumber}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 shrink-0">
                          ACTIVE
                        </span>
                      )}
                    </div>

                    {/* Quick stats row */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {vel && (
                        <span className="text-xs text-neutral-300 font-medium">
                          {vel} fps
                        </span>
                      )}
                      {lot.extremeSpread != null && (
                        <span className={`text-xs font-medium ${esInfo?.color || 'text-neutral-400'}`}>
                          ES {lot.extremeSpread}
                        </span>
                      )}
                      {lot.standardDeviation != null && (
                        <span className="text-xs text-neutral-400 font-medium">
                          SD {lot.standardDeviation}
                        </span>
                      )}
                      {bestGroup != null && (
                        <span className="text-xs text-emerald-400 font-medium">
                          Best {bestGroup}&quot;
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Rating + expand */}
                  <div className="flex items-center gap-2 shrink-0">
                    {lot.ratingStars != null && lot.ratingStars > 0 && (
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${
                              i < (lot.ratingStars || 0)
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-neutral-600'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    )}
                  </div>
                </div>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-4 md:px-5 pb-4 space-y-3 border-t border-white/5 pt-3">
                  {/* Velocity data */}
                  <div className="grid grid-cols-2 gap-3">
                    {lot.boxMuzzleVelocityFps && (
                      <div className="bg-neutral-900/80 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">Box Velocity</span>
                        <span className="text-lg font-bold text-white">{lot.boxMuzzleVelocityFps} fps</span>
                      </div>
                    )}
                    {lot.measuredAvgFps && (
                      <div className="bg-neutral-900/80 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">Measured Avg</span>
                        <span className="text-lg font-bold text-white">{lot.measuredAvgFps} fps</span>
                      </div>
                    )}
                    {lot.extremeSpread != null && (
                      <div className="bg-neutral-900/80 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">Extreme Spread</span>
                        <span className={`text-lg font-bold ${esInfo?.color || 'text-white'}`}>
                          {lot.extremeSpread} fps
                        </span>
                        {esInfo && <span className={`text-xs ${esInfo.color} block`}>{esInfo.label}</span>}
                      </div>
                    )}
                    {lot.standardDeviation != null && (
                      <div className="bg-neutral-900/80 rounded-xl p-3 border border-white/5">
                        <span className="text-[10px] uppercase font-mono text-neutral-400 font-bold block">Std Deviation</span>
                        <span className="text-lg font-bold text-white">{lot.standardDeviation} fps</span>
                      </div>
                    )}
                  </div>

                  {/* Session count and tested temp */}
                  <div className="flex items-center gap-3 flex-wrap text-xs text-neutral-400 font-medium">
                    <span>{sessCount} session{sessCount !== 1 ? 's' : ''} with this lot</span>
                    {lot.testedTempF && <span>Tested at {lot.testedTempF}°F</span>}
                    {bestGroup != null && <span className="text-emerald-400">Best vertical: {bestGroup}&quot;</span>}
                  </div>

                  {/* Notes */}
                  {lot.notes && (
                    <div className="text-sm text-neutral-300 bg-neutral-900/60 rounded-xl p-3 border border-white/5 italic">
                      {lot.notes}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
