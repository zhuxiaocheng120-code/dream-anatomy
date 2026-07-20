# Guarantee Complete Dream Result Card Design

## Problem

Current quick analysis can return HTTP 200 with valid text analysis and `dreamResultCardStatus: "generation_failed"`. That creates a half-success result, saves reports without a usable Dream Result Card, and forces users to retry from Dream Detail.

## Product Contract

For new `POST /api/v1/dream-analysis` requests with `analysisType: "quick"`, success means:

- `analysis` is complete and quality-checked.
- `dreamResultCard` is complete and quality-checked.
- `dreamResultCardStatus` is exactly `ai_generated`.
- `generationMeta.source` is `ai_generated`.
- `generationMeta.qualityStatus` is `passed`.
- `generationMeta.limitedEvidence` is a boolean.
- `generationMeta.evidenceConfidence` is `low`, `medium`, or `high`.

The API must not return HTTP 200 with `dreamResultCardStatus: "generation_failed"` for new quick analyses.

If a complete result cannot be produced after the allowed generation path, the API returns `GENERATION_INCOMPLETE` and the frontend does not save a partial report.

## Limited-Evidence Mode

Sparse dream text is not a failure. The backend may return a complete card with:

- `generationMeta.limitedEvidence: true`
- `generationMeta.evidenceConfidence: "low"` or `"medium"`

The card must still contain a valid archetype, four numeric scores, rationales tied to the dream text, symbols, emotional profile, reflection questions, and safety reminder. No score may be fabricated by local code or filled with `0` when missing.

When `limitedEvidence` is true, the frontend shows:

- `基于有限线索的暂定画像`
- `这张画像依据的是本次记录中呈现的线索。它不是对你的固定判断，补充更多梦境细节后，画像可能会有所变化。`

## Quick Generation Flow

1. Combined generation: request `analysis` and `dreamResultCard` together.
2. Directed card repair: if analysis is valid but the card is incomplete, keep the validated analysis internally and request only a repaired card using the dream text, the validated analysis, and concrete missing issues.
3. Limited-evidence final attempt: if repair is still incomplete, request a minimum complete card in limited-evidence mode.

The quick flow performs at most three upstream DeepSeek calls. If all fail quality checks, it returns `GENERATION_INCOMPLETE`.

## Standalone Result Card Flow

`analysisType: "result_card"` remains for historical repair. It may retry once with directed issues and once more in limited-evidence mode. Failure must not overwrite existing text analysis or user reflection.

## Quota And Analytics

One quick analysis counts as one user request even if internal repair calls occur. Upstream token usage is combined across attempts. `qualityRetryCount` is `0`, `1`, or `2`.

If the request ends in `GENERATION_INCOMPLETE`, the daily quota reservation is refunded because no successful result was delivered. Timeout and upstream-unavailable refund behavior remains unchanged.

Analytics must not store dream text or full AI responses. Existing analytics fields record retry count, outcome, error code, prompt version, model, and token/cost totals. Limited-evidence metadata remains in the saved report JSON unless a future analytics schema explicitly adds dedicated fields.

## Frontend Behavior

Quick success:

- Shows text analysis and full Dream Result Card immediately.
- Saves a full dream record.
- Does not show a card retry button.
- Does not show `画像暂时未能完整生成`.

Quick failure:

- Does not show half text analysis.
- Does not save a success record.
- Keeps the dream input and selected sleep quality.
- Shows: `这次解析没有完整生成，已保留你的梦境内容。请稍后重新提交。`

The local mock function may remain for legacy tests or historical compatibility, but new quick API failures must not be presented as successful analyses.

## Compatibility

Existing historical records with `generation_failed`, `mock_legacy`, or partial saved cards remain viewable through existing compatibility rendering. New successful quick analyses cannot create those states.

The WeChat mini program uses the same backend contract. Old clients that ignore `generationMeta` still receive a complete card on success.
