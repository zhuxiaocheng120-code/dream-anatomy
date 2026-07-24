# Cloud Logo Motion Refinement Design

## Goal

Refine Dream Anatomy's existing cloud logo and line ornament motion across Web and the WeChat Mini Program. The result should feel like quiet archival manuscript linework: slow, slight, continuous, and premium. This PR is presentation-only.

## Scope

- Web public home brand mark and hero lockup.
- Web authenticated Dream Home brand mark.
- Web auth brand mark where the same asset appears.
- Mini Program home `visual-orbit`.
- Mini Program profile identity seal.
- Any Mini Program view that reuses the shared orbit/cloud motion classes.
- Documentation for the refined motion language.

## Out Of Scope

- AI prompts, API contracts, database schema, migrations, Supabase, WeChat auth, cloud sync, payment, membership, and compliance copy.
- Reopening deep guidance.
- Adding JS animation loops or animation libraries.
- Remote images, remote fonts, downloaded assets, or copyrighted source material.

## Visual Direction

The motion is not a loading indicator and not a playful bounce. It should read as:

- manuscript line breathing;
- a very slight floating paper-seal effect;
- subtle opacity/line drift;
- European archival psychology studio rather than mystical or fortune-telling.

Web cycles should remain slow, roughly 8-12 seconds for the primary cloud breath. Mini Program motion should be even more restrained and implemented through WXSS keyframes only.

## Web Behavior

Web will keep the current local SVG logo assets and CSS-only animation approach. New reusable motion classes will make the intent explicit:

- `.archive-cloud-mark`
- `.archive-cloud-line`
- `.cloud-breath`
- `.cloud-line-drift`

Existing logo selectors (`.brand-mark`, `.hero-brand-seal`, `.dream-guide-seal`, `.auth-brand-mark`) remain supported so current markup hooks and tests keep working. `prefers-reduced-motion: reduce` disables continuous logo/cloud animation.

## Mini Program Behavior

Mini Program shared WXSS will define:

- `.archive-cloud-mark`
- `.archive-cloud-line`
- `.mini-cloud-breath`
- `.mini-line-drift`
- `@keyframes miniCloudBreath`
- `@keyframes miniLineDrift`

The home orbit and profile seal will opt into these classes. They remain decorative (`aria-hidden="true"`), local, and pointer-safe. If a target WeChat runtime cannot animate a given keyframe property, the visual falls back to the existing static orbit/seal.

## Compliance Boundary

This PR must not add user-facing Mini Program copy that restores high-risk terms removed for compliance. It should not add or change visible copy in the Mini Program except class attributes.

## Acceptance Criteria

- Web logo motion classes and keyframes exist.
- Web reduced-motion disables the cloud/logo motion.
- Mini Program home includes cloud/line motion classes.
- Mini Program profile identity seal uses the same shared motion language.
- Mini Program WXSS contains keyframes and no JS animation loop is introduced.
- Mini Program keeps no remote image/font dependency and no high-risk compliance copy regression.
- API, prompt, database, auth, and sync files are not behaviorally changed.
- `npm test`, JavaScript syntax checks, `git diff --check`, and final reviewer pass.
