const SUPABASE_URL = window.__SUPABASE_URL__ || 'https://ijwxlyoxhlmlysfjzksl.supabase.co';
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__ || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlqd3hseW94aGxtbHlzZmp6a3NsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MTMzMTgsImV4cCI6MjA3ODk4OTMxOH0.1UUriMLsy0uplz85u5wEOAjQ5kJoxOxE-Fg6kMmSpNE';

export const supabase = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
