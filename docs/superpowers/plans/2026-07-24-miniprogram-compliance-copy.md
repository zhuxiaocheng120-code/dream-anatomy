# Mini Program Compliance Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Mini Program filing/review copy risk by repositioning visible text as dream record and AI-assisted text organization while preserving all existing Mini Program functionality.

**Architecture:** Keep existing native Mini Program pages and services. Add one display-only compliance text utility under `miniprogram/utils/`, update page/component/legal copy, and protect the contract with static and service tests. Existing storage values and API request payloads remain compatible.

**Tech Stack:** Native WeChat Mini Program WXML/WXSS/JavaScript, Node `node:test`, existing plain JavaScript services.

## Global Constraints

- Modify only `miniprogram/` and Mini Program documentation plus tests/spec/plan required for this PR.
- Do not modify Web app source under `src/`, server code, Supabase migrations, AI prompts, database schema, API contract, cloud sync, payment, membership, or product analytics.
- Keep `/api/v1/dream-analysis` usage intact.
- Keep Mini Program guest local storage and WeChat identity bridge behavior intact.
- Do not delete result pages, result-card component, AI functionality, saved historical records, or existing business flows.
- User-visible Mini Program copy must avoid: `解梦`, `算命`, `占卜`, `吉凶`, `预示`, `预测未来`, `通灵`, `命运判断`, `固定含义`, `梦境解析`, `AI 解梦`, `核心解析`, `梦境画像`, `梦境原型`, `象征含义`, `潜意识告诉你`, `弗洛伊德`, `荣格`.
- Compliance/legal docs may mention restricted words only in negative-service context such as `不提供解梦、算命、占卜、吉凶判断或未来预测`.
- Do not mutate stored `reportContent`; text lowering is display-only.
- Do not introduce external assets, new frameworks, or large dependencies.

---

### Task 1: Compliance Static Tests

**Files:**
- Modify: `tests/miniprogramStatic.test.js`
- Modify: `tests/miniprogramServices.test.js`
- Modify: `tests/miniprogramVisualRefresh.test.js`

**Interfaces:**
- Consumes: existing `read`, `listFiles`, and `createWxHarness` helpers.
- Produces: failing tests that define the low-risk Mini Program copy contract.

- [ ] **Step 1: Update app-shell/page-copy assertions**

In `tests/miniprogramStatic.test.js`, replace old expectations with:

```js
const appJson = JSON.parse(read("miniprogram/app.json"));
assert.equal(appJson.window.navigationBarTitleText, "Dream Anatomy 梦境手札");

const home = read("miniprogram/pages/home/index.wxml");
assert.match(home, /Dream Anatomy 梦境手札/);
assert.match(home, /AI 整理梦境/);
assert.doesNotMatch(home, /析梦|快速解析/);
assert.match(home, /深度记录/);
assert.match(home, /正在开发中/);

const quick = read("miniprogram/pages/quick/index.wxml");
assert.match(quick, /AI 整理梦境/);
assert.match(quick, /保存并整理/);
assert.doesNotMatch(quick, /快速解析|保存并解析|正在解析|解析失败|梦境含义|预示/);

const result = read("miniprogram/pages/result/index.wxml");
assert.match(result, /AI 整理结果/);
assert.match(result, /梦境线索卡/);
assert.match(result, /文字线索整理/);
assert.doesNotMatch(result, /梦境画像|梦境原型|核心解析/);

const detail = read("miniprogram/pages/detail/index.wxml");
assert.match(detail, /记录详情/);
assert.match(detail, /AI 辅助整理/);
assert.match(detail, /删除这条记录/);
assert.doesNotMatch(detail, /梦境详情|AI 分析|删除这条梦境/);
```

- [ ] **Step 2: Add Mini Program forbidden-copy scan**

In `tests/miniprogramStatic.test.js`, add a test that scans `miniprogram/**/*.wxml`, `miniprogram/pages/**/*.json`, and user-facing message/service files. Exclude `miniprogram/services/legalDocuments.js` from the blanket ban because it contains negative-service legal context. Assert the source does not contain:

```js
const forbidden = /析梦|解梦|算命|占卜|吉凶|预示|预测未来|通灵|命运判断|固定含义|梦境解析|AI 解梦|核心解析|梦境画像|梦境原型|象征含义|潜意识告诉你|弗洛伊德|荣格/u;
```

- [ ] **Step 3: Add complianceText service tests**

In `tests/miniprogramServices.test.js`, add:

```js
test("compliance text lowers high-risk AI display terms without mutating records", () => {
  const { sanitizeComplianceText, sanitizeComplianceObject } = require("../miniprogram/utils/complianceText");
  assert.equal(sanitizeComplianceText("这个梦预示着命运改变"), "这个记录片段可能让你联想到生活体验改变");
  const raw = { insight: "潜意识告诉你这意味着机会", nested: { text: "梦境解析" } };
  const cleaned = sanitizeComplianceObject(raw);
  assert.notStrictEqual(cleaned, raw);
  assert.equal(raw.insight, "潜意识告诉你这意味着机会");
  assert.doesNotMatch(JSON.stringify(cleaned), /潜意识告诉你|意味着|梦境解析/);
});
```

- [ ] **Step 4: Update visual-copy tests**

In `tests/miniprogramVisualRefresh.test.js`, update page visual copy expectations to low-risk copy:

```js
home: ["data-visual=\"home-archive\"", "不急着解释，先把它留下来"],
quick: ["data-visual=\"quick-workbench\"", "结果仅供记录和回顾"],
result: ["data-visual=\"result-report\"", "记录卡片预览"],
```

- [ ] **Step 5: Run tests and verify RED**

Run:

```bash
npm test -- tests/miniprogramStatic.test.js tests/miniprogramServices.test.js tests/miniprogramVisualRefresh.test.js
```

Expected: FAIL because the Mini Program still contains old copy and `complianceText.js` does not exist.

### Task 2: Display Sanitizer And Mapped Labels

**Files:**
- Create: `miniprogram/utils/complianceText.js`
- Modify: `miniprogram/services/resultCard.js`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/journal/index.js`
- Modify: `miniprogram/pages/detail/index.js`
- Modify: `miniprogram/pages/result/index.js`
- Modify: `miniprogram/services/errorMessages.js`

**Interfaces:**
- Produces:
  - `sanitizeComplianceText(value: unknown, fallback?: string): string`
  - `sanitizeComplianceList(value: unknown): string[]`
  - `sanitizeComplianceObject(value: unknown): unknown`
  - `formatMiniProgramAnalysisType(value: string): string`
- Consumes: existing `normalizeResultCard`, record display functions, API error mapping.

- [ ] **Step 1: Implement compliance utility**

Create `miniprogram/utils/complianceText.js`:

```js
const replacements = [
  [/AI\s*解梦/gu, "AI 辅助整理"],
  [/梦境解析/gu, "梦境文字整理"],
  [/解梦/gu, "记录整理"],
  [/预示着?/gu, "可能让你联想到"],
  [/意味着/gu, "可能关联到"],
  [/象征着/gu, "可以作为一个意象关键词"],
  [/潜意识告诉你/gu, "你可以回想"],
  [/吉凶/gu, "感受"],
  [/命运判断/gu, "生活体验判断"],
  [/命运/gu, "生活体验"],
  [/固定含义/gu, "固定说法"],
  [/核心解析/gu, "文字线索整理"],
  [/梦境画像/gu, "梦境线索卡"],
  [/梦境原型/gu, "记录类型提示"],
  [/象征含义/gu, "意象关键词"],
  [/AI 分析/gu, "AI 辅助整理"],
  [/快速解析/gu, "AI 整理"],
  [/弗洛伊德/gu, "一种心理学视角"],
  [/荣格/gu, "一种心理学视角"]
];

function sanitizeComplianceText(value, fallback = "") {
  let text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  return text;
}

function sanitizeComplianceList(value) {
  return Array.isArray(value)
    ? value.map((item) => sanitizeComplianceText(item)).filter(Boolean)
    : [];
}

function sanitizeComplianceObject(value) {
  if (Array.isArray(value)) return value.map(sanitizeComplianceObject);
  if (!value || typeof value !== "object") return sanitizeComplianceText(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeComplianceObject(item)]));
}

function formatMiniProgramAnalysisType(value) {
  if (value === "快速解析" || value === "quick" || value === "Quick") return "AI 整理";
  if (value === "深度解析" || value === "深度引导" || value === "deep" || value === "Deep") return "深度记录";
  return sanitizeComplianceText(value || "AI 整理");
}

module.exports = {
  formatMiniProgramAnalysisType,
  sanitizeComplianceList,
  sanitizeComplianceObject,
  sanitizeComplianceText
};
```

- [ ] **Step 2: Sanitize result-card normalized fields**

In `miniprogram/services/resultCard.js`, import compliance helpers and apply them to displayed summaries, evidence, insight, symbol text, emotional profile, reflection questions, and safety reminder. Keep `hasResultCard` structural checks unchanged.

- [ ] **Step 3: Map displayed analysis type labels**

In `miniprogram/pages/home/index.js` and `miniprogram/pages/journal/index.js`, include:

```js
const { formatMiniProgramAnalysisType } = require("../../utils/complianceText");
```

and set each display record with:

```js
displayAnalysisType: formatMiniProgramAnalysisType(record.analysisType)
```

WXML will use `displayAnalysisType`.

- [ ] **Step 4: Sanitize result/detail analysis display without mutating storage**

In `miniprogram/pages/result/index.js`, sanitize `response.analysis` and `response.dreamResultCard` only for page data:

```js
const { sanitizeComplianceObject } = require("../../utils/complianceText");
```

Use sanitized values in `analysis` and `resultCard`, but keep `response` from storage untouched for `saveToJournal()`.

In `miniprogram/pages/detail/index.js`, add `displayRecord` with sanitized analysis text and mapped analysis type. Keep `record` unchanged for deletion and storage identity.

- [ ] **Step 5: Update user-facing error messages**

In `miniprogram/services/errorMessages.js`, replace:

```js
DAILY_LIMIT_REACHED: "今天的免费解析次数已经用完，稍后再来继续记录梦境。",
UPSTREAM_UNAVAILABLE: "梦境解析服务暂时不可用，请稍后再试。",
```

with:

```js
DAILY_LIMIT_REACHED: "今天的免费整理次数已经用完，稍后再来继续记录梦境。",
UPSTREAM_UNAVAILABLE: "梦境文字整理服务暂时不可用，请稍后再试。",
```

- [ ] **Step 6: Run service tests**

Run:

```bash
npm test -- tests/miniprogramServices.test.js
```

Expected: PASS.

### Task 3: Page Copy, Legal Copy, Docs, And Static Scan

**Files:**
- Modify: `miniprogram/app.json`
- Modify: `miniprogram/pages/home/index.json`
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.js`
- Modify: `miniprogram/pages/quick/index.json`
- Modify: `miniprogram/pages/quick/index.wxml`
- Modify: `miniprogram/pages/quick/index.js`
- Modify: `miniprogram/pages/result/index.json`
- Modify: `miniprogram/pages/result/index.wxml`
- Modify: `miniprogram/pages/journal/index.wxml`
- Modify: `miniprogram/pages/detail/index.json`
- Modify: `miniprogram/pages/detail/index.wxml`
- Modify: `miniprogram/services/legalDocuments.js`
- Modify: `docs/MINIPROGRAM_SETUP.md`
- Modify: `docs/MINIPROGRAM_ARCHITECTURE.md`
- Modify: `docs/MINIPROGRAM_VISUAL_LANGUAGE.md`
- Create: `docs/MINIPROGRAM_COMPLIANCE_COPY.md`

**Interfaces:**
- Consumes: `formatMiniProgramAnalysisType`, sanitized page data from Task 2.
- Produces: low-risk Mini Program user-facing copy and compliance review note.

- [ ] **Step 1: Update titles and page copy**

Use exact visible copy:

- App/home navigation title: `Dream Anatomy 梦境手札`
- Home eyebrow: `Dream Anatomy 梦境手札`
- Home subtitle: `记录梦境文字、睡眠感受和醒来后的想法，AI 可帮助你整理摘要、情绪词和意象关键词。`
- Home microcopy: `不急着解释，先把它留下来。`
- Home primary button: `AI 整理梦境`
- Home disabled deep button: `深度记录 <text class="tag">正在开发中</text>`
- Home deep hint: `深度记录正在开发中，暂时不能进入。`
- Quick title: `AI 整理梦境`
- Quick subtitle: `写下梦境文字，系统会帮你整理摘要、情绪词、意象关键词和自我反思问题。`
- Quick microcopy: `结果仅供记录和回顾，不代表固定说法。`
- Quick loading: `正在整理梦境记录……`
- Quick submit: `保存并整理`
- Result eyebrow/title: `AI 整理结果` / `梦境线索卡`
- Result subtitle: `AI 会整理你输入的文字线索，但不会判断感受、预测未来或给出固定说法。`
- Result summary heading: `记录摘要`
- Result analysis heading: `文字线索整理`
- Detail eyebrow/title fallback: `记录详情` / `本机记录`
- Detail analysis heading: `AI 辅助整理`
- Detail missing card: `梦境线索卡暂未生成。`
- Detail delete button/modal title: `删除这条记录`

- [ ] **Step 2: Update result-card component copy**

Use:

- `梦境线索卡`
- `记录类型提示：{{normalized.archetype.nameZh}}`
- `一句话回顾：{{normalized.coreInsight}}`
- `记录维度`
- `意象关键词`
- `记录卡片预览`

- [ ] **Step 3: Update legal documents**

In `miniprogram/services/legalDocuments.js`, rewrite short sections so they avoid high-risk positive positioning and include negative-service disclaimers:

```js
createSection("产品定位", "Dream Anatomy 梦境手札是梦境记录、睡眠感受记录与 AI 辅助文字整理工具。")
createSection("服务边界", "本功能不是解梦、算命、占卜、吉凶判断或未来预测服务，也不宣称梦境符号具有固定含义。")
createSection("AI 内容性质", "AI 仅对你主动输入的梦境文字进行摘要、情绪词、意象关键词和开放式反思问题整理，不构成心理诊断、心理治疗或医疗建议。")
createSection("AI 请求", "当你主动使用 AI 整理功能时，梦境文字会发送至服务端和 AI 服务提供方，用于完成本次文字整理请求。")
```

- [ ] **Step 4: Add compliance document**

Create `docs/MINIPROGRAM_COMPLIANCE_COPY.md` with the exact filing/review note from the spec:

```md
# 微信小程序备案与审核备注建议

本小程序是一款个人梦境记录、睡眠感受记录与 AI 辅助文字整理工具。

用户可以记录梦境文字、睡眠感受和醒来后的个人想法。用户主动提交文字后，系统可对该文字进行摘要整理、情绪词识别、意象关键词整理，并生成开放式自我反思问题，便于用户保存和回顾个人记录。

本小程序不提供解梦、算命、占卜、吉凶判断、未来预测、通灵或其他封建迷信相关服务，不对梦境符号作固定含义解释，也不根据梦境判断用户的命运、健康状况或现实事件。

本产品不是医疗、心理诊断或心理治疗服务，AI 生成内容仅作为记录整理和自我反思参考。
```

- [ ] **Step 5: Update Mini Program docs**

Update `docs/MINIPROGRAM_SETUP.md`, `docs/MINIPROGRAM_ARCHITECTURE.md`, and `docs/MINIPROGRAM_VISUAL_LANGUAGE.md` so they describe `Dream Anatomy 梦境手札`, `AI 整理`, `梦境线索卡`, and the compliance copy doc. Keep architecture boundaries unchanged.

- [ ] **Step 6: Run static tests and scan**

Run:

```bash
npm test -- tests/miniprogramStatic.test.js tests/miniprogramVisualRefresh.test.js
rg -n "析梦|快速解析|梦境解析|AI 解梦|核心解析|梦境画像|梦境原型|象征含义|潜意识告诉你|弗洛伊德|荣格" miniprogram
```

Expected: tests PASS; `rg` returns no Mini Program source matches except no output. Legal negative-service terms are checked through tests instead of the blanket source scan.

### Task 4: Final Verification And PR

**Files:**
- Read only unless verification finds a direct task-scope failure.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: reviewed, tested branch and PR.

- [ ] **Step 1: Run Mini Program syntax checks**

Run:

```bash
find miniprogram -name '*.js' -print -exec node --check {} \;
```

Expected: every JS file exits 0.

- [ ] **Step 2: Run focused and full tests**

Run:

```bash
npm test -- tests/miniprogramStatic.test.js tests/miniprogramServices.test.js tests/miniprogramVisualRefresh.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Run diff checks**

Run:

```bash
git diff --check
git diff --name-only
```

Expected: no whitespace errors; changed production files are under `miniprogram/` and Mini Program docs only.

- [ ] **Step 4: Final reviewer**

Request read-only review for Critical/Important findings, focusing on:

- Whether Mini Program user-visible copy avoids high-risk terms.
- Whether legal docs mention restricted terms only as negative-service disclaimers.
- Whether API/storage/functionality boundaries remain unchanged.
- Whether compliance display filtering mutates stored records.
- Whether tests actually protect the new copy contract.

- [ ] **Step 5: Commit, push, PR**

Stage only intended files and commit:

```bash
git add docs/MINIPROGRAM_COMPLIANCE_COPY.md docs/MINIPROGRAM_SETUP.md docs/MINIPROGRAM_ARCHITECTURE.md docs/MINIPROGRAM_VISUAL_LANGUAGE.md docs/superpowers/specs/2026-07-24-miniprogram-compliance-copy-design.md docs/superpowers/plans/2026-07-24-miniprogram-compliance-copy.md miniprogram tests/miniprogramStatic.test.js tests/miniprogramServices.test.js tests/miniprogramVisualRefresh.test.js
git commit -m "Adjust mini program compliance copy"
git push -u origin codex/miniprogram-compliance-copy
```

Create PR:

```bash
gh pr create --base main --head codex/miniprogram-compliance-copy --title "Adjust Mini Program Compliance Copy"
```

Expected: PR URL returned.
