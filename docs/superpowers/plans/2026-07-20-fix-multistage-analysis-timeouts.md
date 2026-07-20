# Fix Multi-Stage Analysis Timeouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix quick analysis production regressions caused by sharing one abort signal across multiple upstream generation stages.

**Architecture:** Keep the existing complete-success contract: quick analysis only succeeds when text analysis and Dream Result Card are both complete. Replace the single shared upstream timeout with a server-side stage timeout runner that gives each DeepSeek attempt its own `AbortController`, while a total request deadline prevents unbounded waiting. Record stage names, durations, retry count, and final error code in analytics metadata without logging dream text or model output.

**Tech Stack:** Node.js, Express, native `fetch`, AbortController, existing `node:test` test suite.

## Global Constraints

- Do not restore partial text-only success.
- Do not modify AI Prompt content except timeout-related plumbing.
- Do not modify database schema.
- Do not modify sleep quality, user reflection, WeChat identity, DreamSync, or deep guidance behavior.
- Do not record dream text, full AI response, token, email, raw IP, or API key in logs or analytics.
- Keep public API stable: external timeout errors still use `UPSTREAM_TIMEOUT`.

---

### Task 1: Server Stage Timeout Runner

**Files:**
- Modify: `server.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Produces: `getAiTimeoutConfig()` returning `{ initialAttemptMs, repairAttemptMs, limitedAttemptMs, totalRequestMs }`.
- Produces: `runDeepSeekStage(stage, timeoutMs, totalDeadlineMs, task, analyticsMeta)` to create a fresh `AbortController` per stage and record `stageDurations`.
- Consumes: existing `requestDeepSeekCompletion(dreamText, analysisType, options)`.

- [x] **Step 1: Write failing test**

Add a route test where the first quick combined call returns incomplete `dreamResultCard`, the second call succeeds, and the second call receives a fresh non-aborted signal even after the first call takes most of the old total timeout.

- [x] **Step 2: Verify red**

Run:

```bash
npm test -- tests/server.test.js --test-name-pattern "repair stage receives its own timeout"
```

Expected: FAIL because the second upstream call reuses the first shared abort signal or no stage timeout config exists.

- [x] **Step 3: Implement minimal stage timeout runner**

Add timeout config defaults:

```js
AI_INITIAL_ATTEMPT_TIMEOUT_MS=45000
AI_REPAIR_ATTEMPT_TIMEOUT_MS=30000
AI_LIMITED_ATTEMPT_TIMEOUT_MS=25000
AI_TOTAL_REQUEST_TIMEOUT_MS=90000
```

Use fresh `AbortController` for each stage, with a per-stage timer bounded by the total deadline.

- [x] **Step 4: Verify green**

Run:

```bash
npm test -- tests/server.test.js --test-name-pattern "repair stage receives its own timeout"
```

Expected: PASS.

### Task 2: Quick Three-Stage Flow And Overall Deadline

**Files:**
- Modify: `server.js`
- Test: `tests/server.test.js`

**Interfaces:**
- Consumes: `runDeepSeekStage()`.
- Produces: analytics meta fields: `generationStage`, `stageDurations`, `qualityRetryCount`, `finalErrorCode`.

- [x] **Step 1: Write failing tests**

Cover:
- initial success calls upstream once;
- initial incomplete then repair success;
- initial and repair incomplete then limited success;
- total timeout aborts current stage and skips later stages;
- three failed stages return no partial text result.

- [x] **Step 2: Verify red**

Run:

```bash
npm test -- tests/server.test.js --test-name-pattern "multi-stage|overall timeout|three-stage"
```

Expected: at least one FAIL before implementation.

- [x] **Step 3: Route quick/result_card retries through stage runner**

Use stages:
- `initial`
- `repair`
- `limited`

For quick non-card full retries, keep the existing single quality retry but run it under `repair` timeout. For standalone result-card, use the same stage semantics.

- [x] **Step 4: Verify green**

Run:

```bash
npm test -- tests/server.test.js --test-name-pattern "multi-stage|overall timeout|three-stage|quick"
```

Expected: PASS.

### Task 3: Analytics And Frontend Error Classification

**Files:**
- Modify: `server/aiAnalytics.js`
- Modify: `src/app.js`
- Test: `tests/aiAnalytics.test.js`
- Test: `tests/dreamJournal.test.js`

**Interfaces:**
- `buildUsageEvent(context)` accepts `generationStage`, `stageDurations`, and `finalErrorCode`.
- Quick failure UI maps `GENERATION_INCOMPLETE`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, `RATE_LIMITED`, and `DAILY_LIMIT_REACHED` to distinct Chinese copy.

- [x] **Step 1: Write failing tests**

Add tests proving analytics event includes safe stage metadata and frontend failure leaves input/sleep quality state intact while showing distinct timeout/incomplete messages.

- [x] **Step 2: Verify red**

Run:

```bash
npm test -- tests/aiAnalytics.test.js tests/dreamJournal.test.js
```

Expected: FAIL for missing metadata or message distinctions if not already covered.

- [x] **Step 3: Implement minimal metadata and copy mapping**

Do not include dream text or model output. If schema columns do not exist, keep extra stage metadata in the event object only when the current in-memory/test writer accepts it; otherwise keep metadata available for future migration and preserve existing insert behavior.

- [x] **Step 4: Verify green**

Run:

```bash
npm test -- tests/aiAnalytics.test.js tests/dreamJournal.test.js
```

Expected: PASS.

### Task 4: Documentation, Full Verification, Review, PR

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

- [x] **Step 1: Document timeout env vars**

Document new timeout variables and defaults. Mark `AI_REQUEST_TIMEOUT_MS` as legacy compatibility if kept.

- [x] **Step 2: Run verification**

Run:

```bash
npm test
node --check server.js
node --check src/app.js
git diff --check
```

Expected: all pass.

- [x] **Step 3: Final reviewer**

Dispatch reviewer focused on timeout architecture, no partial success, privacy of analytics metadata, and scope boundaries.

- [ ] **Step 4: Commit and PR**

Commit:

```bash
git commit -m "Fix multi-stage analysis timeout handling"
```

PR title:

```text
Fix Quick Analysis Multi-Stage Timeouts
```
