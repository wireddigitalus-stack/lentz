import { BarrelProfile, AmmoLot, TuneSession, MatchDayLog, ConditionSnapshot } from '@/types';
import { DEFAULT_BARRELS, DEFAULT_AMMO_LOTS, DEFAULT_TUNING_SESSION } from './constants';

const STORAGE_KEYS = {
  BARRELS: 'lentz_tuner_barrels_v1',
  AMMO_LOTS: 'lentz_tuner_ammo_lots_v1',
  SESSIONS: 'lentz_tuner_sessions_v1',
  ACTIVE_BARREL_ID: 'lentz_tuner_active_barrel_v1',
  ACTIVE_AMMO_ID: 'lentz_tuner_active_ammo_v1',
  MATCH_DAYS: 'lentz_tuner_match_days_v1',
  SNAPSHOTS: 'lentz_tuner_snapshots_v1',
};

// Safe browser local storage helper
function getStoredItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    if (!data) return fallback;
    return JSON.parse(data) as T;
  } catch (err) {
    console.warn(`Error reading localStorage key "${key}":`, err);
    return fallback;
  }
}

function setStoredItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing localStorage key "${key}":`, err);
  }
}

export function getStoredBarrels(): BarrelProfile[] {
  const barrels = getStoredItem<BarrelProfile[]>(STORAGE_KEYS.BARRELS, []);
  if (barrels.length === 0) {
    setStoredBarrels(DEFAULT_BARRELS);
    return DEFAULT_BARRELS;
  }
  return barrels;
}

export function setStoredBarrels(barrels: BarrelProfile[]): void {
  setStoredItem(STORAGE_KEYS.BARRELS, barrels);
}

export function saveBarrel(barrel: BarrelProfile): void {
  const barrels = getStoredBarrels();
  const idx = barrels.findIndex((b) => b.id === barrel.id);
  if (idx >= 0) {
    barrels[idx] = barrel;
  } else {
    barrels.unshift(barrel);
  }
  setStoredBarrels(barrels);
}

export function deleteBarrel(id: string): void {
  const barrels = getStoredBarrels().filter((b) => b.id !== id);
  setStoredBarrels(barrels);
}

export function getStoredAmmoLots(): AmmoLot[] {
  const lots = getStoredItem<AmmoLot[]>(STORAGE_KEYS.AMMO_LOTS, []);
  if (lots.length === 0) {
    setStoredAmmoLots(DEFAULT_AMMO_LOTS);
    return DEFAULT_AMMO_LOTS;
  }
  return lots;
}

export function setStoredAmmoLots(lots: AmmoLot[]): void {
  setStoredItem(STORAGE_KEYS.AMMO_LOTS, lots);
}

export function saveAmmoLot(lot: AmmoLot): void {
  const lots = getStoredAmmoLots();
  const idx = lots.findIndex((l) => l.id === lot.id);
  if (idx >= 0) {
    lots[idx] = lot;
  } else {
    lots.unshift(lot);
  }
  setStoredAmmoLots(lots);
}

export function deleteAmmoLot(id: string): void {
  const lots = getStoredAmmoLots().filter((l) => l.id !== id);
  setStoredAmmoLots(lots);
}

export function getStoredSessions(): TuneSession[] {
  const sessions = getStoredItem<TuneSession[]>(STORAGE_KEYS.SESSIONS, []);
  if (sessions.length === 0) {
    setStoredSessions([DEFAULT_TUNING_SESSION]);
    return [DEFAULT_TUNING_SESSION];
  }
  return sessions;
}

export function setStoredSessions(sessions: TuneSession[]): void {
  setStoredItem(STORAGE_KEYS.SESSIONS, sessions);
}

export function saveSession(session: TuneSession): void {
  const sessions = getStoredSessions();
  const idx = sessions.findIndex((s) => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = session;
  } else {
    sessions.unshift(session);
  }
  setStoredSessions(sessions);
}

export function deleteSession(id: string): void {
  const sessions = getStoredSessions().filter((s) => s.id !== id);
  setStoredSessions(sessions);
}

export function getActiveBarrelId(): string {
  return getStoredItem<string>(STORAGE_KEYS.ACTIVE_BARREL_ID, DEFAULT_BARRELS[0].id);
}

export function setActiveBarrelId(id: string): void {
  setStoredItem(STORAGE_KEYS.ACTIVE_BARREL_ID, id);
}

export function getActiveAmmoId(): string {
  return getStoredItem<string>(STORAGE_KEYS.ACTIVE_AMMO_ID, DEFAULT_AMMO_LOTS[0].id);
}

export function setActiveAmmoId(id: string): void {
  setStoredItem(STORAGE_KEYS.ACTIVE_AMMO_ID, id);
}

export function exportAllDataAsJSON(): string {
  const payload = {
    app: 'Lentz TunerPro',
    version: '1.1.0',
    exportedAt: new Date().toISOString(),
    barrels: getStoredBarrels(),
    ammoLots: getStoredAmmoLots(),
    sessions: getStoredSessions(),
    matchDays: getStoredMatchDays(),
    snapshots: getStoredSnapshots(),
  };
  return JSON.stringify(payload, null, 2);
}

export function importAllDataFromJSON(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (Array.isArray(data.barrels)) setStoredBarrels(data.barrels);
    if (Array.isArray(data.ammoLots)) setStoredAmmoLots(data.ammoLots);
    if (Array.isArray(data.sessions)) setStoredSessions(data.sessions);
    if (Array.isArray(data.matchDays)) setStoredItem(STORAGE_KEYS.MATCH_DAYS, data.matchDays);
    if (Array.isArray(data.snapshots)) setStoredItem(STORAGE_KEYS.SNAPSHOTS, data.snapshots);
    return true;
  } catch (err) {
    console.error('Failed to import JSON data:', err);
    return false;
  }
}

export function resetToJeremiahLentzDefaults(): void {
  setStoredBarrels(DEFAULT_BARRELS);
  setStoredAmmoLots(DEFAULT_AMMO_LOTS);
  setStoredSessions([DEFAULT_TUNING_SESSION]);
  setActiveBarrelId(DEFAULT_BARRELS[0].id);
  setActiveAmmoId(DEFAULT_AMMO_LOTS[0].id);
}

// ─── Match Day Logs ─────────────────────────────────────────────────────────

export function getStoredMatchDays(): MatchDayLog[] {
  return getStoredItem<MatchDayLog[]>(STORAGE_KEYS.MATCH_DAYS, []);
}

export function saveMatchDay(log: MatchDayLog): void {
  const days = getStoredMatchDays();
  const idx = days.findIndex((d) => d.id === log.id);
  if (idx >= 0) {
    days[idx] = log;
  } else {
    days.unshift(log);
  }
  setStoredItem(STORAGE_KEYS.MATCH_DAYS, days);
}

export function deleteMatchDay(id: string): void {
  const days = getStoredMatchDays().filter((d) => d.id !== id);
  setStoredItem(STORAGE_KEYS.MATCH_DAYS, days);
}

// ─── Condition Snapshots ────────────────────────────────────────────────────

export function getStoredSnapshots(): ConditionSnapshot[] {
  return getStoredItem<ConditionSnapshot[]>(STORAGE_KEYS.SNAPSHOTS, []);
}

export function saveSnapshot(snap: ConditionSnapshot): void {
  const snaps = getStoredSnapshots();
  snaps.unshift(snap);
  // Keep last 200 snapshots
  if (snaps.length > 200) snaps.length = 200;
  setStoredItem(STORAGE_KEYS.SNAPSHOTS, snaps);
}

export function deleteSnapshot(id: string): void {
  const snaps = getStoredSnapshots().filter((s) => s.id !== id);
  setStoredItem(STORAGE_KEYS.SNAPSHOTS, snaps);
}

