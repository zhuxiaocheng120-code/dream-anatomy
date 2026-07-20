create table if not exists public.wechat_accounts (
  id uuid primary key default gen_random_uuid(),
  app_id text not null,
  openid_hash text not null,
  unionid_hash text,
  linked_supabase_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_login_at timestamptz not null default now(),
  disabled_at timestamptz,
  unique (app_id, openid_hash)
);

alter table public.wechat_accounts enable row level security;
alter table public.wechat_accounts force row level security;
revoke all on table public.wechat_accounts from anon;
revoke all on table public.wechat_accounts from authenticated;

create unique index if not exists wechat_accounts_unionid_hash_unique_idx
on public.wechat_accounts (unionid_hash)
where unionid_hash is not null;

create index if not exists wechat_accounts_linked_supabase_user_id_idx
on public.wechat_accounts (linked_supabase_user_id)
where linked_supabase_user_id is not null;

create table if not exists public.wechat_sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.wechat_accounts(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz
);

alter table public.wechat_sessions enable row level security;
alter table public.wechat_sessions force row level security;
revoke all on table public.wechat_sessions from anon;
revoke all on table public.wechat_sessions from authenticated;

create index if not exists wechat_sessions_account_id_idx
on public.wechat_sessions (account_id);

create index if not exists wechat_sessions_expires_at_idx
on public.wechat_sessions (expires_at);
