// Supabase Edge Function to send Web Push notifications
// Requires environment variables:
// VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, SUPABASE_SERVICE_ROLE_KEY

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import webpush from 'npm:web-push';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing Supabase service role configuration');
}
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.error('Missing VAPID configuration');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
webpush.setVapidDetails('mailto:hello@loveboard.local', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

type Payload = {
  targetUser?: string;
  title?: string;
  body?: string;
};

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Only POST', { status: 405 });
  }

  const payload = (await req.json()) as Payload;
  if (!payload?.targetUser || !payload?.title || !payload?.body) {
    return new Response('Missing fields', { status: 400 });
  }

  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user', payload.targetUser);

  if (error) {
    console.error('Subscription fetch error', error);
    return new Response('Fetch failed', { status: 500 });
  }

  if (!subs || subs.length === 0) {
    return new Response('No subscriptions', { status: 200 });
  }

  const sendPromises = subs.map(async (row) => {
    try {
      await webpush.sendNotification(row.subscription, JSON.stringify({
        title: payload.title,
        body: payload.body
      }));
    } catch (err) {
      console.error('Push send failed', err);
    }
  });

  await Promise.all(sendPromises);
  return new Response('ok', { status: 200 });
});
