const LOVE_SUPABASE_URL = window.__SUPABASE_URL__;
const LOVE_SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;

export const supabase = window.supabase.createClient(
  LOVE_SUPABASE_URL,
  LOVE_SUPABASE_ANON_KEY
);
