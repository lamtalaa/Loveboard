alter table public.story_chronicles enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'story_chronicles'
      and policyname = 'story_chronicles_select_all'
  ) then
    create policy story_chronicles_select_all
      on public.story_chronicles
      for select
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'story_chronicles'
      and policyname = 'story_chronicles_insert_all'
  ) then
    create policy story_chronicles_insert_all
      on public.story_chronicles
      for insert
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'story_chronicles'
      and policyname = 'story_chronicles_update_all'
  ) then
    create policy story_chronicles_update_all
      on public.story_chronicles
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'story_chronicles'
      and policyname = 'story_chronicles_delete_all'
  ) then
    create policy story_chronicles_delete_all
      on public.story_chronicles
      for delete
      using (true);
  end if;
end;
$$;
