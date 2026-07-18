create extension if not exists pgcrypto;

create table if not exists public.legal_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  privacy_policy_version text not null,
  terms_version text not null,
  ai_disclaimer_version text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_legal_consents_updated_at on public.legal_consents;

create trigger set_legal_consents_updated_at
before update on public.legal_consents
for each row
execute function public.set_updated_at();

alter table public.legal_consents enable row level security;
alter table public.legal_consents force row level security;

drop policy if exists "Users can read own legal consents" on public.legal_consents;
drop policy if exists "Users can insert own legal consents" on public.legal_consents;
drop policy if exists "Users can update own legal consents" on public.legal_consents;

create policy "Users can read own legal consents"
on public.legal_consents
for select
to authenticated
using (auth.uid() = user_id);

create policy "Users can insert own legal consents"
on public.legal_consents
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Users can update own legal consents"
on public.legal_consents
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
