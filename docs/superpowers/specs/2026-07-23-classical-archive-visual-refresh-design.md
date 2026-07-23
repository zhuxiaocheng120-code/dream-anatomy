# Classical Archive Visual Refresh Design

## Goal

Upgrade the Dream Anatomy Web UI into a more refined European psychological archive style while preserving all existing business flows, API contracts, authentication behavior, privacy/data controls, and database schema.

## Confirmed Approach

Use方案 A: shared visual system plus restrained page-level accents.

- Shared tokens carry the new palette: warm ivory, parchment, muted olive, dark walnut, and bronze-gold accents.
- Existing page structure and `data-*` hooks remain intact.
- Page-level ornaments stay small and original: manuscript dividers, archive-card marks, light paper texture, and quiet quote panels.
- Logo animation is CSS-only, slow, and restrained. It affects both the public home logo and authenticated Dream Home logo.
- `prefers-reduced-motion: reduce` disables continuous logo motion and other decorative animation.

## Visual Language

The site should feel like a calm personal archive: old paper, refined typography, fine ruled lines, archival cards, and manuscript notes. It should not resemble tarot, fortune-telling, zodiac, hospital software, or a cartoon product.

The main background uses layered parchment tones with a very subtle paper fiber texture. Cards use low-contrast borders, fine inset lines, softened shadows, and a manuscript-page surface. Titles use a serif Chinese-first stack for archive/editorial character, while body text remains a readable sans-serif stack.

## Page Coverage

- Public home: stronger archive hero, animated logo lockup, refined entry cards, and one restrained self-exploration line.
- Dream Home: keep the existing complete expression, enrich archive-card surfaces, and animate the Dream Guide mark with the same motion language.
- Quick Analysis: preserve the workbench/input flow, but make it read more like a manuscript record card.
- Guided/Deep Guidance: keep disabled state clear, with a calm path/ledger motif and no interaction changes.
- Dream Journal: make list cards feel like private index cards and keep search/filter usability unchanged.
- Dream Detail/Report: make the detail surface feel like a psychological manuscript/report while preserving long-text readability.
- Privacy & Data/Auth/shared states: use the same palette, borders, and typography without letting decoration distract from legal or dangerous actions.

## Logo Motion

Both logo placements must continuously move very slightly:

- `.brand-mark` in the global/public header.
- `.hero-brand-seal` on the public home.
- `.dream-guide-seal` in authenticated Dream Home.

The motion is a combined float/breathing/shimmer effect implemented in CSS. It must be slow, low-amplitude, and not tied to layout or JavaScript. Reduced motion disables it.

## Copy Rules

Additional copy must be short, Chinese-first, and self-exploration oriented. It may use restrained phrases such as:

- “梦不是答案，而是线索。”
- “你不必立刻理解梦，只需要先把它留下来。”
- “有些意象不是结论，而是邀请。”

No copy may imply diagnosis, treatment, prediction, fortune telling, fixed identity, or medical interpretation.

## Non-Goals

This PR does not:

- Modify JavaScript product logic.
- Modify AI prompts or API request/response structures.
- Modify Supabase schema or migrations.
- Modify authentication, privacy/data flow, analytics, account deletion, or mini program behavior.
- Add a heavy UI framework, animation library, remote image, remote font, or copyrighted visual asset.

## Testing

Add static visual-safety tests that verify:

- The new classical archive tokens exist.
- Main page types include archive treatment classes/hooks.
- Public and authenticated logos have the new microanimation class coverage.
- Reduced motion disables the logo motion.
- No external visual assets are introduced.
- Existing `data-*` product hooks remain present.

Manual desktop verification should check public home, Dream Home, quick analysis, Dream Journal, Dream Detail, Privacy & Data, auth modal, loading/empty states, and reduced-motion behavior.

