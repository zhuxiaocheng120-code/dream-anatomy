# Mini Program Compliance Copy Design

## Goal

Adjust only the WeChat Mini Program copy, display labels, lightweight AI-output presentation filtering, and Mini Program documentation so the product is positioned as a dream text record, sleep-feeling record, and AI-assisted text organization tool.

## Scope

This PR changes `miniprogram/` and Mini Program documentation only. It does not change Web UI, server APIs, DeepSeek prompts, Supabase schema, AI quality logic, cloud sync, payment, membership, or the WeChat identity bridge architecture.

## Positioning

The Mini Program user-facing positioning becomes:

> Dream Anatomy 梦境手札：梦境记录、睡眠感受记录与 AI 辅助文字整理工具。

The Mini Program may say it helps organize summaries, emotion words, image keywords, and open self-reflection questions based on user-entered text. It must not describe the product as dream interpretation, fortune telling, divination, fixed symbol meaning, fate judgment, or future prediction.

## Copy Rules

User-visible Mini Program copy replaces higher-risk terms:

- `析梦` becomes `Dream Anatomy 梦境手札`.
- `快速解析` becomes `AI 整理`.
- `保存并解析` becomes `保存并整理`.
- `梦境解析` becomes `梦境文字整理`.
- `AI 分析` becomes `AI 辅助整理`.
- `核心解析` becomes `文字线索整理`.
- `梦境画像` becomes `梦境线索卡`.
- `梦境原型` becomes `记录类型提示`.
- `象征含义` becomes `意象关键词`.

Existing stored values such as `analysisType: "快速解析"` may remain for compatibility, but display mapping must show `AI 整理` or `深度记录`.

## Presentation Filtering

Add `miniprogram/utils/complianceText.js` for Mini Program display only. It sanitizes AI-generated strings before WXML rendering by replacing high-risk terms such as `解梦`, `预示`, `意味着`, `象征着`, `潜意识告诉你`, `吉凶`, and `命运` with lower-risk phrasing. It must not mutate stored `reportContent`, the API response object, or Web output.

## Legal And Privacy Copy

Mini Program legal documents must explicitly state:

- The Mini Program does not provide dream interpretation, fortune telling, divination, good/bad luck judgment, or future prediction services.
- AI only organizes user-submitted dream text into summaries, emotion words, image keywords, and open reflection questions.
- AI output does not mean dream symbols have fixed meanings.
- AI output is not psychological diagnosis, psychotherapy, or medical advice.
- When the user actively uses AI organization, dream text is sent to the backend and AI service provider only to complete that request.

## Documentation

Add `docs/MINIPROGRAM_COMPLIANCE_COPY.md` with copy that can be used in WeChat review/filing notes. Update Mini Program setup and architecture docs so they describe the current low-risk positioning and keep the existing boundaries: local storage, guest mode, WeChat identity bridge without cloud sync, and no Mini Program direct DeepSeek call.

## Tests

Tests should cover:

- `app.json` and page titles use `Dream Anatomy 梦境手札` / low-risk labels.
- Home, quick, result, detail, journal, privacy, and profile user-visible copy no longer uses disallowed high-risk terms.
- Result and detail pages show `梦境线索卡`, `记录类型提示`, `AI 辅助整理`, and `文字线索整理`.
- `complianceText` lowers high-risk AI output terms without changing storage or API request behavior.
- Mini Program docs include the WeChat review note.
- Existing Mini Program AI request still calls `/api/v1/dream-analysis` and does not send Authorization.
- Full `npm test`, Mini Program JS syntax checks, and `git diff --check` pass.

## Non-Goals

This PR does not delete AI functionality, result pages, result-card components, `/api/v1/dream-analysis` calls, or saved historical records. It does not reopen deep guidance, change prompts, change backend behavior, add cloud sync, or perform a visual redesign.
