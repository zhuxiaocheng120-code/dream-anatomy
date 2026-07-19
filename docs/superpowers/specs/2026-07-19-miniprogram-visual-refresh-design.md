# Mini Program Visual Refresh Design

## Goal

Adapt the frozen Web visual language from Dream Home and the site-wide refresh to the native WeChat Mini Program, while keeping the Mini Program guest-only feature loop unchanged.

## Scope

- Update only Mini Program presentation, Mini Program visual documentation, and visual-contract tests.
- Keep page paths, navigation, API request shape, local storage, legal consent, Dream Result Card data handling, deletion, export, and disabled deep guidance behavior unchanged.
- Do not modify Web pages, backend routes, DeepSeek prompts, Supabase, database schema, product analytics, payment, membership, `wx.login`, or cloud sync.
- Do not introduce Taro, uni-app, React, Vue, remote images, remote fonts, font files, large Base64 assets, or copyrighted network images.

## Visual System

The Mini Program should use the same brand direction now used by Web:

- parchment / warm ivory backgrounds
- warm charcoal primary text
- sepia / muted brown secondary text
- muted olive / dusty sage accents
- low-contrast paper dividers
- calm cards, buttons, badges, inputs, loading, error, empty, and modal states
- editorial-feeling Chinese title hierarchy with readable system body text

Because WeChat WXSS does not support CSS custom properties in the same way as Web CSS across all targets, the tokens will be documented in comments and encoded through shared classes in `miniprogram/app.wxss`.

## Page-Level Treatment

### Home

Home is the strongest visual anchor. It should show a richer hero area with the `析梦 Dream Anatomy` brand, a restrained original archive / ring / manuscript motif, primary entry actions, recent local dreams, and a small reflective microcopy area. Deep guidance remains visible but disabled and marked `正在开发中`.

### Quick Analysis

Quick Analysis becomes a quiet dream-recording workbench. The textarea should feel like a manuscript card, with a light page note and a small original corner/sketch motif. Loading, errors, quota messages, and consent remain clear and functional.

### Result

Result should feel like a structured psychological archive report. Text analysis, safety reminder, Dream Result Card, missing-card fallback, and save actions remain readable and separated.

### Dream Journal

Dream Journal becomes a private archive / index-card collection. Record cards should scan quickly, empty state should include a small original motif, and local-only guest boundaries remain visible.

### Dream Detail

Dream Detail should feel like a manuscript report. Original dream text, AI analysis, saved Dream Result Card, and delete action should remain clearly separated. The delete button stays visibly dangerous and requires the existing confirmation flow.

### Privacy & Data

Privacy & Data keeps a trustworthy ledger/document feeling. Legal text readability and destructive actions matter more than decoration.

### Profile

Profile should remain an honest guest-mode identity card. It must not imply login, cloud sync, avatar identity, or a fake account state.

## Decorations And Copy

- Use only original WXML/WXSS geometric line motifs: rings, paths, index cards, ledger lines, manuscript corners, seals, and archive rails.
- Decorative structures use `aria-hidden="true"` and should not capture taps.
- Add only a few original Chinese microcopy lines, such as:
  - 梦并不急着给出答案，它更像是在递来线索。
  - 你不需要立刻理解梦，只需要先把它留住。
  - 情绪有时比解释更早接近真相。
  - 反复出现的意象，也许值得被安静地看见。
- Do not attribute original copy to Jung, Freud, or any real author.
- Do not add diagnosis, treatment, prediction, fortune, luck judgment, deterministic interpretation, or fixed personality language.

## Code Structure

- `miniprogram/app.wxss` owns shared visual classes and visual tokens.
- Page WXML may add small page-level structures and existing class combinations.
- Page WXSS files keep only page-specific layout refinements.
- Component WXSS files receive visual alignment for loading, error, confirmation modal, legal document, and result card.
- No new ornament component is added unless a structure truly repeats enough to justify it; this first visual pass should stay lightweight.

## Testing

Add a static Mini Program visual refresh test that verifies:

- required native page registrations remain unchanged
- shared visual classes and token comments exist in `miniprogram/app.wxss`
- every main Mini Program page has a page-level visual hook
- Home, Quick, Result, Journal, Detail, Privacy, and Profile contain the intended visual identity copy or motifs
- no remote images, remote fonts, large Base64 images, extra frameworks, `wx.login`, Authorization header, Supabase login, or server secrets are introduced
- reusable state components keep safe WXML rendering and gain shared visual alignment
- long-text and small-screen guard classes exist

Manual verification should be documented as WeChat Developer Tools required. If it is not performed in this environment, the PR must say so plainly.
