/**
 * AI tagging goes through this project's own Worker (see worker/), not straight to
 * Groq.
 *
 * The key used to live in EXPO_PUBLIC_GROQ_API_KEY, which is embedded in the
 * built JavaScript in plain text — publishing the site handed it to anyone who
 * opened devtools. The Worker holds it instead and answers only to a request
 * carrying a Firebase ID token, so the quota belongs to people who have actually
 * signed in. The prompt lives there too: it decides what the model is asked, and
 * that is not something a caller should be able to rewrite.
 */
function getEndpoint(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new Error(
      '未設定 EXPO_PUBLIC_API_URL。請在專案根目錄的 .env 填入 Worker 的網址（見 .env.example），並重新啟動開發伺服器。',
    );
  }
  return url.replace(/\/$/, '');
}

export type TagSuggestion = {
  name: string;
  themes: string[];
  series: string | null;
  type: string | null;
  size: string | null;
  color: string | null;
  tags: string[];
};

/** What the server says is left today — the number that actually decides. */
export type ServerUsage = { used: number; limit: number; remaining: number };

export type AnalysisResult = { suggestion: TagSuggestion; usage: ServerUsage };

/** No capacity left, either this user's daily allowance or Groq's own rate limit. */
export class GroqQuotaError extends Error {
  readonly usage: ServerUsage | null;
  constructor(message: string, usage: ServerUsage | null) {
    super(message);
    this.name = 'GroqQuotaError';
    this.usage = usage;
  }
}

/** The sign-in has expired or was rejected; signing in again is the fix. */
export class AuthRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

/**
 * @param dataUri A `data:image/jpeg;base64,…` URI, exactly as lib/compress-photo.ts
 *   returns it — the same string the app renders, so there is no second encoding
 *   step that could disagree with what the user sees.
 * @param idToken The signed-in user's Firebase ID token.
 */
export async function suggestTagsForPhoto(dataUri: string, idToken: string): Promise<AnalysisResult> {
  const response = await fetch(`${getEndpoint()}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ image: dataUri }),
  });

  // Every failure path below is already written in Chinese by the Worker, which is
  // also what keeps Groq's own error text — it names the account and its token
  // budget — from reaching a browser.
  const payload = (await response.json().catch(() => null)) as
    | { suggestion?: unknown; usage?: ServerUsage; error?: string }
    | null;

  if (response.status === 401) {
    throw new AuthRequiredError(payload?.error ?? '請重新登入後再試一次。');
  }
  if (response.status === 429) {
    throw new GroqQuotaError(payload?.error ?? 'AI 額度不足，請洽詢管理員', payload?.usage ?? null);
  }
  if (!response.ok || !payload?.suggestion) {
    throw new Error(payload?.error ?? `AI 辨識服務回應異常（${response.status}）`);
  }

  const parsed = payload.suggestion as Partial<TagSuggestion>;
  return {
    suggestion: {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : '未命名收藏',
      themes: Array.isArray(parsed.themes)
        ? parsed.themes.filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        : [],
      series: parsed.series ?? null,
      type: parsed.type ?? null,
      size: parsed.size ?? null,
      color: parsed.color ?? null,
      tags: Array.isArray(parsed.tags) ? parsed.tags.filter((t): t is string => typeof t === 'string') : [],
    },
    usage: payload.usage ?? { used: 0, limit: 0, remaining: 0 },
  };
}

/** Today's remaining allowance for the signed-in user, as the server counts it. */
export async function fetchUsage(idToken: string): Promise<ServerUsage> {
  const response = await fetch(`${getEndpoint()}/usage`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const payload = (await response.json().catch(() => null)) as
    | { usage?: ServerUsage; error?: string }
    | null;
  if (response.status === 401) {
    throw new AuthRequiredError(payload?.error ?? '請重新登入後再試一次。');
  }
  if (!response.ok || !payload?.usage) {
    throw new Error(payload?.error ?? `無法取得今日額度（${response.status}）`);
  }
  return payload.usage;
}
