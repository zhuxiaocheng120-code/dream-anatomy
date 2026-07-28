# Cloud Logo Motion Refinement Design

## Goal

This historical motion refinement design is superseded by the 2026-07-28 static Logo decision. Dream Anatomy's cloud Logo is now a static brand mark across Web and the WeChat Mini Program.

## Scope

- Web public home brand mark and hero lockup remain static.
- Web authenticated Dream Home brand mark remains static.
- Web auth brand mark remains static.
- Mini Program home cloud mark remains static.
- Mini Program profile identity seal remains static.
- Documentation records the static Logo boundary.

## Out Of Scope

- AI prompts, API contracts, database schema, migrations, Supabase, WeChat auth, cloud sync, payment, membership, and compliance copy.
- Reopening deep guidance.
- Adding JS animation loops or animation libraries.
- Remote images, remote fonts, downloaded assets, or copyrighted source material.

## Static Visual Direction

The brand mark should read as quiet archival manuscript linework without continuous animation:

- European archival psychology studio rather than mystical or fortune-telling.

## Web Behavior

Web keeps the current local SVG logo assets and inline cloud mark. The previous animated overlay path direction is not used.

## Mini Program Behavior

Mini Program uses only the static local SVG cloud mark. The previous shared cloud animation class/keyframe direction is not used.

The home mark and profile seal remain decorative (`aria-hidden="true"`), local, pointer-safe, and static.

## Compliance Boundary

This PR must not add user-facing Mini Program copy that restores high-risk terms removed for compliance. It should not add or change visible copy in the Mini Program except class attributes.

## Acceptance Criteria

- Web Logo has no animation classes, animated overlay paths, or Logo-specific keyframes.
- Mini Program home includes only the static cloud mark layer.
- Mini Program profile identity seal uses the same static cloud mark.
- Mini Program WXSS contains no cloud Logo keyframes and no JS animation loop is introduced.
- Mini Program keeps no remote image/font dependency and no high-risk compliance copy regression.
- API, prompt, database, auth, and sync files are not behaviorally changed.
- `npm test`, JavaScript syntax checks, `git diff --check`, and final reviewer pass.
