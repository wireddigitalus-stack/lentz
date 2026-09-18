'use client';

import React, { useState, useMemo } from 'react';
import { 
  Trophy, ClipboardList, Plus, Trash2, 
  ChevronDown, ChevronRight, Camera, Flag, 
  Thermometer, Wind, Target
} from 'lucide-react';
import { 
  MatchDayLog, MatchRelay, MatchType, ConditionSnapshot, 
  EnvironmentalConditions, BarrelProfile, AmmoLot 
} from '@/types';
import { calculateDensityAltitude } from '@/lib/ballistics';

interface MatchDayLogProps {
  matchDays: MatchDayLog[];
  snapshots: ConditionSnapshot[];
  currentEnvironment: EnvironmentalConditions;
  currentClick: number;
  barrel?: BarrelProfile;
  ammo?: AmmoLot;
  onSaveMatchDay: (day: MatchDayLog) => void;
  onDeleteMatchDay: (id: string) => void;
  onSaveSnapshot: (snap: ConditionSnapshot) => void;
  isEasyMode?: boolean;
}

type ViewMode = 'list' | 'start' | 'active';

const MATCH_TYPES: MatchType[] = ['ARA 2500', 'PSL', 'IR50/50', 'Practice', 'Lot Test', 'Other'];

export function MatchDayLogComponent({
  matchDays,
  snapshots,
  currentEnvironment,
  currentClick,
  barrel,
  ammo,
  onSaveMatchDay,
  onDeleteMatchDay,
  onSaveSnapshot,
  isEasyMode
}: MatchDayLogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Start Match State
  const [newMatchType, setNewMatchType] = useState<MatchType>('ARA 2500');
  const [newVenue, setNewVenue] = useState(currentEnvironment.locationName || '');
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  // Active Match State
  const [activeMatch, setActiveMatch] = useState<Partial<MatchDayLog> | null>(null);
  const [currentRelayScore, setCurrentRelayScore] = useState<string>('');
  const [currentRelayXCount, setCurrentRelayXCount] = useState<string>('');
  const [currentRelayClick, setCurrentRelayClick] = useState<number>(currentClick);
  const [currentRelayNote, setCurrentRelayNote] = useState<string>('');

  const sortedMatches = useMemo(() => {
    return [...matchDays].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matchDays]);

  const recentSnapshots = useMemo(() => {
    return [...snapshots].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);
  }, [snapshots]);

  const getBadgeColor = (type: MatchType) => {
    switch (type) {
      case 'ARA 2500': return 'bg-sky-500/20 text-sky-300';
      case 'PSL': return 'bg-emerald-500/20 text-emerald-300';
      case 'IR50/50': return 'bg-violet-500/20 text-violet-300';
      case 'Practice': return 'bg-neutral-500/20 text-neutral-300';
      case 'Lot Test': return 'bg-amber-500/20 text-amber-300';
      default: return 'bg-neutral-500/20 text-neutral-300';
    }
  };

  const handleStartNewMatch = () => {
    setNewVenue(currentEnvironment.locationName || '');
    const d = new Date();
    setNewDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setViewMode('start');
  };

  const handleBeginLogging = () => {
    setActiveMatch({
      id: crypto.randomUUID(),
      date: newDate,
      venue: newVenue,
      matchType: newMatchType,
      barrelId: barrel?.id || '',
      ammoLotId: ammo?.id || '',
      relays: [],
      startingConditions: { ...currentEnvironment },
      tunerClickUsed: currentClick,
      createdAt: new Date().toISOString()
    });
    setCurrentRelayClick(currentClick);
    setCurrentRelayScore('');
    setCurrentRelayXCount('');
    setCurrentRelayNote('');
    setViewMode('active');
  };

  const handleLogRelay = () => {
    if (!activeMatch) return;
    
    const nextRelayNum = (activeMatch.relays?.length || 0) + 1;
    const scoreVal = currentRelayScore ? parseInt(currentRelayScore, 10) : undefined;
    const xVal = currentRelayXCount ? parseInt(currentRelayXCount, 10) : undefined;
    
    const newRelay: MatchRelay = {
      id: crypto.randomUUID(),
      relayNumber: nextRelayNum,
      score: scoreVal,
      xCount: xVal,
      tunerClick: currentRelayClick,
      conditions: { ...currentEnvironment },
      notes: currentRelayNote,
      timestamp: new Date().toISOString()
    };

    setActiveMatch({
      ...activeMatch,
      relays: [...(activeMatch.relays || []), newRelay]
    });
    
    setCurrentRelayScore('');
    setCurrentRelayXCount('');
    setCurrentRelayNote('');
  };

  const handleEndMatch = () => {
    if (!activeMatch) return;
    
    let totalScore = 0;
    let totalX = 0;
    
    activeMatch.relays?.forEach(r => {
      if (r.score) totalScore += r.score;
      if (r.xCount) totalX += r.xCount;
    });

    const finalizedMatch: MatchDayLog = {
      ...activeMatch,
      totalScore,
      totalXCount: totalX,
    } as MatchDayLog;

    onSaveMatchDay(finalizedMatch);
    setActiveMatch(null);
    setViewMode('list');
  };

  const handleTakeSnapshot = () => {
    onSaveSnapshot({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      conditions: { ...currentEnvironment },
      tunerClick: currentRelayClick,
      matchDayId: activeMatch?.id
    });
  };

  const renderList = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Trophy className="w-5 h-5 text-sky-400" />
          Match Days
        </h2>
        <button
          onClick={handleStartNewMatch}
          className="flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors min-h-[44px]"
        >
          <Plus className="w-4 h-4" />
          New Match
        </button>
      </div>

      <div className="space-y-4">
        {sortedMatches.length === 0 ? (
          <div className="text-center p-8 bg-[#10131A]/90 border border-white/10 rounded-2xl">
            <ClipboardList className="w-12 h-12 text-slate-500 mx-auto mb-3" />
            <p className="text-slate-400">No matches logged yet.</p>
          </div>
        ) : (
          sortedMatches.map(match => (
            <div key={match.id} className="bg-[#10131A]/90 border border-white/10 rounded-2xl overflow-hidden">
              <div 
                className="p-4 md:p-6 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpandedMatchId(expandedMatchId === match.id ? null : match.id)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-slate-300 font-medium">{new Date(match.date).toLocaleDateString()}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getBadgeColor(match.matchType)}`}>
                        {match.matchType}
                      </span>
                    </div>
                    {!isEasyMode && <p className="text-slate-400 text-sm">{match.venue}</p>}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-white">{match.totalScore || 0}</div>
                    <div className="text-slate-400 text-sm">{match.totalXCount || 0}X</div>
                  </div>
                </div>

                {!isEasyMode && match.relays.length > 0 && (
                  <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                    <span>{match.relays.length} Relays</span>
                    {match.relays.length > 1 && (
                      <span>
                        Temp: {match.relays[0].conditions.tempF}° → {match.relays[match.relays.length - 1].conditions.tempF}°
                      </span>
                    )}
                  </div>
                )}
                
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sky-400 flex items-center gap-1 text-sm font-medium">
                    {expandedMatchId === match.id ? (
                      <><ChevronDown className="w-4 h-4" /> Hide Details</>
                    ) : (
                      <><ChevronRight className="w-4 h-4" /> Show Relays</>
                    )}
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Delete this match?')) onDeleteMatchDay(match.id);
                    }}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expandedMatchId === match.id && (
                <div className="p-4 md:p-6 border-t border-white/10 bg-black/20">
                  <div className="space-y-3">
                    {match.relays.map(relay => (
                      <div key={relay.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
                        <div>
                          <div className="font-semibold text-white">Relay {relay.relayNumber}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {relay.conditions.tempF}°F | {relay.conditions.densityAltitudeFt}ft DA
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-emerald-400">
                            {relay.score || 0}-{relay.xCount || 0}X
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            Click {relay.tunerClick}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {recentSnapshots.length > 0 && !isEasyMode && (
        <div className="pt-6 border-t border-white/10">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Camera className="w-4 h-4" /> Recent Snapshots
          </h3>
          <div className="space-y-3">
            {recentSnapshots.map(snap => (
              <div key={snap.id} className="flex justify-between items-center p-3 bg-[#10131A]/60 border border-white/5 rounded-xl text-sm">
                <div className="text-slate-300">
                  {new Date(snap.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  <span className="mx-2 text-slate-600">|</span>
                  {snap.conditions.tempF}°F
                </div>
                <div className="text-sky-400 font-mono">
                  Click {snap.tunerClick}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderStart = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setViewMode('list')}
          className="p-2 text-slate-400 hover:text-white bg-white/5 rounded-xl min-h-[44px]"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
        </button>
        <h2 className="text-xl font-bold text-white">Start Match</h2>
      </div>

      <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 md:p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Match Date</label>
          <input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-2">Venue</label>
          <input
            type="text"
            value={newVenue}
            onChange={e => setNewVenue(e.target.value)}
            placeholder="e.g. Chickenfoot, Rocky River"
            className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-400 mb-3">Match Type</label>
          <div className="flex flex-wrap gap-2">
            {MATCH_TYPES.map(type => (
              <button
                key={type}
                onClick={() => setNewMatchType(type)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors min-h-[44px] ${
                  newMatchType === type 
                    ? getBadgeColor(type) 
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Barrel</div>
            <div className="text-sm text-slate-300 font-medium truncate">{barrel?.name || 'None'}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500 mb-1">Active Ammo</div>
            <div className="text-sm text-slate-300 font-medium truncate">
              {ammo ? `${ammo.brand} ${ammo.model} (${ammo.lotNumber})` : 'None'}
            </div>
          </div>
        </div>
        
        <div className="pt-4 border-t border-white/10">
          <div className="text-xs text-slate-500 mb-2">Starting Conditions</div>
          <div className="flex gap-4 text-sm text-slate-300">
            <span className="flex items-center gap-1"><Thermometer className="w-4 h-4 text-sky-400"/> {currentEnvironment.tempF}°F</span>
            <span className="flex items-center gap-1"><Flag className="w-4 h-4 text-sky-400"/> {currentEnvironment.densityAltitudeFt}ft DA</span>
            <span className="flex items-center gap-1"><Target className="w-4 h-4 text-sky-400"/> Click {currentClick}</span>
          </div>
        </div>

        <button
          onClick={handleBeginLogging}
          className="w-full bg-sky-500 hover:bg-sky-600 text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 mt-4 transition-colors min-h-[56px]"
        >
          Begin Logging Relays <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  const renderActive = () => {
    if (!activeMatch) return null;
    
    const runningScore = activeMatch.relays?.reduce((sum, r) => sum + (r.score || 0), 0) || 0;
    const runningX = activeMatch.relays?.reduce((sum, r) => sum + (r.xCount || 0), 0) || 0;
    const nextRelay = (activeMatch.relays?.length || 0) + 1;

    return (
      <div className="space-y-6">
        <div className="bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 md:p-6 text-center shadow-lg shadow-sky-900/10">
          <div className="flex justify-center items-center gap-2 mb-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${getBadgeColor(activeMatch.matchType!)}`}>
              {activeMatch.matchType}
            </span>
            <span className="text-slate-400 text-sm">{activeMatch.venue}</span>
          </div>
          <div className="text-slate-400 font-medium mb-1 uppercase tracking-wide text-sm">Total Score</div>
          <div className="text-5xl font-black text-white flex justify-center items-baseline gap-1">
            {runningScore}
            <span className="text-2xl text-emerald-400">{runningX}X</span>
          </div>
        </div>

        <div className="bg-[#10131A]/90 border border-sky-500/30 rounded-2xl p-4 md:p-6 shadow-[0_0_15px_rgba(14,165,233,0.1)]">
          <h3 className="text-lg font-bold text-white mb-4">Relay {nextRelay}</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Score</label>
              <input
                type="number"
                value={currentRelayScore}
                onChange={e => setCurrentRelayScore(e.target.value)}
                placeholder="2500"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-2xl font-bold text-white text-center focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">X-Count</label>
              <input
                type="number"
                value={currentRelayXCount}
                onChange={e => setCurrentRelayXCount(e.target.value)}
                placeholder="25"
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-4 text-2xl font-bold text-white text-center focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Tuner Click</label>
              <input
                type="number"
                value={currentRelayClick}
                onChange={e => setCurrentRelayClick(parseInt(e.target.value) || 0)}
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Note (Optional)</label>
              <input
                type="text"
                value={currentRelayNote}
                onChange={e => setCurrentRelayNote(e.target.value)}
                placeholder="Wind picked up..."
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={handleTakeSnapshot}
              className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl font-medium transition-colors min-h-[48px] flex items-center justify-center gap-2"
              title="Capture conditions without score"
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              onClick={handleLogRelay}
              disabled={!currentRelayScore}
              className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-500/50 disabled:text-emerald-200 text-white font-bold py-3 px-4 rounded-xl transition-colors min-h-[48px]"
            >
              Log Relay {nextRelay}
            </button>
          </div>
        </div>

        {activeMatch.relays && activeMatch.relays.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-slate-400 px-2 uppercase tracking-wide">Previous Relays</h4>
            {[...activeMatch.relays].reverse().map(relay => (
              <div key={relay.id} className="flex justify-between items-center p-4 bg-[#10131A]/60 border border-white/5 rounded-xl">
                <div>
                  <div className="font-bold text-white mb-1">Relay {relay.relayNumber}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Thermometer className="w-3 h-3" /> {relay.conditions.tempF}°
                    <Target className="w-3 h-3 ml-2" /> Click {relay.tunerClick}
                  </div>
                </div>
                <div className="text-xl font-black text-emerald-400">
                  {relay.score}-{relay.xCount}X
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleEndMatch}
          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold py-4 rounded-xl transition-colors min-h-[56px] border border-red-500/20"
        >
          End Match & Save
        </button>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto pb-safe">
      {viewMode === 'list' && renderList()}
      {viewMode === 'start' && renderStart()}
      {viewMode === 'active' && renderActive()}
    </div>
  );
}

export default MatchDayLogComponent;
