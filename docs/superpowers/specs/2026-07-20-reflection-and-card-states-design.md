# Reflection And Result Card States Design

## Goal

Improve Web Dream Result Card missing-score states and turn the Dream Detail “自我思考” placeholder into a real saved note field, without changing AI prompts, database schema, Mini Program code, or core sync architecture.

## Root-Cause Investigation

Current quick V2 generation already validates complete Dream Result Card quality on the server. `normalizeQuickCombinedOutput()` requires the four dimension ids, non-null scores, rationale, and current-dream evidence before accepting a card. If the text analysis succeeds but the card fails, the API returns the analysis with `dreamResultCardStatus: "generation_failed"` and no card; it does not save a partial card as a normal quick result.

The observed “象征深度 has a score, other dimensions show unavailable” state is explainable from historical or manually regenerated records. The browser `DreamResultCard.normalizeDreamResultCard()` intentionally fills the four stable dimensions for compatibility. When old saved content has only one dimension, the missing dimensions normalize to `score: null`, and the renderer currently labels them “暂不可用” while still drawing a 0%-width progress bar. `DreamSync` maps `report_content` as a whole JSON object and does not drop dimensions.

There is one current data-flow gap: the standalone `result_card` API path normalizes model output but does not run the same `validateResultCardQuality()` gate used by quick V2. Manual regeneration for an old record can therefore accept and save a partially shaped card. This PR will add server-side quality rejection for standalone result-card generation so new partial cards are not silently saved.

## Result Card State Rules

`complete` means the saved card has all four dimensions with real `score` values, rationale, and the core card structure. It renders all scores and soft progress bars. A true `score === 0` remains a valid score.

`partial_historical` is a display-only compatibility state for older saved cards that contain some useful card fields but lack reliable scores or rationale. It renders trustworthy fields, replaces missing scores with “线索不足，暂不评分”, hides the numeric progress bar for missing scores, and may show “这是一条较早生成的梦境画像。”

`generation_failed` means no reliable card should be shown. It displays the existing missing-card/retry UI and must not fabricate partial scores.

## Missing Score Copy

For missing dimension scores, use “线索不足，暂不评分”. In share preview, use the shorter “暂不评分”. For missing emotional intensity, use the same principle. Details labels change from “为什么” to “观察依据” when no score exists.

Dimension-specific missing rationale:

- `symbol_depth`: “这次记录中的象征线索较少，可以先从最想记住的画面开始观察。”
- `emotion_intensity`: “这次记录中没有足够明确的情绪强度线索，可以先留意醒来后的身体感受和情绪余韵。”
- `self_awareness`: “这次梦境更偏向事件和画面，暂时没有足够的自我观察线索。”
- `growth_signal`: “这次梦境中没有呈现足够明确的变化、选择或整合线索。”

## User Reflection Data

Dream Detail stores user notes inside the existing JSON field:

```json
{
  "reportContent": {
    "userReflection": "用户写下的自我思考",
    "userReflectionUpdatedAt": "ISO-8601 timestamp"
  }
}
```

No new database table or migration is needed. The existing `dream_records.report_content` JSONB field and localStorage record shape already preserve report content. This field is not sent to AI requests, product analytics, AI usage analytics, logs, URLs, or Mini Program code.

## Dream Detail UI

Dream Detail shows:

- title: “自我思考”
- helper text: “写下你对这个梦的联想、理解，或醒来后仍留下的感受。它只属于你的梦境记录。”
- textarea placeholder: “例如：这个场景让我想到……”
- save button: “保存自我思考”
- clear button: “清空”
- status text: “保存中……” / “已保存” / “保存失败，请稍后再试。”

Maximum length is 3000 characters after trimming only for validation; the textarea preserves user-entered line breaks. Empty save clears the field instead of pretending a blank reflection was saved. “清空” is an explicit local input-clearing action and the user must click “保存自我思考” before the stored note is removed.

## Save Semantics

Reflection saves reuse `saveDreamRecord()` through a per-record Dream Detail save queue and therefore the existing DreamSync local/cloud path. Each queued save reloads the latest visible record before merging into `reportContent`, which keeps dreamResultCard, analysis, localRecordId, cloudId, syncStatus, and metadata even when manual Dream Result Card generation and reflection saving overlap. While a save is running, the save button is disabled. If the user switches to another record or account before an old save finishes, that stale result must not overwrite the current detail view.

For authenticated users, save attempts go through DreamSync. If Supabase save fails, DreamSync stores a pending local record and the UI explains that the note is saved locally and pending cloud sync. Guests save to localStorage only.

## Scope Boundaries

This PR does not modify AI prompts, reopen deep guidance, change schema, add Mini Program behavior, add analytics events, add payment/membership, or introduce a router/framework. It does not fabricate missing scores or send user reflection to AI.
