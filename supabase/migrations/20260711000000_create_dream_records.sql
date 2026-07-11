create extension if not exists pgcrypto;

create table if not exists public.dream_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  raw_dream_text text not null,
  dream_summary text,
  emotions text[] not null default '{}',
  symbols text[] not null default '{}',
  sleep_quality text not null default '未记录',
  analysis_type text not null,
  report_content jsonb not null default '{}'::jsonb
);

alter table public.dream_records enable row level security;
alter table public.dream_records force row level security;

create index if not exists dream_records_user_created_at_idx
  on public.dream_records (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_dream_records_updated_at on public.dream_records;

create trigger set_dream_records_updated_at
before update on public.dream_records
for each row
execute function public.set_updated_at();

drop policy if exists "Users can read own dream records" on public.dream_records;
drop policy if exists "Users can insert own dream records" on public.dream_records;
drop policy if exists "Users can update own dream records" on public.dream_records;
drop policy if exists "Users can delete own dream records" on public.dream_records;

create policy "Users can read own dream records"
on public.dream_records
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own dream records"
on public.dream_records
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own dream records"
on public.dream_records
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Users can delete own dream records"
on public.dream_records
for delete
to authenticated
using (auth.uid() = user_id);
