alter table public.dream_records
  add column if not exists local_record_id text not null default gen_random_uuid()::text,
  add column if not exists source text not null default 'local_storage',
  add column if not exists sync_status text not null default 'synced';

create unique index if not exists dream_records_user_local_record_id_idx
  on public.dream_records (user_id, local_record_id);

create index if not exists dream_records_user_sync_status_idx
  on public.dream_records (user_id, sync_status);
