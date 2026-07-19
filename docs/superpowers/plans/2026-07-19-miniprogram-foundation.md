# WeChat Mini Program Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the native WeChat Mini Program guest-mode foundation for Dream Anatomy.

**Architecture:** Add an independent `miniprogram/` native WeChat project with thin pages, focused services, reusable utilities, and simple components. The Mini Program calls only the existing Render AI backend, stores guest dreams only in WeChat local storage, and keeps Web logic stable except for docs and tests.

**Tech Stack:** Native WeChat Mini Program, JavaScript, WXML, WXSS, Node `node:test` for logic and static tests.

## Global Constraints

- Use native WeChat Mini Program only: JavaScript, WXML, WXSS.
- Do not use Taro, uni-app, React, Vue, or a third-party UI framework.
- Place all Mini Program source under `miniprogram/`.
- Continue using the existing Render backend for AI calls.
- Do not put `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANALYTICS_HASH_SECRET`, WeChat `AppSecret`, `openid`, `unionid`, `session_key`, custom JWTs, or fake Authorization headers in Mini Program source.
- Do not call DeepSeek directly from Mini Program.
- Do not call `wx.login`, `code2Session`, Supabase Auth, payment, membership, product analytics event APIs, or cloud sync in this PR.
- Deep guidance remains “正在开发中” and must not trigger API calls.
- Guest dreams are stored only in local WeChat storage through `dreamStorage.js`.
- Legal consent is explicit, default unchecked, and stored locally for guests only.
- Do not use `rich-text`, dynamic HTML, or `innerHTML`-style rendering.
- Keep all visible copy in Simplified Chinese except allowed brand text `Dream Anatomy`.
- Keep Web quick analysis, Dream Result Card, Auth, privacy controls, product analytics, and admin dashboard behavior unchanged.

---

## File Structure

Create:

- `miniprogram/app.js`: Mini Program bootstrapping and shared global config access.
- `miniprogram/app.json`: page registration and tab bar.
- `miniprogram/app.wxss`: global Mini Program visual language.
- `miniprogram/sitemap.json`: allow indexing setting.
- `miniprogram/project.config.example.json`: non-secret WeChat developer tool template.
- `miniprogram/config/config.example.js`: public API base URL example.
- `miniprogram/services/apiClient.js`: backend quick analysis client and in-flight guard helper.
- `miniprogram/services/authAdapter.js`: guest-only auth adapter.
- `miniprogram/services/dreamStorage.js`: local storage schema, CRUD, export, and limit handling.
- `miniprogram/services/errorMessages.js`: stable API error mapping.
- `miniprogram/services/legalDocuments.js`: Mini Program legal document adapter with Web version parity.
- `miniprogram/services/productAnalyticsAdapter.js`: no-op product analytics adapter.
- `miniprogram/services/resultCard.js`: Mini Program-safe Dream Result Card normalization helpers.
- `miniprogram/utils/dates.js`: local date formatting helpers.
- `miniprogram/utils/ids.js`: local id generation.
- `miniprogram/utils/safeRender.js`: safe string/list helpers.
- `miniprogram/utils/validation.js`: dream text validation.
- `miniprogram/components/loading-state/*`: reusable loading state.
- `miniprogram/components/error-state/*`: reusable error state.
- `miniprogram/components/confirmation-modal/*`: reusable confirmation modal.
- `miniprogram/components/legal-document/*`: legal document renderer.
- `miniprogram/components/result-card/*`: Dream Result Card renderer.
- `miniprogram/pages/home/*`: home and recent local dreams.
- `miniprogram/pages/quick/*`: quick input and consent gate.
- `miniprogram/pages/result/*`: analysis result and save action.
- `miniprogram/pages/journal/*`: local journal list.
- `miniprogram/pages/detail/*`: local detail and delete.
- `miniprogram/pages/privacy/*`: legal/export/clear local data.
- `miniprogram/pages/profile/*`: guest profile.
- `docs/MINIPROGRAM_SETUP.md`: setup and deployment instructions.
- `docs/MINIPROGRAM_ARCHITECTURE.md`: architecture, data, and security boundaries.
- `tests/miniprogramServices.test.js`: service behavior tests.
- `tests/miniprogramStatic.test.js`: static source and page tests.

Modify:

- `.gitignore`: ignore private Mini Program config such as `miniprogram/project.config.json` and `miniprogram/config/config.js`.
- `README.md`: mention Mini Program guest foundation and docs.
- `docs/PROJECT_STATUS.md`: update current status and boundaries.

---

### Task 1: Mini Program Service Foundation

**Files:**
- Create: `miniprogram/config/config.example.js`
- Create: `miniprogram/services/errorMessages.js`
- Create: `miniprogram/services/authAdapter.js`
- Create: `miniprogram/services/productAnalyticsAdapter.js`
- Create: `miniprogram/services/apiClient.js`
- Create: `miniprogram/utils/ids.js`
- Create: `miniprogram/utils/validation.js`
- Test: `tests/miniprogramServices.test.js`

**Interfaces:**
- `getConfig() -> { API_BASE_URL: string, REQUEST_TIMEOUT_MS: number }`
- `getAuthState() -> { mode: "guest", authenticated: false, cloudSyncAvailable: false }`
- `getAccessToken() -> Promise<string>`
- `requestQuickAnalysis(dreamText, options) -> Promise<object>`
- `createQuickAnalysisController(apiClient) -> { submit(dreamText): Promise<object>, isSubmitting(): boolean }`
- `mapApiError(code, fallbackMessage) -> string`
- `validateDreamText(text) -> { ok: boolean, value?: string, message?: string }`
- `createLocalRecordId() -> string`
- `productAnalyticsAdapter.trackEvent() -> false`

**Steps:**

- [ ] Write failing tests in `tests/miniprogramServices.test.js` for: default API URL points to `https://dream-anatomy.onrender.com`, auth adapter returns guest and empty token, product analytics adapter no-ops, quick request sends `analysisType: "quick"` and `clientPlatform: "wechat_mini_program"`, quick request sends no Authorization, 429/504 map to Chinese messages, network failure throws without mock, and duplicate submit uses one request.
- [ ] Run `npm test -- tests/miniprogramServices.test.js` and verify RED.
- [ ] Implement the service modules and utilities listed above.
- [ ] Run `npm test -- tests/miniprogramServices.test.js` and verify GREEN.
- [ ] Run `node --check miniprogram/services/apiClient.js && node --check miniprogram/services/authAdapter.js && node --check miniprogram/services/productAnalyticsAdapter.js`.
- [ ] Commit with `git add miniprogram/config/config.example.js miniprogram/services/errorMessages.js miniprogram/services/authAdapter.js miniprogram/services/productAnalyticsAdapter.js miniprogram/services/apiClient.js miniprogram/utils/ids.js miniprogram/utils/validation.js tests/miniprogramServices.test.js && git commit -m "Add mini program service foundation"`.

### Task 2: Local Dream Storage, Legal, and Result Card Modules

**Files:**
- Create: `miniprogram/services/dreamStorage.js`
- Create: `miniprogram/services/legalDocuments.js`
- Create: `miniprogram/services/resultCard.js`
- Create: `miniprogram/utils/dates.js`
- Create: `miniprogram/utils/safeRender.js`
- Modify: `tests/miniprogramServices.test.js`

**Interfaces:**
- `createDreamStorage(wxStorage) -> { saveRecord(record), getRecords(), getRecord(id), deleteRecord(id), clearRecords(), exportRecords(), getStorageKey() }`
- `getLegalVersions() -> { privacyPolicyVersion, termsVersion, aiDisclaimerVersion }`
- `hasAcceptedLegalVersions(row) -> boolean`
- `saveGuestLegalConsent(storage) -> object`
- `normalizeResultCard(raw) -> object`
- `formatDisplayDate(isoString) -> string`
- `safeText(value, fallback) -> string`

**Steps:**

- [ ] Add failing tests for saving/loading/deleting/clearing records, export JSON without token/principal hash, storage version, unique local ids, 100-record limit returning a typed limit result, JSON parse recovery, legal version parity with `src/legalDocuments.js`, version-change re-consent, and missing Result Card score returning `null`.
- [ ] Run `npm test -- tests/miniprogramServices.test.js` and verify RED.
- [ ] Implement the storage, legal, safe render, date, and Result Card modules.
- [ ] Run `npm test -- tests/miniprogramServices.test.js` and verify GREEN.
- [ ] Run `node --check miniprogram/services/dreamStorage.js && node --check miniprogram/services/legalDocuments.js && node --check miniprogram/services/resultCard.js`.
- [ ] Commit with `git add miniprogram/services/dreamStorage.js miniprogram/services/legalDocuments.js miniprogram/services/resultCard.js miniprogram/utils/dates.js miniprogram/utils/safeRender.js tests/miniprogramServices.test.js && git commit -m "Add mini program local data modules"`.

### Task 3: Native App Shell, Components, and Pages

**Files:**
- Create: `miniprogram/app.js`
- Create: `miniprogram/app.json`
- Create: `miniprogram/app.wxss`
- Create: `miniprogram/sitemap.json`
- Create all component files under `miniprogram/components/`
- Create all page files under `miniprogram/pages/`
- Test: `tests/miniprogramStatic.test.js`

**Interfaces:**
- Pages consume Task 1 and Task 2 services through `require`.
- `pages/result` saves records via `dreamStorage.saveRecord`.
- `pages/detail` deletes local records via `dreamStorage.deleteRecord`.

**Steps:**

- [ ] Write failing static tests that required app/page/component files exist, app routes include home/quick/result/journal/detail/privacy/profile, home contains “析梦 Dream Anatomy” and disabled “深度引导 / 正在开发中”, quick contains legal checkbox and no Authorization copy, result contains Dream Result Card sections, journal/detail/privacy/profile contain required Chinese copy, and no WXML uses `rich-text`.
- [ ] Run `npm test -- tests/miniprogramStatic.test.js` and verify RED.
- [ ] Implement Mini Program app shell, components, and pages with thin JS controllers.
- [ ] Run `npm test -- tests/miniprogramStatic.test.js` and verify GREEN.
- [ ] Run `node --check miniprogram/app.js` and `node --check` for each page/service JS file.
- [ ] Commit with `git add miniprogram tests/miniprogramStatic.test.js && git commit -m "Add mini program guest pages"`.

### Task 4: Documentation and Private Config Boundaries

**Files:**
- Create: `docs/MINIPROGRAM_SETUP.md`
- Create: `docs/MINIPROGRAM_ARCHITECTURE.md`
- Create: `miniprogram/project.config.example.json`
- Modify: `.gitignore`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `tests/miniprogramStatic.test.js`

**Interfaces:**
- Documentation must refer to the service/page files created in earlier tasks.

**Steps:**

- [ ] Add failing static tests for `.gitignore` private config entries, docs existence, setup mentions WeChat Developer Tools import, AppID, request domain, `API_BASE_URL`, dev/trial/production distinction, no AppSecret in Mini Program, and no claim of real-device validation.
- [ ] Run `npm test -- tests/miniprogramStatic.test.js` and verify RED.
- [ ] Write documentation and update README/project status.
- [ ] Run `npm test -- tests/miniprogramStatic.test.js` and verify GREEN.
- [ ] Commit with `git add docs/MINIPROGRAM_SETUP.md docs/MINIPROGRAM_ARCHITECTURE.md miniprogram/project.config.example.json .gitignore README.md docs/PROJECT_STATUS.md tests/miniprogramStatic.test.js && git commit -m "Document mini program setup"`.

### Task 5: Full Regression, Security Scan, and Final Review

**Files:**
- Modify only files required to fix Critical or Important review findings.

**Interfaces:**
- Whole branch must preserve Web behavior and Mini Program guest-only boundaries.

**Steps:**

- [ ] Run `npm test` and verify all tests pass.
- [ ] Run `node --check` over all touched JS files.
- [ ] Run `git diff --check`.
- [ ] Dispatch final reviewer for the full branch.
- [ ] Fix any Critical or Important findings with failing tests first.
- [ ] Re-run full verification.
- [ ] Push branch `codex/miniprogram-foundation`.
- [ ] Create PR titled `Build WeChat Mini Program Foundation`.
