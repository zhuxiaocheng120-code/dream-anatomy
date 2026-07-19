# Site-Wide Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the PR #30 Dream Home visual language across the main Web SPA without changing product behavior.

**Architecture:** Use presentation-only changes in `src/index.html` and `src/style.css`, backed by a static `node:test` visual-contract test. Keep existing modules and DOM hooks intact.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node.js `node:test`.

## Global Constraints

- Do not change backend logic, API behavior, Supabase, auth flow, AI prompts, analysis structures, product analytics, admin APIs, or the Mini Program.
- Do not introduce external images, downloaded fonts, UI frameworks, or a new route system.
- Keep Dream Home as the strongest visual anchor.
- Every major Web view needs a restrained page-level visual identity.
- Preserve all existing `data-*` hooks, hidden states, form behavior, and tests.
- All new user-facing copy must be simplified Chinese unless it is an existing brand/product label.
- Added copy must not imply diagnosis, treatment, fortune telling, luck judgment, future prediction, or deterministic dream interpretation.

---

### Task 1: Static Visual Contract

**Files:**
- Create: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Consumes: `src/index.html` and `src/style.css`.
- Produces: failing static assertions for site-wide visual hooks and CSS classes.

- [x] **Step 1: Write the failing test**

Create `tests/siteVisualRefresh.test.js` with assertions for `data-page-visual="quick-workbench"`, `guided-path`, `journal-archive`, `detail-manuscript`, `privacy-ledger`, `auth-seal`, the three approved microcopy lines, no external image tags, and the CSS classes `.page-visual-shell`, `.work-panel-ornament`, `.archive-divider-sketch`, `.quick-workbench-note`, `.guided-path-note`, `.journal-archive-rail`, `.detail-manuscript-mark`, `.privacy-ledger-note`, `.auth-archive-mark`, and `.empty-state::before`.

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because the page-level visual hooks do not exist yet.

### Task 2: Page-Level Markup

**Files:**
- Modify: `src/index.html`

**Interfaces:**
- Consumes: existing page sections and `data-*` hooks.
- Produces: visual-only wrappers, inline decorative SVGs, and restrained microcopy.

- [x] **Step 1: Add Quick visual shell**

Add a `page-visual-shell` around the Quick panel copy with a decorative `quick-workbench` SVG and the line `情绪有时比解释更早接近真相。`.

- [x] **Step 2: Add Guided visual shell**

Add a `guided-path` decorative SVG and the line `你可以慢一点，让问题先陪你靠近梦。`.

- [x] **Step 3: Add Dream Journal visual shell**

Add a `journal-archive` motif in the Dream Journal heading and the line `把梦写下来，是给内在经验留一张索引卡。`.

- [x] **Step 4: Add Dream Detail and Privacy/Auth ornaments**

Add a `detail-manuscript` visual mark to the detail heading, a `privacy-ledger` note to Privacy & Data, and an `auth-seal` decorative mark to the auth dialog.

### Task 3: Shared CSS System

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: new visual classes from Task 2.
- Produces: unified page-level styling and responsive behavior.

- [x] **Step 1: Add shared visual primitives**

Add `.page-visual-shell`, `.page-visual-copy`, `.work-panel-ornament`, `.archive-divider-sketch`, and shared SVG stroke styles.

- [x] **Step 2: Add page-specific styling**

Add styles for `.quick-workbench-note`, `.guided-path-note`, `.journal-archive-rail`, `.detail-manuscript-mark`, `.privacy-ledger-note`, and `.auth-archive-mark`.

- [x] **Step 3: Refine shared states**

Update `.work-panel`, `.quick-result`, `.deep-report`, `.dream-journal-toolbar`, `.dream-journal-record-card`, `.dream-detail`, `.privacy-action-card`, `.legal-document`, `.auth-dialog`, `.empty-state`, `.auth-status`, and `.status` to use the same paper/archive language without relying on color alone.

- [x] **Step 4: Add responsive rules**

Ensure page visual shells collapse to one column under 820px and decorative panels do not create overflow under 560px.

### Task 4: Verification And PR

**Files:**
- Modify if needed: only the files above.

**Interfaces:**
- Consumes: implemented visual refresh.
- Produces: verified commit and PR.

- [x] **Step 1: Run focused tests**

Run: `npm test -- tests/siteVisualRefresh.test.js` and relevant Dream Home / Dream Journal tests.

- [x] **Step 2: Run full verification**

Run: `npm test`, JS syntax checks, `git diff --check`, and local visual preview where possible.

- [x] **Step 3: Final reviewer**

Request a reviewer for scope, accessibility, visual consistency, safety copy, and logic preservation. Fix Critical and Important issues only.

- [ ] **Step 4: Commit and PR**

Commit: `Refresh site-wide visual language`

PR title: `Refresh Site-Wide Visual Language`
