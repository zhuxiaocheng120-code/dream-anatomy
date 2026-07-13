# Dream Journal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Dream Journal as the primary dream archive page with grouped records, live search, simple filters, empty/loading states, and existing detail navigation.

**Architecture:** Add `src/dreamJournal.js` for archive data and rendering. Keep `src/app.js` as the existing analysis/save/detail owner and add only a small bridge to feed records and open existing detail. Update the existing diary panel in `src/index.html` and extend Dream Home-style CSS in `src/style.css`.

**Tech Stack:** Plain JavaScript UMD-style modules, DOM APIs, Node `node:test`, existing Express static app, existing Supabase/dreamSync controller.

## Global Constraints

- Do not modify DeepSeek API, prompt behavior, or `server.js`.
- Do not modify Supabase Auth flows.
- Do not modify `src/dreamSync.js` cloud sync rules.
- Do not modify Dream Home behavior beyond its existing diary navigation continuing to work.
- Do not modify Supabase migrations or database schema.
- Do not implement Timeline, Calendar, Favorite, Trash, Edit, Delete, Growth, Atlas, Payment, membership, or new backend work.
- Keep Chinese interface copy where user-facing product text is not a required English section label.
- Page name must be `Dream Journal`.
- Subtitle must be `你的每一个梦，都值得被温柔收藏。`
- Loading copy must be `正在整理你的梦境档案……`
- Empty state must include `🌙`, `你还没有记录任何梦。`, `今天开始，`, `把梦轻轻放进梦境档案。`, and `记录第一个梦`.
- Date groups must be `Today`, `Yesterday`, `Earlier This Week`, `Earlier This Month`, and `Older`.
- Filters must be `全部`, `Quick`, `Deep`, and `Pending Sync`.
- Use `textContent` and DOM nodes for user dream content; do not inject user dream content with `innerHTML`.
- Preserve the quiet, mysterious, gentle, premium, mobile-first Dream Home style.

---

### Task 1: Dream Journal Data Helpers

**Files:**
- Create: `src/dreamJournal.js`
- Test: `tests/dreamJournal.test.js`

**Interfaces:**
- Produces: `DreamJournal.getDisplayTitle(record, maxLength)`
- Produces: `DreamJournal.getAnalysisKind(record)` returning `"Quick"`, `"Deep"`, or `"Dream"`
- Produces: `DreamJournal.getSymbolList(record, limit)`
- Produces: `DreamJournal.groupRecordsByDate(records, now)`
- Produces: `DreamJournal.filterRecords(records, state)`
- Produces: `DreamJournal.getSearchText(record)`

- [ ] **Step 1: Write failing helper tests**

Add `tests/dreamJournal.test.js` with tests for title fallback, analysis kind, symbol limiting, group labels, search matching, and filter matching.

- [ ] **Step 2: Run helper tests to verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL because `../src/dreamJournal` does not exist.

- [ ] **Step 3: Implement helper functions**

Create `src/dreamJournal.js` with a UMD wrapper matching `dreamHome.js`. Implement the helper functions listed above.

- [ ] **Step 4: Run helper tests to verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: all Dream Journal helper tests PASS.

### Task 2: Dream Journal Controller And Rendering

**Files:**
- Modify: `src/dreamJournal.js`
- Modify: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: `DreamJournal.createDreamJournalController(options)`
- Produces controller methods: `setRecords(records)`, `setLoading(isLoading)`, `setQuery(query)`, `setFilter(filter)`, `render()`, `clear()`.

- [ ] **Step 1: Write failing controller/render tests**

Extend `tests/dreamJournal.test.js` with fake DOM elements. Test loading copy, empty state visibility, grouped record cards, safe rendering without `innerHTML`, live search rerendering, filter rerendering, pending sync badge, and record click forwarding.

- [ ] **Step 2: Run controller tests to verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL because `createDreamJournalController` is missing.

- [ ] **Step 3: Implement controller and DOM rendering**

In `src/dreamJournal.js`, implement controller state and rendering. Render group sections and cards with `document.createElement`, `textContent`, and event listeners. Do not use `innerHTML`.

- [ ] **Step 4: Run controller tests to verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: all Dream Journal tests PASS.

### Task 3: Integrate Dream Journal With Existing App

**Files:**
- Modify: `src/index.html`
- Modify: `src/app.js`
- Modify: `tests/dreamJournal.test.js`

**Interfaces:**
- Consumes: `DreamJournal.createDreamJournalController`.
- App bridge exposes current records and existing detail navigation through `window.DreamAnatomyApp`.

- [ ] **Step 1: Write failing integration tests**

Add tests that execute `src/app.js` and `src/dreamJournal.js` in a VM harness and verify `renderDreamJournal(records)` forwards records to Dream Journal when present, while old detail navigation remains available.

- [ ] **Step 2: Run integration tests to verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL because `app.js` has not initialized or notified Dream Journal.

- [ ] **Step 3: Update HTML and app bridge**

Update the diary panel in `src/index.html` with Dream Journal title, subtitle, New Dream button, search input, filter buttons, list container, loading/status, empty state, and existing detail section. Add `<script src="dreamJournal.js"></script>` before `app.js`. Update `src/app.js` so its existing `renderDreamJournal(records)` delegates to `DreamJournal.controller.setRecords(records)` when available and keeps the old renderer as fallback. Add app bridge methods needed by Dream Journal: show quick view and open detail.

- [ ] **Step 4: Run integration tests to verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: Dream Journal integration tests PASS.

### Task 4: Styling And Documentation

**Files:**
- Modify: `src/style.css`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Consumes: HTML classes and data attributes from Task 3.
- Produces: mobile-first Dream Journal layout matching Dream Home visual language.

- [ ] **Step 1: Add a failing static style/copy test**

Add test assertions that `src/index.html` contains required Dream Journal copy and `src/style.css` contains the main Dream Journal selectors.

- [ ] **Step 2: Run static test to verify RED**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: FAIL before CSS/documentation selectors exist.

- [ ] **Step 3: Implement styles and docs**

Add mobile-first Dream Journal CSS for header, toolbar, search, filters, groups, cards, badges, empty state, and responsive spacing. Update README and PROJECT_STATUS to describe Dream Journal, search, filters, grouping, and current boundaries.

- [ ] **Step 4: Run static test to verify GREEN**

Run: `npm test -- tests/dreamJournal.test.js`

Expected: Dream Journal tests PASS.

### Task 5: Final Verification And PR

**Files:**
- No feature files unless reviewer finds issues.

**Interfaces:**
- Consumes all previous tasks.
- Produces pushed branch `codex/dream-journal` and PR titled `Build Dream Journal`.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm test
node --check src/app.js
node --check src/dreamJournal.js
node --check src/dreamHome.js
git diff --check main...HEAD
```

- [ ] **Step 2: Run browser smoke verification**

Start app with `npm start`, open `http://localhost:3000`, and verify public home, Dream Journal page, search/filter controls, empty state, and existing detail navigation.

- [ ] **Step 3: Request final reviewer**

Run a final review against `main...HEAD` focused on PR #5 scope and regression risk.

- [ ] **Step 4: Fix reviewer issues and rerun affected tests**

Fix any Critical or Important findings, then rerun the relevant tests plus full `npm test`.

- [ ] **Step 5: Commit, push, and create PR**

Commit message:

```bash
git commit -m "Build Dream Journal"
```

Push branch `codex/dream-journal` and create PR title `Build Dream Journal`.
