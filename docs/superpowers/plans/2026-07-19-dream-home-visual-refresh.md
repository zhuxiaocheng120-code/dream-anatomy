# Dream Home Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh Dream Home and shared brand styling without changing product behavior.

**Architecture:** Keep the current plain HTML/CSS/JavaScript SPA. Add Dream Home presentation markup in `src/index.html`, update reusable CSS tokens and Dream Home styles in `src/style.css`, and protect the visual contract with `tests/dreamHome.test.js`.

**Tech Stack:** Plain HTML, CSS, Node.js `node:test`.

## Global Constraints

- Do not change backend, auth, database schema, analytics, AI prompts, Mini Program code, or Dream Journal / analysis logic.
- Keep Chinese-first user-facing copy.
- Do not add diagnosis, treatment, fortune telling, luck judgment, or future prediction language.
- Do not load remote fonts or copyrighted images.
- Use original inline SVG line art only as restrained decorative support.

---

### Task 1: Visual Contract Tests

**Files:**
- Modify: `tests/dreamHome.test.js`

**Interfaces:**
- Consumes: existing static Dream Home integration test.
- Produces: failing assertions for the visual refresh contract.

- [ ] **Step 1: Write the failing test**

Add assertions to `integrates Dream Home markup, browser scripts, app bridge, and responsive layout` that check:

```js
assert.match(html, /data-dream-home-reflection/);
assert.match(html, /梦并不急着给出答案，它更像是在递来线索。/);
assert.match(html, /自我探索不是判断对错，而是看见自己。/);
assert.match(html, /data-sketch-visual="dream-home-archive"/);
assert.match(html, /data-sketch-visual="dream-home-divider"/);
assert.doesNotMatch(
  html.match(/<section class="dream-home-reflection"[\s\S]*?<\/section>/)[0],
  /算命|诊断|治疗|吉凶|未来预测|预言/
);
assert.match(css, /--paper:\s*#/);
assert.match(css, /--aged-paper:\s*#/);
assert.match(css, /--warm-charcoal:\s*#/);
assert.match(css, /--muted-olive:\s*#/);
assert.match(css, /\.dream-home-sketch-panel/);
assert.match(css, /\.dream-home-reflection/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/dreamHome.test.js`

Expected: FAIL because the new markup and CSS tokens do not exist.

### Task 2: Dream Home Markup

**Files:**
- Modify: `src/index.html`

**Interfaces:**
- Consumes: existing `data-dream-home` layout and Dream Home controller hooks.
- Produces: visual-only markup with no new behavior hooks except static data attributes for tests.

- [ ] **Step 1: Add Dream Home sketch hero markup**

Wrap the welcome header content in a hero grid and add a decorative inline SVG panel with `data-sketch-visual="dream-home-archive"`.

- [ ] **Step 2: Add reflective microcopy**

Add `<section class="dream-home-reflection" data-dream-home-reflection>` after the daily quote. Include the four approved short lines and a decorative divider SVG with `data-sketch-visual="dream-home-divider"`.

- [ ] **Step 3: Run targeted test**

Run: `npm test -- tests/dreamHome.test.js`

Expected: still FAIL until CSS tokens and classes are implemented.

### Task 3: Shared Brand CSS

**Files:**
- Modify: `src/style.css`

**Interfaces:**
- Consumes: existing class names and media-query tests.
- Produces: warm archive visual tokens, refreshed Dream Home styles, and mobile-safe layout.

- [ ] **Step 1: Update CSS variables**

Add warm aliases such as `--paper`, `--aged-paper`, `--warm-charcoal`, `--sepia`, `--muted-olive`, and `--dusty-sage`; map existing tokens to keep old class rules working.

- [ ] **Step 2: Refresh shared surfaces**

Adjust body background, header, cards, buttons, badges, and focus ring to use warmer tokens while preserving existing selectors.

- [ ] **Step 3: Style Dream Home additions**

Add `.dream-home-hero`, `.dream-home-sketch-panel`, `.dream-home-sketch`, `.dream-home-reflection`, `.reflection-note-list`, and mobile media-query rules.

- [ ] **Step 4: Run targeted test**

Run: `npm test -- tests/dreamHome.test.js`

Expected: PASS.

### Task 4: Verification And PR

**Files:**
- Modify if needed: only files touched above.

**Interfaces:**
- Consumes: implemented visual refresh.
- Produces: verified commit and PR.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run syntax checks**

Run: `node --check src/app.js`, `node --check src/dreamHome.js`, and `git diff --check`.

Expected: PASS.

- [ ] **Step 3: Final review**

Review the diff for product boundary, accessibility, mobile fit, safety copy, and no logic changes. Fix only Critical or Important findings.

- [ ] **Step 4: Commit and open PR**

Commit message: `Refresh Dream Home visual style`

PR title: `Refresh Dream Home Visual Style`
