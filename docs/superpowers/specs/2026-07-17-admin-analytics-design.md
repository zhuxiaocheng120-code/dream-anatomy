# Admin Analytics Design

## Goal

Add persistent AI usage analytics and a read-only operations dashboard for Dream Anatomy while preserving the current quick analysis experience, Supabase Auth flow, Dream Journal, Dream Detail, Dream Home, and the disabled deep guidance state.

The implementation uses the existing single-page app. It does not add `/admin.html`, a routing framework, React, Vue, payment, mini-program pages, or write-capable admin tools.

## Chosen Approach

Use an SPA admin view plus focused server modules.

- Frontend: add `src/adminAnalytics.js` and a new `data-view="admin"` panel in `src/index.html`.
- Server: add focused modules for admin auth, server-only Supabase service role access, usage event persistence, and admin analytics aggregation.
- `server.js`: keep routing and orchestration in `server.js`; move new concerns into modules instead of adding all logic inline.

## Data And Privacy Boundary

Create a new Supabase table, `public.ai_usage_events`, for AI usage metadata only.

The table must never store:

- raw IP
- email
- full Supabase user UUID
- access token
- refresh token
- Authorization header
- dream text
- full AI response
- full `principal_hash` in any browser-facing response

The table stores:

- request id
- timestamp
- principal type: `guest` or `authenticated`
- `principal_hash`, generated with `ANALYTICS_HASH_SECRET`
- analysis type
- outcome
- stable error code and HTTP status when applicable
- duration
- quality retry count
- prompt version
- model
- DeepSeek token usage when returned by the upstream API
- estimated cost when cost environment variables are configured

Identity hashing uses HMAC-SHA256, not plain SHA256:

- authenticated users: `HMAC("user:" + verifiedSupabaseUserId)`
- guests: `HMAC("guest:" + trustedRequestIp)`

The `user:` and `guest:` prefixes prevent equivalent raw strings from producing the same identity namespace. Guest hashes are approximate independent visitor signals, not exact user counts.

`ai_usage_events` must not be joined with `auth.users` or `dream_records` to identify users. The admin dashboard must not search real users by `principal_hash`, display full `principal_hash`, or reveal private dream data.

AI usage statistics will be retained long-term for product operations analysis and service improvement for the period necessary to serve those purposes. The current version does not perform automatic cleanup. Future changes to retention periods must be reflected in the privacy policy and deployment documentation.

Do not describe analytics data as permanently saved or never deleted. Future systems must still be able to support lawful deletion requests, account deletion, product shutdown, legal requirements, or explicit administrator archival/deletion. For future account deletion, the server can recompute an authenticated user's `principal_hash` from verified `user.id` and `ANALYTICS_HASH_SECRET` to delete or anonymize matching analytics events. This PR only reserves that design path and does not implement account deletion.

The database must preserve full historical time dimensions so future admin experiences can analyze daily, weekly, monthly, quarterly, and yearly trends. The first dashboard only offers 7-day, 30-day, and 90-day filters; those filters do not imply that the database stores only 90 days of data.

## Supabase Migration

Add a migration named like `supabase/migrations/<timestamp>_create_ai_usage_events.sql`.

Table shape:

- `id uuid primary key default gen_random_uuid()`
- `request_id uuid not null unique`
- `occurred_at timestamptz not null default now()`
- `principal_type text not null`
- `principal_hash text not null`
- `analysis_type text not null`
- `outcome text not null`
- `error_code text`
- `http_status integer`
- `duration_ms integer`
- `quality_retry_count integer not null default 0`
- `prompt_version text`
- `model text`
- `prompt_tokens integer`
- `completion_tokens integer`
- `total_tokens integer`
- `estimated_cost_usd numeric`
- `created_at timestamptz not null default now()`

Constraints:

- `principal_type in ('guest', 'authenticated')`
- `outcome in ('success', 'upstream_error', 'timeout', 'generation_incomplete')`
- non-negative duration, retry count, token counts, and estimated cost
- unique `request_id`

Indexes:

- `occurred_at`
- `analysis_type`
- `outcome`
- `principal_type`

Security:

- enable row level security
- force row level security
- revoke table access from `anon` and `authenticated`
- create no anon/authenticated policies

Browser Supabase clients must not directly access `ai_usage_events`; only server-side service role code may read or write it.

## Server Modules

### `server/adminSupabase.js`

Creates a server-only Supabase service role client for analytics operations.

Environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Client settings:

- `persistSession: false`
- `autoRefreshToken: false`
- `detectSessionInUrl: false`

If `SUPABASE_SERVICE_ROLE_KEY` is missing, user-facing AI analysis must continue to work. Analytics writes fail safely. Admin analytics endpoints return `ANALYTICS_UNAVAILABLE`.

### `server/adminAuth.js`

Verifies admin access for admin API endpoints.

Rules:

- The request must include `Authorization: Bearer <supabase_access_token>`.
- The server validates the token using Supabase Auth.
- The verified `user.id` must be present in `ADMIN_USER_IDS`.
- `ADMIN_USER_IDS` is a comma-separated list of UUIDs.
- Missing token returns 401.
- Invalid or expired token returns 401.
- Valid non-admin user returns 403.
- Missing or empty `ADMIN_USER_IDS` rejects everyone with 403.
- The admin UUID list is never sent to the browser.
- Email, user id, token, and session are never logged.

### `server/aiAnalytics.js`

Builds and records AI usage events.

Responsibilities:

- generate request ids
- create HMAC principal hashes
- normalize usage token fields
- calculate estimated cost from optional environment variables
- map AI outcomes to analytics outcomes
- build safe event rows
- record events with service role client
- swallow analytics insert failures without affecting AI responses

Cost environment variables:

- `AI_INPUT_COST_PER_1M_TOKENS`
- `AI_OUTPUT_COST_PER_1M_TOKENS`

If token usage or cost variables are missing, `estimated_cost_usd` is `null`, not `0`.

### `server/adminAnalytics.js`

Queries analytics rows through the service role client and returns only aggregates or redacted event summaries.

Functions:

- summary for `7d`, `30d`, and `90d`
- recent events with default 20 and max 100

The implementation should not assume data only exists for 90 days. Date range handling should remain extensible for future all-time or custom range filters.

## AI Request Integration

Each user-initiated AI analysis writes at most one analytics event.

Included analysis types:

- `quick`
- `result_card`
- future enabled AI types

Current disabled deep guidance types:

- `guided_questions`
- `guided_final`

When deep guidance is disabled, the server rejects these requests before DeepSeek, quota usage, and normal analytics event writing.

Quality retry behavior:

- internal retry remains part of one user analysis
- only one analytics event is written
- `quality_retry_count` records how many internal retries occurred

Success and failure behavior:

- success writes `outcome = 'success'`
- upstream 5xx writes `outcome = 'upstream_error'`
- timeout writes `outcome = 'timeout'`
- repeated quality failure writes `outcome = 'generation_incomplete'`

Analytics write failure:

- must not fail or delay the user response in a meaningful way
- must not prevent quota/concurrency lock release
- must not log event payloads, dream text, or full AI responses

DeepSeek token usage:

- if upstream returns `usage.prompt_tokens`, `usage.completion_tokens`, or `usage.total_tokens`, store those values
- if usage is missing, store `null`
- never estimate fake token counts

## Admin API

Add:

- `GET /api/v1/admin/analytics/summary?range=7d|30d|90d`
- `GET /api/v1/admin/analytics/recent?limit=20`

All responses set `Cache-Control: no-store`.

Error behavior:

- guest or missing bearer token: 401
- invalid/expired token: 401
- non-admin authenticated user: 403
- missing analytics service role config: 503 with `ANALYTICS_UNAVAILABLE`
- internal database failure: safe admin-facing error without stack or raw database details

Summary response includes:

- today's AI request count
- total requests in selected range
- approximate independent principals
- guest request count
- authenticated request count
- success rate
- failure count
- average duration
- P95 duration
- total quality retry count
- prompt tokens
- completion tokens
- total tokens
- estimated total cost, or `null`
- daily trend
- analysis type distribution
- error code distribution

Recent response includes:

- occurred time
- principal type
- analysis type
- outcome
- error code
- duration
- token totals
- estimated cost
- short request id

Recent response must not include:

- full principal hash
- user id
- email
- IP
- dream text
- full AI response

## SPA Admin View

Add a new SPA view in `src/index.html`:

- `data-view="admin"`
- visible name: `运营后台`
- Chinese user-facing copy
- Dream Anatomy visual style
- mobile-safe layout without horizontal overflow

Add `src/adminAnalytics.js`.

Responsibilities:

- listen to `dream-anatomy-auth-session`
- probe admin permission with server API after login/session restoration
- show admin navigation entry only after server confirms admin
- revalidate when entering admin view
- fetch summary and recent events
- render range controls: 最近 7 天, 最近 30 天, 最近 90 天
- render stat cards
- render lightweight trend chart with DOM/CSS, no chart framework
- render user type, analysis type, and error distributions
- render recent requests without private data
- handle loading, no data, no permission, configuration missing, and network failure states
- clear data on logout or account switch
- leave admin view on logout/account switch

Security:

- hiding the admin entry is not a security measure
- manual admin view access still calls server and receives 401/403/503 as appropriate
- use `textContent`, not `innerHTML`, for API data
- never display full `principal_hash`

## Documentation

Add `docs/ADMIN_ANALYTICS_SETUP.md`.

Document:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_USER_IDS`
- `ANALYTICS_HASH_SECRET`
- optional `AI_INPUT_COST_PER_1M_TOKENS`
- optional `AI_OUTPUT_COST_PER_1M_TOKENS`
- how to find admin UUIDs in Supabase
- how to configure multiple admins
- how to find the Supabase service role key
- why service role must never be exposed to frontend
- migration file name and execution order
- how to verify the table exists
- how to verify regular users cannot access the admin API
- Render redeploy steps
- production manual acceptance checks
- long-term retention wording:
  - "AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存。当前版本不执行自动清理；未来如调整保留期限，将在隐私政策和部署文档中同步更新。"
- warn that rotating `ANALYTICS_HASH_SECRET` breaks continuity between historical and new principal hashes

Update `.env.example`, README, and `docs/PROJECT_STATUS.md` with concise references.

## Testing Strategy

Use Node's built-in test runner.

New or updated test files:

- `tests/aiAnalytics.test.js`
- `tests/adminAuth.test.js`
- `tests/adminAnalytics.test.js`
- `tests/adminAnalyticsFrontend.test.js`
- `tests/server.test.js`
- `tests/supabaseSecurity.test.js`

Coverage:

- migration creates `ai_usage_events`
- RLS enabled and forced
- no anon/authenticated access policies
- service role key not included in runtime env or static files
- HMAC hashing uses prefixes and secret
- no raw IP, dream text, email, token, or full UUID in event rows
- cost is `null` when pricing is missing
- cost is calculated when pricing is configured
- successful AI call records one event
- upstream error records one failed event
- timeout records one failed event
- quality retry records one event with retry count
- analytics insert failure does not affect AI response
- disabled deep guidance does not write normal usage events
- admin API returns 401, 403, 503, and success correctly
- summary aggregation is correct
- recent redaction is correct
- frontend only shows entry after server confirmation
- logout/account switch clears admin data
- admin view uses no `innerHTML` for API data
- quick analysis, Dream Result Card, rate limiting, Auth, Dream Home, Dream Journal, Dream Detail, sync, and navigation regressions continue passing

## Out Of Scope

This PR does not implement:

- WeChat mini-program pages
- WeChat login
- payment
- membership
- quota editing
- user bans
- user deletion
- account deletion
- analytics cleanup jobs
- customer support views
- raw dream inspection
- raw AI response inspection
- exact finance reconciliation
- real-time WebSocket dashboards
- Dream Result Card prompt changes
- reopening deep guidance
- Timeline or Calendar
