# Mini Program Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync the Web aged-paper / quiet-archive visual language into the native WeChat Mini Program without changing the guest-only product flow.

**Architecture:** Use `miniprogram/app.wxss` as the shared Mini Program visual system, add restrained page-level WXML structures and page-local WXSS only where necessary, and align shared components with the same visual language. Static tests protect page paths, API boundaries, visual hooks, no remote assets, no extra frameworks, and guest-only constraints.

**Tech Stack:** Native WeChat Mini Program WXML, WXSS, JavaScript, Node.js `node:test`.

## Global Constraints

- Keep Mini Program page paths unchanged: `pages/home/index`, `pages/quick/index`, `pages/result/index`, `pages/journal/index`, `pages/detail/index`, `pages/privacy/index`, `pages/profile/index`.
- Keep quick analysis request shape unchanged: `POST /api/v1/dream-analysis` with `analysisType: "quick"`, `dreamText`, and `clientPlatform: "wechat_mini_program"`.
- Guest requests must not send `Authorization`, `Bearer`, Supabase login data, or any auth token.
- Do not call `wx.login`, `code2Session`, `openid`, `unionid`, `session_key`, Supabase Auth, cloud sync, payment, membership, product analytics persistence, or DeepSeek directly.
- Do not modify Web source files, backend, AI prompt, database schema, or Render API behavior.
- Deep guidance remains visible but disabled with `正在开发中`.
- Use only original lightweight WXML/WXSS decorations; no remote images, remote fonts, font files, large Base64 assets, copied logos, copied Jung artwork, or copyrighted network assets.
- All new user-facing copy is simplified Chinese except existing brand terms.
- New copy must not include diagnosis, treatment, prediction, fortune telling, luck judgment, deterministic dream interpretation, fear language, or fixed personality conclusions.
- Preserve local storage, result card normalization, legal consent, deletion, export, clearing, and existing tests.

---

### Task 1: Mini Program Visual Contract

**Files:**
- Create: `tests/miniprogramVisualRefresh.test.js`

**Interfaces:**
- Consumes: `miniprogram/app.json`, `miniprogram/app.wxss`, page WXML/WXSS, component WXML/WXSS.
- Produces: failing static assertions that define the visual refresh contract.

- [x] **Step 1: Write the failing test**

Create `tests/miniprogramVisualRefresh.test.js` with Node `node:test` assertions:

```js
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function listFiles(dir, matcher = () => true) {
  const absolute = path.join(root, dir);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const nested = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(nested, matcher) : (matcher(nested) ? [nested] : []);
  });
}

test("mini program visual language uses shared tokens and keeps page paths stable", () => {
  const appJson = JSON.parse(read("miniprogram/app.json"));
  assert.deepEqual(appJson.pages, [
    "pages/home/index",
    "pages/quick/index",
    "pages/result/index",
    "pages/journal/index",
    "pages/detail/index",
    "pages/privacy/index",
    "pages/profile/index"
  ]);

  const appWxss = read("miniprogram/app.wxss");
  [
    "Mini Program visual tokens",
    "parchment",
    "warm charcoal",
    "muted olive",
    ".page-hero",
    ".visual-orbit",
    ".archive-panel",
    ".manuscript-panel",
    ".identity-seal",
    ".danger-button",
    ".long-text-safe"
  ].forEach((needle) => assert.match(appWxss, new RegExp(needle.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&"))));
});

test("each mini program page has restrained page-level visual identity", () => {
  const expected = {
    home: ["data-visual=\"home-archive\"", "梦并不急着给出答案"],
    quick: ["data-visual=\"quick-workbench\"", "情绪有时比解释更早接近真相"],
    result: ["data-visual=\"result-report\"", "心理档案报告"],
    journal: ["data-visual=\"journal-archive\"", "私人梦境档案"],
    detail: ["data-visual=\"detail-manuscript\"", "手稿记录"],
    privacy: ["data-visual=\"privacy-ledger\"", "档案文书"],
    profile: ["data-visual=\"profile-seal\"", "本机游客档案"]
  };

  Object.entries(expected).forEach(([page, needles]) => {
    const source = read(`miniprogram/pages/${page}/index.wxml`);
    needles.forEach((needle) => assert.match(source, new RegExp(needle)));
    assert.match(source, /aria-hidden="true"/, `${page} decorative visual should be hidden`);
  });
});

test("mini program visual refresh keeps guest-only and asset boundaries", () => {
  const files = listFiles("miniprogram", (file) => /\.(js|json|wxml|wxss)$/.test(file));
  const source = files.map((file) => `${file}\n${read(file)}`).join("\n");

  assert.doesNotMatch(source, /https?:\/\/[^"']+\.(?:png|jpe?g|webp|gif|svg|ttf|otf|woff2?)/i);
  assert.doesNotMatch(source, /base64,[A-Za-z0-9+/=]{200,}/);
  assert.doesNotMatch(source, /taro|uni-app|react|vue/i);
  assert.doesNotMatch(source, /DEEPSEEK_API_KEY|SUPABASE_SERVICE_ROLE_KEY|ANALYTICS_HASH_SECRET|AppSecret/i);
  assert.doesNotMatch(source, /wx\.login|code2Session|openid|unionid|session_key/i);
  assert.doesNotMatch(source, /Authorization\s*:|Bearer\s+/i);
  assert.doesNotMatch(source, /\/chat\/completions|api\.deepseek\.com/i);
  assert.doesNotMatch(source, /产品行为统计|product-events|trackProductEvent/i);
});

test("mini program visual documentation records original asset and manual verification boundaries", () => {
  const docs = read("docs/MINIPROGRAM_VISUAL_LANGUAGE.md");
  assert.match(docs, /原创装饰资产清单/);
  assert.match(docs, /不依赖远程图片/);
  assert.match(docs, /微信开发者工具/);
  assert.match(docs, /尚未完成真机验收|真机验收/);
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/miniprogramVisualRefresh.test.js`

Expected: FAIL because the new visual hooks and documentation do not exist.

### Task 2: Shared Mini Program Visual System

**Files:**
- Modify: `miniprogram/app.wxss`

**Interfaces:**
- Consumes: existing global classes `.page`, `.eyebrow`, `.title`, `.subtitle`, `.section`, `.card`, `.button`, `.tag`, `.input`, `.small`.
- Produces: shared classes `.page-hero`, `.visual-orbit`, `.archive-panel`, `.manuscript-panel`, `.identity-seal`, `.danger-button`, `.long-text-safe`, and refined shared states used by pages/components.

- [x] **Step 1: Write minimal shared WXSS**

Update `miniprogram/app.wxss` to include a top comment named `Mini Program visual tokens` with palette names and shared classes for page heroes, archive panels, manuscript panels, visual ornaments, danger buttons, empty states, and long text safety.

- [x] **Step 2: Run visual contract test**

Run: `npm test -- tests/miniprogramVisualRefresh.test.js`

Expected: still FAIL because page WXML and docs are not updated yet.

### Task 3: Page-Level WXML And WXSS Refresh

**Files:**
- Modify: `miniprogram/pages/home/index.wxml`
- Modify: `miniprogram/pages/home/index.wxss`
- Modify: `miniprogram/pages/quick/index.wxml`
- Modify: `miniprogram/pages/quick/index.wxss`
- Modify: `miniprogram/pages/result/index.wxml`
- Modify: `miniprogram/pages/result/index.wxss`
- Modify: `miniprogram/pages/journal/index.wxml`
- Modify: `miniprogram/pages/journal/index.wxss`
- Modify: `miniprogram/pages/detail/index.wxml`
- Modify: `miniprogram/pages/detail/index.wxss`
- Modify: `miniprogram/pages/privacy/index.wxml`
- Modify: `miniprogram/pages/privacy/index.wxss`
- Modify: `miniprogram/pages/profile/index.wxml`
- Modify: `miniprogram/pages/profile/index.wxss`

**Interfaces:**
- Consumes: shared classes from Task 2.
- Produces: page-level visual identity hooks and restrained original WXML/WXSS motifs without changing page JS behavior.

- [x] **Step 1: Add page hero structures**

Wrap page headings in `.page-hero` / `.archive-panel` structures and add decorative views with `aria-hidden="true"` and `data-visual` values:

- home: `home-archive`
- quick: `quick-workbench`
- result: `result-report`
- journal: `journal-archive`
- detail: `detail-manuscript`
- privacy: `privacy-ledger`
- profile: `profile-seal`

- [x] **Step 2: Add restrained microcopy**

Add the exact page microcopy required by the visual contract:

- Home: `梦并不急着给出答案，它更像是在递来线索。`
- Quick: `情绪有时比解释更早接近真相。`
- Result: include `心理档案报告`
- Journal: include `私人梦境档案`
- Detail: include `手稿记录`
- Privacy: include `档案文书`
- Profile: include `本机游客档案`

- [x] **Step 3: Preserve all bindings and page behavior**

Do not remove existing `bindtap`, `wx:if`, `wx:for`, `data-id`, `data-type`, `disabled`, `value`, `bindinput`, `bindchange`, custom component usage, or navigation text needed by existing tests.

- [x] **Step 4: Run page and visual tests**

Run:

```bash
npm test -- tests/miniprogramVisualRefresh.test.js tests/miniprogramStatic.test.js tests/miniprogramServices.test.js
```

Expected: visual contract still may fail only on docs/component styling; static/services tests pass.

### Task 4: Component Visual Alignment

**Files:**
- Modify: `miniprogram/components/confirmation-modal/index.wxss`
- Modify: `miniprogram/components/error-state/index.wxss`
- Modify: `miniprogram/components/legal-document/index.wxss`
- Modify: `miniprogram/components/loading-state/index.wxss`
- Modify: `miniprogram/components/result-card/index.wxss`
- Modify if needed: component WXML only for class names that do not alter bindings.

**Interfaces:**
- Consumes: existing component WXML bindings and shared global classes.
- Produces: component-level visual alignment for loading, errors, modals, legal document sections, and Dream Result Card.

- [x] **Step 1: Align modal and state components**

Update component WXSS so confirmation, error, and loading states use parchment surfaces, clear text, icon/dot accents, and non-color-only layout cues.

- [x] **Step 2: Align legal document and result card**

Update legal document and result card styles so long text wraps, report sections feel manuscript-like, score bars stay soft, and share preview does not look game-like.

- [x] **Step 3: Run component tests**

Run:

```bash
npm test -- tests/miniprogramVisualRefresh.test.js tests/miniprogramStatic.test.js tests/miniprogramServices.test.js
```

Expected: all three pass after docs are added in Task 5, or only docs assertion remains failing.

### Task 5: Documentation, Status, And Full Verification

**Files:**
- Create: `docs/MINIPROGRAM_VISUAL_LANGUAGE.md`
- Modify: `docs/MINIPROGRAM_SETUP.md`
- Modify: `docs/MINIPROGRAM_ARCHITECTURE.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/superpowers/plans/2026-07-19-miniprogram-visual-refresh.md`

**Interfaces:**
- Consumes: implemented visual system.
- Produces: setup/status documentation and final verification evidence.

- [x] **Step 1: Add Mini Program visual language documentation**

Create `docs/MINIPROGRAM_VISUAL_LANGUAGE.md` with sections for palette tokens, typography, shared classes, page rules, original decoration inventory, copyright boundary, future reuse, and WeChat Developer Tools manual verification checklist.

- [x] **Step 2: Update setup, architecture, README, and project status**

Document that the Mini Program visual refresh mirrors the frozen Web style while keeping guest-only behavior unchanged. State that WeChat Developer Tools and real-device verification are manual release gates.

- [x] **Step 3: Run full verification**

Run:

```bash
npm test
node --check miniprogram/app.js
node --check miniprogram/pages/home/index.js
node --check miniprogram/pages/quick/index.js
node --check miniprogram/pages/result/index.js
node --check miniprogram/pages/journal/index.js
node --check miniprogram/pages/detail/index.js
node --check miniprogram/pages/privacy/index.js
node --check miniprogram/pages/profile/index.js
git diff --check
```

Expected: all pass. If sandbox blocks server listen in `npm test`, rerun the full `npm test` with approved non-sandbox execution and record that reason.

- [ ] **Step 4: Final reviewer**

Request final reviewer for scope, visual consistency, Mini Program boundaries, no secret leaks, no remote assets, accessibility, and tests. Fix Critical and Important findings only.

- [ ] **Step 5: Commit and PR**

Commit:

```bash
git add miniprogram docs README.md tests
git commit -m "Refresh Mini Program visual language"
```

Push branch `codex/miniprogram-visual-refresh` and create PR titled `Refresh WeChat Mini Program Visual Language`.
