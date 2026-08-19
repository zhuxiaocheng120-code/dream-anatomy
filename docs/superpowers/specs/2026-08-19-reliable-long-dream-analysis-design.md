# Reliable Long Dream Analysis Design

## Purpose

Long, detailed dream records currently share the same request path as short records. The server appends the complete raw dream to the full quick-analysis and Dream Result Card contract, so input size rises from about 1,708 estimated tokens at 200 Chinese characters to about 6,113 estimated tokens at 5,000 characters. If validation requests a repair, the same long source is sent again. This increases first-token latency and makes long requests more likely to reach the existing stage timeout.

This change keeps the complete-success contract while reducing the context used by final analysis. It does not increase the existing total timeout, lower validation requirements, or introduce mock analysis.

## Input Classification

The server calculates both normalized character count and a conservative token estimate:

- CJK characters count approximately as one token each.
- Non-CJK runs count approximately as one token per four non-whitespace characters.
- `direct`: fewer than 800 characters **and** fewer than 650 estimated tokens.
- `long`: at least 800 characters or at least 650 estimated tokens, but below the very-long threshold.
- `very_long`: at least 2,200 characters or at least 2,000 estimated tokens.
- The existing hard ceiling remains 5,000 characters, inclusive.

The thresholds are based on measured current prompt sizes: 200 / 800 / 1,500 / 3,000 / 5,000-character inputs produce approximately 1,708 / 2,258 / 2,900 / 4,277 / 6,113 total prompt tokens before output.

## Preprocessing Architecture

Create `server/dreamPreprocessing.js` as a server-only module. It owns input metrics, classification, sentence-aware chunking, preprocessing prompts, strict normalization, evidence verification, deterministic fallback extraction, and canonical merge behavior.

Short and normal dreams keep the current direct path unchanged.

Long dreams use one lightweight DeepSeek preprocessing request. Very long dreams are split near paragraph or sentence boundaries into chunks capped at about 1,500 characters and 1,400 estimated tokens. At most three chunk preprocessing requests run concurrently. Chunk order is retained.

The preprocessing model performs extraction only. It returns:

```json
{
  "people": [],
  "locations": [],
  "events": [{ "order": 1, "description": "", "evidence": "" }],
  "transitions": [{ "order": 1, "description": "", "evidence": "" }],
  "emotions": [{ "name": "", "evidence": "" }],
  "notableObjects": [{ "name": "", "evidence": "" }],
  "recurringElements": [{ "name": "", "evidence": "" }],
  "ambiguities": [],
  "evidenceFragments": []
}
```

It must not interpret symbols, diagnose, predict, score, infer real-life causes, or add facts. Every evidence field and evidence fragment must be an exact substring of the source chunk after whitespace normalization. Invalid evidence is discarded.

Local code merges chunk results, preserves event and transition order, removes normalized duplicates, and enforces bounded collection and text lengths. Exact source fragments and ordered source sentences form a deterministic extraction fallback when a chunk response is invalid or incomplete. This fallback contains no analysis and is not shown as an AI result.

## Final Generation

For preprocessed requests, the final quick-analysis prompt contains:

- the canonical structured representation;
- a bounded set of exact original evidence fragments;
- the existing analysis and complete Dream Result Card contract;
- an explicit instruction that the structure is an extraction of the user record, not an interpretation;
- the same safety and non-diagnostic requirements.

The complete long raw dream is not appended again. Validation still receives the original dream text so existing anchor, safety, four-dimension, rationale, and completeness checks remain authoritative. Repairs reuse the compact structured context rather than the raw long dream.

## Failure Behavior

- A preprocessing upstream timeout or service error may use the deterministic extraction for that chunk and continue to final AI generation.
- A final AI timeout, upstream error, or incomplete generation retains the existing stable API error and quota-refund behavior.
- No partial text result is returned when the Dream Result Card is missing or invalid.
- No mock, local interpretation, fabricated score, or template result is returned.
- The original browser input remains untouched by this server-side pipeline.

## Telemetry and Privacy

Safe request diagnostics add only:

- `inputCharacterCount`
- `estimatedInputTokens`
- `inputMode`
- `preprocessingDurationMs`
- `preprocessingChunkCount`
- `preprocessingFallbackCount`
- `finalGenerationDurationMs`
- `totalGenerationDurationMs`
- existing safe final error code

No dream text, extracted content, model response, token, email, user identifier, or secret is logged. Upstream token usage continues to aggregate all preprocessing and final calls for cost accounting.

## Testing and Acceptance

Automated tests cover:

- direct, long, and very-long classification using both metrics;
- coherent sentence-boundary chunking and stable order;
- exact-evidence enforcement and hallucinated-fragment removal;
- deterministic non-interpretive fallback;
- merge deduplication and bounded output;
- direct requests making one final upstream call;
- long requests preprocessing before final generation;
- very-long requests processing multiple chunks;
- compact final and repair prompts not containing the complete long raw dream;
- full result validation and no partial success;
- safe telemetry without private content;
- 5,000 characters accepted and 5,001 rejected.

Production-like verification uses synthetic, non-private Chinese dreams at 200, 800, 1,500, 3,000, and 5,000 characters. Each must return a complete analysis and Dream Result Card. Real DeepSeek verification records status, duration, mode, chunk count, retry count, and structure completeness only.

Latency goals remain targets rather than relaxed correctness rules:

- normal inputs usually under 20 seconds;
- long inputs usually under 30 seconds;
- very long inputs preferably under 40 seconds.

The existing `AI_TOTAL_REQUEST_TIMEOUT_MS` default remains unchanged.

## Scope Boundaries

This change does not modify frontend UI, authentication, legal consent, rate limits, account binding, cloud sync, database schema, Deep Guidance, Mini Program compliance copy, saved record format, or the complete Dream Result Card success contract.
