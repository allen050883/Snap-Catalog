/**
 * Verifies a Firebase ID token without firebase-admin, which does not run on the
 * Workers runtime. Everything here is WebCrypto and fetch.
 *
 * Skipping verification and trusting the uid the client sends would leave the
 * endpoint wide open — anyone could claim to be anyone and spend the quota.
 */

export type VerifiedUser = { uid: string; email: string | null };

export class TokenError extends Error {}

/**
 * Google's signing keys in JWK form. The x509 endpoint is the better-known one but
 * returns PEM certificates, which WebCrypto cannot import directly; this one feeds
 * straight into importKey('jwk', …).
 */
const JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

type Jwk = JsonWebKey & { kid: string };
let cached: { keys: Jwk[]; expiresAt: number } | null = null;

async function getKeys(): Promise<Jwk[]> {
  // Google rotates these roughly daily and says when to come back in Cache-Control.
  // Honouring that keeps a request from fetching the key set every time while still
  // picking up a rotation.
  if (cached && Date.now() < cached.expiresAt) return cached.keys;

  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new TokenError('無法取得 Google 的驗證金鑰');

  const { keys } = (await response.json()) as { keys: Jwk[] };
  const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')?.[1];
  cached = {
    keys,
    // One hour if the header is missing, rather than caching forever.
    expiresAt: Date.now() + (maxAge ? Number(maxAge) : 3600) * 1000,
  };
  return keys;
}

function decodeSegment(segment: string): Uint8Array {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}

export async function verifyIdToken(token: string, projectId: string): Promise<VerifiedUser> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new TokenError('登入憑證格式不正確');
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = decodeJson(headerPart);
  if (header.alg !== 'RS256') throw new TokenError('登入憑證的簽章演算法不正確');

  const jwk = (await getKeys()).find((k) => k.kid === header.kid);
  // A kid that isn't in the current set means the token predates a key rotation,
  // which for an hour-cached set means it is simply too old.
  if (!jwk) throw new TokenError('登入憑證已過期，請重新登入');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    decodeSegment(signaturePart),
    signed,
  );
  if (!valid) throw new TokenError('登入憑證的簽章無效');

  // A valid signature only proves Google issued it — the claims decide whether it
  // was issued for *this* project and is still current.
  const payload = decodeJson(payloadPart);
  const now = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) throw new TokenError('登入憑證不屬於這個專案');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new TokenError('登入憑證的簽發者不正確');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new TokenError('登入憑證已過期，請重新登入');
  }
  // A little slack for clock skew between Google's servers and this one.
  if (typeof payload.iat !== 'number' || payload.iat > now + 60) {
    throw new TokenError('登入憑證的簽發時間不正確');
  }
  if (typeof payload.sub !== 'string' || payload.sub === '') {
    throw new TokenError('登入憑證缺少使用者識別碼');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : null,
  };
}
