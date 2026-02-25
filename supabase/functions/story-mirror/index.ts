import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') ?? '';
const STORY_MODEL = Deno.env.get('OPENAI_STORY_MODEL') ?? 'gpt-5';
const STORY_IMAGE_MODEL = Deno.env.get('OPENAI_IMAGE_MODEL') ?? 'gpt-image-1';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const STORY_PROMPT_KEY = 'storymirror_prompt_template';
const PROFILE_CONFIG_KEY = 'loveboard_private';
const STORY_ALLOWED_ORIGINS = Deno.env.get('STORY_ALLOWED_ORIGINS') ?? '';
const STORY_TEXT_TIMEOUT_MS = Number(Deno.env.get('STORY_TEXT_TIMEOUT_MS') ?? '25000');
const STORY_IMAGE_TIMEOUT_MS = Number(Deno.env.get('STORY_IMAGE_TIMEOUT_MS') ?? '30000');
const STORY_IMAGE_SIZE = Deno.env.get('STORY_IMAGE_SIZE') ?? '512x512';
const STORY_IMAGE_QUALITY = Deno.env.get('STORY_IMAGE_QUALITY') ?? 'low';
const STORY_IMAGE_BUCKET = Deno.env.get('STORY_IMAGE_BUCKET') ?? 'loveboard-assets';
const STORY_IMAGE_FOLDER = Deno.env.get('STORY_IMAGE_FOLDER') ?? 'story-images';
const STORY_CONFIG_CACHE_TTL_MS = Number(Deno.env.get('STORY_CONFIG_CACHE_TTL_MS') ?? '60000');
const STORY_UPLOAD_IMAGES = (Deno.env.get('STORY_UPLOAD_IMAGES') ?? 'true').toLowerCase() !== 'false';
const STORY_TEXT_ATTEMPTS = sanitizeAttempts(Deno.env.get('STORY_TEXT_ATTEMPTS'), 3);
const STORY_IMAGE_ATTEMPTS = sanitizeAttempts(Deno.env.get('STORY_IMAGE_ATTEMPTS'), 4);
const STORY_RETRY_BASE_MS = sanitizeDelay(Deno.env.get('STORY_RETRY_BASE_MS'), 450);
const STORY_RETRY_MAX_MS = sanitizeDelay(Deno.env.get('STORY_RETRY_MAX_MS'), 3200);

const DEFAULT_ALLOWED_ORIGINS = [
  'https://yani.love',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];
const ALLOWED_ORIGINS = new Set(
  (STORY_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.has(origin)
    ? origin
    : Array.from(ALLOWED_ORIGINS)[0] || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

if (!OPENAI_API_KEY) {
  console.error('Missing OPENAI_API_KEY for story-mirror');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for story-mirror');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

const promptTemplateCache = new Map<string, { value: string; expiresAt: number }>();
let profileConfigCache: { value: unknown; expiresAt: number } | null = null;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  try {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    if (req.method !== 'POST') {
      return new Response('Only POST allowed', { status: 405, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { action } = body;
    if (action === 'text') {
      return await handleText(body, corsHeaders);
    }
    if (action === 'image') {
      return await handleImage(body, corsHeaders);
    }
    return new Response('Unknown action', { status: 400, headers: corsHeaders });
  } catch (error) {
    console.error('story-mirror unexpected error', error);
    return new Response('Unexpected error', { status: 500, headers: corsHeaders });
  }
});

async function handleText(
  body: {
    yFragments?: string[];
    nFragments?: string[];
    eventSpine?: unknown;
    perspective?: string;
    lens?: string;
    fantasy?: string;
    intimacy?: string;
    chapterCount?: number;
    profileY?: string;
    profileN?: string;
    extraDetails?: string;
  },
  corsHeaders: Record<string, string>
) {
  const yFragments = Array.isArray(body.yFragments) ? body.yFragments : [];
  const nFragments = Array.isArray(body.nFragments) ? body.nFragments : [];
  const perspective = body.perspective || 'us';
  const lens = body.lens || 'soft, romantic, and tender';
  const fantasy = body.fantasy || 'balanced: realistic with soft cinematic wonder';
  const intimacy = body.intimacy || 'tender';
  const profileY = body.profileY || '';
  const profileN = body.profileN || '';
  const extraDetails = body.extraDetails || '';
  const eventSpineJson = serializeEventSpine(body.eventSpine);
  const requestedChapters =
    typeof body.chapterCount === 'number' ? Math.round(body.chapterCount) : 4;

  if (!yFragments.length && !nFragments.length) {
    return new Response('Missing fragments', { status: 400, headers: corsHeaders });
  }

  const config = await loadProfileConfig();
  const nameA = config?.users?.a?.display || config?.users?.a?.id || 'Partner A';
  const nameB = config?.users?.b?.display || config?.users?.b?.id || 'Partner B';

  const chapterCount = Math.min(Math.max(requestedChapters, 3), 10);
  const intimacyDirection = describeIntimacy(intimacy);
  const promptTemplate = await loadPromptTemplate(
    STORY_PROMPT_KEY,
    DEFAULT_STORY_PROMPT_TEMPLATE
  );
  const perspectiveLabel = formatPerspective(perspective, nameA, nameB);
  const prompt = renderTemplate(promptTemplate, {
    name_a: nameA,
    name_b: nameB,
    lens,
    fantasy,
    perspective: perspectiveLabel,
    intimacy: intimacyDirection,
    profile_a: profileY,
    profile_b: profileN,
    fragments_a: yFragments.join(' | '),
    fragments_b: nFragments.join(' | '),
    extra_details: extraDetails,
    event_spine_json: eventSpineJson,
    chapter_count: String(chapterCount)
  });

  try {
    const data = await openaiRequestWithRetry('https://api.openai.com/v1/responses', {
      model: STORY_MODEL,
      input: prompt,
      max_output_tokens: 2800
    }, STORY_TEXT_TIMEOUT_MS, STORY_TEXT_ATTEMPTS, 'text');
    const text = extractOutputText(data);
    const jsonText = extractJson(text);
    const parsed = JSON.parse(jsonText);
    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('story-mirror text error', error);
    if (isTimeoutError(error)) {
      return new Response('Story generation timed out. Please try again.', { status: 504, headers: corsHeaders });
    }
    const message = error instanceof Error && error.message
      ? error.message
      : 'Failed to generate story';
    return new Response(message, { status: 502, headers: corsHeaders });
  }
}

async function handleImage(
  body: { prompt?: string },
  corsHeaders: Record<string, string>
) {
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return new Response('Missing prompt', { status: 400, headers: corsHeaders });
  }
  try {
    const imagePayload: StoryImagePayload = {
      model: STORY_IMAGE_MODEL,
      prompt,
      size: STORY_IMAGE_SIZE,
      quality: STORY_IMAGE_QUALITY
    };
    let data: unknown = null;
    try {
      data = await requestStoryImageGeneration(imagePayload, 'image');
    } catch (primaryError) {
      if (!isImageSafetyError(primaryError)) {
        throw primaryError;
      }
      const fallbackPrompts = buildSafeImagePromptVariants(prompt);
      let recovered = false;
      let lastError: unknown = primaryError;
      for (let i = 0; i < fallbackPrompts.length; i += 1) {
        const safePrompt = fallbackPrompts[i];
        try {
          console.warn(`story-mirror image safety fallback ${i + 1}/${fallbackPrompts.length}`);
          data = await requestStoryImageGeneration(
            {
              ...imagePayload,
              prompt: safePrompt
            },
            `image:safety-fallback-${i + 1}`
          );
          recovered = true;
          break;
        } catch (fallbackError) {
          lastError = fallbackError;
          if (!isImageSafetyError(fallbackError)) {
            throw fallbackError;
          }
        }
      }
      if (!recovered) {
        throw lastError;
      }
    }
    const encoded = (data as { data?: Array<{ b64_json?: string }> })?.data?.[0]?.b64_json;
    if (!encoded) {
      return new Response('No image returned', { status: 502, headers: corsHeaders });
    }
    const uploadedImage = STORY_UPLOAD_IMAGES ? await uploadStoryImageToStorage(encoded) : '';
    if (uploadedImage) {
      return new Response(JSON.stringify({ image: uploadedImage, source: 'storage' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ image: `data:image/png;base64,${encoded}`, source: 'inline' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('story-mirror image error', error);
    if (isTimeoutError(error)) {
      return new Response('Image generation timed out. Please try again.', { status: 504, headers: corsHeaders });
    }
    if (isImageSafetyError(error)) {
      return new Response('Image blocked by safety policy after fallback tuning.', {
        status: 422,
        headers: corsHeaders
      });
    }
    const message = error instanceof Error && error.message
      ? error.message
      : 'Failed to generate image';
    return new Response(message, { status: 502, headers: corsHeaders });
  }
}

function sanitizeCacheTtlMs(raw: number) {
  if (!Number.isFinite(raw)) return 60000;
  return Math.min(300000, Math.max(0, Math.round(raw)));
}

function getStoryConfigCacheTtlMs() {
  return sanitizeCacheTtlMs(STORY_CONFIG_CACHE_TTL_MS);
}

function buildStoryImagePath() {
  const base = String(STORY_IMAGE_FOLDER || 'story-images').replace(/^\/+|\/+$/g, '') || 'story-images';
  return `${base}/${crypto.randomUUID()}.png`;
}

function base64ToBytes(base64: string) {
  const clean = String(base64 || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function uploadStoryImageToStorage(base64: string) {
  if (!supabase) return '';
  try {
    const bytes = base64ToBytes(base64);
    const path = buildStoryImagePath();
    const { error } = await supabase.storage.from(STORY_IMAGE_BUCKET).upload(path, bytes, {
      upsert: false,
      contentType: 'image/png',
      cacheControl: '3600'
    });
    if (error) {
      console.warn('story-mirror image upload failed', error.message || error);
      return '';
    }
    const { data } = supabase.storage.from(STORY_IMAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl || '';
  } catch (error) {
    console.warn('story-mirror image upload failed', error);
    return '';
  }
}

type StoryImagePayload = {
  model: string;
  prompt: string;
  size: string;
  quality: string;
};

async function requestStoryImageGeneration(payload: StoryImagePayload, label: string) {
  try {
    return await openaiRequestWithRetry(
      'https://api.openai.com/v1/images/generations',
      payload,
      STORY_IMAGE_TIMEOUT_MS,
      STORY_IMAGE_ATTEMPTS,
      label
    );
  } catch (primaryError) {
    const nonDefaultSize = payload.size !== '1024x1024';
    if (!isImageSizeError(primaryError) || !nonDefaultSize) {
      throw primaryError;
    }
    // Some image models reject smaller custom sizes. Retry once with a safe default.
    return await openaiRequestWithRetry(
      'https://api.openai.com/v1/images/generations',
      {
        ...payload,
        size: '1024x1024'
      },
      STORY_IMAGE_TIMEOUT_MS,
      STORY_IMAGE_ATTEMPTS,
      `${label}:size-fallback`
    );
  }
}

function isImageSizeError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('size') || message.includes('resolution');
}

function isImageSafetyError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const withStatus = error as Error & { status?: number };
  const status = Number(withStatus.status);
  if (Number.isFinite(status) && status !== 400 && status !== 403) {
    return false;
  }
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('safety') ||
    message.includes('safety_violations') ||
    message.includes('sexual') ||
    message.includes('nudity') ||
    message.includes('adult') ||
    message.includes('content policy') ||
    message.includes('policy')
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message || '';
  return String(error || '');
}

function buildSafeImagePromptVariants(prompt: string) {
  const tonedBase = softenImagePrompt(prompt);
  const contextualBase = tonedBase || 'romantic cinematic scene of two adult partners';
  const variants = [
    `${contextualBase}. Keep the same scene context, setting, and emotional tone. Two fully clothed consenting adults, romantic and tasteful, non-sexual, no nudity, no explicit body focus, dreamy-realistic, no text.`,
    `Reframe this same scene as PG-13 romance: ${contextualBase}. Preserve location, time-of-day, and atmosphere from the original context. Two fully clothed adults, intimate but non-sexual, no nudity, no explicit anatomy, no text.`,
    `Use the original scene context from this prompt and keep its visual identity: ${contextualBase}. Show an emotionally close, cinematic romance moment between two fully clothed adults, non-sexual, no nudity, no explicit content, no text.`
  ]
    .map((value) => value.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const deduped: string[] = [];
  variants.forEach((value) => {
    if (!deduped.includes(value)) {
      deduped.push(value);
    }
  });
  return deduped;
}

function softenImagePrompt(value: string) {
  const replacements: Array<[RegExp, string]> = [
    [/\b(doggy\s*style|cow\s*girl|missionary|oral sex|anal sex|penetration|blowjob|deepthroat)\b/gi, 'tender embrace'],
    [/\b(fuck(?:ing|ed)?|slut|bitch)\b/gi, 'intense emotion'],
    [/\b(cock|dick|penis|pussy|vagina|asshole|ass|tits?|boobs?|breasts?|nipple?s?)\b/gi, 'presence'],
    [/\b(nude|nudity|naked|undress(?:ed|ing)?|bare skin)\b/gi, 'fully clothed'],
    [/\b(sexual|explicit|porn|fetish)\b/gi, 'romantic'],
    [/\b(thrust(?:ing|s)?|moan(?:ing|s)?|orgasm|cum)\b/gi, 'closeness']
  ];
  let next = String(value || '').replace(/\s+/g, ' ').trim();
  replacements.forEach(([pattern, replacement]) => {
    next = next.replace(pattern, replacement);
  });
  return next.replace(/\s+/g, ' ').trim();
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError';
}

async function openaiRequestWithRetry(
  url: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  attempts: number,
  label: string
) {
  const maxAttempts = Math.max(1, attempts);
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await openaiRequestOnce(url, payload, timeoutMs);
    } catch (error) {
      lastError = error;
      const retryable = isRetryableOpenAiError(error);
      if (!retryable || attempt >= maxAttempts) {
        throw error;
      }
      const waitMs = getRetryDelayMs(error, attempt);
      console.warn(`story-mirror ${label} retry ${attempt}/${maxAttempts - 1} in ${waitMs}ms`);
      await delay(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('OpenAI request failed.');
}

async function openaiRequestOnce(url: string, payload: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), Math.max(1000, timeoutMs));
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    }).catch((error) => {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new Error('Request timed out');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      const networkError = new Error(error instanceof Error ? error.message : 'Network request failed');
      networkError.name = 'NetworkError';
      throw networkError;
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message ?? 'OpenAI request failed.';
    const err = new Error(message) as Error & { status?: number; retryAfterMs?: number };
    err.name = 'OpenAIHttpError';
    err.status = response.status;
    const retryAfter = response.headers.get('retry-after');
    if (retryAfter) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds) && seconds >= 0) {
        err.retryAfterMs = Math.round(seconds * 1000);
      }
    }
    throw err;
  }
  return data;
}

function isRetryableOpenAiError(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (error.name === 'TimeoutError' || error.name === 'NetworkError') return true;
  const withStatus = error as Error & { status?: number };
  const status = Number(withStatus.status);
  if (!Number.isFinite(status)) return false;
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500;
}

function getRetryDelayMs(error: unknown, attempt: number) {
  if (error instanceof Error) {
    const withRetry = error as Error & { retryAfterMs?: number };
    if (Number.isFinite(withRetry.retryAfterMs) && (withRetry.retryAfterMs || 0) > 0) {
      return Math.min(STORY_RETRY_MAX_MS, Math.max(120, Number(withRetry.retryAfterMs)));
    }
  }
  const exp = Math.min(STORY_RETRY_MAX_MS, STORY_RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1)));
  const jitter = Math.round(exp * (0.25 + Math.random() * 0.35));
  return Math.min(STORY_RETRY_MAX_MS, exp + jitter);
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, Math.max(0, ms));
  });
}

function sanitizeAttempts(raw: string | null, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(6, Math.max(1, Math.round(value)));
}

function sanitizeDelay(raw: string | null, fallback: number) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(15000, Math.max(50, Math.round(value)));
}

function serializeEventSpine(eventSpine: unknown) {
  if (!Array.isArray(eventSpine) || !eventSpine.length) return '[]';
  const compact = eventSpine
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as {
        chapter_index?: unknown;
        date_time?: unknown;
        location?: unknown;
        weather_time?: unknown;
        key_events?: unknown;
      };
      const chapterIndex = Number(row.chapter_index);
      const keyEvents = Array.isArray(row.key_events)
        ? row.key_events.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 6)
        : [];
      return {
        chapter_index: Number.isInteger(chapterIndex) ? chapterIndex : 0,
        date_time: String(row.date_time || '').slice(0, 100),
        location: String(row.location || '').slice(0, 120),
        weather_time: String(row.weather_time || '').slice(0, 90),
        key_events: keyEvents
      };
    })
    .filter(Boolean)
    .slice(0, 16);
  return JSON.stringify(compact);
}

function extractOutputText(data: {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
}) {
  if (typeof data?.output_text === 'string') return data.output_text;
  const outputs = data?.output || [];
  let combined = '';
  outputs.forEach((item) => {
    (item.content || []).forEach((part) => {
      if (part.type === 'output_text' && part.text) {
        combined += part.text;
      }
    });
  });
  return combined;
}

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return '{}';
  return text.slice(start, end + 1);
}

const DEFAULT_STORY_PROMPT_TEMPLATE = `
You are writing a future love story for {{name_a}} and {{name_b}}, a long-distance couple imagining their life together.
Write as if the events already happened, with clear details. Use real future dates and places.
This is a consensual adult relationship. Keep consent explicit. Keep the tone intense, intimate, and emotionally powerful.
Use simple English for A2/B1 readers:
- Short sentences (8–14 words).
- Use common words only.
- Avoid rare words and complex metaphors.
- Keep grammar simple. No long clauses.
User input may be in any language, but the story must be written in English. Preserve the meaning of the input while writing in English.
Tone: {{lens}}. Fantasy balance: {{fantasy}}. Perspective: {{perspective}}.
Intimacy direction: {{intimacy}}.
EVENT_SPINE_JSON (authoritative facts to preserve when switching perspective): {{event_spine_json}}
When EVENT_SPINE_JSON is provided, preserve chapter order, dates, locations, weather, and key events exactly.
Only change the narrator viewpoint and emotional framing for the selected perspective.
{{name_a}} profile: {{profile_a}}
{{name_b}} profile: {{profile_b}}
{{name_a}} moments: {{fragments_a}}.
{{name_b}} moments: {{fragments_b}}.
Extra details: {{extra_details}}

Return valid JSON only. Schema:
{
  "story_title": "short overall title for the full story",
  "chapters": [
    {
      "title": "short title",
      "text": "120-220 words of narrative",
      "caption": "one line poetic caption for the image",
      "image_prompt": "cinematic, dreamy-realistic image prompt, no text"
    }
  ]
}
Return {{chapter_count}} chapters.
`.trim();

function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? '');
}

function formatPerspective(perspective: string, nameA: string, nameB: string) {
  if (perspective === 'a') return nameA;
  if (perspective === 'b') return nameB;
  if (perspective === 'us') return 'us';
  return perspective || 'us';
}

async function loadPromptTemplate(key: string, fallback: string) {
  const cached = promptTemplateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
    const value = !error && typeof data?.value === 'string' ? data.value : fallback;
    promptTemplateCache.set(key, {
      value,
      expiresAt: Date.now() + getStoryConfigCacheTtlMs()
    });
    return value;
  } catch {
    return fallback;
  }
}

async function loadProfileConfig() {
  if (profileConfigCache && profileConfigCache.expiresAt > Date.now()) {
    return profileConfigCache.value;
  }
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', PROFILE_CONFIG_KEY)
      .maybeSingle();
    const value = error ? null : data?.value || null;
    profileConfigCache = {
      value,
      expiresAt: Date.now() + getStoryConfigCacheTtlMs()
    };
    return value;
  } catch {
    return null;
  }
}

function describeIntimacy(value: string) {
  if (value === 'dark') {
    return 'explicit, intense, and sensual dark romance; include dominance/submission as consensual adult play; explicit language is allowed';
  }
  if (value === 'flirty') {
    return 'playful, flirtatious, and suggestive but not explicit';
  }
  return 'tender, romantic, and softly sensual';
}
