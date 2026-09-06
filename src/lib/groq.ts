const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// Groq's vision-capable models as of this writing. Scout is fast and cheap and
// plenty accurate for recognizing a collectible figure's character/series/color;
// Maverick is the larger sibling if you want to try squeezing out more accuracy.
const DEFAULT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export type TagSuggestion = {
  name: string;
  character: string | null;
  series: string | null;
  category: string | null;
  color: string | null;
  tags: string[];
};

const SYSTEM_PROMPT = `You are helping catalog a physical collectible toy/figurine (e.g. Rilakkuma, Sanrio characters, blind-box figures) from a photo, so the owner can tag it and avoid buying duplicates.

Look at the photo and respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "name": "short human-readable name for this item, e.g. 'Rilakkuma Strawberry Series Sitting Plush'",
  "character": "the character/IP name, e.g. 'Rilakkuma', 'Hello Kitty', or null if unclear",
  "series": "the specific series/collection/wave name if visible or inferable, else null",
  "category": "one of: plush, figure, blind-box, keychain, accessory, stationery, other",
  "color": "dominant color(s), e.g. 'brown, pink'",
  "tags": ["short", "lowercase", "keyword", "tags", "for search, 3-8 items"]
}

If you cannot confidently determine a field, use null (or an empty array for tags) rather than guessing wildly.`;

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

export async function suggestTagsForPhoto(base64: string): Promise<TagSuggestion> {
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
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64}` } },
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
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : 'Untitled item',
    character: parsed.character ?? null,
    series: parsed.series ?? null,
    category: parsed.category ?? null,
    color: parsed.color ?? null,
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : [],
  };
}
