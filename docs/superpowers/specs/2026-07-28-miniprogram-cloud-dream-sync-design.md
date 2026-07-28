# Mini Program Cloud Dream Sync Design

## Goal

Add local-first cloud synchronization for Dream Anatomy Mini Program dream records while keeping Web, AI, legal copy, visual style, and current WeChat identity boundaries unchanged.

## Product Boundaries

- This PR does not change AI prompts, DeepSeek calls, Web auth, payment, membership, visual style, Logo, animation, or compliance wording.
- The Mini Program remains a dream record, sleep-feeling record, and AI-assisted text整理 tool. It must not restore high-risk wording such as 解梦、吉凶、预测、象征含义, or fixed symbol meanings.
- Deep guidance stays disabled.
- Quick analysis requests continue to call `POST /api/v1/dream-analysis` without WeChat Authorization and keep the existing guest quota behavior.

## Chosen Architecture

Use the existing `public.dream_records` table as the single cloud dream history table.

The compatibility layer introduces `public.app_users` as the internal user identity table:

- Web email users map to an app user whose `app_users.id` equals `auth.users.id`.
- WeChat Mini Program users map to an app user through `app_users.wechat_account_id = wechat_accounts.id`.
- `dream_records.user_id` becomes the internal app user id.
- Existing Web RLS remains practical because Web records still use `user_id = auth.uid()`.
- Mini Program never accesses Supabase directly. Render verifies the WeChat session, resolves the app user id, and reads/writes `dream_records` with the server-only service role.

This PR does not implement Web/WeChat account binding. A later binding PR can merge a WeChat app user into a Web app user by moving `dream_records.user_id` and attaching the WeChat account to the Web app-user row.

## Database Migration

Create a safe additive migration:

- `public.app_users`
  - `id uuid primary key default gen_random_uuid()`
  - `supabase_user_id uuid unique references auth.users(id) on delete cascade`
  - `wechat_account_id uuid unique references public.wechat_accounts(id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
- Backfill existing Web users into `app_users` with `id = auth.users.id`.
- Add an auth trigger to create `app_users(id, supabase_user_id)` for new Web users.
- Drop the existing `dream_records.user_id -> auth.users(id)` FK and replace it with `dream_records.user_id -> app_users(id)`.
- Keep `dream_records` RLS policies based on `auth.uid() = user_id`, preserving current Web behavior.
- Add `deleted_at timestamptz` and `synced_at timestamptz` to `dream_records`.
- Keep unique `(user_id, local_record_id)` for idempotent sync.
- Do not delete existing data or rebuild production tables.

Manual SQL Editor instructions will be documented with the migration filename.

## Server API

Add a focused server module, `server/miniprogramDreamSync.js`, and wire these routes:

- `POST /api/miniprogram/dreams/sync`
- `GET /api/miniprogram/dreams`
- `PUT /api/miniprogram/dreams/:id`
- `DELETE /api/miniprogram/dreams/:id`

All routes:

- Set `Cache-Control: no-store`.
- Require a valid WeChat Bearer session.
- Resolve `user_id` server-side from the verified WeChat account.
- Ignore and reject client-supplied `user_id`.
- Use the service-role Supabase client on the server only.
- Return stable API errors through the existing `createApiError` / `sendApiError` path.
- Never log dream text or full report content.

Validation:

- Batch sync accepts 1 to 50 records.
- Dream text is a string up to 5000 characters.
- `localRecordId` is a stable string up to 128 characters.
- `createdAt`, `updatedAt`, `deletedAt`, `lastSyncedAt` must be valid ISO timestamps when present.
- `reportContent` must be a JSON object.

## Sync Semantics

Local-first behavior:

1. Mini Program saves locally first.
2. If authenticated and sync is enabled, it attempts cloud sync.
3. Network or server failure marks local records `sync_failed` without deleting content.

Record fields added locally:

- `localRecordId`
- `syncStatus`: `local_only`, `syncing`, `synced`, `sync_failed`
- `cloudRecordId`
- `lastSyncedAt`
- `updatedAt`
- `deletedAt`

Cloud mapping:

- `dream_records.local_record_id` stores `localRecordId`.
- `dream_records.id` maps to `cloudRecordId`.
- `dream_records.deleted_at` is the soft-delete tombstone.
- `dream_records.synced_at` records successful server sync time.
- `dream_records.source` uses `wechat_miniprogram` for Mini Program records.

Conflict handling:

- If only local changed after `lastSyncedAt`, update cloud.
- If only cloud changed after `lastSyncedAt`, restore cloud to local.
- If both changed, keep the newer `updated_at`.
- If timestamps are equal or the server cannot determine the winner, keep the local record and return a conflict copy instruction for the client to create a separate local copy of the cloud version.
- Deleted cloud records are returned as tombstones so old devices do not re-upload them as active records.

## Mini Program UX

On first successful WeChat login:

- If there are local unsynced dreams and sync has not been enabled, show:
  `检测到本机保存的梦境记录，是否同步到云端，以便更换设备后恢复？`
- Buttons:
  - `同步到云端`
  - `暂不处理`
- Never auto-upload existing local records without confirmation.
- If deferred, the user can later start sync from “我的 / 数据管理”.

After login:

- The Mini Program can restore cloud records to local storage.
- New-device restore stores cloud records locally and shows `已恢复 X 条梦境记录。`
- Local records not yet on cloud stay visible and are marked 待同步.

UI state:

- Journal/detail show only simple sync labels:
  - 已同步
  - 待同步
  - 同步失败
- No real-time sync animation is added.

## Local Storage Behavior

`miniprogram/services/dreamStorage.js` remains the local source of truth and will gain:

- Normalization for older records missing sync fields.
- `getRecords({ includeDeleted })`.
- `updateRecord(localRecordId, patch)`.
- `replaceRecords(records)` for cloud restore merge.
- Tombstone-preserving delete for synced records.

Deleted records are hidden from normal lists but remain available for sync until cloud deletion is confirmed.

## Security And Privacy

- Do not expose openid, unionid, session_key, WeChat code, service role key, Supabase URL secrets, or session tokens.
- Do not log dream text, report content, user reflection, or full AI output.
- Server logs may only use record id, stable error code, status, and anonymized request ids if needed.
- Admin dashboard is unchanged and does not gain dream-body access.
- Client cannot access Supabase directly for Mini Program cloud records.

## Tests

Required tests:

- Unauthenticated sync returns `AUTH_INVALID`.
- Expired or invalid WeChat session returns `AUTH_INVALID`.
- First batch upload writes `dream_records` rows with server-resolved `user_id`.
- Repeated sync uses `(user_id, local_record_id)` and does not duplicate.
- Cloud failure keeps local records and marks them `sync_failed`.
- Cross-device restore merges cloud records into local storage.
- Conflict handling creates a conflict copy when timestamps cannot safely choose a winner.
- Deleted records use `deleted_at` and old devices do not re-upload them as active.
- Logs and runtime config do not expose dream text or secrets.
- Compliance wording files are not modified and forbidden Mini Program terms remain absent.
- Web email login and `dreamSync.js` remain compatible with `dream_records`.

## Documentation

Update:

- `docs/MINIPROGRAM_ARCHITECTURE.md`
- `docs/MINIPROGRAM_SETUP.md`
- `docs/WECHAT_AUTH_ARCHITECTURE.md`
- `docs/PROJECT_STATUS.md`
- Add `docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md`

Docs must explain:

- The unified `dream_records` model.
- The `app_users` compatibility layer.
- Migration filename and manual SQL Editor steps.
- Local-first failure behavior.
- Current lack of Web/WeChat account binding.
