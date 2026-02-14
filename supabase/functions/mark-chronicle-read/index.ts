import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for mark-chronicle-read');
}

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

serve(async (req) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405, headers });
  }
  if (!supabase) {
    return new Response('Supabase not configured', { status: 500, headers });
  }
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return new Response('Invalid JSON', { status: 400, headers });
    }
    const { storyId, updates } = body as {
      storyId?: string;
      updates?: Record<string, string>;
    };
    if (!storyId || !updates || typeof updates !== 'object') {
      return new Response('Missing storyId or updates', { status: 400, headers });
    }
    const { error } = await supabase
      .from('story_chronicles')
      .update(updates)
      .eq('id', storyId);
    if (error) {
      return new Response(error.message, { status: 400, headers });
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('mark-chronicle-read error', err);
    return new Response('Unexpected error', { status: 500, headers });
  }
});
