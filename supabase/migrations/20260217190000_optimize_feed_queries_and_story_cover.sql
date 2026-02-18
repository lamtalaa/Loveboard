alter table public.story_chronicles
  add column if not exists cover_image_url text;

update public.story_chronicles
set cover_image_url = images ->> 0
where cover_image_url is null
  and jsonb_typeof(images) = 'array'
  and coalesce(images ->> 0, '') ~* '^https?://';

create index if not exists postcards_created_at_idx
  on public.postcards(created_at desc);

create index if not exists story_chronicles_created_at_idx
  on public.story_chronicles(created_at desc);

create index if not exists postcard_reactions_postcard_id_idx
  on public.postcard_reactions(postcard_id);

create index if not exists postcard_comments_postcard_id_created_at_idx
  on public.postcard_comments(postcard_id, created_at);

create index if not exists comment_reactions_postcard_comment_idx
  on public.comment_reactions(postcard_id, comment_id);

create index if not exists story_reactions_story_id_idx
  on public.story_reactions(story_id);

create index if not exists story_comment_reactions_story_comment_idx
  on public.story_comment_reactions(story_id, comment_id);
