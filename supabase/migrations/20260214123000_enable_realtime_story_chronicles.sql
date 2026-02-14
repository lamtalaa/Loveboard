alter table public.story_chronicles replica identity full;

alter publication supabase_realtime add table public.story_chronicles;
