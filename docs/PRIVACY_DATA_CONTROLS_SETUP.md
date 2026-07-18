# Privacy And Data Controls Setup

This document describes the Dream Anatomy Web Beta privacy/data controls added for legal document display, explicit consent, dream export/deletion, guest local cleanup, and account deletion.

The legal documents in this repository are Beta technical copy based on the current code and data flow. They are not a substitute for professional legal review. Before a production launch, the policies, terms, AI disclaimer, contact process, and deletion process should be reviewed by qualified professionals.

正式发布前，这些法律文件和用户数据流程仍需完成专业法律审阅。

## Supabase Migration

Apply this migration in Supabase SQL Editor after the existing `dream_records` and `ai_usage_events` migrations:

```text
supabase/migrations/20260717001000_create_legal_consents.sql
```

The migration creates `public.legal_consents` with:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `privacy_policy_version`
- `terms_version`
- `ai_disclaimer_version`
- `accepted_at`
- `updated_at`

It enables and forces RLS. Authenticated users can select, insert, and update only their own consent row. The table has no anon policy.

## Render Environment Variables

Add the public support email before Beta release:

```text
PUBLIC_SUPPORT_EMAIL=
```

This value is intentionally public and is written into `runtime-env.js`. If it is missing, the app shows “联系方式尚未配置”.

Keep these values server-only:

```text
SUPABASE_SERVICE_ROLE_KEY=
ANALYTICS_HASH_SECRET=
DEEPSEEK_API_KEY=
```

Do not expose service role, analytics secret, DeepSeek key, access tokens, refresh tokens, or Authorization headers in browser runtime config.

## Legal Document Versions

Legal document text and versions are centralized in:

```text
src/legalDocuments.js
```

Current version constants:

- `PRIVACY_POLICY_VERSION`
- `TERMS_VERSION`
- `AI_DISCLAIMER_VERSION`

When legal text changes, update the relevant version constant. Existing users with missing or older `legal_consents` versions will be asked to confirm the latest versions again. `TOKEN_REFRESHED` should not repeatedly show the prompt for an already checked session.

## Consent Behavior

Registration requires an unchecked-by-default explicit checkbox:

```text
我已阅读并同意《用户协议》《隐私政策》和《AI使用说明》
```

Guest users must confirm legal/AI terms before their first AI request in the current browser. Guest consent is stored only in localStorage for that browser and version set. It is not represented as a cloud consent record.

Authenticated consent is stored in `public.legal_consents` through the user’s Supabase session and RLS policies.

## Dream Data Controls

The SPA view is:

```text
data-view="privacy-data"
```

The controller is:

```text
src/privacyData.js
```

It supports:

- viewing legal documents
- confirming current legal versions
- exporting current user or guest dream data
- deleting a single dream from Dream Detail
- clearing all visible dream records for the current account or current guest browser
- clearing current-account local cache after account deletion
- calling the server account deletion API

Dangerous actions use an in-app confirmation UI. `清空全部梦境` and `注销账户` require exact confirmation text.

## Data Export Scope

Export creates a UTF-8 JSON file named like:

```text
dream-anatomy-export-YYYY-MM-DD.json
```

The export includes current visible dream records, AI analysis result content, Dream Result Card content, and legal version metadata.

It must not include:

- email
- full Supabase user UUID
- access token
- refresh token
- Authorization header
- `principal_hash`
- admin analytics
- other account data

Export does not call DeepSeek and does not consume AI quota.

## Account Deletion API

The server endpoint is:

```text
DELETE /api/v1/account
```

Implementation:

```text
server/accountDeletion.js
```

The endpoint requires:

- `Authorization: Bearer <supabase_access_token>`
- JSON body `{ "confirmation": "注销账户" }`

The server verifies the token and derives the current user from Supabase. It does not trust body `userId`, body `email`, localStorage, or any client-provided identity field.

Deletion order:

1. If `ANALYTICS_HASH_SECRET` is configured, recalculate the authenticated analytics HMAC with `user:<verified user id>`.
2. If the hash can be recalculated, delete matching `authenticated AI 使用统计` rows from `ai_usage_events`.
3. Delete the Supabase Auth user through the server-only service role client.
4. Perform scoped cleanup for this user’s `legal_consents`.
5. Perform scoped cleanup for this user’s `dream_records`.
6. Client clears current-account local cache.
7. Client signs out and returns to the public home state.

If any server-side step fails, the endpoint returns a stable error and request id. It must not report success before all server-side deletion steps complete.
If Supabase Auth deletion fails, dream records and legal consent are not deleted first, so the user can retry the account deletion flow. The `legal_consents` and `dream_records` foreign keys are expected to cascade after Auth deletion; the explicit scoped cleanup is retained as a server-side fallback.

## Analytics Deletion Boundary

Account deletion deletes authenticated AI usage events that match the recalculated principal hash for the verified user when `ANALYTICS_HASH_SECRET` is configured. Configure this secret before Beta release; without it, the server cannot reliably match historical authenticated analytics rows to the verified user.

`guest AI 使用统计不会被删除`, because historical guest signals cannot be reliably proven to belong to the account being deleted.

AI usage statistics are stored for product operation analysis and service improvement for the necessary period. The current version does not run automatic cleanup. Future changes to retention behavior should be reflected in privacy documents and deployment docs.

Do not describe `principal_hash` as fully anonymous. It is a de-identified operational identifier and must not be displayed in full or used to reverse-search real users from the admin UI.

## Manual Online Verification

Use synthetic test accounts and non-private dream text.

1. Apply `20260717001000_create_legal_consents.sql` in Supabase SQL Editor.
2. Configure `PUBLIC_SUPPORT_EMAIL` on Render.
3. Confirm `runtime-env.js` exposes only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `PUBLIC_SUPPORT_EMAIL`.
4. Register without checking legal consent and confirm registration is blocked.
5. Register with consent, verify email, and log in.
6. Confirm stale or missing legal consent prompts for current versions.
7. Create a quick dream record, export data, and confirm the JSON contains only current-user records and no token/email/principal hash.
8. Delete one dream from Dream Detail and confirm it disappears only for the current user.
9. Clear all dreams and confirm only the current user’s dream records are removed.
10. Log in with a second account and confirm it cannot see or delete the first account’s data.
11. Call `DELETE /api/v1/account` with the current account and exact confirmation text.
12. Confirm the user’s dream records, legal consent row, Auth user, and authenticated AI usage events are removed.
13. Confirm guest analytics rows are not deleted.
14. Confirm the browser returns to the public home and cannot access Dream Journal, Dream Home, or admin data as the deleted user.
