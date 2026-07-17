# Privacy Data Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Dream Anatomy Web Beta privacy/data controls: legal documents, explicit consent, export, dream deletion, guest local cleanup, and account deletion.

**Architecture:** Add an existing-SPA `privacy-data` view with focused frontend modules for legal documents and privacy/data actions. Reuse Supabase SDK, RLS, and DreamSync for normal dream operations; use a server-only account deletion module for authenticated account deletion and Supabase Auth user removal.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js/Express, Supabase JavaScript SDK, Supabase SQL migrations, Node test runner.

## Global Constraints

- Use方案 A: SPA Privacy Center + Server Account Deletion Modules.
- Create `src/legalDocuments.js` for legal text and versions; do not place legal text in `app.js` or `index.html`.
- Create `src/privacyData.js` for privacy-data view, legal display, consent, export, dream deletion, clear-all, guest local cleanup, and account deletion interaction.
- Create `server/accountDeletion.js` for `DELETE /api/v1/account`; it must use verified Supabase token identity and service-role cleanup.
- `app.js` only wires modules, SPA navigation, and events.
- Account deletion order: authenticated analytics events, legal consents, dream records, Supabase Auth user, current account local cache, local sign-out, public home.
- Do not delete guest analytics.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `ANALYTICS_HASH_SECRET` to the browser.
- Add only public runtime config `PUBLIC_SUPPORT_EMAIL`.
- Do not trust body `userId` or `email` for deletion identity.
- Do not log full user ids, principal hashes, emails, tokens, dream text, or deletion payloads.
- Do not use `innerHTML` for user/API content.
- Dangerous actions use in-app confirmation UI, not final `window.confirm`/`window.alert`.
- Do not reopen deep guidance, modify AI prompts, add payment, membership, WeChat, Timeline, Calendar, product behavior analytics, or admin write operations.
- Legal text is Beta technical copy and must not claim lawyer review.
- Legal text must not say `永久保存`, `永不删除`, or `完全匿名`.

---

## File Structure

- Create `src/legalDocuments.js`: legal document versions and text helpers.
- Create `src/privacyData.js`: privacy/data controller and UI action handlers.
- Create `server/accountDeletion.js`: account deletion service.
- Create `supabase/migrations/20260717001000_create_legal_consents.sql`: legal consent table and RLS.
- Create `tests/legalDocuments.test.js`: legal text/version behavior.
- Create `tests/privacyData.test.js`: privacy controller behavior.
- Create `tests/accountDeletion.test.js`: server deletion sequencing.
- Modify `scripts/writeRuntimeEnv.js`: expose `PUBLIC_SUPPORT_EMAIL`.
- Modify `.env.example`: add `PUBLIC_SUPPORT_EMAIL=`.
- Modify `src/index.html`: add privacy-data view, legal links, consent checkbox, scripts, privacy entry.
- Modify `src/auth.js`: registration consent blocking and legal link hooks.
- Modify `src/dreamSync.js`: current-user delete/clear/cache helper methods.
- Modify `src/app.js`: module wiring, before-AI guest consent gate, detail delete button connection.
- Modify `src/style.css`: privacy center and confirmation UI styles.
- Modify `server.js`: wire `DELETE /api/v1/account`.
- Modify `tests/server.test.js`, `tests/dreamSync.test.js`, `tests/authDiagnostics.test.js`, `tests/supabaseSecurity.test.js`.
- Create `docs/PRIVACY_DATA_CONTROLS_SETUP.md`; update README, PROJECT_STATUS, SUPABASE_SECURITY_AUDIT.

---

### Task 1: Legal Documents, Runtime Support Email, And Consent Migration

**Files:**
- Create: `src/legalDocuments.js`
- Create: `tests/legalDocuments.test.js`
- Create: `supabase/migrations/20260717001000_create_legal_consents.sql`
- Modify: `scripts/writeRuntimeEnv.js`
- Modify: `.env.example`
- Modify: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Produces `DreamLegalDocuments.getLegalVersions()`.
- Produces `DreamLegalDocuments.getLegalDocument(type, runtimeEnv)`.
- Produces `DreamLegalDocuments.hasAcceptedVersions(consentRow)`.
- Produces migration table `public.legal_consents`.
- Produces browser-safe runtime config key `PUBLIC_SUPPORT_EMAIL`.

- [ ] **Step 1: Write failing tests**

Add `tests/legalDocuments.test.js`:

```js
const assert = require("node:assert/strict");
const test = require("node:test");
const LegalDocuments = require("../src/legalDocuments");

test("legal documents expose stable versions and configured support email", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.match(versions.privacyPolicyVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.termsVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(versions.aiDisclaimerVersion, /^\d{4}-\d{2}-\d{2}$/);

  const privacy = LegalDocuments.getLegalDocument("privacy", { PUBLIC_SUPPORT_EMAIL: "support@example.com" });
  assert.equal(privacy.title, "隐私政策");
  assert.equal(privacy.version, versions.privacyPolicyVersion);
  assert.match(JSON.stringify(privacy), /support@example\.com/);
});

test("legal documents do not make forbidden legal or privacy claims", () => {
  const all = ["privacy", "terms", "ai"].map((type) =>
    JSON.stringify(LegalDocuments.getLegalDocument(type, {}))
  ).join("\n");

  assert.doesNotMatch(all, /永久保存|永不删除|完全匿名|律师审核/);
  assert.match(all, /Beta 技术版本/);
  assert.match(all, /联系方式尚未配置/);
  assert.match(all, /不构成心理诊断/);
  assert.match(all, /不构成治疗建议/);
  assert.match(all, /不构成未来预测/);
});

test("hasAcceptedVersions checks all current legal versions", () => {
  const versions = LegalDocuments.getLegalVersions();
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: versions.privacyPolicyVersion,
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), true);
  assert.equal(LegalDocuments.hasAcceptedVersions({
    privacy_policy_version: "old",
    terms_version: versions.termsVersion,
    ai_disclaimer_version: versions.aiDisclaimerVersion
  }), false);
});
```

Extend `tests/supabaseSecurity.test.js`:

```js
test("legal consent migration creates current-user RLS policies", () => {
  const migration = readProjectFile("supabase/migrations/20260717001000_create_legal_consents.sql");

  assert.match(migration, /create table if not exists public\.legal_consents/);
  assert.match(migration, /user_id uuid primary key references auth\.users\(id\) on delete cascade/);
  assert.match(migration, /privacy_policy_version text not null/);
  assert.match(migration, /terms_version text not null/);
  assert.match(migration, /ai_disclaimer_version text not null/);
  assert.match(migration, /alter table public\.legal_consents enable row level security/);
  assert.match(migration, /alter table public\.legal_consents force row level security/);
  assert.match(migration, /for select\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for insert\s+to authenticated\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.match(migration, /for update\s+to authenticated\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/s);
  assert.doesNotMatch(migration, /to anon/);
});

test("public support email is exposed without exposing secrets", () => {
  const runtimeWriter = readProjectFile("scripts/writeRuntimeEnv.js");
  const envExample = readProjectFile(".env.example");

  assert.match(runtimeWriter, /PUBLIC_SUPPORT_EMAIL: process\.env\.PUBLIC_SUPPORT_EMAIL \|\| ""/);
  assert.doesNotMatch(runtimeWriter, /SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|DEEPSEEK_API_KEY/);
  assert.match(envExample, /^PUBLIC_SUPPORT_EMAIL=$/m);
});
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/legalDocuments.test.js tests/supabaseSecurity.test.js
```

Expected: fail because files and runtime support email do not exist.

- [ ] **Step 3: Implement legal documents, migration, and runtime env**

Create `src/legalDocuments.js` with UMD-style exports matching current frontend modules. Use version `"2026-07-17"` for all three documents. Use arrays of sections and `textContent`-friendly strings. Include the required privacy/terms/AI disclaimer content, support email fallback, and forbidden-copy avoidance.

Create `supabase/migrations/20260717001000_create_legal_consents.sql` with idempotent table, trigger, RLS, and policies.

Update `scripts/writeRuntimeEnv.js`:

```js
const runtimeConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
  PUBLIC_SUPPORT_EMAIL: process.env.PUBLIC_SUPPORT_EMAIL || ""
};
```

Add `PUBLIC_SUPPORT_EMAIL=` to `.env.example`.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm test -- tests/legalDocuments.test.js tests/supabaseSecurity.test.js
```

Expected: pass.

- [ ] **Step 5: Review Task 1**

Reviewer checks legal copy boundaries, migration RLS, and runtime secret exposure.

---

### Task 2: DreamSync Delete, Clear, And Export Helpers

**Files:**
- Modify: `src/dreamSync.js`
- Modify: `tests/dreamSync.test.js`

**Interfaces:**
- Produces `deleteRecord(recordId)`.
- Produces `clearCurrentRecords()`.
- Produces `clearCurrentLocalCache()`.
- Produces `getCurrentUser()`.
- Produces `getLegalExportIdentity()`.

- [ ] **Step 1: Write failing DreamSync tests**

Add tests that assert:

- authenticated delete calls `.delete().eq("id", cloudId).eq("user_id", user.id)`
- authenticated clear calls `.delete().eq("user_id", user.id)`
- failed cloud delete keeps local records
- guest delete removes only local guest record
- guest clear removes only local guest records
- account local cache clear removes only current user's local rows

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/dreamSync.test.js
```

Expected: fail because methods do not exist.

- [ ] **Step 3: Implement minimal DreamSync methods**

Add methods inside `createDreamSyncController`:

```js
async function deleteRecord(recordId) { ... }
async function clearCurrentRecords() { ... }
function clearCurrentLocalCache() { ... }
function getCurrentUser() { return getUser(); }
```

Use local id matching against `id`, `localRecordId`, and `cloudId`. For authenticated deletes, require `client` and active `user`; use explicit `user_id` filters before mutating local cache.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm test -- tests/dreamSync.test.js
```

Expected: pass.

- [ ] **Step 5: Review Task 2**

Reviewer checks cross-account isolation and failure handling.

---

### Task 3: Privacy Data Controller And SPA View

**Files:**
- Create: `src/privacyData.js`
- Create: `tests/privacyData.test.js`
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `src/style.css`

**Interfaces:**
- Produces `PrivacyData.createPrivacyDataController(options)`.
- Consumes `DreamLegalDocuments`.
- Consumes DreamSync methods from Task 2.
- Exposes `ensureGuestAiConsent()`, `handleSession()`, `openLegalDocument(type)`, `deleteDreamRecord(record)`, `exportData()`, `clearAllDreams()`, `deleteAccount()`.

- [ ] **Step 1: Write failing privacy controller tests**

Test:

- privacy entry/view renders Chinese labels
- legal document links render document sections with `textContent`
- guest AI consent stores local versions only after explicit confirm
- export excludes token, principal_hash, email, and full UUID
- clear-all requires exact `清空全部梦境`
- delete single record calls DreamSync and preserves UI on failure
- account deletion calls `/api/v1/account` with Bearer token and confirmation only
- logout/account switch clears privacy state

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/privacyData.test.js
```

Expected: fail because controller does not exist.

- [ ] **Step 3: Add privacy-data markup**

Modify `src/index.html`:

- add privacy entry near auth/session controls
- add `data-view="privacy-data"`
- add legal document viewer area
- add export/clear/delete account cards
- add confirmation dialog shell
- add register consent checkbox and document buttons in register form
- load scripts in order: `legalDocuments.js`, then `privacyData.js`, before `app.js`

- [ ] **Step 4: Implement `src/privacyData.js`**

Implement DOM-safe controller using only `textContent`, `createElement`, and `replaceChildren`. Use custom confirmation state. Use `URL.createObjectURL` / anchor download for export, with injected fallback in tests.

Guest consent key: `dreamAnatomy.legalConsent.guest`.

- [ ] **Step 5: Wire in `app.js`**

Create controller with:

- `localStorage`
- `dreamJournalStorageKey`
- `dreamSyncController`
- `DreamAnatomyAuth`
- `DreamLegalDocuments`
- app bridge: `showView`, `renderDreamJournal`, `loadDreamRecords`, `showDreamJournalList`

Before quick AI request, call:

```js
if (privacyDataController && !(await privacyDataController.ensureGuestAiConsent())) return;
```

Add delete button in Dream Detail that calls the controller.

- [ ] **Step 6: Add CSS**

Add responsive styles for privacy cards, legal document viewer, consent rows, danger confirmations, and disabled buttons. Keep radius <= 8px and current quiet visual language.

- [ ] **Step 7: Verify tests pass**

Run:

```bash
npm test -- tests/privacyData.test.js tests/dreamJournal.test.js tests/dreamHome.test.js
```

Expected: pass.

- [ ] **Step 8: Review Task 3**

Reviewer checks `app.js` remains glue-only and no user/API content uses `innerHTML`.

---

### Task 4: Auth Registration And Legal Consent Persistence

**Files:**
- Modify: `src/auth.js`
- Modify: `src/privacyData.js`
- Modify: `tests/authDiagnostics.test.js`
- Modify: `tests/privacyData.test.js`

**Interfaces:**
- Auth emits registration submit through privacy controller validation.
- Privacy controller persists `legal_consents` for authenticated users through Supabase SDK.

- [ ] **Step 1: Write failing tests**

Add tests:

- register checkbox default unchecked
- unchecked registration blocks `signUp`
- legal document buttons open viewer
- login/initial session checks consent
- stale version prompts once
- `TOKEN_REFRESHED` does not re-prompt current accepted versions
- switching account reloads consent

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/authDiagnostics.test.js tests/privacyData.test.js
```

Expected: fail.

- [ ] **Step 3: Implement auth/privacy consent integration**

Expose from `PrivacyData`:

```js
validateRegistrationConsent()
handleSession({ authEvent, user, client })
acceptCurrentLegalVersions()
```

In `auth.js`, before `client.auth.signUp`, call a callback from `window.DreamPrivacyData.validateRegistrationConsent()` if present. If false, show:

> 请先阅读并勾选同意用户协议、隐私政策和 AI 使用说明。

Do not sign up.

- [ ] **Step 4: Verify tests pass**

Run:

```bash
npm test -- tests/authDiagnostics.test.js tests/privacyData.test.js
```

Expected: pass.

- [ ] **Step 5: Review Task 4**

Reviewer checks explicit consent and session-event behavior.

---

### Task 5: Server Account Deletion API

**Files:**
- Create: `server/accountDeletion.js`
- Create: `tests/accountDeletion.test.js`
- Modify: `server.js`
- Modify: `server/aiErrors.js`
- Modify: `tests/server.test.js`

**Interfaces:**
- Produces `createAccountDeletionService(options)`.
- Produces route `DELETE /api/v1/account`.

- [ ] **Step 1: Write failing server tests**

Test:

- guest returns 401
- invalid token returns 401
- wrong confirmation returns 400
- body `userId` and `email` are ignored
- deletes authenticated `ai_usage_events` hash only
- does not delete guest analytics
- deletes `legal_consents`
- deletes `dream_records`
- deletes Auth user
- service role missing returns safe unavailable error
- partial failure returns safe error with request id
- `Cache-Control: no-store`

- [ ] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/accountDeletion.test.js tests/server.test.js
```

Expected: fail.

- [ ] **Step 3: Implement account deletion service**

Use `createAiAuthResolver` to verify Bearer token. Use `createAdminSupabaseClient` for service role operations. Recompute authenticated analytics hash with HMAC-SHA256 and `user:` prefix. Delete in the required order. Use stable errors:

- `AUTH_INVALID`
- `INVALID_REQUEST`
- `ANALYTICS_UNAVAILABLE` or `INTERNAL_ERROR` for missing service config
- `ACCOUNT_DELETION_FAILED`

Do not log sensitive values.

- [ ] **Step 4: Wire route in `server.js`**

Add:

```js
app.delete("/api/v1/account", async (request, response) => { ... });
```

Set `Cache-Control: no-store` on success and error.

- [ ] **Step 5: Verify tests pass**

Run with elevated permissions if local listen is sandbox-blocked:

```bash
npm test -- tests/accountDeletion.test.js tests/server.test.js
```

Expected: pass.

- [ ] **Step 6: Review Task 5**

Reviewer checks deletion order, service-role isolation, and no identity trust from body.

---

### Task 6: Documentation And Security Audit Updates

**Files:**
- Create: `docs/PRIVACY_DATA_CONTROLS_SETUP.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/SUPABASE_SECURITY_AUDIT.md`
- Modify: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Documents migration, support email, legal versioning, deletion scope, guest boundary, analytics deletion boundary, and manual verification.

- [ ] **Step 1: Write failing docs tests**

Extend `tests/supabaseSecurity.test.js` to assert:

- setup doc exists
- includes migration `20260717001000_create_legal_consents.sql`
- includes `PUBLIC_SUPPORT_EMAIL`
- includes Beta legal review warning
- says account deletion deletes authenticated analytics but not guest analytics
- does not say `永久保存`, `永不删除`, or `完全匿名`

- [ ] **Step 2: Run failing docs tests**

Run:

```bash
npm test -- tests/supabaseSecurity.test.js
```

Expected: fail.

- [ ] **Step 3: Write docs**

Create `docs/PRIVACY_DATA_CONTROLS_SETUP.md` and update README/status/audit.

- [ ] **Step 4: Verify docs tests pass**

Run:

```bash
npm test -- tests/supabaseSecurity.test.js
```

Expected: pass.

- [ ] **Step 5: Review Task 6**

Reviewer checks docs do not overclaim legal review, permanence, or anonymity.

---

### Task 7: Full Verification, Final Review, Commit, Push, PR

**Files:**
- All changed files.

**Interfaces:**
- Produces branch `codex/privacy-data-controls`.
- Produces commit `Add privacy and user data controls`.
- Produces PR `Add Privacy, Data Export, and Account Deletion`.

- [ ] **Step 1: Run full test suite**

Run:

```bash
npm test
```

If sandbox blocks local `127.0.0.1` listen, rerun with approved escalation.

- [ ] **Step 2: Run syntax checks**

Run:

```bash
node --check server.js
node --check server/accountDeletion.js
node --check src/legalDocuments.js
node --check src/privacyData.js
node --check src/app.js
node --check src/auth.js
node --check src/dreamSync.js
```

- [ ] **Step 3: Run diff check**

Run:

```bash
git diff --check
```

- [ ] **Step 4: Final reviewer**

Ask final reviewer to check all requirements, especially:

- no secret exposure
- account deletion order
- no body identity trust
- guest analytics untouched
- RLS and explicit user filters
- legal copy boundaries
- no `innerHTML`
- no prompt/deep-guidance changes

- [ ] **Step 5: Fix Critical/Important findings only**

If reviewer finds Critical or Important issues, fix them with focused tests and re-review.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add .env.example README.md docs/PROJECT_STATUS.md docs/SUPABASE_SECURITY_AUDIT.md docs/PRIVACY_DATA_CONTROLS_SETUP.md server.js server/aiErrors.js server/accountDeletion.js src/index.html src/style.css src/app.js src/auth.js src/dreamSync.js src/legalDocuments.js src/privacyData.js scripts/writeRuntimeEnv.js supabase/migrations/20260717001000_create_legal_consents.sql tests/*.test.js
git commit -m "Add privacy and user data controls"
```

- [ ] **Step 7: Push and create PR**

Run:

```bash
git push -u origin codex/privacy-data-controls
/opt/homebrew/bin/gh pr create --base main --head codex/privacy-data-controls --title "Add Privacy, Data Export, and Account Deletion" --body "<summary>"
```

PR body includes:

- architecture summary
- migration file name
- data deletion scope
- legal document versions
- test results
- final reviewer conclusion
- Supabase and Render manual setup steps

---

## Plan Self-Review

- Spec coverage: legal docs, public support email, consent, delete single, clear all, export, account deletion, docs, and tests are covered.
- Scope check: no WeChat, payment, deep guidance reopening, prompt changes, product analytics, Timeline, Calendar, or framework migration.
- Type consistency: `DreamLegalDocuments`, `PrivacyData`, DreamSync methods, and account deletion service names are defined before use.
- Placeholder scan: no `TBD`, `TODO`, or intentionally vague implementation steps remain.
