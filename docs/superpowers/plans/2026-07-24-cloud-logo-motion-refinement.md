# Cloud Logo Motion Refinement Implementation Plan

## Task 1: TDD Coverage For Refined Motion

- Update Web visual tests to require explicit cloud motion classes, slow 8-12s breath timing, line-drift coverage, and reduced-motion shutdown.
- Update Mini Program visual tests to require shared WXSS classes/keyframes, home/profile WXML adoption, no JS animation loops, and no remote image/font assets.
- Run the focused visual tests and confirm they fail before implementation.

## Task 2: Web Cloud Logo Motion Refinement

- Add explicit reusable Web motion classes in `src/style.css`.
- Refine logo keyframes to use smaller `translateY`, very light `scale`, and opacity drift.
- Keep existing selectors and UI hooks intact.
- Add the new classes to Web logo placements only if needed for explicit class coverage.
- Extend the reduced-motion block to disable the new motion classes.

## Task 3: Mini Program Shared Motion

- Add shared cloud/orbit motion keyframes and classes in `miniprogram/app.wxss`.
- Apply motion classes to the home `visual-orbit`.
- Apply motion classes to the profile `identity-seal`.
- Avoid all JS animation loops, remote assets, fonts, and copy changes.

## Task 4: Documentation

- Update `docs/MINIPROGRAM_VISUAL_LANGUAGE.md` with motion classes, fallback behavior, and manual verification guidance.
- Update `docs/BRAND_ASSETS.md` with refined cloud/logo motion notes.
- Update `docs/PROJECT_STATUS.md` to record Web and Mini Program cloud microanimations.

## Task 5: Verification And PR

- Run focused tests.
- Run full `npm test`.
- Run JavaScript syntax checks for touched/existing entry JS where applicable.
- Run `git diff --check`.
- Request final reviewer.
- Fix Critical or Important findings only.
- Commit, push, and create PR titled `Refine Cloud Logo Motion Across Web and Mini Program`.
