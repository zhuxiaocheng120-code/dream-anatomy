# Dream Home Visual Refresh Design

## Goal

Refresh Dream Home and the shared Dream Anatomy brand style so the authenticated home experience feels warmer, more premium, more reflective, and closer to a quiet dream archive / psychological studio.

## Scope

- Refresh Dream Home first.
- Apply reusable visual language through existing CSS tokens and shared card/button styles.
- Add a restrained reflective microcopy area to Dream Home.
- Add original sketch-style decorative visuals in Dream Home only.
- Preserve all product logic, navigation, auth, analytics, backend, database schema, AI prompts, Mini Program code, and saved-data behavior.

## Visual Direction

The palette shifts from plain MVP blue-purple accents toward aged paper, ivory, sepia, muted olive, dusty sage, and warm charcoal. The body background should feel like soft faded paper, not a fantasy or astrology surface.

Headings use a more editorial Chinese-friendly stack with system serif fallbacks. Body copy remains readable with system sans fonts. No external font loading is added.

Dream Home cards, buttons, badges, dividers, and containers use softer borders, lower-contrast shadows, and warmer surfaces.

## Dream Home Additions

The authenticated Dream Home receives:

- A refreshed welcome hero that keeps the existing greeting, email, and introductory copy.
- A small original line-art panel using inline SVG paths, marked decorative and not interactive.
- A reflective note section with a few original short Chinese lines:
  - 梦并不急着给出答案，它更像是在递来线索。
  - 有些反复出现的意象，也许是内在经验的回声。
  - 你不需要立刻理解梦，只需要先把它留住。
  - 自我探索不是判断对错，而是看见自己。

These lines are product microcopy, not attributed quotations. They must not sound clinical, predictive, diagnostic, or fortune-telling.

## Safety Boundaries

The refresh must not add or imply diagnosis, treatment, fortune telling, luck judgment, or future prediction. Existing reminders about Dream Anatomy being a self-exploration tool remain intact.

## Testing

Add static tests that verify:

- Warm archive CSS tokens exist.
- Dream Home includes the reflective microcopy area.
- Dream Home includes original sketch visual hooks.
- The added copy avoids prohibited safety-boundary expressions.
- Existing Dream Home markup, action order, script order, and responsive layout continue to pass.
