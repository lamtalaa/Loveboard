do $$
declare
  fk record;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'story_comments'
      and column_name = 'reply_to_comment_id'
  ) then
    for fk in
      select conname
      from pg_constraint
      where conrelid = 'public.story_comments'::regclass
        and contype = 'f'
        and pg_get_constraintdef(oid) ilike '%(reply_to_comment_id)%'
    loop
      execute format('alter table public.story_comments drop constraint if exists %I', fk.conname);
    end loop;

    alter table public.story_comments
      add constraint story_comments_reply_to_comment_id_fkey
      foreign key (reply_to_comment_id)
      references public.story_comments(id)
      on delete cascade;
  end if;
end;
$$;
