# Dream Guide Logo And Subtle Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add original Dream Guide logo assets, connect them to the Web UI, align the sleep-quality cloud thumb, and add restrained CSS microanimations.

**Architecture:** Keep this as a presentation-only Web PR. Brand assets live under `src/assets/brand/`, page references stay in `src/index.html`, all motion and slider changes stay in `src/style.css`, and static tests protect asset safety and behavior hooks.

**Tech Stack:** Plain HTML, CSS, SVG, Node test runner.

## Global Constraints

- Do not modify backend, database, API routes, Supabase, authentication, analytics, AI prompts, or WeChat Mini Program files.
- Do not change sleep-quality range logic, 5-point snapping, null initial state, saved field names, Dream Detail editing, or data structure.
- Do not introduce GSAP, Lottie, React, Vue, route frameworks, font files, remote images, or large Base64 assets.
- All logo assets must be original local SVGs with no scripts, event handlers, external resources, or third-party marks.
- Motion must use CSS transform / opacity where possible and support `prefers-reduced-motion: reduce`.
- Header brand button behavior and data hooks must remain unchanged.

---

### Task 1: Brand Asset Safety Tests And SVG Assets

**Files:**
- Create: `src/assets/brand/dream-guide-mark.svg`
- Create: `src/assets/brand/dream-anatomy-lockup.svg`
- Create: `src/assets/brand/dream-guide-monochrome.svg`
- Modify: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Produces local paths used by `src/index.html` and tests:
  - `src/assets/brand/dream-guide-mark.svg`
  - `src/assets/brand/dream-anatomy-lockup.svg`
  - `src/assets/brand/dream-guide-monochrome.svg`

- [ ] **Step 1: Write failing asset safety test**

Add a test named `brand logo assets are local original SVGs without executable or external content` to `tests/siteVisualRefresh.test.js`. It should read all three SVG files, assert they exist, assert each contains `<svg`, `<title>`, and no `<script`, `onload=`, `onclick=`, `http://`, `https://`, `data:image`, `base64`, `Anthropic`, `Claude`, `HEMISPHERIC`, `tarot`, or `zodiac`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because the SVG files do not exist.

- [ ] **Step 3: Create SVG assets**

Create three small SVG files:

- `dream-guide-mark.svg`: cloud outline with quiet eyes and one small star/dream symbol.
- `dream-anatomy-lockup.svg`: mark plus "析梦 Dream Anatomy" with text converted to normal SVG text, no font files.
- `dream-guide-monochrome.svg`: same mark simplified with `fill="none"` / `stroke="currentColor"` where possible.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: PASS.

### Task 2: Logo UI Integration Tests And Markup

**Files:**
- Modify: `src/index.html`
- Modify: `src/style.css`
- Modify: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Consumes SVG paths from Task 1.
- Produces CSS classes:
  - `.brand-mark`
  - `.brand-lockup`
  - `.dream-guide-seal`
  - `.auth-brand-mark`

- [ ] **Step 1: Write failing integration test**

Add assertions to `tests/siteVisualRefresh.test.js` that:

- `src/index.html` references `src/assets/brand/dream-guide-mark.svg` as favicon.
- The header brand button still has `data-view-target="home"` and `aria-label="返回析梦 Dream Anatomy 首页"`.
- Header, public hero, Dream Home, and auth modal include local brand image references with empty `alt=""` for decorative instances or accessible text on the button.
- The markup does not add a new route, script, or backend call.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because references and classes are missing.

- [ ] **Step 3: Update markup and minimal styles**

Update `src/index.html`:

- Add `<link rel="icon" type="image/svg+xml" href="assets/brand/dream-guide-mark.svg">`.
- Add the icon to the existing `.brand` button without changing `data-view-target`.
- Add a small hero seal, Dream Home seal, and auth modal mark.

Update `src/style.css` with responsive sizing and `pointer-events: none` for decorative image classes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: PASS.

### Task 3: Motion Tests And CSS Microanimations

**Files:**
- Modify: `src/style.css`
- Modify: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Produces keyframes:
  - `dreamGuideFloat`
  - `dreamGuideBlink`
  - `dreamSoftEnter`
  - `dreamDimensionReveal`

- [ ] **Step 1: Write failing motion test**

Add assertions that CSS includes the required keyframes, uses `transform` and `opacity`, includes `@media (prefers-reduced-motion: reduce)`, and sets continuous animations to `none` in reduced motion.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because animation rules are missing.

- [ ] **Step 3: Add CSS-only microanimations**

Add restrained animation classes:

- Logo float on brand marks.
- Blink using classed SVG/image container state where feasible without JS.
- Page entry on hero, work panels, result panels, Dream Journal, Dream Detail, privacy panels, and auth modal.
- Result Card progress reveal via `.result-card-progress span`.
- Hover/focus lift for cards without breaking hidden states.
- Reduced motion disables continuous and entry animations.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: PASS.

### Task 4: Logo-Aligned Cloud Slider Thumb

**Files:**
- Modify: `src/style.css`
- Modify: `tests/siteVisualRefresh.test.js`

**Interfaces:**
- Consumes existing `.sleep-quality-range`.
- Keeps existing `src/sleepQuality.js` untouched.

- [ ] **Step 1: Write failing slider visual test**

Tighten the existing sleep-quality visual test so the base range rule contains a logo-aligned cloud thumb marker, both WebKit and Firefox thumb rules use `--sleep-quality-cloud-thumb`, and the SVG path differs from the PR #37 thumb by using the new smoother logo cloud curve.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because the thumb is still the PR #37 cloud shape.

- [ ] **Step 3: Update only slider visuals**

Update `--sleep-quality-cloud-thumb` in `src/style.css` to match the new logo cloud language. Preserve dimensions, track colors, focus ring, hover/active states, and coarse pointer sizing.

- [ ] **Step 4: Run behavior tests**

Run:

```bash
npm test -- tests/siteVisualRefresh.test.js
npm test -- tests/sleepQuality.test.js
npm test -- tests/dreamJournal.test.js
```

Expected: PASS.

### Task 5: Brand Documentation And Final Regression

**Files:**
- Create: `docs/BRAND_ASSETS.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`

**Interfaces:**
- Documents source SVGs, originality, reduced-motion behavior, and future Mini Program PNG export note.

- [ ] **Step 1: Write failing documentation test**

Add assertions to `tests/siteVisualRefresh.test.js` that `docs/BRAND_ASSETS.md` exists and includes:

- `Dream Anatomy Beta 的原创品牌标识 v1`
- `正式商标使用前仍应完成相似标识检索和必要法律审查`
- `prefers-reduced-motion`
- `小程序`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/siteVisualRefresh.test.js`

Expected: FAIL because the doc does not exist.

- [ ] **Step 3: Write documentation**

Create `docs/BRAND_ASSETS.md` and add short references in `README.md` and `docs/PROJECT_STATUS.md`.

- [ ] **Step 4: Full verification**

Run:

```bash
npm test -- tests/siteVisualRefresh.test.js
npm test -- tests/sleepQuality.test.js
npm test -- tests/dreamJournal.test.js
git diff --check
node --check src/app.js
node --check src/sleepQuality.js
npm test
```

Expected: all pass. If sandbox blocks server listen with `EPERM`, rerun full `npm test` with approved non-sandbox execution.

- [ ] **Step 5: Final reviewer and PR**

Request code review focused on scope, accessibility, motion safety, asset safety, and no business logic changes. Fix Critical or Important findings, rerun verification, commit, push, and create PR titled `Add Dream Guide Logo and Subtle Animations`.

## Self-Review

- Spec coverage: Logo assets, placements, motion, reduced motion, slider visual alignment, docs, testing, and out-of-scope boundaries are all mapped to tasks.
- Placeholder scan: No TBD/TODO placeholders remain.
- Type consistency: Class names and asset paths are defined before use and reused consistently across tasks.
