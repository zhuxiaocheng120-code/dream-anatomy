# Product Analytics Setup

This document describes the opt-in, first-party product analytics used by Dream Anatomy Web Beta. It is separate from legal consent and AI usage analytics. It is not a substitute for professional legal review before production.

## Supabase Migration

Apply this migration in Supabase SQL Editor after the existing analytics and legal-consent migrations:

```text
supabase/migrations/20260719000000_create_product_analytics.sql
```

The migration creates `public.product_analytics_preferences` for authenticated opt-in state and `public.product_events` for server-written event rows. Both tables enable and force RLS. Browser roles can access only their own preference; they cannot directly read or write product events.

## Data Boundary

Events store an event id, UTC occurrence time, allowed event name, authenticated-or-guest type, HMAC-derived principal and session hashes, web platform, application version, and allowlisted properties. They do not store dream text, dream title, analysis text, emotions, symbols, sleep quality, search terms, email, full user id, token, Authorization header, raw IP, raw User-Agent, raw installation id, or raw session id.

The event allowlist is:

```text
app_opened, view_opened, dream_input_started, dream_input_abandoned,
analysis_requested, analysis_completed, analysis_failed, result_viewed,
dream_saved, journal_opened, dream_detail_opened, signup_started,
signup_completed, login_completed, data_export_completed, dream_deleted,
all_dreams_cleared
```

Each event accepts only its documented categorical properties. Examples include `view_name`, `entry_point`, `length_bucket`, `analysis_type`, `source`, `has_result_card`, `error_code`, `sync_status`, `record_count_bucket`, and `method`. Unknown properties are removed by the server.

## Consent And Withdrawal

Product analytics is 默认关闭. A user may opt in from the privacy/data center and may 随时关闭 it. Disabling immediately stops new events and clears the current browser queue. Guest preference stays in that browser only; authenticated preference is stored in `product_analytics_preferences` under the current user’s RLS-scoped session. Account changes reload the preference rather than inheriting another account’s choice.

With consent enabled, the browser sends only allowlisted event batches to `POST /api/v1/product-events`. Users can withdraw and delete currently matched analytics data through `DELETE /api/v1/product-analytics`.

## Funnel And Retention

Admin reporting uses only aggregates and is labeled `基于已同意产品分析的用户样本`.

- Funnel stages are ordered by HMAC-derived session: `app_opened`, `dream_input_started`, `analysis_requested`, `analysis_completed`, `result_viewed`, and `dream_saved`.
- D1 is the share of eligible de-identified principals with an observed event on the first UTC calendar day after their first observed UTC event date.
- D7 is the equivalent share on the seventh UTC calendar day after that first date.
- A retention result reports insufficient data when fewer than five eligible principals are in the sampled range.

The dashboard does not display full principal or session hashes.

## Storage And Deletion

Product event data is kept for product operation analysis and service improvement for the necessary period. 当前版本不执行自动清理 and no TTL is implemented. Any future retention change must be reflected here and in privacy documentation.

For account deletion, a configured `ANALYTICS_HASH_SECRET` lets the server recalculate the verified authenticated identity hash and delete matching authenticated `product_events`; it also deletes that user’s `product_analytics_preferences`. `guest product_events 不会被删除`, because a historical guest installation cannot be reliably proven to belong to the account being deleted.

## Render Configuration

Set these server-only Render variables before enabling production analytics:

```text
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_USER_IDS=
ANALYTICS_HASH_SECRET=
```

Do not expose these values in `runtime-env.js`. `ANALYTICS_HASH_SECRET` must remain stable while historical HMAC-derived product data needs to be matched for deletion.

## Manual Online Verification

1. Run `20260719000000_create_product_analytics.sql` in Supabase SQL Editor.
2. Configure the three server-only Render variables above and deploy.
3. Confirm no product event request is sent before opt-in.
4. Opt in with a synthetic guest session, trigger an allowlisted event, then disable the setting and confirm later events stop.
5. Log in with a synthetic user, opt in, generate allowed events, and verify the preference belongs only to that account.
6. Open the admin dashboard with an allowlisted admin account and confirm the aggregate cards, funnel, and D1/D7 rows show the sample label without hashes or personal content.
7. Call `DELETE /api/v1/product-analytics` for an authenticated synthetic user and confirm only that user’s matching product events are removed.
8. Delete that account through `DELETE /api/v1/account`; confirm authenticated product events and the preference row are removed, while guest product events remain.
