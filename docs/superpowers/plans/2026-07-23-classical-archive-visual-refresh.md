# Classical Archive Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Dream Anatomy Web UI with a refined classical archive visual language without changing core product behavior. Earlier animated Logo requirements in this historical plan are superseded by the 2026-07-28 static Logo decision.

**Architecture:** Keep the existing plain HTML/CSS/JS SPA. Use `src/style.css` as the shared visual system and touch `src/index.html` only for small classes/microcopy needed by the visual layer. Static tests in `tests/siteVisualRefresh.test.js` protect the visual contract and existing behavior hooks.

**Tech Stack:** Plain HTML, CSS, JavaScript, Node test runner, no new frontend dependencies.

## Global Constraints

- Do not modify backend logic, AI prompts, API contracts, authentication, analytics, privacy/data behavior, database schema, or mini program behavior.
- Keep all existing `data-*` hooks and form controls usable.
- Use only local assets, inline SVG, or CSS decoration; do not add remote images, remote fonts, or animation libraries.
- Visual language: old paper, refined, archival, calm, premium, Jungian.
- Avoid tarot, fortune telling, diagnosis, therapy, future prediction, zodiac, hospital, or cartoon styling.
- Logo must remain static: no continuous cloud line morphing, stroke flow, opacity cycle, floating, scaling, breathing, or rotation.
- User-visible new copy must be short, Chinese-first, non-diagnostic, non-therapeutic, and non-predictive.

---

### Task 1: Visual Contract Tests

**Files:**
- Modify: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Consumes: existing static helpers `readSource`, `cssRuleBlock`, `cssMediaBlock`.
- Produces: failing tests for new CSS tokens, page-level archive classes, static Logo coverage, and hook preservation.

- [ ] **Step 1: Write the failing test**

Add a test named `classical archive refresh exposes shared tokens and restrained motion` that asserts:

```js
const html = readSource("src/index.html");
const css = readSource("src/style.css");
assert.match(css, /--warm-ivory:/);
assert.match(css, /--parchment-fiber:/);
assert.match(css, /--dark-walnut:/);
assert.match(css, /--bronze-gold:/);
assert.doesNotMatch(css, /Logo-specific keyframes/);
assert.doesNotMatch(cssRuleBlock(css, ".brand-mark"), /animation\s*:/);
assert.doesNotMatch(cssRuleBlock(css, ".hero-brand-seal"), /animation\s*:/);
assert.doesNotMatch(cssRuleBlock(css, ".dream-guide-seal"), /animation\s*:/);
assert.match(html, /梦不是答案，而是线索。/);
assert.match(html, /class="archive-microcopy"/);
```

Add a test named `classical archive refresh keeps product hooks and visual boundaries` that asserts existing `data-view`, `data-quick-form`, `data-journal-list-shell`, `data-dream-detail`, and `data-privacy-data-view` hooks still exist, and that no new `http(s)` image references exist.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because the new token names, keyframes, and microcopy do not exist yet.

- [ ] **Step 3: Do not change production code in this task**

Leave implementation for Task 2.

### Task 2: Shared Classical Archive CSS

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: CSS selectors already used by `src/index.html`.
- Produces: shared tokens, paper texture, refined typography, card treatments, section ornaments, and static Logo classes.

- [ ] **Step 1: Implement shared tokens and body texture**

Update `:root` to include:

```css
--warm-ivory: #fbf3e4;
--parchment-fiber: rgba(112, 91, 61, 0.055);
--dark-walnut: #2b2118;
--bronze-gold: #a77a3d;
```

Keep existing variables as aliases where needed so current selectors continue to work.

- [ ] **Step 2: Preserve static Logo boundary**

Do not add Logo-specific keyframes, overlay paths, or transform/opacity cycles. Ensure `.brand-mark`, `.hero-brand-seal`, and `.dream-guide-seal` have no `animation` or `transform` rules for Logo behavior.

- [ ] **Step 3: Refine shared components**

Update card-like selectors (`.dream-card`, `.entry-card`, `.dream-form`, `.work-panel`, `.journal-card`, `.dream-detail`, `.privacy-data-panel`, `.auth-dialog`) with parchment surfaces, low-contrast double borders, and restrained shadows. Do not change display or interaction semantics.

- [ ] **Step 4: Preserve reduced motion**

Ensure the existing `@media (prefers-reduced-motion: reduce)` block continues to handle non-logo decorative motion where needed. It does not need Logo-specific rules because the Logo is static.

- [ ] **Step 5: Run focused test**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: remaining failure only for missing HTML microcopy/classes if Task 3 has not run yet.

### Task 3: Page-Level Visual Copy And Hooks

**Files:**
- Modify: `src/index.html`

**Interfaces:**
- Consumes: CSS classes added in Task 2.
- Produces: restrained archive microcopy and page-level classes without changing form, navigation, or data hooks.

- [ ] **Step 1: Add public-home microcopy**

Add an element near the public hero summary:

```html
<p class="archive-microcopy">梦不是答案，而是线索。</p>
```

- [ ] **Step 2: Add page-level archive classes**

Add decorative-only classes without removing existing ones:

```html
class="hero archive-hero"
class="entry-card archival-card"
class="dream-form archival-card"
class="dream-home-reflection archival-card"
```

Use existing elements; do not add new buttons or navigation.

- [ ] **Step 3: Add restrained page microcopy where useful**

Add one short line to Quick, Journal, Detail, or Privacy visual panels, using only non-diagnostic self-exploration language.

- [ ] **Step 4: Run focused test**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: PASS.

### Task 4: Verification And PR

**Files:**
- Read: `git diff`
- No production edits unless tests reveal a direct visual-contract gap.

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: verified branch, commit, push, PR.

- [ ] **Step 1: Run syntax and whitespace checks**

Run:

```bash
git diff --check
node --check src/app.js
```

Expected: exit 0.

- [ ] **Step 2: Run focused and full tests**

Run:

```bash
npm test -- tests/siteVisualRefresh.test.js
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Review changed files**

Run:

```bash
git diff --stat
git diff -- src/index.html src/style.css tests/siteVisualRefresh.test.js
```

Confirm no business logic, API, schema, or mini program files changed.

- [ ] **Step 4: Commit and PR**

Stage only intended files:

```bash
git add docs/superpowers/specs/2026-07-23-classical-archive-visual-refresh-design.md docs/superpowers/plans/2026-07-23-classical-archive-visual-refresh.md src/index.html src/style.css tests/siteVisualRefresh.test.js
git commit -m "Refresh classical archive visual language"
git push -u origin codex/classical-archive-visual-refresh
```

Create PR:

```bash
gh pr create --base main --head codex/classical-archive-visual-refresh --title "Refresh Classical Archive Visual Language" --body-file <prepared-body.md>
```

Expected: PR URL is returned.
