# Sleep Quality Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fixed sleep quality defaults with an optional 0-100 sleep feeling slider for quick analysis and Dream Detail.

**Architecture:** Add a small `src/sleepQuality.js` module for score snapping, label mapping, state normalization, and reportContent merging. `src/app.js` owns DOM wiring for the quick form and Dream Detail while reusing the module, and `src/dreamSync.js` preserves null sleep quality instead of converting it to `"未记录"`.

**Tech Stack:** Vanilla JavaScript SPA, Node `node:test`, browser-native `<input type="range">`, localStorage, Supabase SDK mapping.

## Global Constraints

- Product copy remains Chinese-first and must not describe sleep quality as a medical measurement.
- Initial sleep quality is `null`; no untouched slider may save `50` or `"未记录"`.
- Slider range is `0-100`, step is `5`, and labels are exactly: `0-20 很不安稳`, `21-40 偏疲惫`, `41-60 一般`, `61-80 比较安稳`, `81-100 很安稳`.
- Save top-level `sleepQuality` / `sleep_quality` as the text label only when the user has provided a value.
- Save `reportContent.sleepQualityScore`, `reportContent.sleepQualityLabel`, and `reportContent.sleepQualityUpdatedAt` only when a value exists.
- Clearing restores the unfilled state and removes sleep quality fields from the record/reportContent.
- Dream Detail must show `睡眠感受：65% · 比较安稳` when filled, and a low-distraction `补充睡眠感受` entry when missing.
- Updating sleep quality must merge `reportContent` and preserve AI analysis, Dream Result Card, `userReflection`, raw dream text, and all other fields.
- Sleep quality must not be sent to AI, must not change AI prompts, must not trigger reanalysis, must not enter product analytics payloads, logs, URLs, or AI usage events.
- No database migration; reuse `sleep_quality` and `report_content` JSONB.
- Do not modify miniprogram code in this Web PR.
- Do not use `innerHTML` to render user, AI, or sleep quality content.

---

## File Structure

- Create `src/sleepQuality.js`: pure sleep quality helpers and CommonJS/browser export wrapper.
- Modify `src/index.html`: add the quick analysis sleep slider between `#quickDream` and the submit buttons.
- Modify `src/app.js`: wire quick slider state, create/save records with optional sleep data, render and save Dream Detail sleep quality edits.
- Modify `src/style.css`: add parchment/archive range slider, sleep panel, detail sleep editor, and accessible states.
- Modify `src/dreamSync.js`: stop converting empty sleep quality to `"未记录"` during Supabase mapping.
- Modify `src/privacyData.js`: keep export/delete flows compatible with optional sleep quality and reportContent sleep fields.
- Test `tests/sleepQuality.test.js`: pure helper boundaries.
- Test `tests/dreamJournal.test.js`: quick form and Dream Detail integration.
- Test `tests/dreamSync.test.js`: Supabase mapping preserves null sleep quality and reportContent fields.
- Test `tests/privacyData.test.js`: export includes saved sleep score/label and no tokens.

---

### Task 1: Sleep Quality Helpers

**Files:**
- Create: `src/sleepQuality.js`
- Test: `tests/sleepQuality.test.js`

**Interfaces:**
- Produces: `getSleepQualityLabel(score: number): string`
- Produces: `snapSleepQualityScore(value: number|string): number`
- Produces: `normalizeSleepQualityState(input: object|number|null): { score: number|null, label: string, updatedAt: string }`
- Produces: `applySleepQualityToRecord(record: object, state: object, now?: () => string): object`

- [ ] **Step 1: Write the failing helper tests**

```js
const assert = require("node:assert/strict");
const test = require("node:test");

const SleepQuality = require("../src/sleepQuality");

test("maps sleep quality label boundaries", () => {
  const cases = [
    [0, "很不安稳"], [20, "很不安稳"], [21, "偏疲惫"], [40, "偏疲惫"],
    [41, "一般"], [60, "一般"], [61, "比较安稳"], [80, "比较安稳"],
    [81, "很安稳"], [100, "很安稳"]
  ];

  cases.forEach(([score, label]) => {
    assert.equal(SleepQuality.getSleepQualityLabel(score), label);
  });
});

test("snaps scores to 5 point steps and clamps to 0-100", () => {
  assert.equal(SleepQuality.snapSleepQualityScore(-3), 0);
  assert.equal(SleepQuality.snapSleepQualityScore(62), 60);
  assert.equal(SleepQuality.snapSleepQualityScore(63), 65);
  assert.equal(SleepQuality.snapSleepQualityScore(104), 100);
});

test("normalizes empty state without manufacturing a score", () => {
  const state = SleepQuality.normalizeSleepQualityState(null);
  assert.equal(state.score, null);
  assert.equal(state.label, "");
  assert.equal(state.updatedAt, "");
});

test("applies and clears sleep quality without overwriting report content", () => {
  const base = {
    sleepQuality: "未记录",
    reportContent: {
      dreamResultCard: { coreInsight: "也许在靠近选择。" },
      userReflection: "我想继续观察这个门。"
    }
  };

  const saved = SleepQuality.applySleepQualityToRecord(base, { score: 65 }, () => "2026-07-20T10:00:00.000Z");
  assert.equal(saved.sleepQuality, "比较安稳");
  assert.equal(saved.reportContent.sleepQualityScore, 65);
  assert.equal(saved.reportContent.sleepQualityLabel, "比较安稳");
  assert.equal(saved.reportContent.sleepQualityUpdatedAt, "2026-07-20T10:00:00.000Z");
  assert.deepEqual(saved.reportContent.dreamResultCard, base.reportContent.dreamResultCard);
  assert.equal(saved.reportContent.userReflection, base.reportContent.userReflection);

  const cleared = SleepQuality.applySleepQualityToRecord(saved, { score: null });
  assert.equal(cleared.sleepQuality, undefined);
  assert.equal(cleared.reportContent.sleepQualityScore, undefined);
  assert.equal(cleared.reportContent.sleepQualityLabel, undefined);
  assert.equal(cleared.reportContent.sleepQualityUpdatedAt, undefined);
  assert.deepEqual(cleared.reportContent.dreamResultCard, base.reportContent.dreamResultCard);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sleepQuality.test.js`
Expected: FAIL with module not found or missing exported helpers.

- [ ] **Step 3: Implement minimal helper module**

Create `src/sleepQuality.js` with the exported helper names above, boundary-safe label mapping, 5-point snap, null normalization, and reportContent merge/removal.

- [ ] **Step 4: Run helper tests**

Run: `node --test tests/sleepQuality.test.js`
Expected: PASS.

---

### Task 2: Quick Analysis Slider and Save Flow

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: `SleepQuality.getSleepQualityLabel`, `SleepQuality.snapSleepQualityScore`, `SleepQuality.applySleepQualityToRecord`
- Produces: quick form sleep state with `score: null|number`

- [ ] **Step 1: Write failing quick form tests**

Add tests asserting:
- untouched quick form save does not persist `sleepQuality`, `reportContent.sleepQualityScore`, or `50`;
- slider input `65` persists top-level `sleepQuality: "比较安稳"` and reportContent sleep fields;
- clear button restores unfilled state;
- AI request body contains `dreamText` and `analysisType` but no sleep quality fields.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `node --test tests/dreamJournal.test.js`
Expected: FAIL because no sleep slider DOM/state exists and default `"未记录"` is saved.

- [ ] **Step 3: Implement quick slider DOM and wiring**

Add the quick form slider panel after `#quickDream`, wire range `min=0 max=100 step=5`, label/status text, clear button, and use sleep state when calling `createDreamRecord(rawDreamText, quickDecode, sleepState)`.

- [ ] **Step 4: Style quick slider**

Add classes for parchment panel, ellipse track, circular thumb with lightweight original moon/star SVG background, filled track variable, disabled/empty copy, and keyboard-visible focus.

- [ ] **Step 5: Run targeted tests**

Run: `node --test tests/sleepQuality.test.js tests/dreamJournal.test.js`
Expected: PASS.

---

### Task 3: Dream Detail Sleep Quality Display and Editing

**Files:**
- Modify: `src/app.js`
- Modify: `src/style.css`
- Test: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: `SleepQuality.normalizeSleepQualityState`, `SleepQuality.applySleepQualityToRecord`
- Produces: `createSleepQualityDetailSection(record)` rendered inside Dream Detail

- [ ] **Step 1: Write failing detail tests**

Add tests asserting:
- filled records display `睡眠感受：65% · 比较安稳`;
- missing records do not render a `未记录` sleep quality card and show `补充睡眠感受`;
- modifying detail sleep quality preserves `dreamResultCard`, `userReflection`, and raw dream text;
- concurrent repeat clicks keep save button disabled and do not overwrite a new detail record.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `node --test tests/dreamJournal.test.js`
Expected: FAIL because detail currently always renders `睡眠质量 未记录` and has no editor.

- [ ] **Step 3: Implement detail section**

Remove fixed sleep meta rendering. Add a dedicated `睡眠感受` section after hero actions or before Dream Result Card, with display mode, `修改` / `补充睡眠感受`, same slider editor, save state text, save button, and clear button.

- [ ] **Step 4: Implement safe save merge**

Use existing `saveDreamDetailRecord(record, callback)` so cloud/local saves preserve current reportContent and cannot overwrite newer same-record state.

- [ ] **Step 5: Run targeted tests**

Run: `node --test tests/sleepQuality.test.js tests/dreamJournal.test.js`
Expected: PASS.

---

### Task 4: Sync and Export Compatibility

**Files:**
- Modify: `src/dreamSync.js`
- Modify: `src/privacyData.js`
- Test: `tests/dreamSync.test.js`
- Test: `tests/privacyData.test.js`

**Interfaces:**
- Consumes: optional `record.sleepQuality`, `record.sleep_quality`, and `reportContent.sleepQualityScore`
- Produces: Supabase rows with `sleep_quality: null` when unfilled and exports preserving sleep score/label via reportContent.

- [ ] **Step 1: Write failing sync/export tests**

Add tests asserting:
- empty sleep quality maps to `sleep_quality: null`;
- Supabase row with `sleep_quality: null` maps back without `"未记录"`;
- reportContent sleep score/label survives map round-trip;
- export includes `sleepQualityScore` and `sleepQualityLabel` when present.

- [ ] **Step 2: Run tests to verify failure**

Run: `node --test tests/dreamSync.test.js tests/privacyData.test.js`
Expected: FAIL because current mapping defaults to `"未记录"`.

- [ ] **Step 3: Update mapping and export**

Use `null` for unfilled `sleep_quality`, preserve reportContent untouched, and avoid adding fake sleep labels to exported records.

- [ ] **Step 4: Run compatibility tests**

Run: `node --test tests/dreamSync.test.js tests/privacyData.test.js`
Expected: PASS.

---

### Task 5: Full Verification, Review, and PR

**Files:**
- Review all changed files.

- [ ] **Step 1: Run full tests**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 2: Run syntax checks**

Run: `node --check src/app.js`
Expected: no output, exit 0.

Run: `node --check src/sleepQuality.js`
Expected: no output, exit 0.

Run: `node --check src/dreamSync.js`
Expected: no output, exit 0.

Run: `node --check src/privacyData.js`
Expected: no output, exit 0.

- [ ] **Step 3: Run whitespace check**

Run: `git diff --check`
Expected: no output, exit 0.

- [ ] **Step 4: Final reviewer**

Dispatch final reviewer against the branch diff. Fix Critical or Important findings only, then rerun covering tests.

- [ ] **Step 5: Commit and PR**

Commit message: `Add sleep quality slider`

PR title: `Add Sleep Quality Slider`

PR description includes:
- optional 0-100 sleep feeling slider in quick analysis;
- sleep labels and reportContent score metadata;
- Dream Detail display/edit flow;
- no AI prompt/API/schema/miniprogram changes;
- tests run.

---

## Self-Review

- Spec coverage: quick slider, null default, clear, boundaries, reportContent fields, detail edit, no AI payload, no migration, accessibility and Web-only constraints are covered.
- Placeholder scan: no task contains `TBD`, `TODO`, or vague test-only instructions without concrete expected behavior.
- Type consistency: helper names in Tasks 2-4 match Task 1 exports.
