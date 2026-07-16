create extension if not exists pgcrypto;

create table if not exists public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  occurred_at timestamptz not null default now(),
  principal_type text not null,
  principal_hash text not null,
  analysis_type text not null,
  outcome text not null,
  error_code text,
  http_status integer,
  duration_ms integer,
  quality_retry_count integer not null default 0,
  prompt_version text,
  model text,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  estimated_cost_usd numeric,
  created_at timestamptz not null default now(),
  constraint ai_usage_events_principal_type_check
    check (principal_type in ('guest', 'authenticated')),
  constraint ai_usage_events_outcome_check
    check (outcome in ('success', 'upstream_error', 'timeout', 'generation_incomplete')),
  constraint ai_usage_events_duration_check
    check (duration_ms is null or duration_ms >= 0),
  constraint ai_usage_events_quality_retry_check
    check (quality_retry_count >= 0),
  constraint ai_usage_events_prompt_tokens_check
    check (prompt_tokens is null or prompt_tokens >= 0),
  constraint ai_usage_events_completion_tokens_check
    check (completion_tokens is null or completion_tokens >= 0),
  constraint ai_usage_events_total_tokens_check
    check (total_tokens is null or total_tokens >= 0),
  constraint ai_usage_events_cost_check
    check (estimated_cost_usd is null or estimated_cost_usd >= 0)
);

create index if not exists ai_usage_events_occurred_at_idx
  on public.ai_usage_events (occurred_at desc);

create index if not exists ai_usage_events_analysis_type_idx
  on public.ai_usage_events (analysis_type);

create index if not exists ai_usage_events_outcome_idx
  on public.ai_usage_events (outcome);

create index if not exists ai_usage_events_principal_type_idx
  on public.ai_usage_events (principal_type);

alter table public.ai_usage_events enable row level security;
alter table public.ai_usage_events force row level security;

revoke all on public.ai_usage_events from anon;
revoke all on public.ai_usage_events from authenticated;
