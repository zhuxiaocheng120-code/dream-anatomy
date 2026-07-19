# Privacy-Safe Product Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-party, opt-in, privacy-safe product behavior analytics system for Dream Anatomy Web Beta.

**Architecture:** Keep product analytics separate from legal consent and AI usage analytics. Store user opt-in in `product_analytics_preferences`, write behavior events only through a server service-role endpoint into `product_events`, and expose aggregate product usage to the existing admin SPA view. Frontend code uses a focused `src/productAnalytics.js` controller and only wires light tracking calls through existing modules.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js + Express, Supabase JavaScript SDK, Supabase SQL migrations, Node `node:test`.

## Global Constraints

- Use scheme B: `legal_consents` remains only for privacy policy, terms, AI disclaimer, and explicit legal consent timestamp.
- Product analytics preference lives in `public.product_analytics_preferences`.
- Product events live in `public.product_events` and are not directly readable or writable by browser roles.
- Product analytics is default off, optional, and can be disabled at any time.
- Disabling product analytics immediately stops new events and clears the local queue.
- Guest preference is browser-local only and never written to `product_analytics_preferences`.
- Login/account switch reloads that account's preference and does not inherit another account's enabled state.
- Use `ANALYTICS_HASH_SECRET` for `user:`, `installation:`, and `session:` HMAC values.
- Do not store raw IP, raw User-Agent, email, full Supabase UUID, tokens, Authorization header, dream text, dream title, AI analysis text, symbols, emotions, sleep quality, search text, URL query params, input contents, raw installation UUID, or raw session UUID.
- Do not use Google Analytics, Mixpanel, Amplitude, or any third-party behavior analytics SDK.
- Deep guidance remains disabled.
- Do not change DeepSeek prompt behavior.
- Do not add WeChat, payment, membership, Timeline, Calendar, React, Vue, or a route framework.
- Product analytics write failures must not break normal product use.
- AI usage analytics remains independent and unaffected by product analytics consent.
- Admin product metrics must be labeled: `基于已同意产品分析的用户样本`.
- `PRIVACY_POLICY_VERSION = "2026-07-19"`.
- `PRODUCT_ANALYTICS_VERSION = "2026-07-19"`.

---

## File Structure

- Create `supabase/migrations/20260719000000_create_product_analytics.sql`: preference and event tables, RLS, grants, indexes.
- Create `server/productAnalytics.js`: event allowlist, property sanitizer, HMAC helpers, request normalization, safe event recording, deletion helpers.
- Create `server/adminProductAnalytics.js`: product summary, funnel, retention, and range helpers.
- Modify `server/accountDeletion.js`: delete `product_analytics_preferences` and authenticated `product_events` during account deletion.
- Modify `server.js`: wire `POST /api/v1/product-events` and admin product analytics endpoints.
- Create `src/productAnalytics.js`: browser opt-in state, session/installation ids, queue, event de-duplication, flush, preference load/save, delete analytics data.
- Modify `src/privacyData.js`: render opt-in toggle, delete product analytics data action, preference status.
- Modify `src/legalDocuments.js`: privacy policy version/content and product analytics version export.
- Modify `src/adminAnalytics.js`: render product usage dashboard sections.
- Modify `src/index.html`: add product analytics UI shells, include `productAnalytics.js`.
- Modify `src/app.js` and `src/auth.js`: wire controller and track allowlisted events.
- Modify docs: `docs/PRODUCT_ANALYTICS_SETUP.md`, `README.md`, `docs/PROJECT_STATUS.md`, `docs/PRIVACY_DATA_CONTROLS_SETUP.md`.
- Add/modify tests: `tests/productAnalytics.test.js`, `tests/productAnalyticsFrontend.test.js`, `tests/adminProductAnalytics.test.js`, `tests/adminAnalyticsFrontend.test.js`, `tests/accountDeletion.test.js`, `tests/legalDocuments.test.js`, `tests/privacyData.test.js`, `tests/server.test.js`, `tests/supabaseSecurity.test.js`, `tests/authDiagnostics.test.js`, `tests/dreamJournal.test.js`.

---

### Task 1: Product Analytics Migration And Server Core

**Files:**
- Create: `supabase/migrations/20260719000000_create_product_analytics.sql`
- Create: `server/productAnalytics.js`
- Test: `tests/productAnalytics.test.js`
- Modify: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Produces: `PRODUCT_ANALYTICS_VERSION`
- Produces: `sanitizeProductEvent(rawEvent) -> { ok, event?, errorCode? }`
- Produces: `createProductPrincipalHash(identity, installationId, secret) -> string|null`
- Produces: `createProductSessionHash(sessionId, secret) -> string|null`
- Produces: `normalizeProductEventBatch(body, context) -> { events, rejected }`
- Produces: `recordProductEventsSafely(client, events, logger) -> Promise<{ ok, insertedCount, duplicateCount }>`
- Produces: `deleteProductEventsForIdentity(client, identity, installationId, secret) -> Promise<{ deleted: boolean, principalHash: string|null }>`

- [ ] **Step 1: Write failing server core tests**

Add tests to `tests/productAnalytics.test.js` covering:

```js
test("sanitizes allowlisted properties and strips private fields", () => {
  const event = sanitizeProductEvent({
    eventId: "00000000-0000-4000-8000-000000000001",
    eventName: "analysis_completed",
    occurredAt: "2026-07-19T00:00:00.000Z",
    sessionId: "00000000-0000-4000-8000-000000000002",
    properties: {
      analysis_type: "quick",
      source: "ai_generated",
      has_result_card: true,
      dreamText: "private dream",
      email: "private@example.com",
      unknown: "drop me"
    }
  });

  assert.equal(event.ok, true);
  assert.deepEqual(event.event.properties, {
    analysis_type: "quick",
    source: "ai_generated",
    has_result_card: true
  });
});
```

Also test unknown event names, batch max 20, guest installation HMAC, authenticated user HMAC, invalid token body user id ignored by caller context, duplicate insert handling, write failures safe, and product event deletion by authenticated and guest principal.

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
npm test -- tests/productAnalytics.test.js
```

Expected: fail because `server/productAnalytics.js` does not exist.

- [ ] **Step 3: Write migration tests**

Extend `tests/supabaseSecurity.test.js` to assert:

- migration creates `public.product_analytics_preferences`
- migration creates `public.product_events`
- RLS is enabled and forced on both tables
- `product_analytics_preferences` has current-user select/insert/update policies
- `product_events` revokes anon/authenticated and has no browser policy
- `event_id uuid not null unique`
- no TTL or delete-retention clause

- [ ] **Step 4: Run migration tests and verify RED**

Run:

```bash
npm test -- tests/supabaseSecurity.test.js
```

Expected: fail because migration is missing.

- [ ] **Step 5: Implement migration**

Create `supabase/migrations/20260719000000_create_product_analytics.sql` with:

```sql
create table if not exists public.product_analytics_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  version text,
  updated_at timestamptz not null default now()
);

alter table public.product_analytics_preferences enable row level security;
alter table public.product_analytics_preferences force row level security;

drop policy if exists "product analytics preferences select own" on public.product_analytics_preferences;
create policy "product analytics preferences select own"
on public.product_analytics_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "product analytics preferences insert own" on public.product_analytics_preferences;
create policy "product analytics preferences insert own"
on public.product_analytics_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "product analytics preferences update own" on public.product_analytics_preferences;
create policy "product analytics preferences update own"
on public.product_analytics_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  event_name text not null,
  principal_type text not null,
  principal_hash text not null,
  session_hash text,
  client_platform text not null default 'web',
  properties jsonb not null default '{}'::jsonb,
  app_version text,
  created_at timestamptz not null default now()
);

alter table public.product_events enable row level security;
alter table public.product_events force row level security;
revoke all on table public.product_events from anon;
revoke all on table public.product_events from authenticated;

create index if not exists product_events_occurred_at_idx on public.product_events (occurred_at);
create index if not exists product_events_event_name_idx on public.product_events (event_name);
create index if not exists product_events_principal_type_idx on public.product_events (principal_type);
create index if not exists product_events_principal_hash_occurred_at_idx on public.product_events (principal_hash, occurred_at);
```

- [ ] **Step 6: Implement server core**

Create `server/productAnalytics.js`. Keep allowlists as constants. Normalize events into database row shape. Use `crypto.createHmac("sha256", secret)`. Use `upsert` with `onConflict: "event_id"` or insert and treat unique conflicts as duplicates. Never return or log raw ids or payloads.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- tests/productAnalytics.test.js tests/supabaseSecurity.test.js
```

Expected: pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add server/productAnalytics.js supabase/migrations/20260719000000_create_product_analytics.sql tests/productAnalytics.test.js tests/supabaseSecurity.test.js
git commit -m "Add product analytics storage core"
```

---

### Task 2: Product Event API And Admin Aggregation

**Files:**
- Create: `server/adminProductAnalytics.js`
- Modify: `server.js`
- Modify: `server/aiErrors.js`
- Test: `tests/adminProductAnalytics.test.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Consumes Task 1 `normalizeProductEventBatch`, `recordProductEventsSafely`, `deleteProductEventsForIdentity`.
- Produces: `getProductAnalyticsSummary(client, options)`
- Produces: `getProductAnalyticsFunnel(client, options)`
- Produces: `getProductAnalyticsRetention(client, options)`
- Produces routes:
  - `POST /api/v1/product-events`
  - `GET /api/v1/admin/product-analytics/summary?range=7d`
  - `GET /api/v1/admin/product-analytics/funnel?range=7d`
  - `GET /api/v1/admin/product-analytics/retention?range=30d`

- [ ] **Step 1: Write failing aggregation tests**

Add `tests/adminProductAnalytics.test.js` covering:

- range normalization for `7d`, `30d`, `90d`
- summary counts approximate active principals, guest/auth split, page distribution, event distribution
- same-session funnel counts app open -> dream input -> analysis requested -> completed -> viewed -> saved
- D1 and D7 retention use UTC date keys
- cohort size below 5 returns `insufficient_data`
- formatted output never exposes full principal/session hashes

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/adminProductAnalytics.test.js
```

Expected: fail because module does not exist.

- [ ] **Step 3: Write failing route tests**

Extend `tests/server.test.js` for:

- `POST /api/v1/product-events` accepts valid guest opt-in event and returns no-store
- valid logged-in Bearer identity is used; body user id ignored
- invalid token returns `AUTH_INVALID`
- unknown event returns `INVALID_REQUEST`
- batch > 20 returns `INVALID_REQUEST`
- missing analytics secret returns `ANALYTICS_UNAVAILABLE`
- duplicate event id is not inserted twice
- admin product endpoints require admin auth
- admin product endpoints return no-store and sample-label-ready payloads

- [ ] **Step 4: Verify RED**

Run:

```bash
npm test -- tests/server.test.js
```

Expected: fail because routes are missing.

- [ ] **Step 5: Implement aggregation module**

Create `server/adminProductAnalytics.js` with pure helpers for UTC date keys, range filtering, unique principal counting, funnel stage counting by `session_hash`, and D1/D7 retention. Do not expose full hashes in returned payloads.

- [ ] **Step 6: Wire server routes**

Modify `server.js`:

- import product analytics modules
- add `getProductAnalyticsClient()`
- add `handleProductEventsRequest()`
- add admin product handlers using existing `getAdminAuth()`
- set `Cache-Control: no-store`
- use stable errors from `server/aiErrors.js`
- do not enable CORS

Modify `server/aiErrors.js` to add:

- `ANALYTICS_UNAVAILABLE` if not already present
- `PRODUCT_ANALYTICS_DISABLED`
- `PRODUCT_ANALYTICS_WRITE_FAILED`

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm test -- tests/adminProductAnalytics.test.js tests/server.test.js
```

Expected: pass.

- [ ] **Step 8: Commit Task 2**

```bash
git add server.js server/aiErrors.js server/adminProductAnalytics.js tests/adminProductAnalytics.test.js tests/server.test.js
git commit -m "Add product analytics API"
```

---

### Task 3: Frontend Consent, Queue, Privacy Center, And Legal Copy

**Files:**
- Create: `src/productAnalytics.js`
- Modify: `src/legalDocuments.js`
- Modify: `src/privacyData.js`
- Modify: `src/index.html`
- Modify: `src/style.css`
- Test: `tests/productAnalyticsFrontend.test.js`
- Test: `tests/privacyData.test.js`
- Test: `tests/legalDocuments.test.js`
- Test: `tests/authDiagnostics.test.js`

**Interfaces:**
- Produces browser global `DreamProductAnalytics`.
- Produces `DreamProductAnalytics.PRODUCT_ANALYTICS_VERSION`.
- Produces `createProductAnalyticsController(options)`.
- Privacy controller consumes `productAnalytics` controller through `options.productAnalytics`.

- [ ] **Step 1: Write failing frontend analytics tests**

Create `tests/productAnalyticsFrontend.test.js` covering:

- default off, no events sent
- `setAnalyticsConsent(true)` enables local guest analytics and creates installation id
- `setAnalyticsConsent(false)` clears queue, session id, guest installation id
- authenticated preference load reads `.from("product_analytics_preferences").select(...).eq("user_id", user.id).maybeSingle()`
- account switch does not inherit previous enabled state
- `trackView()` de-duplicates identical view names
- `trackEvent()` strips private properties before sending
- flush adds Bearer token only when session exists
- `TOKEN_REFRESHED` does not emit login event

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/productAnalyticsFrontend.test.js
```

Expected: fail because module does not exist.

- [ ] **Step 3: Write failing privacy/legal tests**

Update:

- `tests/legalDocuments.test.js`: privacy version is `2026-07-19`; terms and AI disclaimer remain `2026-07-17`; product analytics version exists; privacy copy mentions optional product analytics and forbidden fields.
- `tests/privacyData.test.js`: renders “帮助改进 Dream Anatomy”, default off, saves authenticated preference to `product_analytics_preferences`, guest preference local only, turning off clears queue, delete analytics data action calls product analytics deletion.
- `tests/authDiagnostics.test.js`: runtime config still does not expose service role, analytics secret, product hashes, or product event internals.

- [ ] **Step 4: Verify RED**

Run:

```bash
npm test -- tests/legalDocuments.test.js tests/privacyData.test.js tests/authDiagnostics.test.js
```

Expected: fail because UI/legal updates are missing.

- [ ] **Step 5: Implement `src/productAnalytics.js`**

Implement with safe DOM-free logic where possible:

- localStorage key `dreamAnatomy.productAnalytics.guestPreference`
- localStorage key `dreamAnatomy.productAnalytics.installationId`
- sessionStorage key `dreamAnatomy.productAnalytics.sessionId`
- queue max 20
- event ids via `crypto.randomUUID()` when available
- no dream text or arbitrary properties
- `flushEvents({ keepalive })` calls `/api/v1/product-events`
- fetch failures are swallowed after clearing in-flight state

- [ ] **Step 6: Update privacy center UI**

Modify `src/privacyData.js` and `src/index.html`:

- add opt-in card with toggle labeled “帮助改进 Dream Anatomy”
- copy: “允许我们记录不包含梦境内容的功能使用事件，用于分析产品体验、错误和使用趋势。你可以随时关闭。”
- add “删除我的产品分析数据”
- default toggle off
- update status messages in Simplified Chinese
- use `textContent` and DOM nodes only

- [ ] **Step 7: Update legal documents**

Modify `src/legalDocuments.js`:

- `PRIVACY_POLICY_VERSION = "2026-07-19"`
- add `PRODUCT_ANALYTICS_VERSION = "2026-07-19"`
- privacy policy section for optional product analytics
- keep `TERMS_VERSION = "2026-07-17"`
- keep `AI_DISCLAIMER_VERSION = "2026-07-17"`

- [ ] **Step 8: Run focused frontend tests**

Run:

```bash
npm test -- tests/productAnalyticsFrontend.test.js tests/legalDocuments.test.js tests/privacyData.test.js tests/authDiagnostics.test.js
```

Expected: pass.

- [ ] **Step 9: Commit Task 3**

```bash
git add src/productAnalytics.js src/legalDocuments.js src/privacyData.js src/index.html src/style.css tests/productAnalyticsFrontend.test.js tests/legalDocuments.test.js tests/privacyData.test.js tests/authDiagnostics.test.js
git commit -m "Add product analytics consent controls"
```

---

### Task 4: Product Behavior Instrumentation

**Files:**
- Modify: `src/app.js`
- Modify: `src/auth.js`
- Modify: `tests/dreamJournal.test.js`
- Modify: `tests/privacyData.test.js`
- Modify: `tests/productAnalyticsFrontend.test.js`

**Interfaces:**
- Consumes Task 3 `productAnalyticsController.trackEvent`, `trackView`, `handleAuthEvent`, `flushEvents`.

- [ ] **Step 1: Write failing behavior tests**

Extend tests to cover:

- `app_opened` once per page/session
- `view_opened` does not fire for admin and does not repeat for same view
- `journal_opened` fires when diary opens
- `dream_detail_opened` fires when detail opens
- quick input start fires once and no input content is sent
- abandoning quick input sends `length_bucket`, not exact length
- quick submit emits one `analysis_requested`
- success emits `analysis_completed`, `result_viewed`, and one `dream_saved`
- failure emits `analysis_failed`, not completion
- `signup_started`, `signup_completed`, and `login_completed` are not triggered by `INITIAL_SESSION` or `TOKEN_REFRESHED`
- export/delete/clear emit events only after success

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js
```

Expected: fail because instrumentation is missing.

- [ ] **Step 3: Wire product analytics controller in `src/app.js`**

Add controller initialization after `privacyDataController` dependencies are available. Pass:

- `auth: window.DreamAnatomyAuth || {}`
- `storage: localStorage`
- `sessionStorage`
- `fetch`
- `app: { getCurrentView, showView }` only if needed

Call:

- `trackEvent("app_opened")` on first startup when enabled
- `trackView(viewName)` inside `showView()` except admin
- `trackEvent("journal_opened")` on diary open
- `trackEvent("dream_detail_opened")` in `openDreamDetail`
- quick form events at submit/success/failure/save points
- export/delete/clear through privacy controller callbacks

- [ ] **Step 4: Wire auth event tracking in `src/auth.js`**

Add optional calls to `window.DreamProductAnalytics`:

- `signup_started` on explicit register form submit before Supabase call
- `signup_completed` only after successful signUp
- `login_completed` only after successful `signInWithPassword`
- no auth tracking for `INITIAL_SESSION`, `TOKEN_REFRESHED`, or session restore

- [ ] **Step 5: Run focused behavior tests**

Run:

```bash
npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js
```

Expected: pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/app.js src/auth.js tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js
git commit -m "Track opt-in product behavior events"
```

---

### Task 5: Admin UI, Account Deletion Integration, Docs, And Final Verification

**Files:**
- Modify: `server/accountDeletion.js`
- Modify: `src/adminAnalytics.js`
- Modify: `src/index.html`
- Modify: `src/style.css`
- Create: `docs/PRODUCT_ANALYTICS_SETUP.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/PRIVACY_DATA_CONTROLS_SETUP.md`
- Test: `tests/adminAnalyticsFrontend.test.js`
- Test: `tests/accountDeletion.test.js`
- Test: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Consumes Task 1 `deleteProductEventsForIdentity`.
- Consumes Task 2 admin product endpoints.
- Consumes Task 3 product analytics controller delete method.

- [ ] **Step 1: Write failing admin/deletion/docs tests**

Add/extend tests:

- admin UI renders product usage section and sample limitation copy
- admin UI does not render full principal/session hashes
- account deletion deletes `product_analytics_preferences`
- account deletion deletes authenticated `product_events`
- account deletion does not delete guest `product_events`
- docs mention migration, allowlist, consent/withdrawal, D1/D7 definitions, long-term storage, deletion boundaries, sample limitation

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- tests/adminAnalyticsFrontend.test.js tests/accountDeletion.test.js tests/supabaseSecurity.test.js
```

Expected: fail until integrations/docs are added.

- [ ] **Step 3: Update account deletion**

Modify `server/accountDeletion.js`:

- after authenticated analytics HMAC cleanup, also delete `product_events` for authenticated principal hash
- delete `product_analytics_preferences` for verified `user_id`
- do not delete guest product events
- preserve safe deletion order around Auth deletion from PR #26

- [ ] **Step 4: Extend admin dashboard UI**

Modify `src/adminAnalytics.js`, `src/index.html`, and `src/style.css`:

- add product usage cards
- add product funnel rows
- add product retention rows
- label all product analytics data with `基于已同意产品分析的用户样本`
- keep layout quiet, mobile-friendly, and not table-heavy
- do not display hashes

- [ ] **Step 5: Add docs**

Create `docs/PRODUCT_ANALYTICS_SETUP.md` with:

- migration file name
- data fields
- event allowlist
- property allowlist
- consent and withdrawal behavior
- D1/D7 retention definitions using UTC
- long-term retention boundary without TTL
- authenticated and guest deletion boundaries
- admin sample limitation
- Supabase SQL Editor steps
- Render requirements
- manual online verification steps

Update README, PROJECT_STATUS, and PRIVACY_DATA_CONTROLS_SETUP.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- tests/adminAnalyticsFrontend.test.js tests/accountDeletion.test.js tests/supabaseSecurity.test.js
```

Expected: pass.

- [ ] **Step 7: Run full verification**

Run:

```bash
node --check server.js
node --check server/productAnalytics.js
node --check server/adminProductAnalytics.js
node --check server/accountDeletion.js
node --check src/productAnalytics.js
node --check src/privacyData.js
node --check src/adminAnalytics.js
node --check src/app.js
node --check src/auth.js
npm test
git diff --check
```

Expected: all pass.

- [ ] **Step 8: Final reviewer**

Dispatch final reviewer with a review package from merge-base to HEAD. Fix Critical or Important findings only, rerun affected tests and full verification.

- [ ] **Step 9: Commit Task 5**

```bash
git add server/accountDeletion.js src/adminAnalytics.js src/index.html src/style.css docs/PRODUCT_ANALYTICS_SETUP.md README.md docs/PROJECT_STATUS.md docs/PRIVACY_DATA_CONTROLS_SETUP.md tests/adminAnalyticsFrontend.test.js tests/accountDeletion.test.js tests/supabaseSecurity.test.js
git commit -m "Add product analytics admin reporting"
```

- [ ] **Step 10: Create PR**

Push and create:

```bash
git push -u origin codex/product-analytics
gh pr create --base main --head codex/product-analytics --title "Add Privacy-Safe Product Analytics"
```

PR body must include:

- architecture summary
- migration file name
- event allowlist
- data privacy boundary
- consent and deletion flow
- funnel and retention definitions
- test results
- final reviewer conclusion
- Supabase manual setup steps

---

## Plan Self-Review

- Spec coverage: the tasks cover opt-in consent, separate preference table, product event storage, event API, identity hashing, allowlist filtering, admin reporting, withdrawal/deletion, account deletion, docs, and verification.
- Placeholder scan: no unresolved placeholder markers are used as plan requirements.
- Type consistency: frontend controller and server module names are defined before use and reused consistently across tasks.
- Scope check: this is one PR because the event pipeline, opt-in control, admin reporting, and deletion boundary depend on the same schema and identity model. No unrelated product features are included.
