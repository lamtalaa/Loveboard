create table if not exists public.story_reactions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_chronicles(id) on delete cascade,
  "user" text not null,
  reaction text not null,
  created_at timestamptz not null default now(),
  unique (story_id, "user")
);

create index if not exists story_reactions_story_id_idx on public.story_reactions(story_id);

create table if not exists public.story_comments (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.story_chronicles(id) on delete cascade,
  "user" text not null,
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists story_comments_story_id_idx on public.story_comments(story_id);

alter table public.story_reactions enable row level security;
alter table public.story_comments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_reactions' and policyname = 'story_reactions_select_all'
  ) then
    create policy story_reactions_select_all on public.story_reactions for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_reactions' and policyname = 'story_reactions_insert_all'
  ) then
    create policy story_reactions_insert_all on public.story_reactions for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_reactions' and policyname = 'story_reactions_delete_all'
  ) then
    create policy story_reactions_delete_all on public.story_reactions for delete using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_select_all'
  ) then
    create policy story_comments_select_all on public.story_comments for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_insert_all'
  ) then
    create policy story_comments_insert_all on public.story_comments for insert with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'story_comments' and policyname = 'story_comments_delete_all'
  ) then
    create policy story_comments_delete_all on public.story_comments for delete using (true);
  end if;
end;
$$;

alter table public.story_reactions replica identity full;
alter table public.story_comments replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'story_reactions'
  ) then
    alter publication supabase_realtime add table public.story_reactions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'story_comments'
  ) then
    alter publication supabase_realtime add table public.story_comments;
  end if;
end;
$$;
