import * as SQLite from 'expo-sqlite';

export const FREE_DAILY_LIMIT = 5;

export type UsageToday = {
  used: number;
  bonus: number;
  allowed: number;
  remaining: number;
};

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('snap-catalog.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS ai_usage (
          date TEXT PRIMARY KEY,
          used INTEGER NOT NULL DEFAULT 0,
          bonus INTEGER NOT NULL DEFAULT 0
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

// Local calendar date, not UTC, so the daily reset lines up with the user's own midnight.
function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function toUsage(row: { used: number; bonus: number } | null): UsageToday {
  const used = row?.used ?? 0;
  const bonus = row?.bonus ?? 0;
  const allowed = FREE_DAILY_LIMIT + bonus;
  return { used, bonus, allowed, remaining: Math.max(0, allowed - used) };
}

export async function getUsageToday(): Promise<UsageToday> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ used: number; bonus: number }>(
    `SELECT used, bonus FROM ai_usage WHERE date = ?`,
    [todayKey()],
  );
  return toUsage(row ?? null);
}

export async function recordAnalysisUsed(): Promise<UsageToday> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ai_usage (date, used, bonus) VALUES (?, 1, 0)
     ON CONFLICT(date) DO UPDATE SET used = used + 1`,
    [todayKey()],
  );
  return getUsageToday();
}

export async function grantBonusAnalysis(): Promise<UsageToday> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO ai_usage (date, used, bonus) VALUES (?, 0, 1)
     ON CONFLICT(date) DO UPDATE SET bonus = bonus + 1`,
    [todayKey()],
  );
  return getUsageToday();
}
