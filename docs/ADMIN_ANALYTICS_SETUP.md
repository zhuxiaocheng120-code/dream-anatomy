# Admin Analytics Setup

## Overview

Dream Anatomy now records privacy-preserving AI usage metadata for product operations analysis and service improvement. The analytics path is server-only:

1. A user starts an AI analysis request.
2. The server completes the DeepSeek request and returns the normal analysis response.
3. The server attempts to write one safe usage event to `public.ai_usage_events`.
4. Admin users can view aggregate and recent redacted analytics in the existing SPA admin view.

Analytics write failures must not block normal dream analysis. The admin dashboard is read-only and never exposes dream text, full AI responses, tokens, emails, raw IP addresses, or full Supabase user ids.

## Required Render Environment Variables

Configure these on Render for the web service:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_USER_IDS=
ANALYTICS_HASH_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, and `ANALYTICS_HASH_SECRET` are server-only values. They must not be added to `src/runtime-env.js`, browser JavaScript, screenshots, logs, or public documentation with real values.

`ADMIN_USER_IDS` is a comma-separated list of Supabase Auth user ids that may access the operations dashboard. The admin entry is only shown after the server confirms the current session is an admin session, but hiding the entry is not a security boundary. Every admin API request still verifies the Supabase Bearer token and `ADMIN_USER_IDS` on the server.

If `ANALYTICS_HASH_SECRET` is missing, normal AI analysis continues and analytics writes are skipped. If the admin analytics configuration is incomplete, admin APIs return `ANALYTICS_UNAVAILABLE`.

## Optional Cost Environment Variables

Configure these if you want estimated cost totals:

```text
AI_INPUT_COST_PER_1M_TOKENS=
AI_OUTPUT_COST_PER_1M_TOKENS=
```

If token usage or cost variables are missing, the system stores `null` for estimated cost instead of inventing a value.

## Supabase Migration Steps

Run this migration in Supabase before enabling the admin dashboard:

```text
supabase/migrations/20260717000000_create_ai_usage_events.sql
```

Recommended manual flow:

1. Open the Supabase project SQL Editor.
2. Paste the full migration SQL from the file above.
3. Run it once.
4. Confirm `public.ai_usage_events` exists.
5. Confirm Row Level Security is enabled and forced.
6. Confirm `anon` and `authenticated` do not have direct table access.

The browser Supabase client must not read or write this table. Only the server-side service role client writes usage events and reads aggregate admin data.

## How To Find Admin User IDs

1. Create or choose the Supabase Auth account that should administer the Beta.
2. In Supabase Auth Users, copy the user's UUID.
3. Add the UUID to `ADMIN_USER_IDS`.
4. For multiple admins, separate ids with commas.

Do not put emails in `ADMIN_USER_IDS`. The server checks verified user ids only and does not log admin emails.

## Retention And Privacy Boundary

AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存。
当前版本不执行自动清理；未来如调整保留期限，将在隐私政策和部署文档中同步更新。

This analytics table intentionally keeps the historical time dimension needed for future daily, weekly, monthly, quarterly, and yearly trends. The current dashboard offers 7-day, 30-day, and 90-day quick filters, but those filters do not mean the database only stores 90 days of data.

The analytics table does not store:

- raw IP
- email
- full Supabase UUID
- access token
- refresh token
- Authorization header
- dream text
- full AI response

`principal_hash` is only used for approximate independent visitor counts, long-term trends, user-type splits, and usage-frequency analysis. Guest hashes are approximate independent visitor signals, not exact user counts.

The admin dashboard must not:

- display full `principal_hash`
- search for a real user by `principal_hash`
- join `ai_usage_events` with `auth.users`
- join `ai_usage_events` with `dream_records`
- reveal private dream content

Future account deletion can recompute a verified user's analytics `principal_hash` from `user:` plus the verified Supabase `user.id` and the same `ANALYTICS_HASH_SECRET`, then delete or anonymize matching usage events. This version only preserves that design path; it does not implement account deletion.

## Hash Secret Rotation Warning

不要随意轮换 ANALYTICS_HASH_SECRET。

Changing `ANALYTICS_HASH_SECRET` changes all future `principal_hash` values. Historical and new analytics events will no longer identify the same approximate authenticated user or guest signal as the same principal. Rotate this secret only with an explicit migration, deletion, or anonymization plan.

## Manual Verification Checklist

After deploying:

1. Run `npm test`.
2. Run `node --check server.js`.
3. Run `git diff --check` before committing.
4. Confirm `/api/v1/dream-analysis` still works for quick analysis.
5. Confirm quick analysis still saves and opens in Dream Journal and Dream Detail.
6. Confirm a non-admin logged-in user receives 403 from `/api/v1/admin/analytics/summary`.
7. Confirm an admin user can open the admin view and see aggregate cards.
8. Confirm admin API responses include `Cache-Control: no-store`.
9. Confirm admin responses do not include dream text, email, access tokens, raw IP, or full principal hashes.
10. Confirm `src/runtime-env.js` only contains browser-safe Supabase settings.
11. Confirm analytics insert failure does not break normal AI analysis.

Deep guidance remains marked as “正在开发中”. This setup does not add WeChat login, payment, membership, Timeline, Calendar, or new AI prompt behavior.
