# WeChat Auth Bridge Design

## Context

Dream Anatomy currently has a native WeChat Mini Program guest foundation. `miniprogram/services/authAdapter.js` always returns guest state, the Mini Program stores dreams locally, and quick analysis calls the existing Render backend as an unauthenticated guest request. This PR adds a secure WeChat identity bridge without cloud dream sync, Web account binding, payment, Supabase fake sessions, or AI prompt changes.

## Goals

- Let a Mini Program user explicitly establish a Dream Anatomy WeChat identity using `wx.login()`.
- Keep WeChat identity separate from Web Supabase email accounts in this PR.
- Keep Mini Program dreams local-only and keep `cloudSyncAvailable: false`.
- Store no raw `openid`, raw `unionid`, `session_key`, WeChat `code`, email, token, dream text, or AI response in the WeChat auth tables.
- Return only an opaque Dream Anatomy session token to the Mini Program.
- Verify subsequent WeChat session requests on the Render server.

## Out Of Scope

- No cloud dream sync.
- No Web account binding.
- No synthetic Supabase users or custom Supabase JWTs.
- No WeChat nickname, avatar, phone, location, contacts, payment, membership, product analytics persistence, or deep guidance reopening.
- No changes to DeepSeek prompts, quick analysis contract, Web Auth, Web DreamSync, Supabase RLS for existing dream data, or Mini Program local storage semantics.

## Architecture

The Mini Program calls `wx.login()` only after the user taps “使用微信身份继续”. It sends the one-time `code` to `POST /api/v1/wechat-auth/login`. Render validates the code with WeChat using server-only `WECHAT_MINIPROGRAM_APP_ID` and `WECHAT_MINIPROGRAM_APP_SECRET`, hashes identity values with `WECHAT_IDENTITY_HASH_SECRET`, finds or creates a `wechat_account`, creates a high-entropy opaque session token, stores only `WECHAT_SESSION_HASH_SECRET` HMAC of that token, and returns the raw token once to the Mini Program.

The Mini Program stores the opaque token under one centralized key and sends it only to WeChat auth session/logout endpoints. The token is not treated as a Supabase token. Quick analysis remains guest-quota based for now and does not send this token to `/api/v1/dream-analysis`.

## Server Modules

- `server/wechatIdentity.js`
  - Validates environment configuration.
  - Validates `code` shape.
  - Calls WeChat `jscode2session`.
  - Creates HMAC-SHA256 identity hashes.
  - Never logs or returns raw WeChat identity values.

- `server/wechatSession.js`
  - Generates opaque random tokens with at least 32 bytes of entropy.
  - HMAC-hashes session tokens for storage.
  - Creates, verifies, and revokes sessions.
  - Checks expiry, revocation, and account disabled state.

- `server/wechatAuth.js`
  - Orchestrates login/session/logout.
  - Applies safe, in-memory login rate limiting.
  - Uses service-role Supabase client only on the server.
  - Returns stable API errors and no-store responses through `server.js`.

## Database

Add `supabase/migrations/20260720000000_create_wechat_auth.sql`.

`public.wechat_accounts`:

- `id uuid primary key default gen_random_uuid()`
- `app_id text not null`
- `openid_hash text not null`
- `unionid_hash text`
- `linked_supabase_user_id uuid references auth.users(id) on delete set null`
- `created_at timestamptz not null default now()`
- `last_login_at timestamptz not null default now()`
- `disabled_at timestamptz`
- `unique(app_id, openid_hash)`
- Index for non-null `unionid_hash`

`public.wechat_sessions`:

- `id uuid primary key default gen_random_uuid()`
- `account_id uuid not null references public.wechat_accounts(id) on delete cascade`
- `token_hash text not null unique`
- `created_at timestamptz not null default now()`
- `expires_at timestamptz not null`
- `last_seen_at timestamptz`
- `revoked_at timestamptz`

Both tables enable and force RLS, revoke access from `anon` and `authenticated`, and intentionally define no browser/client policies. Only Render service role operations use these tables.

## API

### `POST /api/v1/wechat-auth/login`

Request:

```json
{ "code": "wx.login one-time code" }
```

Behavior:

- Reject missing or malformed code.
- Reject missing server config with `WECHAT_AUTH_UNAVAILABLE`.
- Validate code with WeChat.
- Ignore body `openid`, `unionid`, `session_key`, `accountId`, and `userId`.
- Upsert account by `(app_id, openid_hash)`.
- Create a 7-day session.
- Return:

```json
{
  "sessionToken": "...",
  "expiresAt": "...",
  "account": {
    "mode": "wechat",
    "authenticated": true,
    "cloudSyncAvailable": false
  }
}
```

No `openid`, `unionid`, `session_key`, identity hash, database id, or service-role details are returned.

### `GET /api/v1/wechat-auth/session`

Reads `Authorization: Bearer <wechat-session-token>`, verifies it, and returns the same safe account object plus `expiresAt`.

### `POST /api/v1/wechat-auth/logout`

Revokes only the current session. It is idempotent and returns `{ "ok": true }`.

All responses set `Cache-Control: no-store`.

## Mini Program UX

`authAdapter` exposes:

- `initialize(options)`
- `login(options)`
- `logout(options)`
- `getAuthState()`
- `getAccessToken()`
- `isCloudSyncAvailable()`
- `clearLocalSession(options)`

Guest state:

```js
{ mode: "guest", authenticated: false, cloudSyncAvailable: false }
```

WeChat state:

```js
{ mode: "wechat", authenticated: true, cloudSyncAvailable: false }
```

The “我的” page shows:

- Guest: “游客模式”, “当前梦境仅保存在本机。”, “使用微信身份继续”.
- WeChat identity: “微信身份已建立”, “当前身份可以用于后续云端同步。现阶段梦境仍只保存在本机。”, session status, and “退出当前身份”.

Login failure keeps guest mode available and does not delete local dreams.

## Security And Privacy

- WeChat AppSecret is server-only.
- Runtime browser config and Mini Program source must not contain WeChat secrets.
- Raw WeChat identifiers and `session_key` are never persisted.
- Session token is returned once and stored only on the Mini Program client.
- Database stores only token HMAC and identity HMAC.
- Logs must not include code, token, raw identity, full hashes, email, dream text, or AI output.
- `wechat_sessions.last_seen_at` updates are best-effort and must not block normal session validation.
- WeChat tokens are never used as Supabase tokens.

## Testing

Tests cover:

- Secret-free static boundaries.
- WeChat identity hashing and code validation.
- Login creates or reuses accounts without persisting raw identity.
- Opaque token entropy and hash-only storage.
- Session verify/revoke/expire/disabled-account behavior.
- Login rate limiting.
- Server route no-store and stable errors.
- Mini Program `authAdapter` login/session/logout state.
- Profile page copy and cloud sync boundary.
- Regression that quick analysis remains guest-style and does not send the WeChat token.

## Manual Verification

In WeChat Developer Tools with a test AppID and Render env configured:

1. Open “我的”.
2. Confirm guest copy and local-only boundary.
3. Tap “使用微信身份继续”.
4. Confirm “微信身份已建立” and no cloud sync claim.
5. Restart Mini Program and confirm session restore.
6. Tap logout and confirm guest mode returns.
7. Run quick analysis and confirm local dream save still works.
