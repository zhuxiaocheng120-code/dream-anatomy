# Reflection And Result Card States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve missing Dream Result Card states and add saved Dream Detail user reflection notes.

**Architecture:** Keep server quality control in `server.js`, Dream Result Card rendering in `src/dreamResultCard.js`, Dream Detail composition in `src/app.js`, and persistence through existing `saveDreamRecord()` / `DreamSync`. Store reflection in existing `reportContent` JSON without schema changes.

**Tech Stack:** Plain JavaScript, DOM APIs using `textContent` / textarea `value`, Node test runner, existing localStorage and Supabase SDK sync layer.

## Global Constraints

- Only Web Dream Result Card and Dream Detail behavior are in scope.
- Do not modify Mini Program code, AI prompts, DeepSeek supplier, Supabase schema, Auth flow, product analytics allowlist, payment, membership, or deep guidance availability.
- User reflection must not be sent to AI, product analytics, AI usage analytics, logs, or URLs.
- Missing scores must not be converted to fake `0`; true `score === 0` remains valid.
- Use Simplified Chinese user-visible copy and retain non-diagnostic, non-fortune-telling product positioning.
- Use `textContent` and textarea `value`; do not use `innerHTML` for user or AI content.

---

### Task 1: Result Card Missing Score States

**Files:**
- Modify: `tests/dreamResultCard.test.js`
- Modify: `src/dreamResultCard.js`

**Interfaces:**
- Consumes: `DreamResultCard.normalizeDreamResultCard(raw, context, options)`
- Produces: Rendered missing-score copy and `DreamResultCard.getDreamResultCardDisplayState(record)`

- [x] **Step 1: Write failing tests**

Add assertions that missing dimension scores render “线索不足，暂不评分”, share preview renders “暂不评分”, no 0%-style progress bar is present for missing scores, true zero still renders `0`, missing emotional intensity renders “线索不足，暂不评分”, and partial historical cards show “这是一条较早生成的梦境画像。”

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: FAIL because current renderer still says “暂不可用” and renders a progress element for missing scores.

- [x] **Step 3: Implement result card display states**

Update `src/dreamResultCard.js` to:

- Add dimension-specific missing rationale copy.
- Add `getDreamResultCardDisplayState(record)` returning `complete`, `partial_historical`, or `generation_failed`.
- Render score `null` as “线索不足，暂不评分”.
- Skip the progress element when `score === null`.
- Use details summary “观察依据” when `score === null`; keep “为什么” for scored dimensions.
- Render share preview missing scores as “暂不评分”.
- Render emotional intensity missing state as “线索不足，暂不评分”.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: PASS.

---

### Task 2: Standalone Result Card Quality Gate

**Files:**
- Modify: `tests/server.test.js`
- Modify: `server.js`

**Interfaces:**
- Consumes: `normalizeDeepSeekResultCardOutput(parsed)` and `validateResultCardQuality(card, dreamText)`
- Produces: `result_card` API rejects incomplete cards with `GENERATION_INCOMPLETE`

- [x] **Step 1: Write failing test**

Add server route tests where `analysisType: "result_card"` receives a card with only `symbol_depth` scored and where core fields such as `coreInsight` are blank before normalization. Assert HTTP 422, error code `GENERATION_INCOMPLETE`, and no partial `analysis` body is returned.

- [x] **Step 2: Run focused test and verify RED**

Run: `npm test -- tests/server.test.js`

Expected: FAIL because current standalone `result_card` path returns a normalized partial card.

- [x] **Step 3: Implement quality gate**

In `requestDeepSeekAnalysis()`, for `analysisType === "result_card"`:

- Validate the raw card for required fields before display fallback normalization.
- Normalize the card.
- Run `validateResultCardQuality(normalized, dreamText)`.
- If invalid, throw an Error with `code/status/statusCode` set to `GENERATION_INCOMPLETE` / `422`, `generationMeta.source = "generation_failed"`, and existing analytics metadata.
- Keep quick combined behavior unchanged.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/server.test.js`

Expected: PASS.

---

### Task 3: Dream Detail Reflection Editing

**Files:**
- Modify: `tests/dreamJournal.test.js`
- Modify: `src/app.js`
- Modify: `src/style.css`

**Interfaces:**
- Consumes: `saveDreamRecord(record)`, `getReportContent(record)`, `loadDreamRecords()`
- Produces: `reportContent.userReflection` and `reportContent.userReflectionUpdatedAt`

- [x] **Step 1: Write failing tests**

Add Dream Detail integration tests for:

- textarea and copy render.
- Saving new reflection persists `reportContent.userReflection` without removing existing analysis or `dreamResultCard`.
- Reopening detail restores saved reflection.
- Updating reflection changes content and timestamp.
- Empty/clear removes reflection and timestamp after confirmation.
- Failed save preserves UI and shows failure.
- Duplicate clicks while saving call `saveRecord` once.
- Concurrent manual Dream Result Card and reflection cloud saves are serialized and keep both fields.
- Stale save completion does not overwrite a newly opened record.
- Reflection is not included in AI request bodies or product analytics payloads.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL because current Dream Detail has only placeholder copy and no textarea/save behavior.

- [x] **Step 3: Implement reflection editor**

Update `src/app.js` to:

- Add constants/helpers for reflection max length, record identity, and `buildReflectionRecord(record, value)`.
- Render textarea, save button, clear button, and status.
- Use a per-record Dream Detail save queue over `saveDreamRecord()` to persist merged report content.
- Disable save while in flight.
- On successful save, update the current detail record in local/cloud visible list by relying on DreamSync result and re-rendering journal, then keep the current detail view on the same record.
- On failed save, show “保存失败，请稍后再试。” and do not mutate saved state.
- Make clear an explicit local input-clearing action; the stored field is removed only after the user clicks save.

Update `src/style.css` with minimal reflection form styling consistent with current site-wide visual language.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: PASS.

---

### Task 4: Sync, Export, Docs, And Regression

**Files:**
- Modify: `tests/dreamSync.test.js`
- Modify: `tests/privacyData.test.js`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: existing DreamSync `reportContent` passthrough and PrivacyData export
- Produces: documented reflection field and tests proving it stays in report content

- [x] **Step 1: Write failing or confirming tests**

Add/update tests proving:

- DreamSync maps `reportContent.userReflection` unchanged to/from Supabase rows.
- Privacy export includes reflection inside `reportContent` but still excludes tokens, hashes, emails, and other-account data.

- [x] **Step 2: Run focused tests**

Run: `npm test -- tests/dreamSync.test.js tests/privacyData.test.js`

Expected: Existing pass-through behavior may already pass; if so, document as confirming coverage.

- [x] **Step 3: Update docs**

Update README and PROJECT_STATUS to say Dream Detail now supports saved “自我思考” notes in `reportContent.userReflection`, with no AI use and no schema migration.

- [x] **Step 4: Run final verification**

Run:

- `npm test`
- `node --check src/app.js`
- `node --check src/dreamResultCard.js`
- `node --check server.js`
- `git diff --check`

Expected: PASS. If sandbox blocks server tests with `listen EPERM`, rerun `npm test` outside sandbox with escalation and report that boundary.
