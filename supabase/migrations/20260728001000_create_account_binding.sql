create table if not exists public.account_binding_tokens (
  id uuid primary key default gen_random_uuid(),
  target_app_user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  created_at timestamptz not null default now(),
  request_correlation_id text not null
);

alter table public.account_binding_tokens enable row level security;
alter table public.account_binding_tokens force row level security;
revoke all on table public.account_binding_tokens from anon;
revoke all on table public.account_binding_tokens from authenticated;

create index if not exists account_binding_tokens_expires_at_idx
  on public.account_binding_tokens (expires_at);

create index if not exists account_binding_tokens_target_app_user_id_idx
  on public.account_binding_tokens (target_app_user_id);

create table if not exists public.account_binding_attempts (
  wechat_account_id uuid primary key references public.wechat_accounts(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.account_binding_attempts enable row level security;
alter table public.account_binding_attempts force row level security;
revoke all on table public.account_binding_attempts from anon;
revoke all on table public.account_binding_attempts from authenticated;

create index if not exists account_binding_attempts_locked_until_idx
  on public.account_binding_attempts (locked_until);

create or replace function public.confirm_wechat_account_binding(
  p_token_hash text,
  p_wechat_account_id uuid,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  binding_token public.account_binding_tokens%rowtype;
  target_user_id uuid;
  target_supabase_user_id uuid;
  target_wechat_account_id uuid;
  source_user_id uuid;
  linked_supabase_user_id uuid;
  binding_attempt public.account_binding_attempts%rowtype;
  source_record public.dream_records%rowtype;
  duplicate_record public.dream_records%rowtype;
  conflict_local_id text;
  next_failed_attempts integer;
  next_locked_until timestamptz;
  moved_count integer := 0;
  deduped_count integer := 0;
  conflict_count integer := 0;
begin
  select linked_supabase_user_id
    into linked_supabase_user_id
    from public.wechat_accounts
    where id = p_wechat_account_id
    for update;

  if not found then
    raise exception 'wechat_account_not_found';
  end if;

  insert into public.account_binding_attempts (wechat_account_id, updated_at)
    values (p_wechat_account_id, p_now)
    on conflict (wechat_account_id) do nothing;

  select *
    into binding_attempt
    from public.account_binding_attempts
    where wechat_account_id = p_wechat_account_id
    for update;

  if binding_attempt.locked_until is not null and binding_attempt.locked_until > p_now then
    return jsonb_build_object(
      'status', 'error',
      'errorCode', 'binding_token_locked'
    );
  end if;

  select *
    into binding_token
    from public.account_binding_tokens
    where token_hash = p_token_hash
    for update;

  if not found then
    update public.account_binding_attempts
      set failed_attempts = failed_attempts + 1,
          last_failed_at = p_now,
          locked_until = case
            when failed_attempts + 1 >= 5 then p_now + interval '10 minutes'
            else null
          end,
          updated_at = p_now
      where wechat_account_id = p_wechat_account_id
      returning failed_attempts, locked_until
      into next_failed_attempts, next_locked_until;

    return jsonb_build_object(
      'status', 'error',
      'errorCode', case
        when next_locked_until is not null then 'binding_token_locked'
        else 'binding_token_invalid'
      end
    );
  end if;

  if binding_token.used_at is not null then
    update public.account_binding_attempts
      set failed_attempts = failed_attempts + 1,
          last_failed_at = p_now,
          locked_until = case
            when failed_attempts + 1 >= 5 then p_now + interval '10 minutes'
            else null
          end,
          updated_at = p_now
      where wechat_account_id = p_wechat_account_id
      returning failed_attempts, locked_until
      into next_failed_attempts, next_locked_until;

    return jsonb_build_object(
      'status', 'error',
      'errorCode', case
        when next_locked_until is not null then 'binding_token_locked'
        else 'binding_token_used'
      end
    );
  end if;

  if binding_token.expires_at <= p_now then
    update public.account_binding_tokens
      set failed_attempts = failed_attempts + 1
      where id = binding_token.id;
    update public.account_binding_attempts
      set failed_attempts = failed_attempts + 1,
          last_failed_at = p_now,
          locked_until = case
            when failed_attempts + 1 >= 5 then p_now + interval '10 minutes'
            else null
          end,
          updated_at = p_now
      where wechat_account_id = p_wechat_account_id
      returning failed_attempts, locked_until
      into next_failed_attempts, next_locked_until;

    return jsonb_build_object(
      'status', 'error',
      'errorCode', case
        when next_locked_until is not null then 'binding_token_locked'
        else 'binding_token_expired'
      end
    );
  end if;

  if binding_token.failed_attempts >= 5 then
    return jsonb_build_object(
      'status', 'error',
      'errorCode', 'binding_token_locked'
    );
  end if;

  target_user_id := binding_token.target_app_user_id;

  select supabase_user_id, wechat_account_id
    into target_supabase_user_id, target_wechat_account_id
    from public.app_users
    where id = target_user_id
    for update;

  if target_supabase_user_id is null then
    raise exception 'target_user_not_found';
  end if;

  if target_wechat_account_id is not null and target_wechat_account_id <> p_wechat_account_id then
    return jsonb_build_object(
      'status', 'error',
      'errorCode', 'target_already_bound'
    );
  end if;

  if linked_supabase_user_id is not null and linked_supabase_user_id <> target_supabase_user_id then
    return jsonb_build_object(
      'status', 'error',
      'errorCode', 'wechat_account_already_bound'
    );
  end if;

  select id
    into source_user_id
    from public.app_users
    where wechat_account_id = p_wechat_account_id
    for update;

  if source_user_id is not null and source_user_id <> target_user_id then
    if exists (
      select 1
      from public.app_users
      where id = source_user_id
        and supabase_user_id is not null
        and supabase_user_id <> target_supabase_user_id
    ) then
      return jsonb_build_object(
        'status', 'error',
        'errorCode', 'wechat_account_already_bound'
      );
    end if;

    for source_record in
      select *
        from public.dream_records
        where user_id = source_user_id
        order by created_at asc, id asc
    loop
      select *
        into duplicate_record
        from public.dream_records
        where user_id = target_user_id
          and local_record_id = source_record.local_record_id
        limit 1
        for update;

      if not found then
        update public.dream_records
          set user_id = target_user_id
          where id = source_record.id;
        moved_count := moved_count + 1;
      elsif coalesce(duplicate_record.raw_dream_text, '') = coalesce(source_record.raw_dream_text, '')
        and coalesce(duplicate_record.sleep_quality, '') = coalesce(source_record.sleep_quality, '')
        and coalesce(duplicate_record.analysis_type, '') = coalesce(source_record.analysis_type, '')
        and coalesce(duplicate_record.dream_summary, '') = coalesce(source_record.dream_summary, '')
        and duplicate_record.emotions = source_record.emotions
        and duplicate_record.symbols = source_record.symbols
        and duplicate_record.report_content = source_record.report_content
        and duplicate_record.deleted_at is not distinct from source_record.deleted_at then
        update public.dream_records
          set updated_at = greatest(
                coalesce(duplicate_record.updated_at, duplicate_record.created_at),
                coalesce(source_record.updated_at, source_record.created_at)
              ),
              synced_at = nullif(
                greatest(
                  coalesce(duplicate_record.synced_at, '-infinity'::timestamptz),
                  coalesce(source_record.synced_at, '-infinity'::timestamptz)
                ),
                '-infinity'::timestamptz
              )
          where id = duplicate_record.id;
        delete from public.dream_records
          where id = source_record.id;
        deduped_count := deduped_count + 1;
      else
        conflict_local_id := left(source_record.local_record_id, 90)
          || '_wechat_conflict_'
          || left(replace(gen_random_uuid()::text, '-', ''), 12);

        while exists (
          select 1
          from public.dream_records
          where user_id = target_user_id
            and local_record_id = conflict_local_id
        ) loop
          conflict_local_id := left(source_record.local_record_id, 90)
            || '_wechat_conflict_'
            || left(replace(gen_random_uuid()::text, '-', ''), 12);
        end loop;

        update public.dream_records
          set user_id = target_user_id,
              local_record_id = conflict_local_id
          where id = source_record.id;
        conflict_count := conflict_count + 1;
      end if;
    end loop;

    delete from public.app_users
      where id = source_user_id;
  end if;

  update public.app_users
    set wechat_account_id = p_wechat_account_id,
        updated_at = p_now
    where id = target_user_id;

  update public.wechat_accounts
    set linked_supabase_user_id = target_supabase_user_id,
        last_login_at = p_now
    where id = p_wechat_account_id;

  update public.account_binding_tokens
    set used_at = p_now
    where id = binding_token.id;

  delete from public.account_binding_attempts
    where wechat_account_id = p_wechat_account_id;

  return jsonb_build_object(
    'status', 'bound',
    'movedCount', moved_count,
    'dedupedCount', deduped_count,
    'conflictCount', conflict_count
  );
end;
$$;

revoke all on function public.confirm_wechat_account_binding(text, uuid, timestamptz) from public;
revoke all on function public.confirm_wechat_account_binding(text, uuid, timestamptz) from anon;
revoke all on function public.confirm_wechat_account_binding(text, uuid, timestamptz) from authenticated;
grant execute on function public.confirm_wechat_account_binding(text, uuid, timestamptz) to service_role;
