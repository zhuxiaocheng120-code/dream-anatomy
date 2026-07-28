# Email And WeChat Account Binding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bind Web email accounts and WeChat Mini Program identities to one `public.app_users.id` while preserving and merging existing dreams.

**Architecture:** Add a server-only binding service, a short-lived token table, and a transactional Supabase function for account merge. Web exposes token generation/status in Privacy & Data; Mini Program profile confirms the code and reuses existing cloud sync afterward.

**Tech Stack:** Node.js/Express, Supabase JS service role client, PostgreSQL migration/RPC, plain browser JS, WeChat native JS/WXML/WXSS, `node:test`.

## Global Constraints

- Use `public.app_users.id` as the permanent internal user id.
- Do not create separate Web and Mini Program dream tables.
- Do not trust client-supplied `user_id`, email, openid, unionid, or account id.
- Web final merged user must keep `app_users.id = auth.users.id` for existing RLS compatibility.
- Binding code is one-time, 10-minute expiry, random, hashed in DB, and never logged.
- Preserve existing Web dreams and Mini Program dreams; do not restore deleted tombstones.
- Same `local_record_id` with identical content dedupes; same id with different content creates a conflict copy.
- No visual redesign, logo/animation changes, AI Prompt changes, payments, membership, admin dashboard, or unbinding in this PR.

---

### Task 1: Service And Migration

**Files:**
- Create: `server/accountBinding.js`
- Create: `supabase/migrations/20260728001000_create_account_binding.sql`
- Modify: `server.js`
- Test: `tests/accountBinding.test.js`
- Test: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Produces `createAccountBindingService({ aiAuthResolver, getAdminClient, env, now, logger })`.
- Produces methods `createWebToken(request)`, `getWebStatus(request)`, `confirmMiniProgramBinding(request)`, `getMiniProgramStatus(request)`.
- Adds routes listed in the design.

- [x] Write failing service tests for token generation, hash-only DB writes, auth rejection, invalid/expired/used code rejection, one-time confirmation, and dream merge outcomes.
- [x] Write migration static tests for no separate dream table, RLS/forced RLS, token table columns/indexes, transaction function, service-role-only table posture, and no raw identity columns.
- [x] Implement token normalization, hashing, safe code generation, status lookup, and request validation.
- [x] Implement RPC-backed confirmation and safe error mapping.
- [x] Register Express routes with no-store responses.
- [x] Run focused tests and JS syntax checks.

### Task 2: Web Privacy & Data Binding UI

**Files:**
- Modify: `src/privacyData.js`
- Modify: `src/style.css` only if existing card spacing needs a class hook
- Test: `tests/privacyData.test.js`

**Interfaces:**
- Consumes account binding API routes from Task 1.
- Produces controller methods `loadWechatBindingStatus()` and `generateWechatBindingToken()`.

- [x] Write failing tests that authenticated Web users see “微信账户”, status is loaded with Bearer token, generated code displays once with expiry hint, guests cannot generate a token, and no internal ids are rendered.
- [x] Implement the account binding card in the existing Privacy & Data render flow.
- [x] Implement session-token retrieval and API calls through existing `fetchJson`.
- [x] Ensure account switching clears code/status and reloads for the current user.
- [x] Run focused tests.

### Task 3: Mini Program Binding UI And Client

**Files:**
- Create: `miniprogram/services/accountBinding.js`
- Modify: `miniprogram/pages/profile/index.js`
- Modify: `miniprogram/pages/profile/index.wxml`
- Test: `tests/miniprogramServices.test.js`
- Test: `tests/miniprogramStatic.test.js`

**Interfaces:**
- Consumes existing `auth.getAccessToken()`.
- Produces `getBindingStatus(options)` and `confirmBinding(bindingCode, options)`.

- [x] Write failing tests that unauthenticated Mini Program users cannot confirm, authenticated requests send WeChat Bearer token, `confirmMerge: true` is required, success triggers existing cloud sync, and no high-risk compliance words are introduced.
- [x] Implement `accountBinding.js` using existing request patterns and error mapping.
- [x] Add profile page input, merge confirmation modal, status messages, and success sync/restore call.
- [x] Run focused tests.

### Task 4: Documentation, Regression, Review, PR

**Files:**
- Create: `docs/ACCOUNT_BINDING_SETUP.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/WECHAT_AUTH_ARCHITECTURE.md`
- Modify: `docs/MINIPROGRAM_ARCHITECTURE.md`

**Interfaces:**
- Documents migration filename, SQL Editor steps, API list, privacy/logging boundaries, and manual Web/Mini Program verification.

- [x] Write/update docs with exact migration filename and manual Supabase SQL Editor instructions.
- [x] Run full `npm test`.
- [x] Run `node --check` on modified JS files.
- [x] Run `git diff --check`.
- [x] Run final reviewer.
- [x] Commit, push, and create PR titled `Add Email and WeChat Account Binding`.
