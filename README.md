# 析梦 Dream Anatomy

**析梦 Dream Anatomy** 是一个中文梦境自我探索工具。它帮助用户记录梦境，并用温和的荣格心理学视角整理梦中的象征、情绪和内在主题。

这个项目目前是一个简单的 MVP 雏形，使用 plain HTML、CSS、JavaScript 和一个最小 Node.js 后端代理编写。后端用于让浏览器通过同源接口安全请求梦境解析服务，而不是把 API key 放到前端。

## What the App Does

页面的 PRD 风格定位是：**你的梦境自我探索工具**。

它包含：

- 中文首页，介绍梦境记录和自我探索的核心想法。
- 三个明确入口：快速解析、深度引导、梦境日记。
- 点击入口后可以进入快速解析、Dream Journal 和 Dream Detail 等现有流程。
- 深度引导入口目前保留展示，但通过 `src/featureFlags.js` 暂时标记为“正在开发中”，不能开始新的深度引导。
- 快速解析区域可以输入梦境碎片，优先通过本项目后端代理请求 DeepSeek API；快速解析的一次最终请求会同时返回 V2 结构化分析正文和完整 `reportContent.dreamResultCard` 梦境画像。
- 快速解析 V2 会要求结果包含梦境摘要、核心主题、核心解析、梦境证据与解释、情绪画像、主要意象、自我思考、今日小行动和温和提醒，并在服务端做基础质量检查。
- 快速解析完成后会在当前结果页直接展示梦境画像，并把分析正文和梦境画像一起保存到梦境日记；连接不可用时会回退到明确标记的本地示例结果，AI 输出质量不完整时不会伪装成本地 mock。
- 深度引导源码、后端接口和既有测试仍保留；历史深度引导记录仍可以从 Dream Journal / Dream Detail 查看。
- 梦境日记区域会在同一个列表中显示快速解析和深度引导记录，并可以点击查看单条记录详情。
- 梦境详情会展示梦境标题、日期、时间、完整原文、AI 摘要、情绪标签、梦境意象、睡眠质量和分析类型。
- 梦境详情里的 AI 分析采用可折叠卡片，包含荣格、弗洛伊德和现代心理学三个温和视角，并预留“自我思考”区域供后续扩展。
- 项目包含 Supabase 基础设施准备：JavaScript SDK 依赖、环境变量示例，以及 `dream_records` 表迁移和 RLS 策略。
- 右上角提供 Supabase Auth 账户入口，支持邮箱注册、邮箱验证后登录、退出登录、忘记密码和重置密码。
- 登录后会自动把当前浏览器里的本地梦境迁移到 Supabase，并以云端梦境日记为主；未登录或云端暂时不可用时，仍保留 localStorage 本地保存和待同步兜底。
- 已认证用户会自动进入 **Dream Home**；退出登录后会立即回到原有公开首页。
- Dream Home 只读取当前登录用户的 Supabase `dream_records`，用这些记录计算梦境总数、连续记录夜晚、AI 整理次数，并显示最近五条梦境。它不会读取其他账户的记录。
- Dream Home 的“查看梦境档案”会进入 **Dream Journal**，这是梦境档案的主要页面。
- Dream Journal 会展示当前用户可见的全部梦境记录，按 Today、Yesterday、Earlier This Week、Earlier This Month、Older 自动分组，并按时间倒序排列。
- Dream Journal 支持实时搜索标题、原文、梦境摘要、情绪和意象，也支持 `全部`、`Quick`、`Deep`、`Pending Sync` 过滤。
- Dream Journal 里的记录会继续进入现有 Dream Detail 页面，不会重新实现另一套详情页，也不会自动重复调用 AI。
- 每日引语来自已核验的公版中文经典文本，并按浏览器本地日期稳定选择；同一日期刷新页面会显示同一句引语。
- Dream Home 的“重要梦境”当前固定显示为 `0`，因为现有记录和数据库 schema 没有收藏或重要标记字段。
- “AI 洞察”和“标签 / 分类”目前只是标有 `Coming Soon` 的非交互视觉区域，不包含模拟数据或可用功能。

这个应用不是诊断工具、治疗服务、算命工具，也不会预测未来。它只用于梦境记录和温和的自我探索。快速解析请求会通过本项目后端代理发送给配置的 DeepSeek API，连接失败时会显示本地示例结果。

## Project Structure

```text
.
├── AGENTS.md
├── .env.example
├── README.md
├── assets/
├── docs/
│   ├── ACCEPTANCE.md
│   ├── IMPROVEMENT_IDEAS.md
│   ├── MVP_SPEC.md
│   ├── PRD_ALIGNMENT.md
│   ├── PROJECT_STATUS.md
│   └── superpowers/
├── lib/
├── package.json
├── scripts/
│   └── writeRuntimeEnv.js
├── server.js
├── src/
│   ├── app.js
│   ├── auth.js
│   ├── dreamHome.js
│   ├── dreamJournal.js
│   ├── dreamQuotes.js
│   ├── dreamSync.js
│   ├── featureFlags.js
│   ├── index.html
│   ├── runtime-env.js
│   ├── style.css
│   └── vendor/
│       └── supabase.js
├── supabase/
│   └── migrations/
└── tests/
```
- src/index.html: page content and structure.
- src/style.css: colors, layout, spacing, and responsive styles.
- src/app.js: interactions for the dream analysis, local journal, and view switching flows.
- src/auth.js: Supabase Auth interactions for account registration, login, logout, password reset, and persistent session display.
- src/dreamHome.js: authenticated Dream Home session handling, current-user cloud-record loading, statistics, recent dreams, and reuse of existing navigation/detail flows.
- src/dreamJournal.js: Dream Journal archive grouping, realtime search, filters, empty state, record rendering, and existing detail navigation.
- src/dreamQuotes.js: verified public-domain daily quote records and browser-local, date-stable quote selection.
- src/dreamSync.js: localStorage to Supabase dream record sync, cloud loading, pending retry, and record mapping.
- src/featureFlags.js: small browser feature flag module; `DEEP_GUIDANCE_ENABLED` currently keeps new deep guidance creation disabled.
- src/runtime-env.js: browser runtime configuration generated for local or deployed Supabase public settings.
- src/vendor/supabase.js: browser Supabase SDK asset used by the account UI.
- server.js: Express server that serves src and proxies quick, guided-question, guided-final, and legacy manual result-card dream analysis requests.
- scripts/writeRuntimeEnv.js: writes `src/runtime-env.js` from environment variables before startup.
- lib/supabaseClient.js: helper for creating a Supabase client from environment variables.
- supabase/migrations/: database migrations for cloud dream record storage and sync fields.
- .env.example: example environment variables for local backend configuration.
- AGENTS.md: contributor guidelines for this repository.

## How to Open the App

- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` locally. The server loads this file automatically.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` locally to enable the account UI. These are browser-safe Supabase project values, not service role secrets.
- Start the app with `npm start`.
- Open `http://localhost:3000` in your browser.
- Without `DEEPSEEK_API_KEY`, the page can still open; analysis API requests will fail safely and the frontend will show clearly marked local fallback results.
- Without Supabase values, the page can still open; account actions will show a configuration prompt.
- Run unit tests with `npm test`.

## Editing the App

- To change page structure or copy, edit `src/index.html`.
- To change colors or layout, edit `src/style.css`.
- To change dream-analysis interactions, edit `src/app.js`.
- To change Dream Journal grouping, search, filter, or archive rendering, edit `src/dreamJournal.js`.

## Contributing

Before making larger changes, read [AGENTS.md](AGENTS.md). Keep updates small, clear, and easy for a beginner to understand.

## Dream Home Boundaries

Dream Home is a read-only authenticated home experience. It does not change the existing DeepSeek integration or prompts, Supabase Auth rules, `dreamSync.js` synchronization behavior, or the Supabase schema.

The following are intentionally not implemented inside Dream Home itself yet: favorites, a dream timeline, trash or deletion, title/content editing, and analytics. The fixed-zero “重要梦境” value is a visible reminder of that current schema boundary, rather than a hidden or invented data field.

## Dream Journal Boundaries

Dream Journal is the primary dream archive page. It reads the records already visible to the current session through the existing local/cloud sync flow, then groups, searches, filters, and opens them through the existing Dream Detail view.

This PR does not add Timeline, Calendar, Favorite, Trash, Edit, Delete, Growth, Atlas, payment, membership, new schema fields, or a new detail system. Search is local and realtime; `Pending Sync` only reflects the existing local pending-sync status.

## Dream Detail Boundaries

Dream Detail is a read-only view of an existing dream record's original content. It does not edit dream text, change titles, or add database fields.

The folded AI analysis sections and saved Dream Result Card are presentation views derived from the existing saved record content. Dream Journal and Dream Detail read saved data and do not automatically repeat AI calls. They are not diagnosis, treatment, fortune telling, or future prediction.

## Dream Result Card Boundaries

Quick decode uses 一次最终请求 to generate V2 structured analysis text and `reportContent.dreamResultCard` **梦境画像** from the same context. The server checks that the quick result includes concrete dream evidence, complete dimensions, rationale, safe language, and `quick-analysis-v2` generation metadata before accepting it. The current result page displays the Dream Result Card immediately after analysis, and saving writes it into the existing record content; this feature 不新增 schema 或数据库字段。Guided final analysis keeps its source code and server path, but starting new deep guidance is currently disabled by feature flag.

Dream Detail may still show a manual generation option for old records that do not have a saved card, but Dream Journal and Dream Detail do not automatically regenerate cards or overwrite saved results. The result card includes a share card preview for the current page only; 图片下载和分享功能未实现。
