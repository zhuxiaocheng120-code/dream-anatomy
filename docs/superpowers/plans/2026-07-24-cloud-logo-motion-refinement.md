# Cloud Logo Motion Refinement Implementation Plan

> Superseded by the 2026-07-28 static Logo decision. The active implementation should remove cloud/logo animation rather than refine it.

## Task 1: TDD Coverage For Static Logo

- Update Web visual tests to require no cloud/logo keyframes, no animated overlay paths, no dash/path morph animation, and static Logo SVGs.
- Update Mini Program visual tests to require a single static local cloud SVG, no cloud/logo WXSS keyframes, no JS animation loops, and no remote image/font assets.
- Run the focused visual tests and confirm they fail before implementation.

## Task 2: Web Static Cloud Logo

- Remove reusable Web motion classes in `src/style.css`.
- Remove animated overlay paths from visible inline SVG logos.
- Keep existing selectors and UI hooks intact.
- Keep the static `.archive-cloud-outline` path.
- Remove Logo-specific reduced-motion rules that only served animation.

## Task 3: Mini Program Static Cloud Mark

- Remove shared cloud/orbit motion keyframes and classes in `miniprogram/app.wxss`.
- Keep one static local cloud SVG layer on home.
- Keep one static local cloud SVG layer on the profile identity seal.
- Avoid all JS animation loops, remote assets, fonts, and copy changes.

## Task 4: Documentation

- Update `docs/MINIPROGRAM_VISUAL_LANGUAGE.md` with static Logo guidance and manual verification boundaries.
- Update `docs/BRAND_ASSETS.md` with static cloud/logo notes.
- Update `docs/PROJECT_STATUS.md` to record Web and Mini Program static Logo status.

## Task 5: Verification And PR

- Run focused tests.
- Run full `npm test`.
- Run JavaScript syntax checks for touched/existing entry JS where applicable.
- Run `git diff --check`.
- Request final reviewer.
- Fix Critical or Important findings only.
- Commit, push, and create PR titled `Refine Cloud Logo Motion Across Web and Mini Program`.
