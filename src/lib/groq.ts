import { ITEM_TYPE_SLUGS } from '@/constants/item-types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Groq has retired the llama-4 vision models this used to default to (Scout /
// Maverick); qwen3.8-27b is the multimodal model Groq currently serves, and it's
// accurate enough for recognizing a collectible's character/series/color. The rest
// of Groq's current lineup (the gpt-oss models) is text-only and rejects an
// image_url part outright, so overriding EXPO_PUBLIC_GROQ_VISION_MODEL only makes
// sense with another vision model — check GET /v1/models for what's available.
const DEFAULT_MODEL = 'qwen/qwen3.8-27b';

export type TagSuggestion = {
  name: string;
  themes: string[];
  series: string | null;
  type: string | null;
  size: string | null;
  color: string | null;
  tags: string[];
};

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

function getApiKey(): string {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY;
  if (!key) {
    throw new Error(
      'Missing EXPO_PUBLIC_GROQ_API_KEY. Add it to a .env file at the project root (see .env.example) and restart the dev server.',
    );
  }
  return key;
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON: ${text}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}

/**
 * @param dataUri A `data:image/jpeg;base64,…` URI, exactly as lib/compress-photo.ts
 *   returns it — the same string the app renders, so there is no second encoding
 *   step that could disagree with what the user sees.
 */
export async function suggestTagsForPhoto(dataUri: string): Promise<TagSuggestion> {
  const model = process.env.EXPO_PUBLIC_GROQ_VISION_MODEL || DEFAULT_MODEL;

  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: SYSTEM_PROMPT },
            { type: 'image_url', image_url: { url: dataUri } },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Groq API error ${response.status}: ${body}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (typeof content !== 'string') {
    throw new Error('Unexpected Groq response shape');
  }

  const parsed = extractJson(content) as Partial<TagSuggestion>;
  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : '未命名收藏',
    themes: Array.isArray(parsed.themes)
      ? parsed.themes.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
      : [],
    series: parsed.series ?? null,
    type: parsed.type ?? null,
    size: parsed.size ?? null,
    color: parsed.color ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : [],
  };
}
