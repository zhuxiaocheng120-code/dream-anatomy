# Privacy And User Data Controls Design

## Goal

Add the Web Beta privacy and data control layer for Dream Anatomy: legal documents, explicit consent, export, dream deletion, local guest data cleanup, and account deletion with related personal data cleanup.

This PR does not add WeChat, payment, membership, product behavior analytics, Timeline, Calendar, deep guidance reopening, or AI prompt changes.

## Chosen Approach

Use **SPA Privacy Center + Server Account Deletion Modules**.

- Frontend adds an existing-SPA `privacy-data` view.
- `src/legalDocuments.js` owns legal document versions and text.
- `src/privacyData.js` owns the privacy/data UI, legal document viewing, consent checks, export, dream deletion actions, clear-all actions, guest local cleanup, and account deletion interaction.
- `src/app.js` only wires the module into SPA navigation, Auth session events, DreamSync, and Dream Detail.
- Normal dream read/delete/export operations reuse the existing Supabase SDK, current session, RLS, and DreamSync architecture.
- High-risk account deletion and Supabase Auth user deletion run only through `DELETE /api/v1/account` in server-side code.
- `server/accountDeletion.js` owns account deletion sequencing and service-role deletion logic.

## Product And Safety Boundaries

Dream Anatomy remains a dream recording and self-exploration tool. Legal and AI copy must not describe the product as diagnosis, treatment, fortune telling, auspicious/inauspicious judgment, or future prediction.

Legal documents are Beta technical drafts. The UI and docs must not claim that the documents have been reviewed by a lawyer.

All user-visible UI is Simplified Chinese except existing brand names such as Dream Anatomy, Dream Home, and Dream Journal.

## Public Runtime Config

Add one public runtime setting:

- `PUBLIC_SUPPORT_EMAIL`

This is a public contact address, not a secret. If unset, legal documents and the privacy page show:

> 联系方式尚未配置

`scripts/writeRuntimeEnv.js` must continue to expose only browser-safe values:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PUBLIC_SUPPORT_EMAIL`

It must not expose:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANALYTICS_HASH_SECRET`
- `DEEPSEEK_API_KEY`
- access tokens
- refresh tokens
- private payment or platform secrets

## Legal Documents

Create `src/legalDocuments.js`.

The module exports or attaches to `window.DreamLegalDocuments`:

- `PRIVACY_POLICY_VERSION`
- `TERMS_VERSION`
- `AI_DISCLAIMER_VERSION`
- `getLegalDocument(type, runtimeEnv)`
- `getLegalVersions()`
- `hasAcceptedVersions(consentRow)`

Document types:

- `privacy`
- `terms`
- `ai`

Each document returns:

```js
{
  type: "privacy",
  title: "隐私政策",
  version: "2026-07-17",
  sections: [
    { heading: "我们收集哪些信息", body: ["..."] }
  ]
}
```

The text must reflect the current implementation:

Privacy policy includes:

- email and account identifier use
- dream text, emotions, sleep quality, AI results
- AI usage statistics scope
- statistics table does not store dream text, email, or raw IP
- Supabase, Render, and DeepSeek as service providers
- export, deletion, and account deletion
- data retention principles
- support contact configuration
- unnecessary sensitive information warning: ID number, phone number, home address, and similar data are not needed
- minor usage notice
- legal document update notice
- principal_hash is de-identified, not fully anonymous
- AI usage statistics are retained for operations analysis and service improvement as necessary
- authenticated analytics events related to a deleted account are deleted during account deletion when `ANALYTICS_HASH_SECRET` is configured

Terms include:

- product is a dream recording and self-exploration tool
- users may not abuse the service
- free Beta may change, pause, or fail
- users are responsible for their own input content
- service and IP boundaries
- account management
- service termination
- document updates
- contact method

AI disclaimer includes:

- not psychological diagnosis
- not treatment advice
- not future prediction
- AI may be wrong or incomplete
- users should interpret content in context
- persistent distress should be discussed with qualified professionals
- no absolute, frightening, or fatalistic language

## Legal Consent Table

Add Supabase migration:

`supabase/migrations/20260717001000_create_legal_consents.sql`

Table:

```sql
public.legal_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  privacy_policy_version text not null,
  terms_version text not null,
  ai_disclaimer_version text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
)
```

Security:

- enable row level security
- force row level security
- authenticated users can select only `auth.uid() = user_id`
- authenticated users can insert only `auth.uid() = user_id`
- authenticated users can update only `auth.uid() = user_id`
- no anon policies
- no delete policy is needed for users; account deletion service-role cleanup can delete rows server-side

The migration should reuse `public.set_updated_at()` if it exists. If the function is missing, the migration creates it idempotently.

## Consent UX

Registration:

- The register form includes an unchecked checkbox:
  > 我已阅读并同意《用户协议》《隐私政策》和《AI 使用说明》
- Default is unchecked.
- Registration is blocked until checked.
- The three document names open the legal document viewer.
- The UI must not use "continuing means you agree" as a substitute for explicit consent.

Existing authenticated users:

- On login or initial session restore, the app reads the current user's `legal_consents`.
- If missing or any version is stale, show a gentle update prompt.
- Save updated consent only after explicit confirmation.
- `TOKEN_REFRESHED` must not repeatedly show the prompt for the same current user/version.
- Switching accounts clears the previous consent state and reads the next account's consent.

Guests:

- Before the first AI request in a browser, show a local consent prompt.
- Store local guest consent versions in localStorage only.
- A different browser/device must confirm again.
- Do not describe guest consent as cloud-saved.

## Privacy And Data SPA View

Add `data-view="privacy-data"` in `src/index.html`.

User-visible title:

> 隐私与数据

The entry lives near account/session controls and remains visible to guests and logged-in users. Ordinary users must not see admin controls in this view.

Sections:

- 隐私政策
- 用户协议
- AI 使用说明
- 导出我的数据
- 清空全部梦境
- 注销账户
- guest-only: 清除本机梦境数据

The view uses existing Dream Anatomy visual style: quiet, gentle, spacious, mobile-first, no dashboard/table-heavy design.

## Dream Deletion

Single record deletion is added to Dream Detail:

Button text:

> 删除这条梦境

Rules:

- Use a custom in-app confirmation component, not a final `window.alert` or `window.confirm`.
- Confirmation says the operation is not recoverable.
- Authenticated cloud delete must filter by both:
  - record id
  - current verified `user_id` from the active Supabase session
- Do not trust record id alone.
- Do not delete UI/local cache before cloud success.
- On success, remove the corresponding current-account local cache row and return to Dream Journal.
- On failure, keep the UI and show a stable error.
- Guests can delete only local guest records.
- Users cannot delete another account's records.

## Clear All Dreams

Privacy/Data view includes:

> 清空全部梦境

Rules:

- Requires typing exactly:
  > 清空全部梦境
- Shows how many visible records will be deleted.
- Authenticated cloud delete only deletes current `user_id` `dream_records`.
- Does not delete account, legal consent, admin eligibility, or other users' data.
- Guest clear only removes local guest records.
- On success, clear the current account's local cache rows and return journal/home state to empty.
- On failure, do not show success or remove UI records.

## Personal Data Export

Privacy/Data view includes:

> 导出我的数据

Export is a UTF-8 JSON download with filename:

`dream-anatomy-export-YYYY-MM-DD.json`

The filename must not contain email or full UUID.

Payload includes:

- `exportVersion`
- `exportedAt`
- redacted user id summary, not full user id
- dream creation time
- raw dream text
- sleep quality
- emotions
- symbols
- analysis type
- AI analysis result
- Dream Result Card if present
- accepted legal document versions when available

Payload excludes:

- access token
- refresh token
- Authorization header
- principal_hash
- admin analytics
- other users' cached records
- full Supabase user UUID
- email

Export must not call DeepSeek or consume AI quota.

If JSON serialization or browser download creation fails, show a stable error.

## Account Deletion API

Add:

`DELETE /api/v1/account`

Request:

```json
{
  "confirmationText": "注销账户"
}
```

Rules:

- Requires `Authorization: Bearer <supabase_access_token>`.
- Guests receive 401.
- Invalid or expired tokens receive 401.
- Wrong confirmation text receives 400.
- Identity comes only from verified token.
- Ignore body `userId`, `email`, and any other identity fields.
- Set `Cache-Control: no-store`.
- Use stable error structure from `server/aiErrors.js`.
- Return a request id for success and failures.
- Do not return service-role errors, stack traces, or internal table details.
- Do not log token, user id, email, principal hash, dream text, or deletion payload.

## Account Deletion Sequence

`server/accountDeletion.js` executes this order for the verified user id:

1. If `ANALYTICS_HASH_SECRET` is configured, recompute:
   `HMAC_SHA256("user:" + verifiedUserId)`
2. Delete `public.ai_usage_events` rows where:
   - `principal_type = 'authenticated'`
   - `principal_hash = recomputedHash`
3. Delete `public.legal_consents` where `user_id = verifiedUserId`.
4. Delete `public.dream_records` where `user_id = verifiedUserId`.
5. Delete the Supabase Auth user with the server-only service role client.

Guest analytics are not deleted because historical guest IP signals cannot be reliably proven to belong to the account.

If one step fails:

- do not claim full success
- return a safe error with request id
- do not attempt to restore already deleted data
- allow the user to retry

If analytics deletion succeeds but Auth deletion fails, retrying is valid.

On frontend success:

- clear current account local cache rows
- clear admin data if current account was admin
- sign out locally
- return to public home

## Data Retention Copy

Legal pages must not say:

- 永久保存
- 永不删除
- 完全匿名

Use:

> 我们会在实现产品功能、服务安全和运营分析目的所必要的期限内保存相关数据。用户主动删除梦境或注销账户时，我们将按照产品功能和适用规则处理相关数据。

`principal_hash` is a de-identified identifier, not fully anonymous data.

## Server Module Boundaries

Create `server/accountDeletion.js` with:

- `createAccountDeletionService(options)`
- `deleteAccountForRequest(request, body)`
- `deleteAccountForIdentity(identity, body)`
- helper to recompute authenticated analytics hash

The module consumes:

- `createAiAuthResolver()` identity resolution
- service-role Supabase client from `createAdminSupabaseClient()`
- `ANALYTICS_HASH_SECRET`
- `createApiError()`

`server.js` only wires the route:

- parse request body
- call service
- set no-store
- return stable response or stable error

## Frontend Module Boundaries

Create `src/privacyData.js`.

The module creates a controller:

```js
PrivacyData.createPrivacyDataController({
  document,
  storage,
  storageKey,
  app,
  auth,
  dreamSync,
  legalDocuments,
  elements
})
```

Responsibilities:

- render legal documents
- handle registration checkbox state
- check and save authenticated legal consent
- check and save guest local consent before AI
- export current user/guest data
- delete one dream through DreamSync
- clear all current user/guest dream records through DreamSync
- call `DELETE /api/v1/account`
- clear state on logout/account switch

It must not:

- call DeepSeek
- create admin views
- include service role secrets
- use `innerHTML` for user content or API errors

## DreamSync Extensions

Extend `src/dreamSync.js` with focused methods:

- `deleteRecord(recordId)`
- `clearCurrentRecords()`
- `clearCurrentLocalCache()`
- `getCurrentUser()`

Authenticated delete/clear uses Supabase SDK with active session and explicit `.eq("user_id", user.id)` filter. RLS remains the final security boundary.

Guest delete/clear affects only local records with no `userId`.

## Failure Handling

All dangerous actions use in-app confirmation UI.

Stable messages:

- deletion failed:
  > 暂时没有删除成功，请稍后再试。
- clear-all wrong confirmation:
  > 请输入“清空全部梦境”后再继续。
- account deletion wrong confirmation:
  > 请输入“注销账户”后再继续。
- account deletion unavailable:
  > 账户注销暂时无法完成，请稍后再试。请求编号：...

## Testing Strategy

Unit tests:

- `tests/legalDocuments.test.js`
- `tests/privacyData.test.js`
- `tests/accountDeletion.test.js`
- extend `tests/dreamSync.test.js`
- extend `tests/authDiagnostics.test.js`
- extend `tests/server.test.js`
- extend `tests/supabaseSecurity.test.js`

Coverage includes:

- registration checkbox default unchecked and blocks submit
- legal links open document viewer
- current user reads/writes own consent
- stale consent prompts once per user/version, not on token refresh
- guest consent local-only
- runtime config exposes support email but no secret
- single delete filters id and user_id
- delete failure preserves UI
- clear-all exact confirmation
- export excludes token, principal_hash, email, full UUID, admin analytics
- account deletion ignores body userId/email
- account deletion deletes authenticated analytics hash but not guest analytics
- account deletion deletes legal consents, dream records, and auth user
- partial failure returns safe error
- logout/account switch clears protected UI data
- quick analysis, Dream Result Card, AI limits, analytics, admin dashboard, Dream Home, Dream Journal, and Dream Detail still work

## Documentation

Create:

- `docs/PRIVACY_DATA_CONTROLS_SETUP.md`

Update:

- `README.md`
- `docs/PROJECT_STATUS.md`
- `docs/SUPABASE_SECURITY_AUDIT.md`
- `.env.example`

Docs must include:

- migration file name
- Supabase SQL Editor steps
- `PUBLIC_SUPPORT_EMAIL` setup
- legal version update method
- account deletion scope
- guest data boundary
- analytics deletion boundary
- manual online acceptance checklist
- statement that Beta legal text still needs professional review before formal launch

## Out Of Scope

- WeChat mini-program
- WeChat login
- payment or membership
- product behavior analytics
- Timeline or Calendar
- community features
- admin write operations
- reopening deep guidance
- AI prompt changes
- legal claim of lawyer review
- deleting guest analytics during account deletion
- React, Vue, or a route framework
