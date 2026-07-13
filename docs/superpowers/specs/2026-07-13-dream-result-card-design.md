# Dream Result Card Design

## Goal

Add a Dream Result Card, shown to users as **梦境画像**, inside the existing Dream Detail page. It is a structured, collectible summary of one dream, not a replacement for the existing raw dream text, summary, emotion tags, symbols, three analysis perspectives, or gentle reminder.

The feature keeps Dream Anatomy's positioning: AI accompanies self-understanding and does not make conclusions for the user.

## Scope

In scope:

- Show a new **梦境画像** area inside Dream Detail.
- Generate the card on demand for records that do not already have one.
- Store generated card data in the existing `reportContent.dreamResultCard` / `report_content.dreamResultCard` JSON object.
- Use the existing DeepSeek backend proxy and environment-variable API key handling.
- Keep all user-visible copy in Simplified Chinese, except approved brand terms and archetype English subtitles.
- Preserve old Quick and Deep records.
- Keep existing Dream Home, Dream Journal, Dream Detail, Auth, and sync behavior working.

Out of scope:

- New Supabase schema fields or tables.
- New API provider, OpenAI dual-model routing, or API-key exposure to the browser.
- WeChat sharing, image download, social publishing, favorites, trash, editing, Timeline, Calendar, Dream Growth, long-term cross-dream analysis, payment, membership, or mini-program work.

## User Experience

Dream Detail renders the existing sections first enough to remain familiar, then adds an independent **梦境画像** area. If a record already has structured card data, it renders immediately. If a record has no card data, the area shows:

- `尚未生成梦境画像`
- a short explanation that generation is optional
- a `生成梦境画像` button

Clicking the button calls the backend for this single dream only. It does not automatically generate cards for older records. While loading, the button is disabled and the status says `正在整理梦境画像……`. On success, the card renders and the updated record is saved through the existing local/cloud record save path. On failure, the page keeps working and shows `暂时无法生成梦境画像，请稍后再试。`

## Dream Result Card Structure

The visible card contains these sections in order:

1. **梦境原型**
   - Shows `本次梦境更接近：`
   - Shows a Chinese archetype title as the main title.
   - Shows a small English subtitle, such as `The Seeker`.
   - Explains the archetype in non-absolute language.
   - Never says `你就是...`.

2. **一句话核心洞察**
   - A short quote-like sentence, about 40 Chinese characters or fewer.
   - It must relate to this dream's text, summary, symbols, or emotions.
   - It avoids diagnosis, prediction, and fixed conclusions.

3. **梦境维度**
   - Four dimensions only:
     - `象征深度`
     - `情绪强度`
     - `自我觉察`
     - `成长信号`
   - Each dimension shows:
     - name
     - score clamped to `0-100`
     - soft progress bar
     - one-sentence summary
     - collapsed `为什么` details with rationale bullets
   - Include the visible note: `这些分数用于帮助整理梦境线索，不是心理测量结果。`

4. **主要意象**
   - Shows at most three symbol cards.
   - Each card shows:
     - symbol name
     - possible meaning in this dream
     - why it was identified
     - one reflection question
   - Copy uses words such as `可能`, `有时`, and `在这次梦里`.

5. **情绪画像**
   - Shows primary emotion.
   - Shows secondary emotions.
   - Shows intensity as a clamped `0-100` score.
   - Shows evidence from the dream.
   - Includes the visible note: `这反映的是梦境中的情绪线索，不代表现实中的固定心理状态。`

6. **自我思考**
   - Shows two or three open-ended questions.
   - Questions must be gentle and tied to the dream's content.

7. **分享卡片预览**
   - Shows a screenshot-friendly card containing:
     - `Dream Anatomy`
     - `梦境画像`
     - archetype name
     - core insight
     - up to three symbols
     - four simplified dimension rows
     - disclaimer: `这是一次自我探索视角，不是诊断或预测。`
   - Must not show user email.
   - Must not show full raw dream text.
   - Must not auto-share or generate an image.

## Archetype Definitions

Create `src/dreamArchetypes.js`.

It owns stable archetype definitions. First version includes eight:

- `seeker`: `寻路者`, `The Seeker`
- `explorer`: `探索者`, `The Explorer`
- `guardian`: `守护者`, `The Guardian`
- `observer`: `观察者`, `The Observer`
- `transformer`: `转变者`, `The Transformer`
- `creator`: `创造者`, `The Creator`
- `healer`: `疗愈者`, `The Healer`
- `homecomer`: `归途者`, `The Homecomer`

The module exports helpers for normalizing an archetype id and providing a safe fallback. The frontend and backend may both use these definitions through CommonJS/browser-compatible UMD style, matching the existing project modules.

## Data Shape

The normalized card shape is:

```json
{
  "archetype": {
    "id": "seeker",
    "nameZh": "寻路者",
    "nameEn": "The Seeker",
    "summary": "本次梦境更接近寻路者原型，也许与你正在寻找新的方向有关。"
  },
  "coreInsight": "这个梦也许在提醒你靠近尚未说清的方向。",
  "dimensions": [
    {
      "id": "symbol_depth",
      "name": "象征深度",
      "score": 72,
      "summary": "这个梦中出现了多个可能具有个人意义的意象。",
      "rationale": ["门和走廊提供了方向与边界线索。", "这不代表固定含义。"]
    }
  ],
  "symbols": [
    {
      "name": "门",
      "generalPossibility": "门有时会与选择、边界或变化有关。",
      "contextMeaning": "在这次梦里，它可能与你正在靠近的某个决定有关。",
      "evidence": "梦里你停在发光的门前。",
      "reflectionQuestion": "如果门可以打开，你希望门后是什么？"
    }
  ],
  "emotionalProfile": {
    "primary": "迟疑",
    "secondary": ["好奇"],
    "intensity": 64,
    "evidence": "你停在门前很久，像是在靠近但还没有进入。"
  },
  "reflectionQuestions": ["这个梦里哪个画面最想被你记住？"],
  "safetyReminder": "这不是诊断、治疗或预言，只是一种自我探索视角。"
}
```

The frontend normalizer must:

- tolerate missing fields
- clamp scores to `0-100`
- limit symbols to three
- limit reflection questions to three
- remove unsupported dimension ids
- fill missing text with safe, non-diagnostic fallback copy
- treat AI text as plain text

## Backend API

Extend `POST /api/dream-analysis` to accept:

```json
{
  "dreamText": "用户输入的梦境",
  "analysisType": "result_card"
}
```

Keep current `analysisType: "quick"` behavior unchanged.

For `result_card`:

- Validate `dreamText` as a non-empty string with max length `5000`.
- Call DeepSeek through the same backend proxy and environment variables.
- Ask the model for strict JSON only.
- Do not ask for diagnosis, treatment, fortune telling, future prediction, fixed symbol meanings, or personality-test conclusions.
- Parse and validate JSON.
- Return `{ "analysis": normalizedCard }`.
- If DeepSeek is unavailable or returns invalid JSON, return safe `502` without stack traces, key leaks, full upstream response, full user dream text, or full AI response logs.

## Frontend Integration

Create `src/dreamResultCard.js`.

Responsibilities:

- Normalize raw card data.
- Render the **梦境画像** section.
- Render missing-card fallback and generation button.
- Render dimensions with progress bars and collapsed rationale.
- Render up to three symbol cards.
- Render emotional profile.
- Render reflection questions.
- Render screenshot-friendly share preview.
- Expose a controller function that `src/app.js` can use from Dream Detail.

`src/app.js` remains the owner of record lookup, current detail rendering, and saving updated records. It passes the current record and callback functions into the Dream Result Card controller.

## Saving

Generated data is saved by updating the current record's `reportContent.dreamResultCard` value.

For local-only records:

- Update localStorage using the existing storage key.
- Re-render the journal from updated visible records.

For authenticated records:

- Reuse `dreamSyncController.saveRecord(updatedRecord)`.
- Let existing Supabase RLS and `user_id` handling enforce account ownership.
- Do not let the frontend specify another user's `user_id`.

If saving fails after generation, the card may remain visible in the current page but status must explain that it was not saved.

## Safety and Security

- No user-visible copy may say `Dashboard`, `Personality Test`, `Diagnosis`, `命运`, `预言`, `你就是`, or `这说明你一定`.
- Avoid `算命`, `吉凶`, and future-prediction phrasing in prompts and UI.
- Use `可能`, `也许`, `可以理解为`, `本次梦境更接近`, and `你可以思考`.
- All AI and user content must be inserted with `textContent` or equivalent DOM text APIs.
- Do not use `innerHTML` for card content.
- Do not expose API keys to frontend code.
- Do not log full dreams, tokens, sessions, API keys, or full AI responses.

## Testing

Add or update tests to cover:

- archetype definitions and fallback normalization
- result-card normalization, clamped scores, max three symbols, fallback copy
- renderer creates expected Simplified Chinese sections and does not use `innerHTML`
- missing old-record fallback and button copy
- share preview excludes email and full raw dream text
- server accepts `analysisType: "result_card"` and normalizes DeepSeek output
- server rejects invalid JSON safely
- existing quick API tests remain passing
- Dream Detail integration renders card or fallback without breaking existing detail content

## Acceptance Mapping

- A6: Dream Detail still opens from Dream Journal and shows original dream plus analysis content.
- A7: The card repeats the non-diagnostic, non-predictive safety boundary and uses non-absolute phrasing.
- A8: The visual treatment stays quiet, warm, mobile-first, and avoids dashboard or gamified progress language.
