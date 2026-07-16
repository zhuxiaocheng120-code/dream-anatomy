# Supabase Security Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify and harden Supabase `dream_records` data isolation without changing product features or database shape beyond required security fixes.

**Architecture:** Treat Supabase RLS as the server-side boundary and client-side `user_id` filters as defense in depth. Add static and mock-based regression tests for migrations, cloud sync, environment exposure, and account switching. Document evidence and remaining manual verification in a Security Audit Matrix.

**Tech Stack:** Plain JavaScript, Node `node:test`, Supabase SQL migrations, Supabase JS SDK.

## Global Constraints

- Do not modify DeepSeek prompts or AI analysis behavior.
- Do not reopen deep guidance.
- Do not add payment, membership, WeChat, new tables, or service_role usage.
- Do not log full dream text, token, email, API key, or complete AI response.
- If RLS SQL is already correct, do not rewrite existing migrations for formality.
- If a security gap is found in already-applied schema, create a new migration instead of editing old migrations.

---

### Task 1: RLS And Environment Audit Tests

**Files:**
- Create: `tests/supabaseSecurity.test.js`
- Modify: none

**Interfaces:**
- Consumes: existing `supabase/migrations/*.sql`, `scripts/writeRuntimeEnv.js`, `.gitignore`, `server/aiAuth.js`, `server.js`, `lib/supabaseClient.js`
- Produces: static regression coverage for RLS, key exposure, no-store API response, and safe server Supabase client defaults

- [ ] **Step 1: Write the failing test**

Create `tests/supabaseSecurity.test.js` with tests that assert:
- base migration enables and forces RLS
- SELECT/INSERT/UPDATE/DELETE policies use `auth.uid() = user_id`
- `user_id` is non-null FK to `auth.users(id)` with cascade delete
- sync migration adds unique `(user_id, local_record_id)`
- runtime env script only exposes `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- `.env` and generated runtime/vendor files are ignored
- server auth client uses `persistSession: false` and `autoRefreshToken: false`
- `lib/supabaseClient.js` also uses non-persistent auth defaults

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: FAIL because `lib/supabaseClient.js` does not yet declare safe auth defaults.

### Task 2: Minimal Server Helper Hardening

**Files:**
- Modify: `lib/supabaseClient.js`
- Test: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Consumes: `createSupabaseClient()`
- Produces: a Supabase client helper that never persists or refreshes server-side sessions by default

- [ ] **Step 1: Implement minimal code**

Change `createClient(supabaseUrl, supabaseAnonKey)` to:

```js
return createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});
```

- [ ] **Step 2: Run focused test**

Run: `npm test -- tests/supabaseSecurity.test.js`

Expected: PASS.

### Task 3: Cloud Isolation Behavior Tests

**Files:**
- Modify: `tests/dreamSync.test.js`

**Interfaces:**
- Consumes: `DreamSync.createDreamSyncController`, `DreamSync.mapLocalRecordToSupabaseRow`
- Produces: regression coverage that forged `userId` and foreign pending records do not migrate or sync into the active account

- [ ] **Step 1: Add tests**

Add tests that assert:
- `mapLocalRecordToSupabaseRow()` ignores a forged record `userId` and uses the session user id
- pending records tagged with another `userId` are not uploaded when a different account logs in
- switching accounts clears visible records and does not show the prior account's records

- [ ] **Step 2: Run focused test**

Run: `npm test -- tests/dreamSync.test.js`

Expected: PASS if the current implementation already enforces these boundaries.

### Task 4: Security Audit Matrix

**Files:**
- Create: `docs/SUPABASE_SECURITY_AUDIT.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: audit evidence from code, migrations, and tests
- Produces: PR-ready matrix with Area, Current state, Risk, Evidence, Fix, Verification, Remaining limitation

- [ ] **Step 1: Create audit matrix**

Document:
- RLS state
- table constraints
- client query filters
- sync/upsert conflict keys
- auth/token handling
- runtime env exposure
- logging/privacy
- account switching/local cache behavior
- SQL injection search results
- manual online RLS checks still required

- [ ] **Step 2: Link from docs**

Add a short reference to the audit doc in README and PROJECT_STATUS.

### Task 5: Verification And PR

**Files:**
- No production code changes beyond previous tasks

**Interfaces:**
- Consumes: full test suite and final reviewer
- Produces: committed branch and PR

- [ ] **Step 1: Run verification**

Run:
- `npm test`
- `node --check server.js`
- `node --check src/app.js`
- `node --check src/auth.js`
- `node --check src/dreamSync.js`
- `node --check src/dreamHome.js`
- `node --check src/dreamJournal.js`
- `node --check lib/supabaseClient.js`
- `git diff --check`

- [ ] **Step 2: Request final reviewer**

Ask reviewer to inspect the full diff for Critical/Important findings only.

- [ ] **Step 3: Commit and PR**

Commit: `Harden Supabase data isolation`

PR title: `Audit Supabase Security and Data Isolation`
