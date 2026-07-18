# Privacy-Safe Product Analytics Design

## Goal

Add a first-party, opt-in, privacy-safe product behavior analytics system for Dream Anatomy Web Beta. The system helps understand product opening, dream input starts, quick analysis completion, result viewing, saving, archive/detail usage, auth conversion, retention, page trends, and drop-off points without collecting dream content or using third-party analytics SDKs.

## Scope

This PR adds:

- optional product analytics consent in the existing `privacy-data` SPA view
- a separate Supabase preference table, `public.product_analytics_preferences`
- a server-only product events table, `public.product_events`
- a browser module, `src/productAnalytics.js`
- server modules for product event validation, safe persistence, deletion, and admin aggregation
- admin dashboard product usage sections
- account deletion cleanup for authenticated product events and product analytics preferences
- documentation and tests

This PR does not add WeChat, payment, membership, third-party analytics, device fingerprinting, Timeline, Calendar, AI prompt changes, or deep guidance reopening.

## Architecture

Product analytics is a separate pipeline from AI usage analytics.

AI usage analytics remains a service-safety, quota, cost, and reliability system and is not controlled by product analytics consent. Product analytics is optional and only records allowlisted behavior events after explicit opt-in.

Client:

```text
src/productAnalytics.js
  -> local opt-in state and session id
  -> small in-memory queue
  -> POST /api/v1/product-events
```

Server:

```text
server/productAnalytics.js
  -> validate consent signal, identity, event allowlist, properties allowlist
  -> HMAC principal/session identifiers with ANALYTICS_HASH_SECRET
  -> write to public.product_events using service role

server/adminProductAnalytics.js
  -> aggregate summary, funnel, retention, distributions

server/accountDeletion.js
  -> delete authenticated product events and product analytics preference during account deletion
```

Admin view:

```text
src/adminAnalytics.js
  -> existing admin permission checks
  -> adds product usage sections
```

`server.js` only wires routes and modules.

## Consent Model

`legal_consents` remains limited to:

- privacy policy version
- terms version
- AI disclaimer version
- explicit legal consent timestamp

Product analytics preferences live in a separate table:

```text
public.product_analytics_preferences
```

Fields:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `enabled boolean not null default false`
- `version text`
- `updated_at timestamptz not null default now()`

RLS:

- enable row level security
- force row level security
- authenticated users can select their own row
- authenticated users can insert their own row
- authenticated users can update their own row
- no anon access

Browser behavior:

- default off
- user must actively enable in Privacy & Data
- user can disable at any time
- disabling immediately stops new event sending and clears pending queue
- login reads that account's preference
- account switch clears previous in-memory state and loads the new account's row
- logout clears authenticated preference state
- guest preference is local only and never written to `product_analytics_preferences`

Version:

- `PRODUCT_ANALYTICS_VERSION = "2026-07-19"`
- `PRIVACY_POLICY_VERSION = "2026-07-19"`
- `TERMS_VERSION` remains unchanged unless terms copy changes
- `AI_DISCLAIMER_VERSION` remains unchanged unless AI disclaimer copy changes

## Product Event Storage

Migration:

```text
supabase/migrations/20260719000000_create_product_analytics.sql
```

Create `public.product_events`:

- `id uuid primary key default gen_random_uuid()`
- `event_id uuid not null unique`
- `occurred_at timestamptz not null`
- `received_at timestamptz not null default now()`
- `event_name text not null`
- `principal_type text not null`
- `principal_hash text not null`
- `session_hash text`
- `client_platform text not null default 'web'`
- `properties jsonb not null default '{}'::jsonb`
- `app_version text`
- `created_at timestamptz not null default now()`

Security:

- enable and force RLS
- revoke all from anon and authenticated
- no browser-readable policies
- only service role writes and aggregates
- unique `event_id` prevents duplicate retries
- indexes on `occurred_at`, `event_name`, `principal_type`, and `(principal_hash, occurred_at)`
- no TTL, automatic 90-day cleanup, or automatic 180-day cleanup

## Identity And Session Hashing

The server computes all persisted hashes with `ANALYTICS_HASH_SECRET`.

Authenticated:

```text
HMAC_SHA256("user:" + verifiedSupabaseUserId)
```

Guest:

The browser generates an installation UUID only after opt-in. The browser sends that UUID to the server for product analytics only. The server persists:

```text
HMAC_SHA256("installation:" + installationUuid)
```

Session:

The browser generates a per-browser-session UUID. The server persists:

```text
HMAC_SHA256("session:" + sessionUuid)
```

The system does not save raw IP, raw User-Agent, email, full Supabase UUID, tokens, Authorization headers, raw installation UUID, or raw session UUID. The admin dashboard never displays full hashes.

Guest and authenticated identities are not automatically merged.

## Event API

Endpoint:

```text
POST /api/v1/product-events
```

Request shape:

```json
{
  "events": [
    {
      "eventId": "uuid",
      "eventName": "app_opened",
      "occurredAt": "ISO-8601",
      "sessionId": "uuid",
      "installationId": "uuid only for guest",
      "properties": {}
    }
  ]
}
```

Rules:

- accepts 1-20 events
- rejects unknown event names
- rejects invalid UUIDs
- rejects oversized payloads
- validates authenticated identity from Bearer token only
- invalid Bearer token returns `AUTH_INVALID`
- missing Bearer token is guest
- guest requires installation UUID
- `ANALYTICS_HASH_SECRET` and service role client are required for persistence
- no valid consent signal means no persistence
- returns `Cache-Control: no-store`
- duplicate `event_id` is accepted as already recorded and not reinserted
- write failure returns a stable, safe error for explicit event API calls, but the browser helper swallows it so product features keep working

## Event Allowlist

Allowed event names:

- `app_opened`
- `view_opened`
- `dream_input_started`
- `dream_input_abandoned`
- `analysis_requested`
- `analysis_completed`
- `analysis_failed`
- `result_viewed`
- `dream_saved`
- `journal_opened`
- `dream_detail_opened`
- `signup_started`
- `signup_completed`
- `login_completed`
- `data_export_completed`
- `dream_deleted`
- `all_dreams_cleared`

Allowed `view_name` values:

- `home`
- `quick`
- `quick-result`
- `journal`
- `dream-detail`
- `privacy-data`
- `auth`

Admin view is excluded from product funnel events.

## Property Sanitization

The server never saves client-provided properties as-is.

Allowed properties by event:

- `view_opened`: `view_name`
- `dream_input_started`: `entry_point`
- `dream_input_abandoned`: `length_bucket`, `view_name`
- `analysis_requested`: `analysis_type`
- `analysis_completed`: `analysis_type`, `source`, `has_result_card`
- `analysis_failed`: `analysis_type`, `error_code`
- `result_viewed`: `analysis_type`, `source`
- `dream_saved`: `analysis_type`, `sync_status`
- `journal_opened`: `record_count_bucket`
- `dream_detail_opened`: `analysis_type`
- `signup_started`: `entry_point`
- `signup_completed`: `method`
- `login_completed`: `method`
- `data_export_completed`: `record_count_bucket`
- `dream_deleted`: `analysis_type`
- `all_dreams_cleared`: `record_count_bucket`
- `app_opened`: no properties

Allowed enum values:

- `analysis_type`: `quick`, `deep`, `result_card`
- `source`: `ai_generated`, `fallback`, `generation_failed`, `mock_legacy`
- `sync_status`: `synced`, `pending_sync`, `local_only`
- `length_bucket`: `1-50`, `51-150`, `151-500`, `500+`
- `record_count_bucket`: `0`, `1`, `2-5`, `6-20`, `21+`
- `method`: `email`
- `entry_point`: `nav`, `home`, `journal`, `auth`, `privacy-data`
- `error_code`: stable API codes only, max 64 chars from a strict uppercase/underscore pattern

Forbidden:

- dream text
- dream title
- AI analysis text
- symbols
- emotion labels
- sleep quality
- search keyword
- email
- username
- full Supabase UUID
- raw IP
- User-Agent
- access token
- refresh token
- Authorization header
- URL query strings
- input content
- arbitrary free text

## Frontend Tracking Behavior

`src/productAnalytics.js` exposes:

- `createProductAnalyticsController(options)`
- `trackEvent(eventName, properties)`
- `trackView(viewName)`
- `flushEvents(options)`
- `setAnalyticsConsent(enabled)`
- `loadPreferenceForSession(detail)`
- `deleteProductAnalyticsData()`
- `clearAnalyticsIdentity()`

It stores:

- guest preference in localStorage
- guest installation UUID in localStorage only while enabled
- session UUID in sessionStorage
- small memory queue only

It does not store tokens, dream text, or full user ids.

Event behavior:

- `app_opened` fires once per page load/session, not on tab focus
- `view_opened` fires only when SPA view changes
- `TOKEN_REFRESHED` and `INITIAL_SESSION` do not create login/signup events
- `SIGNED_IN` from a real login creates `login_completed`
- registration submit creates `signup_started`; successful sign-up creates `signup_completed`
- quick analysis submit creates one `analysis_requested`
- quick analysis success creates one `analysis_completed`, `result_viewed`, and `dream_saved`
- quick analysis failure creates one `analysis_failed`
- Dream Journal open creates `journal_opened`
- Dream Detail open creates `dream_detail_opened`
- export/delete/clear create their matching events only after success
- `dream_input_abandoned` fires when a user started typing and leaves the quick view without analysis submission; only length bucket is sent

Deep guidance remains disabled and is not tracked as a usable flow.

## Product Analytics Admin

Add server endpoints:

- `GET /api/v1/admin/product-analytics/summary?range=7d`
- `GET /api/v1/admin/product-analytics/funnel?range=7d`
- `GET /api/v1/admin/product-analytics/retention?range=30d`

They reuse existing admin auth:

- Supabase Bearer token
- `ADMIN_USER_IDS`
- no-store responses
- no public access

Admin UI adds a "产品使用" section in the existing admin view.

Metrics:

- approximate active principals
- guest/authenticated split
- page view distribution
- dream input starts
- analysis completions
- analysis completion rate
- result viewed rate
- dream save rate
- signup started/completed
- same-session funnel
- D1 retention
- D7 retention
- failure/drop-off counts

Every product analytics section shows:

```text
基于已同意产品分析的用户样本
```

The UI must not display full `principal_hash` or `session_hash`.

## Retention Definition

Use UTC date keys.

D1 retention:

For each principal's first product event date, count the principal as retained if it has at least one event on the next UTC date.

D7 retention:

For each principal's first product event date, count the principal as retained if it has at least one event on the seventh UTC date after first appearance.

Same-day repeat events do not count as multiple users.

Guest installation hash and authenticated principal hash are separate principals and are not merged.

If the cohort size is below 5, return:

```json
{ "status": "insufficient_data" }
```

instead of a misleading percentage.

## Deletion And Withdrawal

User disables product analytics:

- stop sending new events immediately
- clear memory queue
- clear session id
- guest disables: clear local installation UUID after optional deletion request
- authenticated disables: update `product_analytics_preferences.enabled = false`
- AI usage analytics is unaffected

Delete product analytics data:

- authenticated: server verifies Bearer token, recomputes `HMAC("user:" + verifiedUserId)`, deletes matching `product_events`
- guest: browser sends current installation UUID before destroying it; server deletes matching guest product events
- never delete other principal data
- never delete AI usage analytics through this feature

Account deletion:

- delete authenticated product events matching the verified user principal hash
- delete `product_analytics_preferences` for the verified user
- do not delete guest product events

## Legal Document Changes

Update privacy policy to mention optional product analytics:

- default off
- no dream content
- no email
- no raw IP
- no raw User-Agent
- no token
- no full UUID
- no direct identity joins
- user can withdraw and delete product analytics data

Set:

- `PRIVACY_POLICY_VERSION = "2026-07-19"`
- `PRODUCT_ANALYTICS_VERSION = "2026-07-19"`

Do not update terms or AI disclaimer versions unless their copy changes.

## Security Notes

- `product_events` is not readable or writable by browser Supabase roles.
- Product event API is same-origin only; no wildcard CORS.
- Server uses service role only on server.
- Server does not log payloads, dream content, raw ids, tokens, or hashes.
- Event payload failures return stable errors without database details.
- Product analytics write failure must not break core product workflows.
- Product analytics preference failure must show a privacy-center status message and keep core product workflows available.

## Testing Strategy

Server tests:

- migration SQL checks for RLS, no anon/auth table access, indexes, unique event id
- product event validation, sanitization, batch size, duplicate handling
- authenticated identity comes from token, body user id ignored
- guest installation UUID is HMACed only
- consent-disabled events do not persist
- product events deletion for authenticated and guest principals
- account deletion removes product preferences and authenticated product events
- admin summary/funnel/retention aggregation

Frontend tests:

- default off
- no events sent while off
- enabling starts sending
- disabling stops sending and clears queue
- account switch reloads preference and does not inherit previous enabled state
- guest preference is local only
- no dream text/input/search/email/token in payloads
- app open/view/input/analysis/save/journal/detail/auth/export/delete events are de-duplicated as specified
- admin UI labels product analytics as an opted-in sample

Regression tests:

- quick analysis still works
- Dream Result Card still works
- AI rate limiting and AI usage analytics still work
- admin dashboard still works
- privacy center, export, dream deletion, and account deletion still work
- `npm test`, syntax checks, and `git diff --check` pass

## Documentation

Add:

```text
docs/PRODUCT_ANALYTICS_SETUP.md
```

Update:

- `README.md`
- `docs/PROJECT_STATUS.md`
- `docs/PRIVACY_DATA_CONTROLS_SETUP.md`
- `src/legalDocuments.js`

Documentation must state that product analytics represents only users who explicitly enabled it, and that the database keeps historical events for necessary product operation and service improvement purposes without automatic TTL in this version.
