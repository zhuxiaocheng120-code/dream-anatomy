# Dream Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance the existing Dream Detail view so Dream Journal records open into a complete, gentle, mobile-first detail page with folded AI analysis cards.

**Architecture:** Reuse the current Dream Journal to Dream Detail bridge in `src/app.js`. Keep record loading and Dream Journal behavior unchanged; only replace the detail render output and add focused styles/tests. Use native `<details>` cards for folded AI analysis.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node.js test runner.

## Global Constraints

- All user-visible Dream Detail text must be Simplified Chinese except existing brand/product names.
- Keep Dream Anatomy quiet, gentle, minimal, spacious, and mobile-first.
- Do not add or modify database schema.
- Do not modify DeepSeek API calls or prompt logic.
- Do not modify Dream Home behavior.
- Do not modify Dream Journal search, filter, grouping, or list behavior except where tests open an existing record.
- Do not add edit, delete, favorite, timeline, payment, membership, or cloud sync behavior.
- Render user-provided dream content using safe DOM APIs and `textContent`; do not introduce `innerHTML`.
- AI analysis cards must not provide diagnosis, treatment, fortune telling, bad/good luck judgments, or future prediction.

---

### Task 1: Detail Rendering Tests

**Files:**
- Modify: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: `window.DreamAnatomyApp.openDreamDetail(recordId, record)` from `src/app.js`.
- Produces: failing tests that describe the required Dream Detail UI.

- [ ] **Step 1: Write the failing test**

Add assertions to the existing `app bridge keeps opening existing Dream Detail from Dream Journal records` test. Use a record with:

```js
{
  id: "record-one",
  createdAt: "2026-07-12T22:35:00.000Z",
  rawDreamText: "我梦见自己走在一条很长的走廊里，尽头有一扇发光的门。",
  dreamSummary: "走廊尽头的门",
  emotions: "安静、迟疑",
  symbols: "走廊、门、光",
  sleepQuality: "浅睡",
  analysisType: "深度引导",
  reportContent: {
    summary: "梦境整理",
    jungianView: "可能是在靠近一个还没有完全展开的内在部分。",
    lifeConnection: "也许和最近的选择感有关。",
    reflectionQuestions: "你可以思考那扇门带来的感受。",
    smallAction: "写下一句话。",
    gentleReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  }
}
```

Assert that collected detail text contains:

- `走廊尽头的门`
- `日期`
- `时间`
- full raw dream text
- `梦境摘要`
- `情绪标签`
- `梦境意象`
- `AI 分析`
- `荣格`
- `弗洛伊德`
- `现代心理学`
- `自我思考`
- `这里先留给之后的自我思考记录。`

Inspect `details` children and assert every AI analysis card has `open !== true`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/dreamJournal.test.js
```

Expected: FAIL because current detail view lacks title-first layout, folded AI cards, and 自我思考 placeholder.

---

### Task 2: Minimal Detail Implementation

**Files:**
- Modify: `src/app.js`
- Modify: `src/index.html`

**Interfaces:**
- Consumes: records passed through `openDreamDetail(recordId, fallbackRow)`.
- Produces: enhanced `renderDreamDetail(recordId, fallbackRow)` output using safe DOM APIs.

- [ ] **Step 1: Add small helper functions in `src/app.js`**

Add helpers near the existing detail helpers:

```js
function normalizeDetailText(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function getRecordField(record, snakeCaseKey, camelCaseKey) {
  return record[camelCaseKey] || record[snakeCaseKey] || "";
}

function getDreamTitle(record) {
  return normalizeDetailText(record.title)
    || normalizeDetailText(getRecordField(record, "dream_summary", "dreamSummary"))
    || getShortDreamText(normalizeDetailText(getRecordField(record, "raw_dream_text", "rawDreamText")))
    || "未命名的梦";
}
```

- [ ] **Step 2: Replace `renderDreamDetail()` layout**

Keep record lookup unchanged. For a found record, render:

- `<header class="detail-hero">`
- `<h3>` with dream title
- a meta row for 日期 / 时间 / 分析类型 / 睡眠质量
- sections for 梦境原文, 梦境摘要, 情绪标签, 梦境意象
- `section.detail-analysis` with three `<details class="detail-analysis-card">` cards
- `section.detail-reflection` with `自我思考` heading and placeholder copy

Use only `document.createElement`, `append`, `replaceChildren`, and `textContent`.

- [ ] **Step 3: Keep page heading Chinese**

In `src/index.html`, change the detail eyebrow from `Dream Detail` to a Simplified Chinese phrase such as `梦境详情`, while keeping the main heading `梦境记录详情`.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/dreamJournal.test.js
```

Expected: PASS.

---

### Task 3: Detail Styling

**Files:**
- Modify: `src/style.css`
- Modify: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: classes from Task 2: `detail-hero`, `detail-hero-meta`, `detail-section`, `detail-analysis`, `detail-analysis-card`, `detail-reflection`.
- Produces: mobile-first, non-dashboard Dream Detail styles.

- [ ] **Step 1: Add static style assertions**

Extend the static asset test to assert CSS contains:

- `.detail-hero`
- `.detail-section`
- `.detail-analysis-card`
- `.detail-reflection`

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/dreamJournal.test.js
```

Expected: FAIL if the new CSS classes are not yet present.

- [ ] **Step 3: Add minimal CSS**

Add styles that:

- keep `.dream-detail` spacious
- style `.detail-hero` as an unframed header area
- style `.detail-section` as quiet 8px-radius cards
- style `.detail-analysis-card` as folded cards with subtle borders
- keep mobile-first layout and use desktop media query only to widen meta columns

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- tests/dreamJournal.test.js
```

Expected: PASS.

---

### Task 4: Documentation and Final Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: completed Dream Detail behavior.
- Produces: docs that accurately describe the current feature and boundaries.

- [ ] **Step 1: Update docs**

Update README and PROJECT_STATUS to say Dream Detail now shows complete dream detail with folded AI analysis cards for 荣格、弗洛伊德、现代心理学, plus a 自我思考 placeholder.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
node --check src/app.js
node --check src/dreamJournal.js
git diff --check
```

Expected: all pass.

- [ ] **Step 3: Request code review**

Run final reviewer against the branch diff from `main` to `HEAD`. Fix Critical and Important findings only.

- [ ] **Step 4: Commit and PR**

Commit:

```bash
git add src/app.js src/index.html src/style.css tests/dreamJournal.test.js README.md docs/PROJECT_STATUS.md docs/superpowers/specs/2026-07-13-dream-detail-design.md docs/superpowers/plans/2026-07-13-dream-detail.md
git commit -m "Build Dream Detail view"
git push -u origin codex/dream-detail
```

Create PR:

```bash
gh pr create --base main --head codex/dream-detail --title "Build Dream Detail view"
```
