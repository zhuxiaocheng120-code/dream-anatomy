# WeChat Auth Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure Render-backed WeChat identity bridge for the native Mini Program while keeping dreams local-only and Web behavior unchanged.

**Architecture:** Add server-only WeChat identity/session/auth modules plus versioned API routes in `server.js`. Add a Supabase migration for HMAC-only WeChat accounts and sessions. Replace the Mini Program guest-only auth adapter with an explicit wx.login flow and update the profile page copy.

**Tech Stack:** Node.js, Express, Supabase JavaScript SDK service-role client, native WeChat Mini Program JavaScript/WXML/WXSS, `node:test`.

## Global Constraints

- Do not implement dream cloud sync, Web account binding, synthetic Supabase users, custom Supabase JWTs, WeChat payment, membership, nickname/avatar/phone authorization, product analytics persistence, deep guidance reopening, or AI prompt changes.
- Do not put `WECHAT_MINIPROGRAM_APP_SECRET`, `WECHAT_IDENTITY_HASH_SECRET`, `WECHAT_SESSION_HASH_SECRET`, service role keys, tokens, raw openid, raw unionid, or session_key in Mini Program source, runtime-env.js, logs, docs examples with real values, or API responses.
- Mini Program WeChat identity remains separate from Web Supabase email identity.
- Quick analysis remains compatible with the existing `/api/v1/dream-analysis` flow and does not treat WeChat session tokens as Supabase access tokens in this PR.
- Dreams remain in Mini Program local storage only; `cloudSyncAvailable` is always `false`.
- Use TDD: write failing tests before production code.

---

### Task 1: Server WeChat Identity And Session Core

**Files:**
- Create: `server/wechatIdentity.js`
- Create: `server/wechatSession.js`
- Create: `tests/wechatAuth.test.js`

**Interfaces:**
- Produces `validateWechatCode(code): string`
- Produces `assertWechatAuthConfigured(env): void`
- Produces `createWechatIdentityHash({ appId, openid, unionid, secret }): { openidHash, unionidHash }`
- Produces `createWechatIdentityClient({ env, fetchImpl }): { exchangeCode(code): Promise<{ openid, unionid, sessionKey }> }`
- Produces `createSessionToken(): string`
- Produces `createWechatSessionHash(token, secret): string`
- Produces `createWechatSessionStore({ client, env, now }): { createSession(accountId), verifySession(token), revokeSession(token) }`

- [ ] **Step 1: Write failing tests**

Add tests in `tests/wechatAuth.test.js` for code validation, missing env, HMAC identity hashing, exchange response safety, token entropy, token hash storage, verify expired/revoked/disabled sessions, and logout idempotency.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/wechatAuth.test.js`

Expected: FAIL with missing module errors for `server/wechatIdentity` and `server/wechatSession`.

- [ ] **Step 3: Implement identity/session modules**

Implement environment validation, code validation, WeChat code exchange, HMAC identity hashing, opaque token creation, token hashing, service-role table writes, session validation, best-effort last_seen update, and idempotent revocation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/wechatAuth.test.js`

Expected: PASS.

### Task 2: Server API Routes And Migration

**Files:**
- Create: `server/wechatAuth.js`
- Create: `supabase/migrations/20260720000000_create_wechat_auth.sql`
- Modify: `server.js`
- Modify: `server/aiErrors.js`
- Modify: `.env.example`
- Modify: `tests/server.test.js`
- Modify: `tests/miniprogramStatic.test.js`

**Interfaces:**
- Consumes Task 1 modules.
- Produces `createWechatAuthService({ env, getAdminClient, fetchImpl, now }): { login(request), getSession(request), logout(request) }`.
- Adds routes `POST /api/v1/wechat-auth/login`, `GET /api/v1/wechat-auth/session`, and `POST /api/v1/wechat-auth/logout`.

- [ ] **Step 1: Write failing tests**

Add route tests for no-store, missing config `WECHAT_AUTH_UNAVAILABLE`, invalid code, safe login response, stable invalid session errors, logout idempotency, and no secret leakage. Add static tests that migration enables/forces RLS and revokes `anon`/`authenticated`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/server.test.js tests/miniprogramStatic.test.js`

Expected: FAIL because routes, errors, env vars, and migration do not exist yet.

- [ ] **Step 3: Implement routes and migration**

Wire the auth service into `server.js` through `app.locals.wechatAuthService` override for tests. Add stable error message `WECHAT_AUTH_UNAVAILABLE`. Add `.env.example` placeholders for the four server-only variables. Create the migration with the two tables, indexes, RLS, force RLS, and revoked public roles.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/server.test.js tests/miniprogramStatic.test.js`

Expected: PASS.

### Task 3: Mini Program Auth Adapter And Profile UI

**Files:**
- Modify: `miniprogram/services/authAdapter.js`
- Modify: `miniprogram/services/apiClient.js`
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/profile/index.wxss`
- Modify: `miniprogram/app.js`
- Modify: `tests/miniprogramServices.test.js`
- Modify: `tests/miniprogramStatic.test.js`

**Interfaces:**
- `authAdapter.initialize(options): Promise<AuthState>`
- `authAdapter.login(options): Promise<AuthState>`
- `authAdapter.logout(options): Promise<AuthState>`
- `authAdapter.getAuthState(): AuthState`
- `authAdapter.getAccessToken(): Promise<string>`
- `authAdapter.isCloudSyncAvailable(): boolean`
- `authAdapter.clearLocalSession(options): void`

- [ ] **Step 1: Write failing tests**

Update Mini Program service/static tests to expect explicit `wx.login` only in authAdapter, token storage under a centralized key, session restore, logout clearing token, profile copy for guest/wechat states, no cloud sync claim, and quick analysis not sending Authorization.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/miniprogramServices.test.js tests/miniprogramStatic.test.js`

Expected: FAIL because current adapter is guest-only and static tests still ban all `wx.login`.

- [ ] **Step 3: Implement Mini Program auth flow**

Implement adapter with request helper, storage key, safe state transitions, no token logging, guest fallback on failure, and no deletion of local dreams. Update profile page to show login/logout buttons and Chinese status messages. Initialize auth state on app launch without forcing login prompts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/miniprogramServices.test.js tests/miniprogramStatic.test.js`

Expected: PASS.

### Task 4: Documentation And Regression

**Files:**
- Create: `docs/WECHAT_AUTH_SETUP.md`
- Create: `docs/WECHAT_AUTH_ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/MINIPROGRAM_SETUP.md`
- Modify: `docs/MINIPROGRAM_ARCHITECTURE.md`

**Interfaces:**
- Documents the migration name, API list, session lifecycle, privacy/security boundary, Render variables, WeChat Developer Tools checks, and current no-cloud-sync/no-Web-binding limitation.

- [ ] **Step 1: Write failing documentation assertions**

Add static checks to `tests/miniprogramStatic.test.js` for the two new docs and required phrases about server-only AppSecret, no Supabase fake session, no cloud sync, and Render variables.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/miniprogramStatic.test.js`

Expected: FAIL because docs are missing.

- [ ] **Step 3: Write docs and update project status**

Add setup/architecture docs and update README/project status/miniprogram docs to replace the old guest-only boundary with “WeChat identity available, cloud sync not yet available”.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- tests/wechatAuth.test.js tests/server.test.js tests/miniprogramServices.test.js tests/miniprogramStatic.test.js
npm test
node --check server.js
node --check server/wechatAuth.js
node --check server/wechatIdentity.js
node --check server/wechatSession.js
node --check miniprogram/services/authAdapter.js
node --check miniprogram/services/apiClient.js
git diff --check
```

Expected: all pass.

### Task 5: Security Review, Commit, And PR

**Files:**
- Review full branch diff.

- [ ] **Step 1: Run final reviewer**

Dispatch a final reviewer with the full diff and ask it to focus on WeChat identity secret leakage, raw identity persistence, fake Supabase sessions, quick analysis regression, Mini Program local storage preservation, and docs accuracy.

- [ ] **Step 2: Fix Critical or Important findings**

If reviewer finds Critical/Important issues, fix them with focused tests and rerun the relevant suite plus final reviewer.

- [ ] **Step 3: Final verification and PR**

Commit with `Add secure WeChat identity bridge`, push `codex/wechat-auth-bridge`, and create PR `Add Secure WeChat Identity Bridge`.
