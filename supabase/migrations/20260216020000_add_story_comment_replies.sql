alter table public.story_comments
  add column if not exists reply_to_comment_id uuid references public.story_comments(id) on delete set null;

create index if not exists story_comments_reply_parent_idx
  on public.story_comments(story_id, reply_to_comment_id, created_at);
