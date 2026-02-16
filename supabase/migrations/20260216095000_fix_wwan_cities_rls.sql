alter table public.wwan_cities enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wwan_cities'
      and policyname = 'wwan_cities_select_all'
  ) then
    create policy wwan_cities_select_all
      on public.wwan_cities
      for select
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wwan_cities'
      and policyname = 'wwan_cities_insert_all'
  ) then
    create policy wwan_cities_insert_all
      on public.wwan_cities
      for insert
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wwan_cities'
      and policyname = 'wwan_cities_update_all'
  ) then
    create policy wwan_cities_update_all
      on public.wwan_cities
      for update
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'wwan_cities'
      and policyname = 'wwan_cities_delete_all'
  ) then
    create policy wwan_cities_delete_all
      on public.wwan_cities
      for delete
      using (true);
  end if;
end
$$;
