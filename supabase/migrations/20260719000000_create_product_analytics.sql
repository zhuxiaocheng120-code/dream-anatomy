create table if not exists public.product_analytics_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  version text,
  updated_at timestamptz not null default now()
);

alter table public.product_analytics_preferences enable row level security;
alter table public.product_analytics_preferences force row level security;

drop policy if exists "product analytics preferences select own" on public.product_analytics_preferences;
create policy "product analytics preferences select own"
on public.product_analytics_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "product analytics preferences insert own" on public.product_analytics_preferences;
create policy "product analytics preferences insert own"
on public.product_analytics_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "product analytics preferences update own" on public.product_analytics_preferences;
create policy "product analytics preferences update own"
on public.product_analytics_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  event_name text not null,
  principal_type text not null,
  principal_hash text not null,
  session_hash text,
  client_platform text not null default 'web',
  properties jsonb not null default '{}'::jsonb,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;
alter table public.product_events force row level security;
revoke all on table public.product_events from anon;
revoke all on table public.product_events from authenticated;

create index if not exists product_events_occurred_at_idx on public.product_events (occurred_at);
create index if not exists product_events_event_name_idx on public.product_events (event_name);
create index if not exists product_events_principal_type_idx on public.product_events (principal_type);
create index if not exists product_events_principal_hash_occurred_at_idx on public.product_events (principal_hash, occurred_at);
