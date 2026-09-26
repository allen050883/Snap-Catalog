// Web counterpart to usage.ts. The native version keeps the daily quota in
// expo-sqlite, but expo-sqlite's web build loads its engine through a worker
// chunk that Metro's web serializer can't emit ("Worker chunk not found for
// expo-sqlite/web/worker.ts"), which fails the whole web bundle. The quota is
// deliberately per-device local state (see README), and a browser already has
// local storage for exactly that — so on web, skip SQLite entirely.
export const FREE_DAILY_LIMIT = 5;

export type UsageToday = {
  used: number;
  bonus: number;
  allowed: number;
  remaining: number;
};

const STORAGE_KEY = 'snap-catalog:ai-usage';

type StoredUsage = { date: string; used: number; bonus: number };

// Local calendar date, not UTC, so the daily reset lines up with the user's own midnight.
function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

// Only today's counts are ever read, so one record is enough — a stale date just
// reads as a fresh day, which is also how the quota resets.
let memoryFallback: StoredUsage | null = null;

// localStorage throws outright in some browser configurations (private windows,
// blocked site data), so every access has to tolerate failure. Falling back to
// memory keeps the quota working for the session instead of breaking AI tagging.
function read(): StoredUsage {
  const empty = { date: todayKey(), used: 0, bonus: 0 };
  let stored = memoryFallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw) as StoredUsage;
  } catch {
    // keep whatever memoryFallback holds
  }
  if (!stored || stored.date !== empty.date) return empty;
  return {
    date: stored.date,
    used: Number(stored.used) || 0,
    bonus: Number(stored.bonus) || 0,
  };
}

function write(next: StoredUsage) {
  memoryFallback = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // memoryFallback already holds it
  }
}

function toUsage(stored: StoredUsage): UsageToday {
  const allowed = FREE_DAILY_LIMIT + stored.bonus;
  return {
    used: stored.used,
    bonus: stored.bonus,
    allowed,
    remaining: Math.max(0, allowed - stored.used),
  };
}

export async function getUsageToday(): Promise<UsageToday> {
  return toUsage(read());
}

export async function recordAnalysisUsed(): Promise<UsageToday> {
  const next = read();
  next.used += 1;
  write(next);
  return toUsage(next);
}

export async function grantBonusAnalysis(): Promise<UsageToday> {
  const next = read();
  next.bonus += 1;
  write(next);
  return toUsage(next);
}
