# Dream Result Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an on-demand Dream Result Card, shown as `梦境画像`, to Dream Detail without changing Supabase schema or replacing existing detail sections.

**Architecture:** Keep card definitions and rendering outside `app.js`. Add `src/dreamArchetypes.js` for stable archetypes and `src/dreamResultCard.js` for normalization/rendering. Extend the existing `/api/dream-analysis` proxy with `analysisType: "result_card"` while preserving existing quick-analysis behavior.

**Tech Stack:** Plain HTML/CSS/JavaScript, Node.js + Express, native `fetch`, Supabase via existing `dreamSync.js`, Node test runner.

## Global Constraints

- Do not modify `AGENTS.md`, `docs/MVP_SPEC.md`, or `docs/ACCEPTANCE.md`.
- Do not add Supabase tables or schema fields.
- Do not modify the API provider or expose API keys to the frontend.
- Do not log full dreams, tokens, sessions, API keys, or full AI responses.
- All user-visible Dream Result Card UI copy must be Simplified Chinese except `Dream Anatomy`, `Dream Home`, `Dream Archive`, and archetype English subtitles.
- Dream Result Card is an enhancement to Dream Detail, not a replacement for existing raw text, summary, emotions, symbols, AI analysis, or gentle reminder.
- Use `reportContent.dreamResultCard` / `report_content.dreamResultCard` to store generated card data.
- AI and user content must be rendered with `textContent` or equivalent text-node APIs; do not use `innerHTML` for card content.
- Do not implement WeChat sharing, image download, favorites, trash, editing, Timeline, Calendar, Dream Growth, long-term cross-dream analysis, payment, membership, or mini-program work.
- Use non-absolute language such as `可能`, `也许`, `可以理解为`, `本次梦境更接近`, and `你可以思考`.
- Do not add user-visible copy saying `Dashboard`, `Personality Test`, `Diagnosis`, `命运`, `预言`, `你就是`, or `这说明你一定`.

---

### Task 1: Archetype And Card Normalization

**Files:**
- Create: `src/dreamArchetypes.js`
- Create: `src/dreamResultCard.js`
- Test: `tests/dreamResultCard.test.js`
- Modify: `src/index.html`

**Interfaces:**
- Produces `window.DreamArchetypes` and CommonJS exports:
  - `archetypes: Array<{ id, nameZh, nameEn, summary, keywords }>`
  - `getArchetypeById(id: string): object`
  - `getFallbackArchetype(context?: object): object`
  - `normalizeArchetype(value: object, context?: object): object`
- Produces `window.DreamResultCard` and CommonJS exports:
  - `normalizeDreamResultCard(raw: object, context?: object): object`
  - `getDreamResultCardFromRecord(record: object): object | null`
  - `getDimensionDefinitions(): Array<{ id, name }>`

- [ ] **Step 1: Write failing tests**

Add `tests/dreamResultCard.test.js` with tests that require both modules and assert:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const DreamArchetypes = require("../src/dreamArchetypes");
const DreamResultCard = require("../src/dreamResultCard");

test("normalizes stable archetypes with Chinese primary names", () => {
  assert.equal(DreamArchetypes.archetypes.length, 8);
  assert.deepEqual(
    DreamArchetypes.archetypes.map((item) => item.id),
    ["seeker", "explorer", "guardian", "observer", "transformer", "creator", "healer", "homecomer"]
  );
  assert.equal(DreamArchetypes.normalizeArchetype({ id: "seeker" }).nameZh, "寻路者");
  assert.equal(DreamArchetypes.normalizeArchetype({ id: "unknown" }).nameZh, "寻路者");
});

test("normalizes Dream Result Card fields safely", () => {
  const card = DreamResultCard.normalizeDreamResultCard({
    archetype: { id: "creator", summary: "本次梦境更接近创造者原型，也许和表达有关。" },
    coreInsight: "这个梦也许在提醒你重新看见表达。",
    dimensions: [
      { id: "symbol_depth", score: 200, summary: "多个意象出现。", rationale: ["门出现。"] },
      { id: "emotion_intensity", score: -4, summary: "情绪很轻。", rationale: ["语气平静。"] },
      { id: "self_awareness", score: 55, summary: "有停留观察。", rationale: ["记录了自己的迟疑。"] },
      { id: "growth_signal", score: 72, summary: "也许出现新的方向。", rationale: ["发光的门。"] },
      { id: "unsupported", score: 99, summary: "忽略。", rationale: ["忽略。"] }
    ],
    symbols: [
      { name: "门", contextMeaning: "在这次梦里可能和选择有关。", evidence: "门发光。", reflectionQuestion: "门后是什么？" },
      { name: "走廊" },
      { name: "光" },
      { name: "第四个应被忽略" }
    ],
    emotionalProfile: { primary: "迟疑", secondary: ["好奇", "紧张"], intensity: 101, evidence: "停在门前很久。" },
    reflectionQuestions: ["门后可能是什么？", "你想靠近什么？", "哪里让你迟疑？", "第四个忽略。"],
    safetyReminder: "这不是诊断、治疗或预言，只是一种自我探索视角。"
  });

  assert.equal(card.archetype.nameZh, "创造者");
  assert.equal(card.dimensions.length, 4);
  assert.equal(card.dimensions[0].score, 100);
  assert.equal(card.dimensions[1].score, 0);
  assert.equal(card.symbols.length, 3);
  assert.equal(card.emotionalProfile.intensity, 100);
  assert.equal(card.reflectionQuestions.length, 3);
  assert.match(card.safetyReminder, /不是诊断、治疗或预言/);
});

test("extracts existing card data from camelCase and snake_case records", () => {
  const card = { archetype: { id: "seeker" }, coreInsight: "也许在找方向。" };
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: { dreamResultCard: card } }), card);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ report_content: { dreamResultCard: card } }), card);
  assert.equal(DreamResultCard.getDreamResultCardFromRecord({ reportContent: {} }), null);
});
```

Also update the existing static asset test or a new test to assert `dreamArchetypes.js` loads before `dreamResultCard.js`, and `dreamResultCard.js` loads before `app.js`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement minimal modules**

Create UMD-style modules matching existing `dreamJournal.js` / `dreamSync.js` patterns. `normalizeDreamResultCard()` must clamp scores, return exactly four dimensions, cap symbols and questions at three, and provide safe fallback text.

Update `src/index.html` scripts:

```html
<script src="dreamArchetypes.js"></script>
<script src="dreamResultCard.js"></script>
<script src="app.js"></script>
```

The new scripts must appear after `dreamJournal.js` and before `app.js`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: PASS.

---

### Task 2: Dream Result Card Renderer

**Files:**
- Modify: `src/dreamResultCard.js`
- Modify: `src/style.css`
- Test: `tests/dreamResultCard.test.js`

**Interfaces:**
- Consumes `normalizeDreamResultCard(raw, context)`.
- Produces:
  - `createDreamResultCardController(options): { render(container, record): void }`
  - `options.requestResultCard(record): Promise<object>`
  - `options.saveResultCard(record, normalizedCard): Promise<{ syncStatus?: string }>`

- [ ] **Step 1: Write failing renderer tests**

Extend `tests/dreamResultCard.test.js` with a fake DOM element helper matching the style used in `tests/dreamJournal.test.js`. Assert:

- existing card renders `梦境画像`, `梦境原型`, `本次梦境更接近：`, Chinese archetype name, English subtitle, `一句话核心洞察`, all four dimension names, `为什么`, at most three symbols, `情绪画像`, `自我思考`, `分享卡片预览`, and the disclaimer.
- missing card renders `尚未生成梦境画像` and a `生成梦境画像` button.
- share preview text does not include the raw dream text or an email passed in record metadata.
- renderer never assigns to `innerHTML`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: FAIL because renderer/controller functions do not exist.

- [ ] **Step 3: Implement renderer**

Implement DOM rendering only with `createElement`, `textContent`, `append`, and `replaceChildren`. Use native `<details>` for dimension rationales. Use CSS classes:

- `.dream-result-card`
- `.dream-result-card-empty`
- `.result-card-hero`
- `.result-card-insight`
- `.result-card-dimensions`
- `.result-card-dimension`
- `.result-card-progress`
- `.result-card-symbols`
- `.result-card-emotion`
- `.result-card-reflection`
- `.result-card-share-preview`

Add quiet, mobile-first styles in `src/style.css`.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: PASS.

---

### Task 3: Backend Result Card API

**Files:**
- Modify: `server.js`
- Test: existing server tests or create `tests/server.test.js` if needed

**Interfaces:**
- Consumes normalized result card shape from Task 1.
- Keeps `POST /api/dream-analysis` with `analysisType: "quick"` unchanged.
- Adds `analysisType: "result_card"`.

- [ ] **Step 1: Write failing API tests**

Add tests that:

- send `{ dreamText: "学校走廊里的门", analysisType: "result_card" }`
- stub `global.fetch` to return valid strict JSON for the card
- assert response status `200`
- assert returned scores are clamped
- assert symbols are limited to three
- assert invalid model JSON returns `502` with only safe `{ error }`
- assert `analysisType: "deep"` still returns `400`
- assert existing quick normalization still works

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/server.test.js`

Expected: FAIL because `result_card` is rejected.

- [ ] **Step 3: Implement backend**

Add:

- `buildResultCardUserPrompt(dreamText)`
- `normalizeDeepSeekResultCardOutput(parsed)`
- route branching in `requestDeepSeekAnalysis(dreamText, analysisType)` or equivalent

Use the same `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL`. Do not log user dream text or upstream response content.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/server.test.js`

Expected: PASS.

---

### Task 4: Dream Detail Integration And Saving

**Files:**
- Modify: `src/app.js`
- Modify: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes `window.DreamResultCard.createDreamResultCardController`.
- Consumes `requestResultCard(record)` and `saveResultCard(record, card)` callbacks.
- Saves generated cards to `reportContent.dreamResultCard`.

- [ ] **Step 1: Write failing integration tests**

Extend `tests/dreamJournal.test.js` to assert:

- Dream Detail existing sections still render.
- Existing `reportContent.dreamResultCard` renders the card.
- Old records without a card show fallback and button.
- Triggering the generation button calls `/api/dream-analysis` with `analysisType: "result_card"`.
- Successful generation updates `reportContent.dreamResultCard`, saves the record, and re-renders the card.
- Failed generation shows `暂时无法生成梦境画像，请稍后再试。`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL because Dream Detail does not mount the result card.

- [ ] **Step 3: Implement integration**

Add in `src/app.js`:

- `requestDreamResultCard(rawDreamText)`
- `upsertDreamRecordLocally(record)` replacing the prepend-only local save path
- `saveDreamResultCard(record, card)` preserving ids, cloud ids, user ids, sync status, and current `reportContent`
- controller creation if `window.DreamResultCard` is available
- a `.dream-result-card` container inside `renderDreamDetail()` after existing core detail sections and before or near AI analysis

Do not remove existing Dream Detail sections.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: PASS.

---

### Task 5: Documentation And Static Safety Checks

**Files:**
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Test: static assertions in existing tests or `tests/dreamResultCard.test.js`

**Interfaces:**
- Documents current feature boundaries and run/test instructions.

- [ ] **Step 1: Write failing static test**

Assert docs mention:

- `梦境画像`
- `reportContent.dreamResultCard`
- no new schema
- no image download or sharing implementation

Assert source files do not contain forbidden user-facing strings except in tests/spec safety checks:

- `Personality Test`
- `Diagnosis`
- `你就是`
- `这说明你一定`

- [ ] **Step 2: Verify RED**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: FAIL because docs are not updated.

- [ ] **Step 3: Update docs**

Update `README.md` and `docs/PROJECT_STATUS.md` with concise descriptions and boundaries.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- tests/dreamResultCard.test.js`

Expected: PASS.

---

### Task 6: Final Verification And PR

**Files:**
- All touched files.

**Interfaces:**
- Produces a final commit and PR titled `Build Dream Result Card`.

- [ ] Run `npm test`
- [ ] Run `node --check server.js`
- [ ] Run `node --check src/app.js`
- [ ] Run `node --check src/dreamResultCard.js`
- [ ] Run `node --check src/dreamArchetypes.js`
- [ ] Run `git diff --check`
- [ ] Request final code review; fix Critical or Important findings only.
- [ ] Commit with `Build Dream Result Card`
- [ ] Push `codex/dream-result-card`
- [ ] Create PR titled `Build Dream Result Card`

## Plan Self-Review

- Spec coverage: Tasks cover archetypes, normalization, rendering, backend result-card API, Dream Detail integration/saving, docs, safety, and final verification.
- Placeholder scan: No `TBD`, `TODO`, or deferred implementation language remains.
- Type consistency: `reportContent.dreamResultCard`, `analysisType: "result_card"`, and exported helper names are consistent across tasks.
