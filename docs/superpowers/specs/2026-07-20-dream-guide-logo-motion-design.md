# Dream Guide Logo And Subtle Motion Design

## Context

Dream Anatomy already has a parchment / quiet archive visual language. This PR adds a small layer of brand recognition and restrained motion without changing product structure, API behavior, database schema, authentication, AI prompts, or WeChat Mini Program code.

PR #37 already introduced a cloud-shaped sleep-quality slider thumb. This PR keeps that slider's native range input, drag behavior, keyboard behavior, value range, 5-point snapping, null initial state, saving structure, Dream Detail editing, and tests intact. It only aligns the thumb's visual language with the new logo.

## Recommended Approach

Use **inline SVG brand assets plus CSS-only microanimations**.

Compared with building an icon component in JavaScript, SVG files keep the mark reusable for favicon, header, auth, empty/loading states, and future Mini Program export. Compared with purely CSS-drawn logos, SVG makes the small 24/32/48px mark clearer and easier to maintain.

## Logo Concept

The logo is **"云朵里的梦境向导"**:

- A soft, slightly irregular cloud silhouette.
- A tiny dream guide represented only by quiet eyes and a small dream symbol.
- The expression is calm and companion-like, not cartoonish, medical, fortune-telling, tarot-like, or copied from another AI brand.
- The palette uses parchment, warm charcoal, muted olive, dusty sage, and sepia.

The first version provides:

- `src/assets/brand/dream-guide-mark.svg`: icon logo for header mark, favicon, loading or empty states, and future Mini Program export source.
- `src/assets/brand/dream-anatomy-lockup.svg`: horizontal lockup with the mark and "析梦 Dream Anatomy".
- `src/assets/brand/dream-guide-monochrome.svg`: single-color mark using `currentColor`.

All SVGs must be original, local, script-free, and free of external resource references. They are beta brand assets, not a registered trademark.

## Web Placement

Use the logo sparingly:

- Header brand button: icon plus existing brand text behavior.
- Public hero brand area: icon mark near the title, without taking over the layout.
- Dream Home welcome: mark as a small brand seal in the hero region.
- Auth modal: small mark above or near the auth title.
- Favicon: reference the local SVG icon.
- Empty/loading states: allow the mark only where it adds calm identity without repeating on every card.

The header brand button must remain keyboard-focusable and must keep its current "return home" behavior for guest and logged-in states.

## Motion Design

Motion is CSS-only and low-stimulation:

- Logo float: 2-4px vertical movement, 7-9s cycle, ease-in-out.
- Guide blink: short, infrequent SVG/CSS state using no JavaScript timers.
- Page entry: subtle opacity and translateY for hero, panels, quick result, Dream Result Card, journal/detail containers, and auth modal.
- Result Card dimension bars: one-time width reveal by CSS transition/animation, without changing the numeric score or treating 0 as missing.
- Hover/focus: small scale or lift, focus rings remain visible.

Reduced motion behavior:

- `prefers-reduced-motion: reduce` disables continuous float, blink, bar reveal, and page-entry motion.
- Necessary focus and instant state feedback remain visible.

Decorative elements must not intercept clicks.

## Sleep Quality Slider

The slider thumb remains an existing native range input. The visual is updated so the thumb cloud curve echoes the logo's cloud mark:

- Simpler cloud outline, no face inside the thumb.
- Parchment fill, sepia / muted olive line work.
- Desktop size remains slightly larger than a standard dot.
- Coarse pointer size remains touch-friendly.
- Hover/focus/active states gently scale and deepen shadow.

No sleep-quality data structure or saving behavior changes.

## Documentation

Add a short brand documentation page:

- Asset list.
- Originality and non-affiliation statement.
- Reduced-motion behavior.
- Future Mini Program PNG export note.
- Trademark/legal review reminder before formal brand use.

## Testing

Static and behavior tests must cover:

- SVG assets exist, are local, and contain no scripts, event handlers, external resources, or embedded raster/base64.
- Header, favicon, hero, Dream Home, and auth modal reference the brand assets.
- Header brand behavior hooks remain unchanged.
- Reduced-motion CSS disables continuous animation.
- Logo and decorative animation classes do not intercept clicks.
- Slider thumb uses the logo-aligned cloud asset/shape while keeping the native range and existing sleep-quality tests green.
- Result Card progress animation CSS does not change final score semantics, including score `0`.

## Out Of Scope

This PR does not:

- Change AI prompts, DeepSeek API behavior, server routes, Supabase schema, auth, analytics, product data, Dream Result Card contract, or WeChat Mini Program pages.
- Add an animation library.
- Add sound, full-screen loading animation, particle effects, or large layout redesign.
- Claim trademark registration or legal clearance.
