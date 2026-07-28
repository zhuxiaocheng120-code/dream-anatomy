# Email And WeChat Account Binding Design

## Goal

Bind a Web Supabase email identity and a WeChat Mini Program identity to one permanent `public.app_users.id`, so both clients share the same `public.dream_records` history without creating separate dream tables.

## Architecture

Web users authenticate with Supabase Auth; Mini Program users authenticate with the existing Dream Anatomy WeChat Session. The server resolves both sessions to `public.app_users.id` and never trusts a client-supplied `user_id`. Because Web RLS still depends on `auth.uid() = dream_records.user_id`, the final merged app user must be the Web app user whose `app_users.id` equals `auth.users.id`.

Binding uses a short-lived one-time code generated on Web and confirmed in the Mini Program. The database stores only a token hash, expiry, used timestamp, failed attempt count, and a correlation id. The Mini Program confirm endpoint verifies the WeChat Session, hashes the submitted code, and calls a server-only transaction function that binds the WeChat account to the Web app user and migrates WeChat-owned dream records.

## Data Model

Add `public.account_binding_tokens` with `target_app_user_id`, `token_hash`, `expires_at`, `used_at`, `failed_attempts`, `created_at`, and `request_correlation_id`. The table has RLS enabled/forced and no anon/authenticated direct grants. Service role writes and reads it through Render only.

Add `public.confirm_wechat_account_binding(p_token_hash text, p_wechat_account_id uuid, p_now timestamptz)` as a transactional database function. It validates the token, rejects already-bound or competing identities, moves source WeChat `dream_records` to the target Web `app_users.id`, deduplicates identical `local_record_id` records, preserves `deleted_at` tombstones, creates conflict local ids for same-id different-content records, links `wechat_accounts.linked_supabase_user_id`, attaches `app_users.wechat_account_id` to the target, marks the token used, and removes the now-empty source app user.

No separate Mini Program dream table is created.

## APIs

- `POST /api/account-binding/wechat/token`: Web Supabase Bearer token required. Returns one plaintext code once plus `expiresAt`.
- `GET /api/account-binding/status`: Web Supabase Bearer token required. Returns `{ status: "bound" | "unbound" }`.
- `POST /api/miniprogram/account-binding/confirm`: WeChat Session Bearer token required. Requires `bindingCode` and `confirmMerge: true`. Returns safe success status.
- `GET /api/miniprogram/account-binding/status`: WeChat Session Bearer token required. Returns safe bound/unbound status.

All errors use stable API error payloads. Responses use `Cache-Control: no-store`. No email, openid, unionid, auth UUID, app user id, token hash, binding code, dream text, or service role detail is returned or logged.

## UI

Web adds a compact “微信账户” card to the existing Privacy & Data page. Authenticated users can load binding status, generate a code, see a 10-minute expiry hint, and regenerate. Guests see a login prompt.

The Mini Program profile page adds “绑定邮箱账户”. It is visible only as an action for authenticated WeChat sessions. Users enter the Web code, read a merge warning, confirm, then the app calls the confirm endpoint and runs the existing local-first sync/restore flow so local and cloud records converge.

## Testing

Tests cover token generation, hashing, expiry, one-time use, invalid attempts, client `user_id` rejection, transaction merge behavior, dedupe/conflict/deleted tombstone handling, Web UI requests, Mini Program requests, static migration safety, and unchanged Web/WeChat login and cloud sync behavior.
