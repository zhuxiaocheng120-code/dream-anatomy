# 析梦 Dream Anatomy

**析梦 Dream Anatomy** 是一个中文梦境自我探索工具。它帮助用户记录梦境，并用温和的荣格心理学视角整理梦中的象征、情绪和内在主题。

这个项目目前是一个简单的 MVP 雏形，使用 plain HTML、CSS、JavaScript 和一个最小 Node.js 后端代理编写。后端用于让浏览器通过同源接口安全请求梦境解析服务，而不是把 API key 放到前端。

## What the App Does

页面的 PRD 风格定位是：**你的梦境自我探索工具**。

它包含：

- 中文首页，介绍梦境记录和自我探索的核心想法。
- 三个明确入口：快速解析、深度引导、梦境日记。
- 基础区域切换，点击入口后可以查看对应占位区域。
- 快速解析区域可以输入梦境碎片，优先通过本项目后端代理请求 DeepSeek API，失败时回退到本地 mock 的结构化快速解析结果。
- 快速解析结果会保存到浏览器本地梦境日记，并在梦境日记区域显示摘要列表。
- 深度引导区域可以输入梦境，并在本地生成 5 个温和短问题，帮助补充情绪、联想、现实连接、梦中主动性和醒后感受。
- 深度引导回答只在当前页面临时暂存，可以回答部分或全部问题，并生成一份本地 mock 的 Dream Anatomy Report。
- 深度报告包含梦境整理、情绪线索、核心意象、荣格式初步解读、现实连接、自我反思问题、今日小行动和温和提醒，并可保存到本地梦境日记。
- 梦境日记区域会在同一个列表中显示快速解析和深度引导记录，并可以点击查看单条记录详情。
- 梦境详情会展示日期、分析类型、原始梦境、摘要、情绪、意象、睡眠质量和完整分析内容。
- 项目包含 Supabase 基础设施准备：JavaScript SDK 依赖、环境变量示例，以及 `dream_records` 表迁移和 RLS 策略。
- 右上角提供 Supabase Auth 账户入口，支持邮箱注册、邮箱验证后登录、退出登录、忘记密码和重置密码。
- 登录后会自动把当前浏览器里的本地梦境迁移到 Supabase，并以云端梦境日记为主；未登录或云端暂时不可用时，仍保留 localStorage 本地保存和待同步兜底。

这个应用不是诊断工具、治疗服务、算命工具，也不会预测未来。它只用于梦境记录和温和的自我探索。快速解析请求会通过本项目后端代理发送给配置的 DeepSeek API，连接失败时会显示本地示例结果。

## Project Structure

```text
.
├── AGENTS.md
├── README.md
├── assets/
├── docs/
├── package.json
├── server.js
├── src/
│   ├── app.js
│   ├── auth.js
│   ├── dreamSync.js
│   ├── index.html
│   └── style.css
└── tests/
```
- src/index.html: page content and structure.
- src/style.css: colors, layout, spacing, and responsive styles.
- src/app.js: interactions for the dream analysis, local journal, and view switching flows.
- src/auth.js: Supabase Auth interactions for account registration, login, logout, password reset, and persistent session display.
- src/dreamSync.js: localStorage to Supabase dream record sync, cloud loading, pending retry, and record mapping.
- server.js: Express server that serves src and proxies quick dream analysis requests.
- lib/supabaseClient.js: helper for creating a Supabase client from environment variables.
- supabase/migrations/: database migrations for future cloud dream record storage.
- .env.example: example environment variables for local backend configuration.
- AGENTS.md: contributor guidelines for this repository.
- How to Open the App
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and set `DEEPSEEK_API_KEY` locally. The server loads this file automatically.
- Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` locally to enable the account UI. These are browser-safe Supabase project values, not service role secrets.
- Start the app with `npm start`.
- Open `http://localhost:3000` in your browser.
- Without `DEEPSEEK_API_KEY`, the page can still open; quick analysis API requests will fail safely and the frontend will show the local fallback result.
- Without Supabase values, the page can still open; account actions will show a configuration prompt.
- Run unit tests with `npm test`.
- Editing the App
- To change the text on the page, edit src/index.html. To change colors or layout, edit src/style.css. To change the button behavior of reflection messages, edit src/app.js.
- Contributing
- Before making larger changes, read [AGENTS.md](AGENTS.md). Keep updates small, clear, and easy for a beginner to understand.
