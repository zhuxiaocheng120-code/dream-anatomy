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
- AI 后端提供版本化接口 `POST /api/v1/dream-analysis`，旧的 `POST /api/dream-analysis` 暂时保留为兼容别名。接口会识别 Supabase Bearer token、应用 Beta 免费额度、短时限流、单用户并发限制和 DeepSeek 超时保护。
- 服务器会把 AI 使用统计以隐私保护形式写入 Supabase `ai_usage_events`，用于运营分析和服务改进；管理员可在只读运营后台查看聚合数据。
- 隐私与数据中心提供隐私政策、用户协议、AI 使用说明、显式同意、梦境导出、单条删除、清空全部梦境、游客本机数据清理和账户注销入口。
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
├── server/
├── src/
│   ├── adminAnalytics.js
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
- src/adminAnalytics.js: read-only admin analytics controller, permission probing, aggregate rendering, and session cleanup.
- src/legalDocuments.js: legal document copy, versions, and support-contact rendering helpers.
- src/privacyData.js: privacy/data center controller for legal document viewing, consent, export, deletion, guest cleanup, and account deletion interaction.
- src/auth.js: Supabase Auth interactions for account registration, login, logout, password reset, and persistent session display.
- src/dreamHome.js: authenticated Dream Home session handling, current-user cloud-record loading, statistics, recent dreams, and reuse of existing navigation/detail flows.
- src/dreamJournal.js: Dream Journal archive grouping, realtime search, filters, empty state, record rendering, and existing detail navigation.
- src/dreamQuotes.js: verified public-domain daily quote records and browser-local, date-stable quote selection.
- src/dreamSync.js: localStorage to Supabase dream record sync, cloud loading, pending retry, and record mapping.
- src/featureFlags.js: small browser feature flag module; `DEEP_GUIDANCE_ENABLED` currently keeps new deep guidance creation disabled.
- src/runtime-env.js: browser runtime configuration generated for local or deployed Supabase public settings.
- src/vendor/supabase.js: browser Supabase SDK asset used by the account UI.
- server.js: Express server that serves src and exposes the protected shared AI analysis API for current Web Beta and future clients.
- server/: server-only AI API helpers for Supabase token identity, stable API errors, Beta quota, short-window rate limiting, concurrent request locking, analytics writing, service-role admin access, and in-memory limiter housekeeping.
- server/accountDeletion.js: server-only account deletion flow using the verified Supabase token identity and service role cleanup.
- scripts/writeRuntimeEnv.js: writes `src/runtime-env.js` from environment variables before startup.
- lib/supabaseClient.js: helper for creating a Supabase client from environment variables.
- supabase/migrations/: database migrations for cloud dream record storage and sync fields.
- docs/SUPABASE_SECURITY_AUDIT.md: Supabase RLS, account isolation, key exposure, and manual production verification matrix.
- .env.example: example environment variables for local backend configuration.
- AGENTS.md: contributor guidelines for this repository.

## How to Open the App

- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` locally. The server loads this file automatically.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` locally to enable the account UI. These are browser-safe Supabase project values, not service role secrets.
- Optional AI protection settings are available in `.env.example`: `AI_GUEST_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT`, `AI_GUEST_REQUESTS_PER_MINUTE`, `AI_USER_REQUESTS_PER_MINUTE`, `AI_MAX_CONCURRENT_PER_PRINCIPAL`, `AI_REQUEST_TIMEOUT_MS`, and `DEEP_GUIDANCE_ENABLED`.
- Optional admin analytics settings are available in `.env.example`: `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, `ANALYTICS_HASH_SECRET`, `AI_INPUT_COST_PER_1M_TOKENS`, and `AI_OUTPUT_COST_PER_1M_TOKENS`. These are server-only values and must not be exposed in browser runtime config.
- Optional public contact setting: `PUBLIC_SUPPORT_EMAIL`. This is safe to expose in browser runtime config and is used by the legal documents. Do not put private inboxes or secrets here.
- Start the app with `npm start`.
- Open `http://localhost:3000` in your browser.
- Without `DEEPSEEK_API_KEY`, the page can still open; analysis API requests will fail safely and the frontend will show clearly marked local fallback results.
- Without Supabase values, the page can still open; account actions will show a configuration prompt.
- Run unit tests with `npm test`.

## AI API Protection

The shared AI endpoint is `POST /api/v1/dream-analysis`. The legacy `POST /api/dream-analysis` route currently calls the same handler for Web compatibility.

Logged-in Web users send `Authorization: Bearer <supabase_access_token>` from the browser session. The server validates that token with Supabase using only `SUPABASE_URL` and `SUPABASE_ANON_KEY`; it does not use or require a `service_role` key. Missing Authorization is treated as a guest request, while invalid or expired tokens return `AUTH_INVALID`.

Default Beta limits:

- `AI_GUEST_DAILY_LIMIT=3`
- `AI_USER_DAILY_LIMIT=10`
- `AI_GUEST_REQUESTS_PER_MINUTE=2`
- `AI_USER_REQUESTS_PER_MINUTE=3`
- `AI_MAX_CONCURRENT_PER_PRINCIPAL=1`
- `AI_REQUEST_TIMEOUT_MS=45000`
- `DEEP_GUIDANCE_ENABLED=false`

These limits use an in-memory counter suitable for the current single-instance Beta. Render restarts reset the counters, and multiple instances would not share them. Before a larger public release, this should move to Redis or another shared persistent limiter.

Deep guidance is still visible as “正在开发中”. When `DEEP_GUIDANCE_ENABLED=false`, `guided_questions` and `guided_final` are rejected by the server before quota usage or DeepSeek calls.

## Supabase Security

The current `dream_records` cloud storage path is covered by [docs/SUPABASE_SECURITY_AUDIT.md](docs/SUPABASE_SECURITY_AUDIT.md). The audit records the RLS policies, current-user query filters, sync de-duplication key, key exposure boundaries, and manual production checks that still require a real Supabase project.

## Privacy And Data Controls

Privacy/data controls setup is documented in [docs/PRIVACY_DATA_CONTROLS_SETUP.md](docs/PRIVACY_DATA_CONTROLS_SETUP.md). The legal documents are Beta technical copy and should receive professional review before production launch.

Apply `supabase/migrations/20260717001000_create_legal_consents.sql` to store authenticated legal consent versions. Account deletion uses `DELETE /api/v1/account`, verifies the Supabase Bearer token on the server, ignores body `userId` and `email`, deletes authenticated AI usage events and authenticated product events matched by recalculated HMAC when `ANALYTICS_HASH_SECRET` is configured, deletes the Supabase Auth user, and then performs scoped cleanup for that user's dream records, legal consent, and product analytics preference. Guest AI and product analytics events are not deleted because they cannot be reliably tied to the account.

## Product Analytics

Product analytics is first-party, optional, and default off. It records only allowlisted behavior metadata after consent; it does not store dream content, personal identifiers, or raw installation/session values. The admin dashboard shows aggregate product usage, funnel, and UTC D1/D7 retention figures labeled `基于已同意产品分析的用户样本`, without full hashes.

Apply `supabase/migrations/20260719000000_create_product_analytics.sql` manually in Supabase, then configure the existing server-only `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_USER_IDS`, and `ANALYTICS_HASH_SECRET` values. Full setup and manual verification steps are in [docs/PRODUCT_ANALYTICS_SETUP.md](docs/PRODUCT_ANALYTICS_SETUP.md).

## Admin Analytics

Admin analytics setup is documented in [docs/ADMIN_ANALYTICS_SETUP.md](docs/ADMIN_ANALYTICS_SETUP.md). The feature stores only AI usage metadata, hashed principals, token usage, estimated cost when configured, outcomes, and timing information. It does not store dream text, full AI responses, raw IP addresses, email, access tokens, refresh tokens, Authorization headers, or full Supabase user ids.

The `public.ai_usage_events` migration must be applied manually in Supabase. The browser runtime continues to expose only `SUPABASE_URL` and `SUPABASE_ANON_KEY`; service role and analytics secrets stay server-side. The admin dashboard is read-only and relies on server-side admin checks for every request.

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
