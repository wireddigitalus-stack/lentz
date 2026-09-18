'use client';

import React, { useState, useEffect } from 'react';
import { ConditionSnapshot, EnvironmentalConditions } from '@/types';
import { Camera, Check } from 'lucide-react';

interface SnapshotButtonProps {
  environment: EnvironmentalConditions;
  currentClick: number;
  onSaveSnapshot: (snap: ConditionSnapshot) => void;
  compact?: boolean;
}

export function SnapshotButton({
  environment,
  currentClick,
  onSaveSnapshot,
  compact = false
}: SnapshotButtonProps) {
  const [showToast, setShowToast] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleSave = () => {
    const snap: ConditionSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date().toISOString(),
      conditions: environment,
      tunerClick: currentClick,
      note: note.trim() !== '' ? note.trim() : undefined,
    };
    onSaveSnapshot(snap);
    setNote('');
    setShowToast(true);
  };

  if (compact) {
    return (
      <div className="relative inline-flex flex-col items-center justify-center">
        {showToast && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg whitespace-nowrap animate-in fade-in zoom-in">
            <Check className="w-3 h-3" /> Saved
          </div>
        )}
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 bg-neutral-800 border border-white/10 px-3 py-1.5 rounded-full text-sm font-medium text-white min-h-[44px] active:scale-95 transition-transform"
        >
          <Camera className="w-4 h-4" />
          Snapshot
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-[#10131A]/90 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
      {showToast && (
        <div className="absolute top-2 right-2 bg-emerald-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 shadow-lg animate-in fade-in">
          <Check className="w-3 h-3" /> Saved
        </div>
      )}
      <div className="flex items-center gap-2 text-white font-medium">
        <Camera className="w-5 h-5 text-sky-500" />
        Record Conditions
      </div>
      <input
        type="text"
        placeholder="Add a note (optional)..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 min-h-[44px]"
      />
      <button
        onClick={handleSave}
        className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold py-2 rounded-xl min-h-[44px] transition-colors"
      >
        Save Snapshot
      </button>
    </div>
  );
}
