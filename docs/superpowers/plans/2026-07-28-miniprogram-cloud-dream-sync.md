# Mini Program Cloud Dream Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure local-first cloud sync for WeChat Mini Program dream records using the unified `dream_records` table.

**Architecture:** Add an `app_users` compatibility layer so Web users keep `user_id = auth.uid()` while WeChat sessions resolve to a server-side internal app user. Mini Program sync APIs verify WeChat sessions, write `dream_records` through the service role, and merge cloud/local state into local storage without losing records.

**Tech Stack:** Node.js Express, Supabase JavaScript SDK through server service role, native WeChat Mini Program JavaScript/WXML/WXSS, Node `node:test`.

## Global Constraints

- Do not modify visual style, Logo, animation, AI prompts, DeepSeek behavior, payment, membership, or compliance wording.
- Do not restore Mini Program high-risk words: `解梦`, `吉凶`, `预测`, `象征含义`, fixed symbol meanings, or medical/diagnostic framing.
- Use one cloud dream history table: `public.dream_records`.
- Never trust client-supplied `user_id`; server resolves `user_id` after verifying Web or WeChat session.
- Mini Program saves locally before cloud sync; cloud failures never delete local dream content.
- Mini Program quick analysis requests remain unauthenticated guest AI requests.
- Do not expose service role, WeChat secrets, openid, unionid, session_key, session token, dream text, or full AI output in logs or runtime config.
- New migration must be additive, safe to rerun, and must not delete or rebuild production tables.

---

## File Structure

- Create `supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql`: app-user compatibility layer, `dream_records` FK migration, sync tombstone fields.
- Create `server/miniprogramDreamSync.js`: WeChat session verification, app-user resolution, record validation/mapping, sync/list/update/delete service methods.
- Modify `server.js`: route wiring only.
- Create `miniprogram/services/cloudSync.js`: authenticated Mini Program sync client and local merge orchestration.
- Modify `miniprogram/services/dreamStorage.js`: normalize sync fields, tombstones, update/replace helpers.
- Modify `miniprogram/pages/profile/*`: first-login prompt, manual data sync controls and status.
- Modify `miniprogram/pages/result/index.js`: local-first save then optional sync attempt.
- Modify `miniprogram/pages/journal/*`: simple sync status labels.
- Modify `miniprogram/pages/detail/*`: tombstone-aware delete and cloud delete attempt.
- Update docs listed in the spec.
- Add/update tests in `tests/miniprogramDreamSync.test.js`, `tests/miniprogramServices.test.js`, `tests/miniprogramStatic.test.js`, and `tests/supabaseSecurity.test.js`.

## Task 1: Database Contract And Static Guards

**Files:**
- Create: `supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql`
- Modify: `tests/supabaseSecurity.test.js`
- Modify: `tests/miniprogramStatic.test.js`

**Interfaces:**
- Produces: `public.app_users`, `dream_records.deleted_at`, `dream_records.synced_at`, `dream_records.user_id -> app_users(id)` compatibility contract.
- Consumes: existing `dream_records`, `wechat_accounts`, `auth.users`.

- [ ] **Step 1: Write failing migration tests**

Add tests that assert the new migration:

```js
test("mini program cloud sync migration keeps dream_records unified through app_users", () => {
  const migration = readProjectFile("supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql");
  assert.match(migration, /create table if not exists public\.app_users/);
  assert.match(migration, /supabase_user_id uuid unique references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /wechat_account_id uuid unique references public\.wechat_accounts\(id\) on delete cascade/);
  assert.match(migration, /insert into public\.app_users \(id, supabase_user_id\)\s+select id, id from auth\.users/s);
  assert.match(migration, /drop constraint if exists dream_records_user_id_fkey/i);
  assert.match(migration, /foreign key \(user_id\) references public\.app_users\(id\) on delete cascade/i);
  assert.match(migration, /add column if not exists deleted_at timestamptz/);
  assert.match(migration, /add column if not exists synced_at timestamptz/);
  assert.match(migration, /create unique index if not exists dream_records_user_local_record_id_idx\s+on public\.dream_records \(user_id, local_record_id\)/s);
});
```

Update the existing first `dream_records` migration assertion so it accepts the base historical `auth.users` FK and the new compatibility migration together.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/supabaseSecurity.test.js tests/miniprogramStatic.test.js`

Expected: fails because the migration file is missing.

- [ ] **Step 3: Add migration**

Create the SQL migration with:

```sql
create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid unique references auth.users(id) on delete cascade,
  wechat_account_id uuid unique references public.wechat_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.app_users force row level security;
revoke all on table public.app_users from anon;
revoke all on table public.app_users from authenticated;

insert into public.app_users (id, supabase_user_id)
select id, id from auth.users
on conflict (id) do nothing;

create or replace function public.ensure_app_user_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.app_users (id, supabase_user_id)
  values (new.id, new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ensure_app_user_after_auth_user_created on auth.users;
create trigger ensure_app_user_after_auth_user_created
after insert on auth.users
for each row execute function public.ensure_app_user_for_auth_user();

alter table public.dream_records
  add column if not exists deleted_at timestamptz,
  add column if not exists synced_at timestamptz;

alter table public.dream_records
  drop constraint if exists dream_records_user_id_fkey;

alter table public.dream_records
  add constraint dream_records_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete cascade;

create index if not exists dream_records_user_deleted_at_idx
  on public.dream_records (user_id, deleted_at);
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/supabaseSecurity.test.js tests/miniprogramStatic.test.js`

Expected: pass.

## Task 2: Server Mini Program Dream Sync API

**Files:**
- Create: `server/miniprogramDreamSync.js`
- Modify: `server.js`
- Create: `tests/miniprogramDreamSync.test.js`
- Modify: `tests/server.test.js` if route-level coverage needs existing app fixtures.

**Interfaces:**
- Consumes: `createWechatSessionStore({ client, env }).verifyRequest(request)`, `createApiError`.
- Produces:
  - `createMiniProgramDreamSyncService({ getAdminClient, env, now, logger })`
  - `syncDreams(request)`
  - `listDreams(request)`
  - `updateDream(request, cloudRecordId)`
  - `deleteDream(request, cloudRecordId)`

- [ ] **Step 1: Write failing service tests**

Create tests that cover:

```js
await assert.rejects(() => service.syncDreams(requestWithoutBearer), (error) => error.code === "AUTH_INVALID");
assert.equal(syncResult.records[0].cloudRecordId, "cloud-1");
assert.equal(fakeClient.state.rows.length, 1);
assert.equal(fakeClient.state.rows[0].user_id, "app-user-from-wechat");
assert.equal(fakeClient.state.rows[0].local_record_id, "local-one");
assert.equal(fakeClient.state.rows[0].raw_dream_text, "我梦见一扇门");
assert.equal(JSON.stringify(fakeClient.state.rows).includes("forged-user"), false);
```

Add cases for repeated sync, cloud newer restore, equal timestamp conflict, soft delete, invalid session, batch too large, text too long, and logger not receiving dream text.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/miniprogramDreamSync.test.js`

Expected: fails because module does not exist.

- [ ] **Step 3: Implement service module**

Implement:

```js
const { createApiError } = require("./aiErrors");
const { createWechatSessionStore } = require("./wechatSession");

function createMiniProgramDreamSyncService({ getAdminClient, env = process.env, now = () => new Date(), logger = console } = {}) {
  async function requireIdentity(request) {
    const client = getAdminClient && getAdminClient();
    if (!client) throw createApiError("WECHAT_AUTH_UNAVAILABLE", "微信身份服务暂时不可用，请稍后再试。", 503);
    const session = await createWechatSessionStore({ client, env, now }).verifyRequest(request);
    const userId = await resolveAppUserId(client, session.wechatAccountId, now);
    return { client, userId, session };
  }

  return { syncDreams, listDreams, updateDream, deleteDream };
}
```

Mapping rules:

- `source = "wechat_miniprogram"`
- `sync_status = "synced"`
- `sleep_quality = record.sleepQuality || null`
- `report_content = record.reportContent || {}`
- `report_content.dreamResultCard` is preserved if provided separately.

Conflict result shape:

```js
{
  ok: true,
  records: [{ localRecordId, cloudRecordId, syncStatus: "synced", lastSyncedAt }],
  restoredRecords: [],
  conflicts: [],
  deletedRecords: []
}
```

- [ ] **Step 4: Wire Express routes**

Add route handlers in `server.js`:

```js
app.post("/api/miniprogram/dreams/sync", handleMiniProgramDreamSyncRequest);
app.get("/api/miniprogram/dreams", handleMiniProgramDreamListRequest);
app.put("/api/miniprogram/dreams/:id", handleMiniProgramDreamUpdateRequest);
app.delete("/api/miniprogram/dreams/:id", handleMiniProgramDreamDeleteRequest);
```

Each handler sets `Cache-Control: no-store`, delegates to the service, catches stable errors, and uses `sendApiError`.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/miniprogramDreamSync.test.js tests/server.test.js`

Expected: pass.

## Task 3: Mini Program Local Storage And Cloud Sync Service

**Files:**
- Modify: `miniprogram/services/dreamStorage.js`
- Create: `miniprogram/services/cloudSync.js`
- Modify: `tests/miniprogramServices.test.js`

**Interfaces:**
- Consumes: `authAdapter.getAccessToken({ wx })`, existing storage key.
- Produces:
  - `createCloudSyncController(wxRef, options)`
  - `syncNow(options)`
  - `restoreFromCloud(options)`
  - `isCloudSyncEnabled(wxRef)`
  - `setCloudSyncEnabled(wxRef, enabled)`
  - `maybePromptInitialSync({ wx, onPrompt })`

- [ ] **Step 1: Write failing local sync tests**

Add tests:

```js
const saved = storage.saveRecord({ dreamText: "梦见门", reportContent: {} });
assert.equal(saved.record.syncStatus, "local_only");
assert.equal(saved.record.cloudRecordId, "");
assert.equal(saved.record.lastSyncedAt, "");

storage.markSynced(saved.record.localRecordId, { cloudRecordId: "cloud-1", lastSyncedAt: "2026-07-28T00:00:00.000Z" });
assert.equal(storage.getRecord(saved.record.localRecordId).syncStatus, "synced");

storage.deleteRecord(saved.record.localRecordId);
assert.equal(storage.getRecords().length, 0);
assert.equal(storage.getRecords({ includeDeleted: true })[0].deletedAt.length > 0, true);
```

Cloud service tests:

```js
assert.equal(requests[0].url, "https://dream-anatomy.onrender.com/api/miniprogram/dreams/sync");
assert.equal(requests[0].header.Authorization, "Bearer wechat-session-token");
assert.equal(requests[0].data.records[0].dreamText, "梦见门");
assert.equal(storage.getRecord(localId).syncStatus, "synced");
```

Also test cloud failure marks `sync_failed`, restore adds cloud-only records, and equal timestamp conflict creates a local conflict copy.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/miniprogramServices.test.js`

Expected: fails because helpers are missing.

- [ ] **Step 3: Extend `dreamStorage.js`**

Add:

- `normalizeRecord(record)`
- `getRecords(options = {})`
- `updateRecord(localRecordId, patch)`
- `markSynced(localRecordId, cloudInfo)`
- `markSyncFailed(localRecordId)`
- `mergeCloudRecords(records)`
- tombstone-preserving `deleteRecord(localRecordId)`

Keep `exportRecords()` using visible records unless `includeDeleted` is explicitly requested internally.

- [ ] **Step 4: Add `cloudSync.js`**

Implement authenticated request helper:

```js
async function requestCloud(path, { wx, method = "GET", data } = {}) {
  const token = await auth.getAccessToken({ wx });
  if (!token) throw createCloudSyncError("AUTH_INVALID", "请先建立微信身份。");
  wx.request({ url: `${apiBaseUrl}${path}`, method, header: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, data });
}
```

Never attach this token to AI analysis requests.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/miniprogramServices.test.js`

Expected: pass.

## Task 4: Mini Program Page Integration

**Files:**
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/result/index.js`
- Modify: `miniprogram/pages/journal/index.js`
- Modify: `miniprogram/pages/journal/index.wxml`
- Modify: `miniprogram/pages/detail/index.js`
- Modify: `miniprogram/pages/detail/index.wxml`
- Modify: `tests/miniprogramStatic.test.js`
- Modify: `tests/miniprogramServices.test.js`

**Interfaces:**
- Consumes: Task 3 storage/cloud service.
- Produces: first-login prompt, manual sync, simple sync labels, local-first save/delete integration.

- [ ] **Step 1: Write failing page/static tests**

Assert:

```js
assert.match(read("miniprogram/pages/profile/index.wxml"), /数据管理/);
assert.match(read("miniprogram/pages/profile/index.wxml"), /同步到云端/);
assert.match(read("miniprogram/pages/journal/index.wxml"), /syncStatusLabel/);
assert.match(read("miniprogram/pages/detail/index.wxml"), /同步状态/);
assert.doesNotMatch(read("miniprogram/pages/profile/index.wxml"), /解梦|吉凶|预测|象征含义/);
```

Add a service-level test that `handleWechatLogin` can call an injected sync prompt helper after successful login.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/miniprogramStatic.test.js tests/miniprogramServices.test.js`

Expected: fails because page copy/hooks are missing.

- [ ] **Step 3: Update profile page**

After `auth.login`, call cloud sync prompt only when local unsynced records exist. Use `wx.showModal` with:

- title: `云端同步`
- content: `检测到本机保存的梦境记录，是否同步到云端，以便更换设备后恢复？`
- confirmText: `同步到云端`
- cancelText: `暂不处理`

Add a “数据管理” card with manual sync button and status text.

- [ ] **Step 4: Update result, journal, detail**

- Result save: save locally first, then if sync enabled call cloud sync; if sync fails, show local save message plus sync failure note.
- Journal: map sync statuses to `已同步`, `待同步`, `同步失败`.
- Detail delete: tombstone locally, attempt cloud delete when `cloudRecordId` exists and sync is enabled, then navigate back.

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/miniprogramStatic.test.js tests/miniprogramServices.test.js`

Expected: pass.

## Task 5: Documentation And Regression

**Files:**
- Create: `docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md`
- Modify: `docs/MINIPROGRAM_ARCHITECTURE.md`
- Modify: `docs/MINIPROGRAM_SETUP.md`
- Modify: `docs/WECHAT_AUTH_ARCHITECTURE.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `README.md`
- Modify: `.env.example` if a batch limit config is added.

**Interfaces:**
- Consumes: completed implementation.
- Produces: deployment and manual verification instructions.

- [ ] **Step 1: Write failing doc tests**

Add static assertions:

```js
assert.match(read("docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md"), /20260728000000_add_miniprogram_cloud_sync\.sql/);
assert.match(read("docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md"), /app_users/);
assert.match(read("docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md"), /dream_records/);
assert.match(read("docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md"), /本地优先/);
assert.match(read("docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md"), /当前不实现 Web 账户绑定/);
```

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- tests/miniprogramStatic.test.js tests/supabaseSecurity.test.js`

Expected: fails because docs are missing or outdated.

- [ ] **Step 3: Update docs**

Document:

- Migration file and SQL Editor steps.
- Render needs existing WeChat auth service-role configuration.
- Sync API list.
- Local-first behavior.
- Cross-device restore.
- Conflict and deletion boundaries.
- Unified model compatibility layer.
- Current no Web/WeChat binding.

- [ ] **Step 4: Full verification**

Run:

```bash
npm test
node --check server.js
node --check server/miniprogramDreamSync.js
node --check miniprogram/services/dreamStorage.js
node --check miniprogram/services/cloudSync.js
git diff --check
```

Expected: all pass.

## Final Review And PR

- Request final reviewer against `origin/main...HEAD`.
- Fix Critical or Important findings only.
- Re-run full verification after fixes.
- Commit with message: `Add local-first mini program dream sync`.
- Push branch `codex/miniprogram-cloud-dream-sync`.
- Create PR titled: `Add Local-First Mini Program Dream Sync`.
