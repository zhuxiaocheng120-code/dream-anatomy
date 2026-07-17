# 项目状态

## 当前应用能做什么

这个项目现在是一个中文梦境自我探索 MVP 雏形，名字是 **析梦 Dream Anatomy**。它的定位是：**你的梦境自我探索工具**。当前可以通过最小 Node.js 后端代理启动，前端仍是 plain HTML、CSS 和 JavaScript。

它强调梦境记录和温和的荣格式自我探索，不提供诊断、治疗、算命或预测。

目前页面包含：

- 中文首页介绍，说明应用想帮助用户记录梦境，并温柔地探索梦中的内在主题。
- 三个明确入口：快速解析、深度引导、梦境日记。
- 深度引导入口目前保留展示，但通过 `src/featureFlags.js` 暂时标记为“正在开发中”，不能开始新的深度引导。
- 点击入口后，可以切换到对应的基础区域。
- 快速解析区域可以输入梦境碎片，优先通过本项目后端代理请求 DeepSeek API。快速解析的一次最终请求会同时返回 V2 结构化分析正文和完整 `reportContent.dreamResultCard` 梦境画像。
- 快速解析 V2 结果包含：梦境整理、核心主题、核心解析、梦境证据与解释、情绪画像、主要意象、自我思考、今日小行动和温和提醒。
- 后端会对快速解析 V2 做基础质量检查：要求引用当前梦境细节、四维评分有 rationale、反思问题完整、安全语言合格；结果过短或缺失时最多自动重试一次，仍不完整时前端会提示生成不完整，而不是展示 mock。
- 快速解析完成后会在当前结果页直接展示梦境画像，并把分析正文和梦境画像一起保存到当前浏览器或当前用户的梦境日记。
- AI 后端现在提供版本化接口 `POST /api/v1/dream-analysis`，旧 `POST /api/dream-analysis` 暂时保留为兼容别名。接口会识别 Supabase Bearer token，把缺少 token 的请求当作访客，并使用内存计数器提供 Beta 免费额度、短时限流、单用户并发限制和 DeepSeek 超时保护。
- AI 后端现在会在不影响用户解析流程的前提下，尝试把隐私保护的 AI 使用统计写入 Supabase `ai_usage_events`，用于运营分析和服务改进。
- 梦境日记区域会显示已保存记录的日期、梦境摘要、主要情绪、主要意象、睡眠质量和分析类型。
- 深度引导源码、后端接口和既有测试仍保留，但当前用户不能从入口开始新的深度引导，也不能创建新的深度引导记录。
- 已保存的历史深度引导记录仍会显示在梦境日记和梦境详情里。
- 快速解析和深度引导记录会显示在同一个梦境日记列表中，深度引导记录的分析类型显示为“深度引导”。
- 梦境日记列表里的记录可以点击“查看详情”，进入本地详情视图。
- 梦境详情视图会展示梦境标题、日期、时间、完整梦境原文、AI 摘要、情绪标签、梦境意象、睡眠质量和分析类型，并支持返回梦境日记列表。
- 梦境详情里的 AI 分析采用可折叠卡片，包含荣格、弗洛伊德和现代心理学三个温和视角，并预留“自我思考”区域供后续扩展。
- 如果没有本地记录，梦境日记区域会显示空状态。
- 项目已准备 Supabase 基础设施，包括 JavaScript SDK 依赖、`SUPABASE_URL` / `SUPABASE_ANON_KEY` 环境变量示例，以及 `dream_records` 数据表迁移和 RLS 策略。
- 页面右上角已加入 Supabase Auth 账户入口。未登录时显示“登录 / 注册”；登录后显示当前邮箱和“退出登录”。
- 当前账户系统支持邮箱注册、验证邮件提示、邮箱验证后登录、退出登录、忘记密码、重置密码，以及刷新页面后的登录状态保持。
- 登录后会自动尝试把当前浏览器里的本地梦境记录迁移到 Supabase，并通过 `local_record_id + user_id` 去重，避免重复同步。
- 登录用户的新快速解析记录会优先保存到 Supabase；保存成功后再更新 localStorage 缓存，保存失败时会保留本地记录并标记为 `pending_sync`。新的深度引导记录当前暂时不能创建。
- 梦境日记在登录后以 Supabase 云端记录为主，退出登录后不会继续显示上一位用户的云端梦境。
- 已认证用户登录或恢复会话后会自动进入 **Dream Home**；退出登录会立即清空 Dream Home 的用户数据并回到公开首页。
- Dream Home 只查询当前用户的 Supabase `dream_records`，并以这些记录显示梦境总数、连续记录夜晚、AI 整理次数和最近五条梦境。当前用户筛选与既有 RLS 策略共同保护账户隔离。
- 每日引语由 `src/dreamQuotes.js` 在浏览器本地日期上稳定选择，来源为已核验的公版中文经典文本；同一日期内刷新不会变更引语。
- “重要梦境”目前固定为 `0`，因为既有记录和 schema 没有 favorite 或 important 字段；Dream Home 不会查询或编造不存在的字段。
- “AI 洞察”和“标签 / 分类”是无数据、无控件的 `Coming Soon` 视觉区域，尚未提供 AI 洞察或分类功能。
- Dream Home 的“查看梦境档案”会进入 **Dream Journal**，这是当前梦境档案的主要页面。
- Dream Journal 会显示当前用户可见的全部梦境记录，并按日期自动分组为 Today、Yesterday、Earlier This Week、Earlier This Month 和 Older。
- Dream Journal 支持本地实时搜索，搜索范围包括自动标题、原文、梦境摘要、情绪和意象。
- Dream Journal 支持 `全部`、`Quick`、`Deep`、`Pending Sync` 四个过滤入口。
- Dream Journal 记录点击后继续进入现有 Dream Detail 页面；Dream Journal 和 Dream Detail 只读取已经保存的分析正文与梦境画像，不自动重复调用 AI。
- Dream Journal 没有记录时会显示温和空状态，并提供“记录第一个梦”入口。

未登录时梦境记录仍只保存在当前浏览器的 localStorage 中；登录后，梦境日记会优先使用 Supabase 云端记录，并保留 localStorage 作为缓存和失败兜底。快速解析、深度追问和深度最终报告请求会通过本项目后端代理发送给配置的 DeepSeek API；如果 API key 未配置或调用失败，前端会显示明确标记的本地示例结果。
真实 Supabase 云同步仍需要使用实际 Supabase 项目完成注册、邮箱验证、跨浏览器、双账号隔离和断网恢复验收。

## 当前文件

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
│       ├── plans/
│       └── specs/
├── lib/
│   └── supabaseClient.js
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
│   ├── index.html
│   ├── runtime-env.js
│   ├── style.css
│   └── vendor/
│       └── supabase.js
├── supabase/
│   └── migrations/
└── tests/
```
src/index.html：页面结构和中文文案。
src/style.css：页面颜色、排版、按钮和响应式布局。
src/app.js：梦境解析、深度引导、本地日记和视图切换逻辑。
src/auth.js：Supabase Auth 注册、登录、退出、忘记密码、重置密码和登录状态展示逻辑。
src/dreamHome.js：Dream Home 的会话处理、当前用户云端记录读取、统计、最近梦境和既有导航/详情复用。
src/dreamJournal.js：Dream Journal 的记录分组、实时搜索、过滤、空状态、列表渲染和既有详情页跳转。
src/dreamQuotes.js：已核验公版引语数据，以及按浏览器本地日期稳定选择引语的逻辑。
src/dreamSync.js：梦境记录 localStorage 与 Supabase 的映射、迁移、云端加载、待同步重试逻辑。
src/featureFlags.js：浏览器端小型功能开关；`DEEP_GUIDANCE_ENABLED` 当前用于暂时关闭新的深度引导创建。
src/runtime-env.js：由启动脚本生成的浏览器运行时配置文件，用于公开 Supabase 配置。
src/adminAnalytics.js：运营后台的浏览器控制器，负责管理员权限探测、只读统计渲染和账户切换清理。
src/vendor/supabase.js：浏览器端 Supabase SDK 资源，用于账户入口。
server.js：Express 静态托管和受保护的共享 AI 分析 API。
server/：服务端专用 AI API helper，负责 Supabase token 身份识别、稳定错误结构、Beta 额度、短时限流、并发锁、AI 使用统计、管理员聚合查询和内存限流计数整理。
scripts/writeRuntimeEnv.js：启动前从环境变量写入 `src/runtime-env.js`。
lib/supabaseClient.js：从环境变量创建 Supabase client 的基础设施 helper。
supabase/migrations/：Supabase 数据表和 RLS 策略迁移。
docs/SUPABASE_SECURITY_AUDIT.md：Supabase RLS、账户隔离、密钥暴露边界和线上手动验收矩阵。
.env.example：本地后端环境变量示例，不包含真实 API key。
README.md：项目简介和如何打开页面。
AGENTS.md：贡献者和编码助手的工作指南。
assets/：以后可以放图片、图标或示例素材。
tests/：包含当前自动化测试，包括 Dream Journal、Dream Home、Dream Quotes、Dream Sync 和 Auth diagnostics。

## Dream Home 的当前边界

Dream Home 是已认证用户的只读首页体验。它没有修改 DeepSeek 调用或提示词、Supabase Auth 规则、`dreamSync.js` 同步逻辑或 Supabase schema。

以下能力仍未实现：搜索、收藏、梦境时间线、回收站或删除、标题/内容编辑、分析图表。它们不会被 Dream Home 的 `Coming Soon` 区域模拟为可用功能。

## Dream Journal 的当前边界

Dream Journal 是登录后从 Dream Home 进入的梦境档案页，也兼容未登录本地记录。它复用现有 `dreamSync.js` 提供的可见记录和现有 Dream Detail 页面，不修改 DeepSeek、Auth、云同步规则或 Supabase schema。

本轮没有实现 Timeline、Calendar、Favorite、Trash、Edit、Delete、Growth、Atlas、支付、会员或新的详情系统。`Pending Sync` 只是显示既有待同步状态；搜索和过滤都在当前页面本地完成。

## Dream Detail 的当前边界

Dream Detail 是现有梦境记录原始内容的只读详情页。它不会编辑梦境正文、修改标题或新增数据库字段。

详情页中的荣格、弗洛伊德、现代心理学折叠卡片和已经保存的梦境画像只根据已有记录内容做温和展示。Dream Journal 和 Dream Detail 不会自动重新生成画像，也不会重复调用 AI，不提供诊断、治疗、算命、吉凶判断或未来预测。

## Dream Result Card 的当前边界

快速解析会通过一次最终请求，在同一上下文中同时生成分析正文和 `reportContent.dreamResultCard` **梦境画像**。当前结果页会立即展示梦境画像，保存时会把它写入现有记录内容里，不新增 schema 或数据库字段。深度引导最终报告的源码和后端路径仍保留，但新的深度引导创建当前由 feature flag 暂时关闭。

旧记录如果没有梦境画像，Dream Detail 仍可显示手动生成入口；但 Dream Journal 和 Dream Detail 不会自动为所有历史记录生成画像，也不会覆盖已有结果。当前只提供页面内的分享卡片预览；图片下载和分享功能未实现。

## AI API 保护的当前边界

当前 AI API 面向 Web Beta 和后续客户端共用，首选接口是 `POST /api/v1/dream-analysis`。浏览器登录后会把 Supabase access token 放在 Authorization header 中；服务端只用 `SUPABASE_URL` 和 `SUPABASE_ANON_KEY` 校验 token，不使用 service role。未登录请求仍可作为访客使用免费额度。

默认 Beta 额度和限制为：访客 24 小时 3 次、登录用户 24 小时 10 次、访客每分钟 2 次、登录用户每分钟 3 次、同一身份同时 1 个 AI 请求、DeepSeek 超时 45000ms。配置项分别是 `AI_GUEST_DAILY_LIMIT`、`AI_USER_DAILY_LIMIT`、`AI_GUEST_REQUESTS_PER_MINUTE`、`AI_USER_REQUESTS_PER_MINUTE`、`AI_MAX_CONCURRENT_PER_PRINCIPAL`、`AI_REQUEST_TIMEOUT_MS` 和 `DEEP_GUIDANCE_ENABLED`。

这些限制目前使用内存计数器，适合当前单实例 Beta。Render 重启后计数会重置，多实例时不会共享；正式大规模发布前需要 Redis 或其他持久化限流方案。

## Supabase 数据安全审查

当前 Supabase 安全审查记录在 `docs/SUPABASE_SECURITY_AUDIT.md`。审查确认现有 migration 已启用并强制 RLS，`dream_records` 的四项策略按 `auth.uid() = user_id` 限制当前用户，云同步使用 `(user_id, local_record_id)` 去重，浏览器运行时配置只公开 Supabase URL 和 anon/publishable key。

本地自动化测试覆盖了 RLS SQL 静态检查、运行时环境暴露边界、服务端 Supabase client 非持久 session 默认值、伪造 `userId` 被忽略、跨账号 pending 记录不会迁移，以及账号切换时只显示当前账号记录。真实线上双账号 RLS 验证仍需要在 Supabase 项目中用合成测试账户完成。

## 运营统计后台的当前边界

当前新增的运营后台复用现有 SPA，不新增 `/admin.html` 或路由框架。管理员入口只有在服务端确认当前 Supabase session 属于 `ADMIN_USER_IDS` 后才显示；普通用户即使手动进入 admin view，也只能收到服务端 403，不能获得统计数据。

AI 使用统计只保存 request id、时间、用户类型、经过 `ANALYTICS_HASH_SECRET` HMAC-SHA256 处理的 `principal_hash`、analysisType、结果状态、稳定错误码、耗时、质量重试次数、模型、token 用量和可选成本估算。它不保存 raw IP、邮箱、完整 Supabase UUID、access token、refresh token、Authorization header、梦境正文或完整 AI 回复。

AI 使用统计将在实现产品运营分析和服务改进目的所必要的期限内长期保存。当前版本不执行自动清理；未来如调整保留期限，将在隐私政策和部署文档中同步更新。当前后台第一版只显示 7 / 30 / 90 天快捷筛选，这不代表数据库只保留 90 天。

部署前需要在 Supabase SQL Editor 手动执行 `supabase/migrations/20260717000000_create_ai_usage_events.sql`，并在 Render 配置 `SUPABASE_SERVICE_ROLE_KEY`、`ADMIN_USER_IDS` 和 `ANALYTICS_HASH_SECRET`。详细步骤见 `docs/ADMIN_ANALYTICS_SETUP.md`。

# 下一步可以做什么
适合初学者继续添加的功能：
继续完善 Dream Journal 的移动端视觉验收。
为 Dream Journal 增加更细的本地测试，覆盖更多日期边界和搜索组合。
整理 Dream Journal 与 Dream Home 的中文命名一致性。
补充浏览器验收记录，确认搜索、过滤和详情跳转在桌面与移动端都可用。
建议一次只做一个小功能。完成后先在浏览器里打开 src/index.html，确认页面仍然可以正常使用。
