alter table public.story_comments
  add column if not exists chapter_index integer,
  add column if not exists start_offset integer,
  add column if not exists end_offset integer,
  add column if not exists selected_text text;

create index if not exists story_comments_story_anchor_idx
  on public.story_comments(story_id, chapter_index, created_at);
