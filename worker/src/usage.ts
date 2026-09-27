/**
 * Per-user daily quota, counted here rather than on the device.
 *
 * The app also tracks this locally, but that copy lives in the browser's own
 * storage where anyone can edit it — it exists to show the remaining count, not to
 * enforce it. This is the number that decides.
 */

/**
 * Days are counted in one fixed zone rather than each device's local midnight, so
 * the reset happens at a predictable moment and cannot be moved by changing a
 * phone's clock.
 */
const RESET_ZONE = 'Asia/Taipei';

export function today(): string {
  // en-CA formats as YYYY-MM-DD, which sorts and reads the same way.
  return new Intl.DateTimeFormat('en-CA', { timeZone: RESET_ZONE }).format(new Date());
}

export type Usage = { used: number; limit: number; remaining: number };

function key(uid: string): string {
  return `usage:${uid}:${today()}`;
}

export async function getUsage(kv: KVNamespace, uid: string, limit: number): Promise<Usage> {
  const raw = await kv.get(key(uid));
  const used = raw ? Number(raw) : 0;
  const safe = Number.isFinite(used) && used > 0 ? used : 0;
  return { used: safe, limit, remaining: Math.max(0, limit - safe) };
}

export async function recordUse(kv: KVNamespace, uid: string, limit: number): Promise<Usage> {
  const current = await getUsage(kv, uid, limit);
  const used = current.used + 1;
  await kv.put(key(uid), String(used), {
    // Two days is long enough to cover the zone offset and clock skew, and lets KV
    // clean up on its own rather than leaving a row per user per day forever.
    expirationTtl: 60 * 60 * 48,
  });
  return { used, limit, remaining: Math.max(0, limit - used) };
}
