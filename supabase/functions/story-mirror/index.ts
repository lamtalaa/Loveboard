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
    chapter_count: String(chapterCount)
  });

  try {
    const data = await openaiRequest('https://api.openai.com/v1/responses', {
      model: STORY_MODEL,
      input: prompt,
      max_output_tokens: 2800
    }, STORY_TEXT_TIMEOUT_MS);
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
    const data = await openaiRequest('https://api.openai.com/v1/images/generations', {
      model: STORY_IMAGE_MODEL,
      prompt,
      size: '1024x1024',
      quality: 'medium'
    }, STORY_IMAGE_TIMEOUT_MS);
    const encoded = data?.data?.[0]?.b64_json;
    if (!encoded) {
      return new Response('No image returned', { status: 502, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ image: `data:image/png;base64,${encoded}` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('story-mirror image error', error);
    if (isTimeoutError(error)) {
      return new Response('Image generation timed out. Please try again.', { status: 504, headers: corsHeaders });
    }
    const message = error instanceof Error && error.message
      ? error.message
      : 'Failed to generate image';
    return new Response(message, { status: 502, headers: corsHeaders });
  }
}

function isTimeoutError(error: unknown) {
  return error instanceof Error && error.name === 'TimeoutError';
}

async function openaiRequest(url: string, payload: Record<string, unknown>, timeoutMs: number) {
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
      throw error;
    });
  } finally {
    clearTimeout(timer);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { error?: { message?: string } })?.error?.message ?? 'OpenAI request failed.';
    throw new Error(message);
  }
  return data;
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
  if (!supabase) return fallback;
  try {
    const { data, error } = await supabase.from('app_config').select('value').eq('key', key).maybeSingle();
    if (error || !data?.value) return fallback;
    return typeof data.value === 'string' ? data.value : fallback;
  } catch {
    return fallback;
  }
}

async function loadProfileConfig() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', PROFILE_CONFIG_KEY)
      .maybeSingle();
    if (error) return null;
    return data?.value || null;
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
