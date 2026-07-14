# Protect AI API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Protect the shared Dream Anatomy AI API for Web Beta and future clients with identity parsing, limits, timeout handling, stable errors, and frontend Authorization headers.

**Architecture:** Add small server-only modules under `server/` for Supabase token identity, quota/rate/concurrency control, and stable error envelopes. Keep `server.js` as the composition point for validation, feature flags, DeepSeek calls, and the legacy/v1 route aliases. Add a browser helper in `src/app.js` so all AI requests share token/header/error handling without changing prompts or reopening deep guidance.

**Tech Stack:** Node.js, Express, native fetch, AbortController, Supabase JS SDK, plain browser JavaScript, Node test runner.

## Global Constraints

- Do not implement WeChat pages, WeChat login, phone login, payment, membership, Redis, new database tables, Timeline, Calendar, React/Vue, wildcard CORS, or deep guidance reopening.
- Do not modify DeepSeek prompt quality content or Dream Result Card content except for wrapping the existing call with access control and timeout handling.
- `DEEPSEEK_API_KEY` remains server-only.
- Supabase server token validation uses `SUPABASE_URL` and `SUPABASE_ANON_KEY`; no `service_role` key.
- Server Supabase client must use `persistSession: false` and `autoRefreshToken: false`.
- `/api/v1/dream-analysis` is the preferred route; `/api/dream-analysis` remains a compatibility alias.
- Deep guidance analysis types are rejected server-side when `DEEP_GUIDANCE_ENABLED=false` before quota usage and before DeepSeek calls.
- Stable errors use `{ error: { code, message }, usage }` and never expose tokens, stack traces, upstream bodies, full dreams, full AI responses, or emails.
- Successful AI responses keep existing fields and add `usage`.
- Memory quota/limit counters are acceptable for Beta and documented as reset-on-restart and single-instance only.

---

### Task 1: Server Access Control Modules

**Files:**
- Create: `server/aiErrors.js`
- Create: `server/aiAuth.js`
- Create: `server/aiAccessControl.js`
- Test: `tests/aiAuth.test.js`
- Test: `tests/aiAccessControl.test.js`

**Interfaces:**
- `createApiError(code, message, status, extra = {})`
- `formatApiError(error, usage = null)`
- `createAiAuthResolver({ createClient, env })`
- `resolveIdentity(request)`
- `createAiAccessControl(options)`
- `accessControl.start(identity, analysisType, now)`
- `accessControl.finish(reservation, outcome)`
- `accessControl.getUsage(identity, now)`

- [ ] Write failing tests for guest identity, valid token identity, invalid/expired token `401`, body `userId` ignored, different users isolated, daily limits, per-minute limits, retry-after, concurrency locks, refund on upstream failure, and cleanup.
- [ ] Implement the smallest server modules that pass the tests.
- [ ] Run `npm test -- tests/aiAuth.test.js tests/aiAccessControl.test.js`.

### Task 2: Protected AI Routes, Timeout, and Stable Errors

**Files:**
- Modify: `server.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Add `POST /api/v1/dream-analysis`.
- Keep `POST /api/dream-analysis` as an alias.
- `requestDeepSeekCompletion(dreamText, analysisType, options = {})` accepts `signal`.
- `requestDeepSeekAnalysis(...)` preserves existing return shape and generation retry behavior.

- [ ] Write failing tests for v1 route success, legacy alias success, guest/user usage metadata, invalid token `AUTH_INVALID`, `FEATURE_DISABLED` for guided types before DeepSeek, `DAILY_LIMIT_REACHED`, `RATE_LIMITED`, `REQUEST_IN_PROGRESS`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, `GENERATION_INCOMPLETE`, no quota loss on timeout/5xx, and `Cache-Control: no-store`.
- [ ] Implement protected route composition using the modules from Task 1.
- [ ] Add `AI_REQUEST_TIMEOUT_MS=45000` behavior with `AbortController`.
- [ ] Run `npm test -- tests/server.test.js tests/aiAuth.test.js tests/aiAccessControl.test.js`.

### Task 3: Frontend AI Request Helper

**Files:**
- Modify: `src/app.js`
- Test: `tests/dreamJournal.test.js`

**Interfaces:**
- `requestDreamAnalysis(payload)` calls `/api/v1/dream-analysis`.
- If `window.DreamAnatomyAuth.getClient().auth.getSession()` returns a session with `access_token`, send `Authorization: Bearer <token>`.
- If no session exists, send no Authorization header.
- Existing quick, guided, and result-card request functions call the helper.

- [ ] Write failing tests that logged-in AI requests include Bearer token, guest requests do not include fake tokens, `401` shows session-expired copy, `429` shows usage/rate copy, and historical saved results are not overwritten by API errors.
- [ ] Implement the helper and route migration.
- [ ] Keep deep guidance disabled while leaving legacy code paths behind the feature flag.
- [ ] Run `npm test -- tests/dreamJournal.test.js`.

### Task 4: Documentation and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Possibly modify: `.env.example`

**Interfaces:**
- Document `AI_GUEST_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT`, `AI_GUEST_REQUESTS_PER_MINUTE`, `AI_USER_REQUESTS_PER_MINUTE`, `AI_MAX_CONCURRENT_PER_PRINCIPAL`, `AI_REQUEST_TIMEOUT_MS`, and `DEEP_GUIDANCE_ENABLED`.
- State memory limits reset on Render restart and are not shared across multiple instances.

- [ ] Update docs and `.env.example` if missing.
- [ ] Run `npm test`.
- [ ] Run `node --check server.js src/app.js server/aiAuth.js server/aiAccessControl.js server/aiErrors.js`.
- [ ] Run `git diff --check`.
- [ ] Run final reviewer and fix Critical/Important findings only.
