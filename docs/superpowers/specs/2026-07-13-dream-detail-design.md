# Dream Detail Design Spec

## Goal

Build the Dream Detail view for existing dream records. When a user clicks any record in Dream Journal, the page should show a calm, mobile-first detail page with complete dream content and folded AI analysis sections.

## Scope

This work enhances the existing `data-dream-detail` view inside `src/index.html` and the existing `openDreamDetail()` / `renderDreamDetail()` flow in `src/app.js`.

This work does not:

- add or modify database schema
- change DeepSeek API calls or prompts
- change Dream Home
- change Dream Journal search, filter, grouping, or list rendering
- add edit, delete, favorite, timeline, or cloud sync behavior

## User Experience

The user enters Dream Detail by clicking a record in Dream Journal. The Dream Journal list is hidden and the detail view is shown. The existing "返回梦境日记" action returns to the list.

The detail page shows:

1. 梦境标题
2. 日期 and 时间
3. 梦境原文, fully displayed
4. 梦境摘要
5. 情绪标签
6. 梦境意象
7. AI 分析 with three collapsed cards:
   - 荣格
   - 弗洛伊德
   - 现代心理学
8. 自我思考 placeholder

All user-visible text is Simplified Chinese except the product/brand names already present in the app. The page keeps the existing Dream Anatomy tone: quiet, gentle, spacious, and not a dashboard.

## Data Mapping

Dream Detail continues to read existing local-shaped dream records:

- `createdAt` / `created_at`
- `rawDreamText` / `raw_dream_text`
- `dreamSummary` / `dream_summary`
- `emotions`
- `symbols`
- `sleepQuality` / `sleep_quality`
- `analysisType` / `analysis_type`
- `reportContent` / `report_content`

Dream title:

1. Use `title` if present.
2. Else use `dreamSummary`.
3. Else use the beginning of `rawDreamText`.
4. Else show `未命名的梦`.

AI analysis:

- The detail page derives folded analysis text from existing `reportContent`.
- For quick records, use `jungian`, `question`, and `reminder` as available.
- For deep records, use `jungianView`, `lifeConnection`, `reflectionQuestions`, `smallAction`, and `gentleReminder` as available.
- The Freud and Modern Psychology cards are non-diagnostic, non-therapeutic framing text derived from existing record fields. They must use gentle, non-absolute language.
- Missing values show `未记录`.

## Safety

Dream Detail must not introduce:

- 算命
- 心理诊断
- 心理治疗
- 吉凶预测
- 未来预测
- absolute dream interpretation

The three AI analysis cards are interpretive views, not new AI output. They are local presentation text only.

## Implementation Shape

Keep the implementation minimal:

- Continue using `src/app.js` for the current detail rendering flow.
- Add small helper functions in `src/app.js` only where they simplify the current detail rendering.
- Keep rendering with `textContent`, `createElement`, and safe DOM APIs.
- Use native `<details>` / `<summary>` for folded AI analysis cards.
- Update `src/style.css` only for Dream Detail layout and folded-card styling.
- Update tests in `tests/dreamJournal.test.js` to verify the existing app bridge opens the improved detail view.

## Testing

Automated tests should verify:

- Clicking/opening a record hides the journal list and shows the detail view.
- Detail view includes title, date, time, raw dream text, AI summary, emotions, symbols, and sleep quality.
- AI analysis includes three folded cards: 荣格, 弗洛伊德, 现代心理学.
- The folded cards are collapsed by default.
- 自我思考 placeholder appears.
- User-visible Dream Detail text is Simplified Chinese.
- Existing Dream Journal list behavior still works.
