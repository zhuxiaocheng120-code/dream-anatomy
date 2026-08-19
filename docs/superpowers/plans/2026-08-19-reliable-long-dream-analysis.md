# Reliable Long Dream Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route long Chinese dream records through a compact, evidence-safe preprocessing pipeline before the existing complete quick-analysis generation.

**Architecture:** A focused server-only module classifies inputs, chunks very long records, validates extraction responses against exact source fragments, and merges a bounded canonical representation. `server.js` keeps the existing final analysis/card normalization and retry behavior, but supplies compact structured context for long requests and emits privacy-safe latency diagnostics.

**Tech Stack:** Node.js 18+, CommonJS, native `fetch`, `AbortController`, Express, Node test runner.

## Global Constraints

- Keep the current direct path for dreams below both 800 characters and 650 estimated tokens.
- Use preprocessing at either long threshold and chunking at either 2,200 characters or 2,000 estimated tokens.
- Keep the 5,000-character hard input ceiling and existing total request timeout.
- Never log dream text, extracted content, complete model output, identity values, tokens, or secrets.
- Never return mock analysis, partial quick success, fabricated scores, or a result without a complete Dream Result Card.
- Do not modify frontend UI, database schema, auth, legal consent, rate limits, cloud sync, account binding, Deep Guidance, or Mini Program compliance copy.

---

### Task 1: Deterministic classification, chunking, normalization, and merge

**Files:**
- Create: `server/dreamPreprocessing.js`
- Create: `tests/dreamPreprocessing.test.js`

**Interfaces:**
- Produces: `estimateDreamTokens(text) -> number`
- Produces: `classifyDreamInput(text) -> { mode, characterCount, estimatedTokenCount }`
- Produces: `splitDreamIntoChunks(text) -> Array<{ index, text }>`
- Produces: `buildDreamExtractionPrompt(chunk, metadata) -> string`
- Produces: `normalizeDreamExtraction(raw, sourceText, chunkIndex) -> structured extraction or null`
- Produces: `createDeterministicExtraction(sourceText, chunkIndex) -> structured extraction`
- Produces: `mergeDreamExtractions(extractions, sourceText) -> canonical representation`
- Produces: `formatStructuredDreamContext(representation) -> string`

- [ ] **Step 1: Write failing classification and chunking tests**

Add tests asserting 200 characters is `direct`, 800 and 1,500 are `long`, 3,000 and 5,000 are `very_long`; assert a compact ASCII-heavy input can cross the token threshold; assert chunk boundaries prefer `。！？\n`, every chunk stays within configured character/token bounds, and concatenated normalized chunks preserve source order.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/dreamPreprocessing.test.js`

Expected: FAIL because `server/dreamPreprocessing.js` does not exist.

- [ ] **Step 3: Implement input metrics and coherent chunking**

Implement constants:

```js
const LONG_CHARACTER_THRESHOLD = 800;
const LONG_TOKEN_THRESHOLD = 650;
const VERY_LONG_CHARACTER_THRESHOLD = 2200;
const VERY_LONG_TOKEN_THRESHOLD = 2000;
const CHUNK_CHARACTER_LIMIT = 1500;
const CHUNK_TOKEN_LIMIT = 1400;
```

Classify with OR at each long boundary and keep direct only when both metrics remain below the first boundary. Split at paragraph/sentence boundaries, using a hard bounded split only when a single segment exceeds the chunk limit.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test tests/dreamPreprocessing.test.js`

Expected: classification and chunking tests PASS.

- [ ] **Step 5: Write failing extraction safety and merge tests**

Add tests proving:

```js
normalizeDreamExtraction({
  events: [{ order: 1, description: "走进学校", evidence: "走进学校" }],
  people: [{ name: "陌生医生", evidence: "陌生医生" }]
}, "我走进学校。", 0)
```

keeps the exact event evidence but removes the invented person; deterministic fallback contains only source sentences/fragments; merge removes repeated people/symbols, preserves ordered events, caps collections, and keeps every final evidence fragment traceable to the full source.

- [ ] **Step 6: Run extraction tests and verify RED**

Run: `node --test tests/dreamPreprocessing.test.js --test-name-pattern "evidence|fallback|merge"`

Expected: FAIL because extraction helpers are not implemented.

- [ ] **Step 7: Implement prompt, strict normalization, fallback, and merge**

The extraction prompt must request JSON only and explicitly prohibit interpretation, scoring, diagnosis, prediction, symbolism claims, and invented context. Normalize bounded strings and arrays, verify all evidence after whitespace normalization against the source, assign global order from chunk index, and merge with stable normalized-key deduplication.

- [ ] **Step 8: Run all preprocessing tests and verify GREEN**

Run: `node --test tests/dreamPreprocessing.test.js`

Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add server/dreamPreprocessing.js tests/dreamPreprocessing.test.js
git commit -m "Add safe long dream preprocessing primitives"
```

### Task 2: DeepSeek preprocessing and compact final-generation context

**Files:**
- Modify: `server.js`
- Modify: `tests/server.test.js`
- Test: `tests/dreamPreprocessing.test.js`

**Interfaces:**
- Consumes all Task 1 exports.
- Produces: `preprocessDreamForAnalysis(dreamText, options) -> { context, metrics, usage }`
- Changes `buildUserPrompt(dreamText, options)` and quick repair builders to accept `options.structuredContext` while retaining direct-path compatibility.

- [ ] **Step 1: Write failing route tests for direct, long, and very-long paths**

Add route tests with mocked DeepSeek responses proving:

- a 200-character dream makes one final call and no extraction call;
- an 800-character dream makes one extraction call followed by one final call;
- a 3,000-character dream makes multiple extraction calls and one final call;
- extraction requests use the lightweight schema and smaller `max_tokens`;
- final and repair prompts include canonical structured context and do not contain the complete long raw dream;
- upstream usage totals include extraction plus final calls.

- [ ] **Step 2: Run route tests and verify RED**

Run: `node --test tests/server.test.js --test-name-pattern "long dream|preprocess|structured context"`

Expected: FAIL because all quick requests still use the direct raw prompt.

- [ ] **Step 3: Add lightweight preprocessing completion support**

Add an internal extraction request using:

```js
{
  temperature: 0.1,
  max_tokens: 900,
  response_format: { type: "json_object" }
}
```

For very-long dreams, process up to three chunks concurrently at a time. Give each extraction call an independent `AbortController` bounded by the existing total deadline. Invalid, timed-out, or unavailable chunk extraction uses only that chunk's deterministic representation; it does not return a user-visible analysis.

- [ ] **Step 4: Feed compact context through final and repair prompts**

For quick long inputs, pass `structuredContext` to initial generation and every quick repair path. Continue passing the original dream text only to existing normalizers and validators. Do not change the standalone `result_card`, guided, or direct quick request behavior.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `node --test tests/dreamPreprocessing.test.js tests/server.test.js --test-name-pattern "long dream|preprocess|structured context|quick"`

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add server.js tests/server.test.js server/dreamPreprocessing.js tests/dreamPreprocessing.test.js
git commit -m "Route long dreams through compact analysis context"
```

### Task 3: Privacy-safe latency telemetry and documentation

**Files:**
- Modify: `server.js`
- Modify: `server/aiAnalytics.js`
- Modify: `tests/server.test.js`
- Modify: `tests/aiAnalytics.test.js`
- Modify: `.env.example`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Extends in-memory/safe-log analytics metadata with input metrics, preprocessing duration/count/fallback count, final-generation duration, and total-generation duration.
- Does not add database columns or expose these diagnostics in the API body.

- [ ] **Step 1: Write failing telemetry privacy tests**

Add tests asserting safe diagnostics contain only numeric/mode fields, accepted stage names include preprocessing where needed, and serialized logs/events do not contain distinctive source text or extracted content.

- [ ] **Step 2: Run telemetry tests and verify RED**

Run: `node --test tests/aiAnalytics.test.js tests/server.test.js --test-name-pattern "preprocessing telemetry|long dream diagnostics"`

Expected: FAIL because the new metrics are absent.

- [ ] **Step 3: Implement safe diagnostics and aggregate timing**

Record:

```js
{
  inputCharacterCount,
  estimatedInputTokens,
  inputMode,
  preprocessingDurationMs,
  preprocessingChunkCount,
  preprocessingFallbackCount,
  finalGenerationDurationMs,
  totalGenerationDurationMs
}
```

Sanitize mode and all numbers before logging. Keep the existing database-persisted event schema unchanged; aggregate DeepSeek token usage across preprocessing and final calls.

- [ ] **Step 4: Document thresholds and operational behavior**

Document direct/long/very-long thresholds, 5,000-character ceiling, deterministic extraction fallback boundary, unchanged total timeout, latency targets, and privacy-safe telemetry. Do not add new required environment variables.

- [ ] **Step 5: Run telemetry and documentation tests**

Run: `node --test tests/aiAnalytics.test.js tests/server.test.js tests/dreamPreprocessing.test.js`

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add server.js server/aiAnalytics.js tests/server.test.js tests/aiAnalytics.test.js .env.example README.md docs/PROJECT_STATUS.md
git commit -m "Add safe long analysis latency telemetry"
```

### Task 4: Production-like acceptance, regression, and review

**Files:**
- Modify only files required by Critical or Important reviewer findings.

**Interfaces:**
- Verifies the completed public API contract without adding behavior.

- [ ] **Step 1: Run synthetic mocked acceptance at all sizes**

Run tests covering exactly 200, 800, 1,500, 3,000, and 5,000 Chinese characters. Assert HTTP 200, analysis present, Dream Result Card present, four numeric dimensions, and no mock/fallback result.

- [ ] **Step 2: Run real DeepSeek acceptance with non-private synthetic dreams**

For each size, record only status, duration, input mode, chunk count, quality retry count, and completeness. Do not print source or response content. Target normal under 20 seconds, long under 30 seconds, and very long preferably under 40 seconds.

- [ ] **Step 3: Run full verification**

```bash
npm test
node --check server.js
node --check server/dreamPreprocessing.js
node --check server/aiAnalytics.js
git diff --check
```

Expected: all tests and checks PASS.

- [ ] **Step 4: Request final reviewer**

Review the complete diff for timeout regressions, prompt privacy, evidence fabrication, unbounded concurrency, incomplete-success paths, telemetry leakage, and out-of-scope changes. Fix Critical or Important findings only, then repeat Step 3.

- [ ] **Step 5: Commit final fixes and create PR**

```bash
git add server.js server/dreamPreprocessing.js server/aiAnalytics.js tests/server.test.js tests/dreamPreprocessing.test.js tests/aiAnalytics.test.js .env.example README.md docs/PROJECT_STATUS.md docs/superpowers/plans/2026-08-19-reliable-long-dream-analysis.md
git commit -m "Support reliable long dream analysis"
git push -u origin codex/support-reliable-long-dream-analysis
gh pr create --title "Support Reliable Long Dream Analysis" --body "Adds evidence-safe long-input preprocessing, compact final analysis context, privacy-safe latency telemetry, and 200-5000 character acceptance coverage."
```
