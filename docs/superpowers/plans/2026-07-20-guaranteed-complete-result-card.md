# Plan: Guarantee Complete Dream Result Card

## Global Constraints

- Do not modify database schema.
- Do not reopen deep guidance.
- Do not modify AI safety rules toward diagnosis, treatment, prediction, fortune-telling, or fixed personality claims.
- Do not use local mock, random scores, or server-filled fake scores for new successful quick analysis.
- Do not save partial quick results as success records.
- Do not log dream text, full AI responses, tokens, keys, emails, or secrets.
- Keep historical records viewable.

## Task 1: Server Contract And Tests

Write failing server tests for:

- Quick combined response with invalid card and repair success returns HTTP 200 with the original valid analysis, repaired card, `dreamResultCardStatus: "ai_generated"`, and `qualityRetryCount: 1`.
- Quick combined response with invalid card, invalid repair, and limited-evidence final success returns HTTP 200 with complete card, `limitedEvidence: true`, `evidenceConfidence`, and `qualityRetryCount: 2`.
- Three failed quick attempts return `GENERATION_INCOMPLETE` and refund daily quota.
- Successful quick responses never include `dreamResultCardStatus: "generation_failed"`.
- Standalone `result_card` can use the final limited-evidence attempt.

Implement:

- Strict quick normalization that reports card issues instead of treating them as successful output.
- Prompt builders for directed card repair and limited-evidence final card.
- Result-card extraction/normalization that accepts card-only and wrapped card responses.
- Quick three-stage orchestration with combined upstream usage and retry count.
- Quota refund for `GENERATION_INCOMPLETE`.

## Task 2: Web Frontend Contract

Write failing frontend tests for:

- `GENERATION_INCOMPLETE` keeps input and sleep quality, does not save a record, and shows the required message.
- Non-validation AI failures do not fall back to local mock success.
- Limited-evidence successful quick results render the limited-evidence notice near Dream Result Card.
- Quick success still saves analysis and card together.

Implement:

- Replace quick API failure fallback with explicit failure status.
- Preserve the current input and sleep quality state on failures.
- Pass saved generation metadata into Dream Result Card rendering.
- Render limited-evidence notice when `generationMeta.limitedEvidence === true`.

## Task 3: Mini Program Compatibility

Write or update tests for:

- Mini program quick service accepts complete cards with limited-evidence metadata.
- Mini program result page can show a limited-evidence notice without requiring new backend behavior.
- Deep guidance remains disabled.

Implement minimal compatibility changes only if tests expose a gap.

## Task 4: Regression And Review

Run:

- Targeted server/frontend/miniprogram tests.
- Full `npm test`.
- JavaScript syntax checks.
- `git diff --check`.
- Final reviewer.

Fix Critical or Important findings only, then create the PR.
