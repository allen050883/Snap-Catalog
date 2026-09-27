var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// ../src/constants/item-types.ts
var ITEM_TYPES = [
  { slug: "plush", label: "\u5A03\u5A03" },
  { slug: "figure", label: "\u516C\u4ED4" },
  { slug: "blind-box", label: "\u76F2\u76D2" },
  { slug: "stationery", label: "\u6587\u5177" },
  { slug: "keychain", label: "\u9470\u5319\u5708" },
  { slug: "bag", label: "\u5305\u888B" },
  { slug: "luggage", label: "\u884C\u674E\u7BB1" },
  { slug: "apparel", label: "\u670D\u98FE" },
  { slug: "tableware", label: "\u9910\u5177" },
  { slug: "accessory", label: "\u914D\u4EF6" },
  { slug: "other", label: "\u5176\u4ED6" }
];
var ITEM_TYPE_SLUGS = ITEM_TYPES.map((t) => t.slug);

// src/firebase-auth.ts
var TokenError = class extends Error {
  static {
    __name(this, "TokenError");
  }
};
var JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
var cached = null;
async function getKeys() {
  if (cached && Date.now() < cached.expiresAt) return cached.keys;
  const response = await fetch(JWKS_URL);
  if (!response.ok) throw new TokenError("\u7121\u6CD5\u53D6\u5F97 Google \u7684\u9A57\u8B49\u91D1\u9470");
  const { keys } = await response.json();
  const maxAge = /max-age=(\d+)/.exec(response.headers.get("cache-control") ?? "")?.[1];
  cached = {
    keys,
    // One hour if the header is missing, rather than caching forever.
    expiresAt: Date.now() + (maxAge ? Number(maxAge) : 3600) * 1e3
  };
  return keys;
}
__name(getKeys, "getKeys");
function decodeSegment(segment) {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
__name(decodeSegment, "decodeSegment");
function decodeJson(segment) {
  return JSON.parse(new TextDecoder().decode(decodeSegment(segment)));
}
__name(decodeJson, "decodeJson");
async function verifyIdToken(token, projectId) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new TokenError("\u767B\u5165\u6191\u8B49\u683C\u5F0F\u4E0D\u6B63\u78BA");
  const [headerPart, payloadPart, signaturePart] = parts;
  const header = decodeJson(headerPart);
  if (header.alg !== "RS256") throw new TokenError("\u767B\u5165\u6191\u8B49\u7684\u7C3D\u7AE0\u6F14\u7B97\u6CD5\u4E0D\u6B63\u78BA");
  const jwk = (await getKeys()).find((k) => k.kid === header.kid);
  if (!jwk) throw new TokenError("\u767B\u5165\u6191\u8B49\u5DF2\u904E\u671F\uFF0C\u8ACB\u91CD\u65B0\u767B\u5165");
  const key2 = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    key2,
    decodeSegment(signaturePart),
    signed
  );
  if (!valid) throw new TokenError("\u767B\u5165\u6191\u8B49\u7684\u7C3D\u7AE0\u7121\u6548");
  const payload = decodeJson(payloadPart);
  const now = Math.floor(Date.now() / 1e3);
  if (payload.aud !== projectId) throw new TokenError("\u767B\u5165\u6191\u8B49\u4E0D\u5C6C\u65BC\u9019\u500B\u5C08\u6848");
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new TokenError("\u767B\u5165\u6191\u8B49\u7684\u7C3D\u767C\u8005\u4E0D\u6B63\u78BA");
  }
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    throw new TokenError("\u767B\u5165\u6191\u8B49\u5DF2\u904E\u671F\uFF0C\u8ACB\u91CD\u65B0\u767B\u5165");
  }
  if (typeof payload.iat !== "number" || payload.iat > now + 60) {
    throw new TokenError("\u767B\u5165\u6191\u8B49\u7684\u7C3D\u767C\u6642\u9593\u4E0D\u6B63\u78BA");
  }
  if (typeof payload.sub !== "string" || payload.sub === "") {
    throw new TokenError("\u767B\u5165\u6191\u8B49\u7F3A\u5C11\u4F7F\u7528\u8005\u8B58\u5225\u78BC");
  }
  return {
    uid: payload.sub,
    email: typeof payload.email === "string" ? payload.email : null
  };
}
__name(verifyIdToken, "verifyIdToken");

// src/usage.ts
var RESET_ZONE = "Asia/Taipei";
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: RESET_ZONE }).format(/* @__PURE__ */ new Date());
}
__name(today, "today");
function key(uid) {
  return `usage:${uid}:${today()}`;
}
__name(key, "key");
async function getUsage(kv, uid, limit) {
  const raw = await kv.get(key(uid));
  const used = raw ? Number(raw) : 0;
  const safe = Number.isFinite(used) && used > 0 ? used : 0;
  return { used: safe, limit, remaining: Math.max(0, limit - safe) };
}
__name(getUsage, "getUsage");
async function recordUse(kv, uid, limit) {
  const current = await getUsage(kv, uid, limit);
  const used = current.used + 1;
  await kv.put(key(uid), String(used), {
    // Two days is long enough to cover the zone offset and clock skew, and lets KV
    // clean up on its own rather than leaving a row per user per day forever.
    expirationTtl: 60 * 60 * 48
  });
  return { used, limit, remaining: Math.max(0, limit - used) };
}
__name(recordUse, "recordUse");

// src/index.ts
var GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
var DEFAULT_MODEL = "qwen/qwen3.8-27b";
var DEFAULT_LIMIT = 5;
var MAX_IMAGE_BYTES = 4 * 1024 * 1024;
var SYSTEM_PROMPT = `You are helping catalog a physical collectible toy/figurine (e.g. Rilakkuma, Sanrio characters, blind-box figures) from a photo, so the owner can tag it and avoid buying duplicates. The owner reads Traditional Chinese (Taiwan).

Look at the photo and respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "name": "short Traditional Chinese name for this item, e.g. '\u62C9\u62C9\u718A \u8349\u8393\u7CFB\u5217 \u5750\u59FF\u73A9\u5076'",
  "themes": ["the character/IP this belongs to, in Traditional Chinese followed by the original name when that differs, e.g. '\u62C9\u62C9\u718A Rilakkuma'. Usually ONE entry; return TWO only for a visible collaboration between two IPs. Empty array if unclear"],
  "series": "the specific series/collection/wave name, using the official Traditional Chinese name when one exists, else null",
  "type": "one of these exact English values: ${ITEM_TYPE_SLUGS.join(", ")}",
  "size": "size or pose if you can tell, in Traditional Chinese, e.g. 'M\u30FB\u5750\u59FF' or '12 \u516C\u5206'. null if not determinable from the photo",
  "color": "dominant color(s) in Traditional Chinese, e.g. '\u68D5\u8272\u3001\u7C89\u7D05\u8272'",
  "tags": ["search keywords, 4-10 items"]
}

Rules:
- Write name, themes, series, size and color in Traditional Chinese, NOT Simplified Chinese and NOT English.
- "type" is the one exception: return the English slug exactly as listed above, never a translation.
- "tags" must contain BOTH Chinese and romanized/English forms of the key terms, so either spelling finds this item later \u2014 e.g. ["\u62C9\u62C9\u718A", "rilakkuma", "\u7D68\u6BDB", "plush", "\u7C89\u7D05\u8272", "pink", "\u8349\u8393"]. Keep Chinese tags unspaced and English tags lowercase.
- Do not guess "size" from an image with nothing to judge scale against \u2014 null is the better answer.
- If you cannot confidently determine a field, use null (or an empty array) rather than guessing wildly.`;
function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean);
  const match = allowed.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
__name(corsHeaders, "corsHeaders");
function json(body, status, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" }
  });
}
__name(json, "json");
function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Model did not return JSON: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text.slice(start, end + 1));
}
__name(extractJson, "extractJson");
var src_default = {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (!cors["Access-Control-Allow-Origin"]) {
      return json({ error: "\u4F86\u6E90\u672A\u6388\u6B0A" }, 403, cors);
    }
    const url = new URL(request.url);
    if (!env.GROQ_API_KEY) {
      console.error("GROQ_API_KEY is not set: `wrangler secret put GROQ_API_KEY`, or .dev.vars locally");
      return json({ error: "AI \u8FA8\u8B58\u670D\u52D9\u5C1A\u672A\u8A2D\u5B9A\u5B8C\u6210" }, 503, cors);
    }
    const limit = Number(env.DAILY_LIMIT ?? DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const authorization = request.headers.get("Authorization") ?? "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ error: "\u8ACB\u5148\u767B\u5165" }, 401, cors);
    let uid;
    try {
      ({ uid } = await verifyIdToken(token, env.FIREBASE_PROJECT_ID));
    } catch (error) {
      const message = error instanceof TokenError ? error.message : "\u767B\u5165\u6191\u8B49\u9A57\u8B49\u5931\u6557";
      return json({ error: message }, 401, cors);
    }
    if (url.pathname === "/usage" && request.method === "GET") {
      return json({ usage: await getUsage(env.USAGE, uid, limit) }, 200, cors);
    }
    if (url.pathname !== "/analyze" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, cors);
    }
    const usage = await getUsage(env.USAGE, uid, limit);
    if (usage.remaining <= 0) {
      return json({ error: "AI \u984D\u5EA6\u4E0D\u8DB3\uFF0C\u8ACB\u6D3D\u8A62\u7BA1\u7406\u54E1", usage }, 429, cors);
    }
    let image;
    try {
      const body = await request.json();
      if (typeof body.image !== "string" || !body.image.startsWith("data:image/")) {
        return json({ error: "\u7167\u7247\u683C\u5F0F\u4E0D\u6B63\u78BA" }, 400, cors);
      }
      if (body.image.length > MAX_IMAGE_BYTES) {
        return json({ error: "\u7167\u7247\u592A\u5927\uFF0C\u8ACB\u91CD\u65B0\u9078\u64C7" }, 413, cors);
      }
      image = body.image;
    } catch {
      return json({ error: "\u8ACB\u6C42\u5167\u5BB9\u4E0D\u6B63\u78BA" }, 400, cors);
    }
    const groq = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: SYSTEM_PROMPT },
              { type: "image_url", image_url: { url: image } }
            ]
          }
        ]
      })
    });
    if (groq.status === 429) {
      return json({ error: "AI \u984D\u5EA6\u4E0D\u8DB3\uFF0C\u8ACB\u6D3D\u8A62\u7BA1\u7406\u54E1", usage }, 429, cors);
    }
    if (!groq.ok) {
      console.error("Groq error", groq.status, await groq.text());
      return json({ error: "AI \u8FA8\u8B58\u670D\u52D9\u66AB\u6642\u7121\u6CD5\u4F7F\u7528" }, 502, cors);
    }
    let suggestion;
    try {
      const payload = await groq.json();
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Unexpected Groq response shape");
      suggestion = extractJson(content);
    } catch (error) {
      console.error("Groq parse", error);
      return json({ error: "AI \u56DE\u50B3\u7684\u5167\u5BB9\u7121\u6CD5\u89E3\u6790\uFF0C\u8ACB\u518D\u8A66\u4E00\u6B21" }, 502, cors);
    }
    const updated = await recordUse(env.USAGE, uid, limit);
    return json({ suggestion, usage: updated }, 200, cors);
  }
};

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-bn7jRV/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-bn7jRV/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
