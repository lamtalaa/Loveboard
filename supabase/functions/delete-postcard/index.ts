import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing Supabase configuration for delete-postcard');
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const CHILD_TABLES = ['postcard_comments', 'postcard_reactions', 'comment_reactions'];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Only POST allowed', { status: 405, headers: corsHeaders });
  }

  const { postcardId } = await req.json().catch(() => ({ postcardId: null }));
  if (!postcardId) {
    return new Response('Missing postcardId', { status: 400, headers: corsHeaders });
  }

  for (const table of CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq('postcard_id', postcardId);
    if (error && !isMissingTableError(error)) {
      console.error(`${table} delete failed`, error);
      return new Response(error.message, { status: 400, headers: corsHeaders });
    }
  }

  const { error: postcardError } = await supabase.from('postcards').delete().eq('id', postcardId);
  if (postcardError) {
    console.error('postcard delete failed', postcardError);
    return new Response(postcardError.message, { status: 400, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});

function isMissingTableError(error: { message?: string; code?: string } | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return error.code === '42P01' || message.includes('does not exist');
}
