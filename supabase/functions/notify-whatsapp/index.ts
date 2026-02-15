import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') ?? '';
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get('TWILIO_MESSAGING_SERVICE_SID') ?? '';
const TWILIO_WHATSAPP_TEMPLATE_SID = Deno.env.get('TWILIO_WHATSAPP_TEMPLATE_SID') ?? '';
const WHATSAPP_ALLOWED_ORIGINS = Deno.env.get('WHATSAPP_ALLOWED_ORIGINS') ?? '';
const CONFIG_KEY = 'loveboard_private';

const DEFAULT_ALLOWED_ORIGINS = ['https://yani.love'];
const ALLOWED_ORIGINS = new Set(
  (WHATSAPP_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for notify-whatsapp');
}
if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN for notify-whatsapp');
}
if (!TWILIO_WHATSAPP_FROM && !TWILIO_MESSAGING_SERVICE_SID) {
  console.error('Missing TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID for notify-whatsapp');
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
    if (!isOriginAllowed(req)) {
      return new Response('Origin not allowed', { status: 403, headers: corsHeaders });
    }
    if (!supabase) {
      return new Response('Supabase not configured', { status: 500, headers: corsHeaders });
    }
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      return new Response('Twilio not configured', { status: 500, headers: corsHeaders });
    }
    if (!TWILIO_WHATSAPP_FROM && !TWILIO_MESSAGING_SERVICE_SID) {
      return new Response('Twilio sender not configured', { status: 500, headers: corsHeaders });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const { type, sender, teaser, link, action } = body as {
      type?: string;
      sender?: string;
      teaser?: string;
      link?: string;
      action?: string;
    };
    if (!sender || (!type && !action)) {
      return new Response('Missing sender or activity type', { status: 400, headers: corsHeaders });
    }

    const config = await loadAppConfig();
    if (!config) {
      return new Response('Missing app config', { status: 400, headers: corsHeaders });
    }

    const users = config.users || {};
    const userAId = users.a?.id || 'user_a';
    const userBId = users.b?.id || 'user_b';
    const whatsapp = config.whatsapp || {};
    if (whatsapp.enabled === false) {
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const numberA = String(whatsapp.a || '').trim();
    const numberB = String(whatsapp.b || '').trim();
    if (!numberA || !numberB) {
      return new Response('Missing WhatsApp numbers', { status: 400, headers: corsHeaders });
    }

    const isSenderA = isSameUser(sender, userAId, users.a?.display, 'a');
    const isSenderB = isSameUser(sender, userBId, users.b?.display, 'b');

    let toNumber = '';
    let senderName = '';
    if (isSenderA) {
      toNumber = numberB;
      senderName = users.a?.display || userAId;
    } else if (isSenderB) {
      toNumber = numberA;
      senderName = users.b?.display || userBId;
    } else {
      return new Response(`Unknown sender: ${String(sender)}`, { status: 400, headers: corsHeaders });
    }

    const message = buildMessage({
      type,
      action,
      senderName,
      teaser,
      link,
      includeLink: !TWILIO_WHATSAPP_TEMPLATE_SID
    });
    const result = await sendTwilioMessage(toNumber, message);
    return new Response(JSON.stringify({ ok: true, sid: result.sid || null }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('notify-whatsapp unexpected error', error);
    return new Response('Unexpected error', { status: 500, headers: corsHeaders });
  }
});

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.size && origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : Array.from(ALLOWED_ORIGINS)[0] || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function isOriginAllowed(req: Request) {
  if (!ALLOWED_ORIGINS.size) return true;
  const origin = req.headers.get('origin') || '';
  return origin ? ALLOWED_ORIGINS.has(origin) : false;
}

async function loadAppConfig() {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle();
    if (error) return null;
    return data?.value || null;
  } catch {
    return null;
  }
}

function buildMessage({
  type,
  action,
  senderName,
  teaser,
  link,
  includeLink = true
}: {
  type?: string;
  action?: string;
  senderName: string;
  teaser?: string;
  link?: string;
  includeLink?: boolean;
}) {
  const cleanTeaser = clipText(teaser || '', 160);
  let line = '';
  switch (action) {
    case 'postcard:new':
      line = `New postcard from ${senderName}.`;
      break;
    case 'postcard:delete':
      line = `${senderName} deleted a postcard.`;
      break;
    case 'story:generate':
      line = `New story from ${senderName}.`;
      break;
    case 'story:save':
      line = `${senderName} saved a story.`;
      break;
    case 'story:delete':
      line = `${senderName} deleted a story.`;
      break;
    case 'storyReaction:add':
      line = `${senderName} reacted to a story.`;
      break;
    case 'storyReaction:remove':
      line = `${senderName} removed a story reaction.`;
      break;
    case 'storyComment:new':
      line = `${senderName} left a story comment.`;
      break;
    case 'storyComment:delete':
      line = `${senderName} deleted a story comment.`;
      break;
    case 'mood:update':
      line = `${senderName} updated their mood.`;
      break;
    case 'reaction:add':
      line = `${senderName} reacted.`;
      break;
    case 'reaction:remove':
      line = `${senderName} removed a reaction.`;
      break;
    case 'commentReaction:add':
      line = `${senderName} reacted to a comment.`;
      break;
    case 'commentReaction:remove':
      line = `${senderName} removed a comment reaction.`;
      break;
    case 'comment:new':
      line = `${senderName} left a comment.`;
      break;
    case 'comment:update':
      line = `${senderName} edited a comment.`;
      break;
    case 'comment:delete':
      line = `${senderName} deleted a comment.`;
      break;
    default:
      line = '';
  }
  if (!line) {
    if (type === 'story') {
      line = `New story from ${senderName}.`;
    } else if (type === 'postcard') {
      line = `New postcard from ${senderName}.`;
    } else {
      line = `New update from ${senderName}.`;
    }
  }
  if (cleanTeaser) {
    line = `${line} ${cleanTeaser}`;
  }
  const cleanLink = includeLink ? (link || '').trim() : '';
  return cleanLink ? `${line}\n${cleanLink}` : line;
}

function clipText(value: string, max: number) {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const limit = Math.max(4, max);
  return `${clean.slice(0, limit - 3).trim()}...`;
}

function normalizeUserKey(value: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
}

function isSameUser(sender: string, userId: string, displayName: string | undefined, slot: 'a' | 'b') {
  const normalizedSender = normalizeUserKey(sender);
  if (!normalizedSender) return false;
  const normalizedId = normalizeUserKey(userId);
  const normalizedDisplay = normalizeUserKey(displayName || '');
  if (normalizedId && normalizedSender === normalizedId) return true;
  if (normalizedDisplay && normalizedSender === normalizedDisplay) return true;
  if (slot === 'a' && ['a', 'usera'].includes(normalizedSender)) return true;
  if (slot === 'b' && ['b', 'userb'].includes(normalizedSender)) return true;
  return false;
}

function formatWhatsAppNumber(value: string) {
  const clean = String(value || '').trim();
  if (!clean) return '';
  return clean.startsWith('whatsapp:') ? clean : `whatsapp:${clean}`;
}

async function sendTwilioMessage(toNumber: string, body: string) {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams();
  params.set('To', formatWhatsAppNumber(toNumber));
  if (TWILIO_MESSAGING_SERVICE_SID) {
    params.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
  } else {
    params.set('From', formatWhatsAppNumber(TWILIO_WHATSAPP_FROM));
  }
  if (TWILIO_WHATSAPP_TEMPLATE_SID) {
    params.set('ContentSid', TWILIO_WHATSAPP_TEMPLATE_SID);
    params.set('ContentVariables', JSON.stringify({ 1: clipText(body, 900) }));
  } else {
    params.set('Body', body);
  }

  const auth = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as { message?: string })?.message || 'Twilio request failed';
    throw new Error(message);
  }
  return data as { sid?: string };
}
