# Privacy And Data Controls Setup

This document describes Dream Anatomy public beta privacy/data controls: legal document display, explicit consent, separate cross-border processing consent, readable and raw data export, dream deletion, guest local cleanup, and account deletion.

## Public Operator Information

- Operator: 朱校成
- Entity type: 个人运营者
- Public contact email: zhuxiaocheng120@gmail.com

These values are public display information, not secrets.

## Supabase Migrations

Apply these migrations in timestamp order after the existing `dream_records` and analytics migrations:

```text
supabase/migrations/20260717001000_create_legal_consents.sql
supabase/migrations/20260721000000_add_cross_border_legal_consent.sql
```

The first migration creates `public.legal_consents` with per-user RLS. The second migration additively stores:

- `cross_border_consent_version`
- `cross_border_accepted_at`

Do not edit the already executed base migration in production. Apply the additive migration through Supabase SQL Editor.

## Render Public Environment Variables

Configure these public values on Render:

```text
PUBLIC_OPERATOR_NAME=朱校成
PUBLIC_SUPPORT_EMAIL=zhuxiaocheng120@gmail.com
PUBLIC_AI_MODEL_NAME=
PUBLIC_AI_MODEL_FILING_NUMBER=
PUBLIC_AI_APP_REGISTRATION_NUMBER=
```

`PUBLIC_AI_MODEL_FILING_NUMBER` and `PUBLIC_AI_APP_REGISTRATION_NUMBER` should remain empty unless real filing or registration information is confirmed. Do not invent placeholder numbers.

`runtime-env.js` may expose only browser-safe public settings such as Supabase URL/anon key and the public values above. Keep these server-only:

```text
SUPABASE_SERVICE_ROLE_KEY=
ANALYTICS_HASH_SECRET=
DEEPSEEK_API_KEY=
WECHAT_MINIPROGRAM_APP_SECRET=
WECHAT_IDENTITY_HASH_SECRET=
WECHAT_SESSION_HASH_SECRET=
```

## Service Providers And Regions

- Render provides Web/API service in 美国俄勒冈州（Oregon, US West）.
- Supabase provides authentication and cloud database in 印度孟买（South Asia / Mumbai，ap-south-1）.
- DeepSeek API receives dream content needed for the user's active AI request.
- WeChat is used for mini program identity verification; the current version does not request nickname, avatar, phone number, or friend data.

## Legal Versions

Current public beta versions:

- Privacy Policy: `2026-07-21`
- Terms: `2026-07-21`
- AI Usage Notice: `2026-07-21`
- Cross-border processing consent: `2026-07-21`

Legal document text and versions are centralized in `src/legalDocuments.js`.

## Consent Behavior

Registration requires two unchecked-by-default boxes:

```text
我已阅读并同意用户协议、隐私政策和 AI 使用说明
我已阅读境外处理说明，并单独同意必要的境外处理
```

Guest users must confirm the same current version set before their first AI request in the current browser. Guest consent is stored only in localStorage for that browser and version set.

Authenticated consent is stored in `public.legal_consents` through the user’s Supabase session and RLS policies. If any required version is missing or stale, the privacy center shows `法律文件状态：待确认`.

The Web UI checks consent before starting AI analysis, and `POST /api/v1/dream-analysis` also verifies authenticated users' current legal and cross-border consent on the server before quota reservation or DeepSeek calls. This server check prevents direct API calls from bypassing the privacy center.

## Data Export

The primary export is a readable HTML archive:

```text
dream-anatomy-archive-YYYY-MM-DD.html
```

The secondary raw backup export is JSON:

```text
dream-anatomy-export-YYYY-MM-DD.json
```

Both exports include only the current user or current guest browser's visible dream records. They do not include email, full Supabase UUID, tokens, Authorization headers, principal hashes, WeChat identity hashes, session tokens, or admin statistics. Export does not call DeepSeek and does not consume AI quota.

## Account Deletion API

The server endpoint is:

```text
DELETE /api/v1/account
```

The endpoint requires:

- `Authorization: Bearer <supabase_access_token>`
- JSON body `{ "confirmation": "注销账户" }`

The server derives identity only from the verified Supabase token. It ignores body `userId`, body `email`, localStorage, and any client-provided identity.

Deletion includes `authenticated AI 使用统计` and product events matched by recalculated HMAC when `ANALYTICS_HASH_SECRET` is configured. `guest AI 使用统计不会被删除`, and guest product events are not deleted, because historical guest signals cannot be reliably proven to belong to the account.

## Release Gate For Generative AI

Before providing generative AI functionality to the public in mainland China at larger scale, confirm:

- The called model's filing or registration information.
- Whether the Dream Anatomy application or feature needs local registration.
- Whether model name, filing number, or launch number must be displayed in the product.

Current documents and code do not represent an administrative license, filing, or approval. No fake filing or registration number should be displayed.

## Manual Online Verification

Use synthetic accounts and non-private dream text.

1. Apply `20260717001000_create_legal_consents.sql`.
2. Apply `20260721000000_add_cross_border_legal_consent.sql`.
3. Configure public Render variables.
4. Confirm `runtime-env.js` exposes only browser-safe public values.
5. Confirm registration is blocked unless both consent boxes are checked.
6. Confirm missing or stale legal consent prompts current versions.
7. Create a quick dream record and export both HTML and JSON.
8. Confirm exports contain current dream records and no token/email/principal hash.
9. Delete one dream, clear all dreams, and delete the account using synthetic data.
10. Confirm authenticated analytics deletion follows the HMAC boundary and guest analytics remain untouched.
