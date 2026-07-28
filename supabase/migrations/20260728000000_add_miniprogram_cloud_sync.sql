create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique references auth.users(id) on delete cascade,
  wechat_account_id uuid unique references public.wechat_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_users force row level security;
revoke all on table public.app_users from anon;
revoke all on table public.app_users from authenticated;

create index if not exists app_users_supabase_user_id_idx
  on public.app_users (supabase_user_id)
  where supabase_user_id is not null;

create index if not exists app_users_wechat_account_id_idx
  on public.app_users (wechat_account_id)
  where wechat_account_id is not null;

insert into public.app_users (id, supabase_user_id)
select id, id from auth.users
on conflict (id) do nothing;

create or replace function public.ensure_app_user_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, supabase_user_id)
  values (new.id, new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_app_user_after_auth_user_created on auth.users;

create trigger ensure_app_user_after_auth_user_created
after insert on auth.users
for each row
execute function public.ensure_app_user_for_auth_user();

alter table public.dream_records
  add column if not exists deleted_at timestamptz,
  add column if not exists synced_at timestamptz;

alter table public.dream_records
  drop constraint if exists dream_records_user_id_fkey;

alter table public.dream_records
  add constraint dream_records_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete cascade;

create unique index if not exists dream_records_user_local_record_id_idx
  on public.dream_records (user_id, local_record_id);

create index if not exists dream_records_user_deleted_at_idx
  on public.dream_records (user_id, deleted_at);

create index if not exists dream_records_user_synced_at_idx
  on public.dream_records (user_id, synced_at desc);
