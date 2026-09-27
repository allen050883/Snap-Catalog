import { ITEM_TYPE_SLUGS } from '../../src/constants/item-types';
import { TokenError, verifyIdToken } from './firebase-auth';
import { getUsage, recordUse } from './usage';

export type Env = {
  /** Secret: `wrangler secret put GROQ_API_KEY`. Never sent to the client. */
  GROQ_API_KEY: string;
  FIREBASE_PROJECT_ID: string;
  /** Comma-separated origins allowed to call this. */
  ALLOWED_ORIGINS: string;
  DAILY_LIMIT?: string;
  GROQ_MODEL?: string;
  USAGE: KVNamespace;
};

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';
const DEFAULT_LIMIT = 5;

// A photo of a collectible, resized to 1000px and JPEG-compressed, lands well under
// this. The cap is here so a caller cannot make the Worker hold an arbitrary
// payload in memory or forward one to Groq.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const SYSTEM_PROMPT = `You are helping catalog a physical collectible toy/figurine (e.g. Rilakkuma, Sanrio characters, blind-box figures) from a photo, so the owner can tag it and avoid buying duplicates. The owner reads Traditional Chinese (Taiwan).

Look at the photo and respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "name": "short Traditional Chinese name for this item, e.g. '拉拉熊 草莓系列 坐姿玩偶'",
  "themes": ["the character/IP this belongs to, in Traditional Chinese followed by the original name when that differs, e.g. '拉拉熊 Rilakkuma'. Usually ONE entry; return TWO only for a visible collaboration between two IPs. Empty array if unclear"],
  "series": "the specific series/collection/wave name, using the official Traditional Chinese name when one exists, else null",
  "type": "one of these exact English values: ${ITEM_TYPE_SLUGS.join(', ')}",
  "size": "size or pose if you can tell, in Traditional Chinese, e.g. 'M・坐姿' or '12 公分'. null if not determinable from the photo",
  "color": "dominant color(s) in Traditional Chinese, e.g. '棕色、粉紅色'",
  "tags": ["search keywords, 4-10 items"]
}

Rules:
- Write name, themes, series, size and color in Traditional Chinese, NOT Simplified Chinese and NOT English.
- "type" is the one exception: return the English slug exactly as listed above, never a translation.
- "tags" must contain BOTH Chinese and romanized/English forms of the key terms, so either spelling finds this item later — e.g. ["拉拉熊", "rilakkuma", "絨毛", "plush", "粉紅色", "pink", "草莓"]. Keep Chinese tags unspaced and English tags lowercase.
- Do not guess "size" from an image with nothing to judge scale against — null is the better answer.
- If you cannot confidently determine a field, use null (or an empty array) rather than guessing wildly.`;

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
  // Echoing only a listed origin — a blanket "*" would let any page on the internet
  // spend this project's quota using a token it phished elsewhere.
  const match = allowed.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': match,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Mirrors the client's extractJson: models sometimes wrap the object in prose. */
function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (!cors['Access-Control-Allow-Origin']) {
      return json({ error: '來源未授權' }, 403, cors);
    }

    const url = new URL(request.url);
    const limit = Number(env.DAILY_LIMIT ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;

    // 1. Who is asking. Without this the endpoint is exactly as open as a leaked key.
    const authorization = request.headers.get('Authorization') ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!token) return json({ error: '請先登入' }, 401, cors);

    let uid: string;
    try {
      ({ uid } = await verifyIdToken(token, env.FIREBASE_PROJECT_ID));
    } catch (error) {
      const message = error instanceof TokenError ? error.message : '登入憑證驗證失敗';
      return json({ error: message }, 401, cors);
    }

    // The screen shows what is left before anything is spent. Reading it from here
    // rather than from the device keeps one number on screen instead of a local
    // guess that drifts from the count that actually decides.
    if (url.pathname === '/usage' && request.method === 'GET') {
      return json({ usage: await getUsage(env.USAGE, uid, limit) }, 200, cors);
    }

    if (url.pathname !== '/analyze' || request.method !== 'POST') {
      return json({ error: 'Not found' }, 404, cors);
    }

    // 2. Have they got any left today.
    const usage = await getUsage(env.USAGE, uid, limit);
    if (usage.remaining <= 0) {
      return json({ error: 'AI 額度不足，請洽詢管理員', usage }, 429, cors);
    }

    // 3. What they sent.
    let image: string;
    try {
      const body = (await request.json()) as { image?: unknown };
      if (typeof body.image !== 'string' || !body.image.startsWith('data:image/')) {
        return json({ error: '照片格式不正確' }, 400, cors);
      }
      if (body.image.length > MAX_IMAGE_BYTES) {
        return json({ error: '照片太大，請重新選擇' }, 413, cors);
      }
      image = body.image;
    } catch {
      return json({ error: '請求內容不正確' }, 400, cors);
    }

    // 4. Ask Groq, with the key that never leaves this Worker.
    const groq = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    });

    if (groq.status === 429) {
      // Groq's own rate limit, not the per-user one. Same message either way: the
      // difference is not actionable for whoever is holding the phone.
      return json({ error: 'AI 額度不足，請洽詢管理員', usage }, 429, cors);
    }
    if (!groq.ok) {
      // The upstream body can name the account and its token budget, so it is logged
      // rather than returned.
      console.error('Groq error', groq.status, await groq.text());
      return json({ error: 'AI 辨識服務暫時無法使用' }, 502, cors);
    }

    let suggestion: unknown;
    try {
      const payload = (await groq.json()) as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== 'string') throw new Error('Unexpected Groq response shape');
      suggestion = extractJson(content);
    } catch (error) {
      console.error('Groq parse', error);
      return json({ error: 'AI 回傳的內容無法解析，請再試一次' }, 502, cors);
    }

    // 5. Only charge for a call that produced something usable.
    const updated = await recordUse(env.USAGE, uid, limit);
    return json({ suggestion, usage: updated }, 200, cors);
  },
};
