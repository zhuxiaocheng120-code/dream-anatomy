# Site-Wide Visual Refresh Design

## Goal

Extend the Dream Home visual language from PR #30 across the main Web SPA so every primary page feels intentionally designed while Dream Home remains the most complete visual anchor.

## Scope

- Keep the current SPA, DOM hooks, forms, hidden states, auth flow, data flow, AI calls, analytics, backend, Supabase schema, and Mini Program unchanged.
- Update Web presentation in `src/index.html` and `src/style.css`.
- Add static visual-contract tests.
- Do not add external images, remote fonts, UI frameworks, routes, or business features.

## Shared Visual Language

The whole site should use the aged-paper / quiet-archive palette already introduced in PR #30:

- parchment and ivory page surfaces
- warm gray, warm charcoal, sepia, muted olive, and dusty sage accents
- low-contrast borders, soft paper shadows, and fine dividers
- editorial Chinese-friendly heading hierarchy using system serif fallbacks
- clear modern sans-serif body text

Decorative visuals should be original inline SVG line art, sparse, and decorative only. They should feel like archival psychology notes: paths, rings, doors, index cards, manuscript dividers, and botanical linework. They must not resemble fantasy game art, tarot cards, horror, or copied historical art.

## Page-Level Treatment

### Dream Home

Dream Home remains the strongest hero-level expression. Existing hero, reflective notes, daily quote, stats, recent dreams, and original sketch panel stay as the visual standard.

### Quick Analysis

Quick Analysis should feel like a quiet dream-recording workbench. Add a small manuscript / index-card visual panel near the page heading and a short original line:

> 情绪有时比解释更早接近真相。

The textarea and result panels should feel like paper cards, not generic forms.

### Guided / Deep Guidance

Guided remains visibly disabled by feature flag when applicable. The page gets calmer spacing and a path / ring line-art motif. Add a small line:

> 你可以慢一点，让问题先陪你靠近梦。

This must not imply the feature is active when the feature flag disables it.

### Dream Journal

Dream Journal should feel like a private archive or index-card collection. Add an archive rail / index motif around the heading and a small line:

> 把梦写下来，是给内在经验留一张索引卡。

Record cards, filters, pending badges, and empty states inherit the archive-card treatment.

### Dream Detail / Report

Dream Detail should feel like a manuscript report. Add a small report ornament near the detail heading and use report/manuscript styling for hero, analysis, Dream Result Card, and folded sections. Long text must remain highly readable.

### Privacy & Data / Auth / Shared States

Privacy & Data should be calm, trustworthy, and minimally decorated. Add a ledger-style visual note and keep danger actions clearly distinguishable. Auth modal receives the same paper/dialog visual language and a small decorative mark. Empty/loading/status states use the shared archive tone and must not rely on color alone.

## Safety And Accessibility

- No diagnosis, treatment, fortune telling, luck judgment, future prediction, fear language, or deterministic dream interpretation.
- Decorative SVGs are `aria-hidden="true"` and do not receive focus.
- Text contrast must remain suitable for small UI text.
- Mobile layouts must collapse to a single column without text overflow.
- Existing `data-*` hooks and form behavior must remain intact.

## Testing

Add a static visual refresh test that verifies:

- page-level visual hooks exist for Quick, Guided, Dream Journal, Dream Detail, Privacy, and Auth
- added microcopy exists and stays within safety boundaries
- decorative SVGs are inline and marked `aria-hidden`
- no external image assets are introduced
- shared CSS classes exist for page ornaments, archive panels, manuscript/report surfaces, empty states, and auth dialog styling
- existing page hooks remain present
