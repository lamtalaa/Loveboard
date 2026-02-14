alter table public.story_chronicles
  add column if not exists opened_by_a_at timestamptz,
  add column if not exists opened_by_b_at timestamptz,
  add column if not exists finished_by_a_at timestamptz,
  add column if not exists finished_by_b_at timestamptz;
