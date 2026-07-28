# 微信小程序架构说明

## 当前范围

小程序位于 `miniprogram/`，使用微信原生 JavaScript、WXML 和 WXSS，不使用 Taro、uni-app、React、Vue 或新的路由框架。当前产品展示名为 Dream Anatomy 梦境手札，定位为梦境记录、睡眠感受记录与 AI 辅助文字整理工具。当前已经在游客核心闭环上新增微信身份桥接，并在用户主动确认后支持本地优先的云端梦境同步，也支持通过 Web 生成的一次性绑定码把微信身份归并到邮箱账户。

本机优先核心闭环：

1. 首页进入 AI 整理梦境。
2. 用户输入梦境并显式同意法律文件。
3. 小程序通过 `wx.request` 调用现有 Render 后端 `POST /api/v1/dream-analysis`。
4. 当前结果页显示 AI 整理结果和梦境线索卡。
5. 用户先保存到本机存储。
6. 用户在本机梦境日记查看列表、详情、删除、导出或清除本机数据。
7. 用户建立微信身份并主动选择同步后，小程序把本机记录同步到统一的 `dream_records` 云端模型。
8. 如果用户在 Web 端生成绑定码，并在小程序“我的”页面确认绑定，小程序身份会与邮箱账户共享同一批云端梦境。

## 数据流

```text
微信小程序用户
→ wx.request
→ https://dream-anatomy.onrender.com/api/v1/dream-analysis
→ 现有 Node.js 后端
→ DeepSeek API
```

小程序不调用 DeepSeek，不读取 DeepSeek API key，也不保存完整 AI 服务响应日志。后端继续负责 AI 接口鉴权、访客额度、限流、超时和安全错误结构。

## 微信身份桥接

微信身份桥接只用于建立 Dream Anatomy 小程序登录态：

```text
wx.login()
→ Render POST /api/v1/wechat-auth/login
→ 微信服务端验证 code
→ wechat_accounts / wechat_sessions
→ 小程序保存不透明 Session Token
```

它不伪造 Supabase Session，不创建合成邮箱用户，也不把微信 Session Token 当作 Supabase access token。当前返回的身份状态包含 `cloudSyncAvailable: true`，表示小程序可以在用户主动开启后调用 Render 的小程序梦境同步接口。

## 小程序云同步

小程序云同步保持 local-first：

1. 新记录总是先写入 `dream_anatomy_guest_records_v1`。
2. 本机保存成功后，如果用户已建立微信身份且已开启同步，再调用 Render 服务端。
3. 云端失败不会删除或覆盖本机记录；记录会保留为待同步或同步失败状态。
4. 换设备登录同一微信身份后，可以从云端恢复记录到本机。

同步接口：

- `POST /api/miniprogram/dreams/sync`
- `GET /api/miniprogram/dreams`
- `PUT /api/miniprogram/dreams/:id`
- `DELETE /api/miniprogram/dreams/:id`

所有接口都验证微信 Session Token。服务端根据 `wechat_sessions → wechat_accounts → app_users` 解析内部 `user_id`，不信任客户端传入的 `user_id`。云端仍使用统一的 `public.dream_records` 表，而不是小程序专属梦境表；`public.app_users` 是当前兼容层，允许 Web 邮箱账户和微信身份绑定到同一个内部用户模型。

## Web / 微信账户绑定

绑定采用“Web 生成绑定码，小程序确认”的流程：

1. Web 邮箱登录用户在“隐私与数据 / 微信账户”生成 10 分钟有效的一次性绑定码。
2. 小程序用户必须先建立微信身份。
3. 用户在“我的 / 绑定邮箱账户”输入绑定码，并确认“绑定后，网页端与小程序端的梦境记录将合并并共享。”
4. Render 服务端验证 Web Supabase session、微信 Session 和绑定码，不信任客户端传入的 `user_id`。
5. 绑定成功后，服务端事务把微信侧梦境合并到邮箱账户对应的 `app_users.id`，保留删除 tombstone，并在相同 `local_record_id` 但内容不同的时候生成冲突副本。

当前不实现自动解绑、小程序内邮箱密码登录、多个微信绑定同一邮箱、一个微信绑定多个邮箱或提高 AI 免费额度。

## 本机存储

梦境首先保存在当前微信本机，存储 key 为：

```text
dream_anatomy_guest_records_v1
```

每条记录包含 `localRecordId`、创建和更新时间、梦境原文、睡眠质量、分析类型、AI 辅助整理正文、梦境线索卡、`syncStatus`、`cloudRecordId`、`lastSyncedAt`、`deletedAt` 和 `storageVersion`。本轮上限为 100 条，超过后提示用户先导出或删除旧记录，不会静默删除。

## 法律文件与同意

小程序通过 `miniprogram/services/legalDocuments.js` 保留小程序根目录内的法律文件版本和精简文案。自动化测试会和 Web 端 `src/legalDocuments.js` 比对版本号，避免版本漂移；运行时不跨出 `miniprogramRoot` 读取 Web 文件。游客第一次使用 AI 辅助文字整理前必须主动勾选同意；本机保存的版本落后时需要重新同意。

## 功能边界

- 不调用 `code2Session`。
- 不保存 openid、unionid、session_key 或自定义 JWT。
- 不接入 Supabase 登录。
- 不接入微信支付、会员，也不让小程序直连数据库。
- 不写入产品行为分析事件。
- 深度记录保持“正在开发中”，不能触发 AI 请求或创建深度记录。

## 视觉结构

小程序视觉语言复用 Web 端已经确定的 aged paper / quiet archive / psychological studio 方向，但保持原生小程序轻量实现。共享视觉样式集中在 `miniprogram/app.wxss`，页面只保留必要的局部 WXSS。

主要页面视觉定位：

- 首页：最完整的品牌视觉锚点。
- AI 整理梦境：梦境记录工作台和手稿输入区。
- 结果页：心理档案报告。
- 梦境日记：私人梦境档案和索引卡列表。
- 记录详情：手稿记录与 AI 辅助整理报告。
- 隐私与数据：可信的档案文书。
- 我的：本机游客档案和印章感。

原创装饰仅通过 WXML/WXSS 绘制，不依赖远程图片、字体文件或版权不明素材。完整视觉说明见 `docs/MINIPROGRAM_VISUAL_LANGUAGE.md`。

## 页面与服务

- `miniprogram/pages/home/`：首页、AI 整理入口、本机最近梦境、深度记录禁用展示。
- `miniprogram/pages/quick/`：梦境输入、法律同意、AI 请求。
- `miniprogram/pages/result/`：AI 整理结果、梦境线索卡、保存到本机日记，并在同步开启时尝试上传云端。
- `miniprogram/pages/journal/`：本机梦境日记列表和同步状态展示。
- `miniprogram/pages/detail/`：本机记录详情、同步状态和删除。
- `miniprogram/pages/privacy/`：法律文件、导出、清除本机数据。
- `miniprogram/pages/profile/`：游客状态说明。
- `miniprogram/services/apiClient.js`：请求 Render 后端。
- `miniprogram/services/dreamStorage.js`：本机梦境记录 CRUD。
- `miniprogram/services/cloudSync.js`：微信身份下的本地优先云同步、跨设备恢复和冲突合并。
- `miniprogram/services/resultCard.js`：梦境线索卡规范化。

## 后续扩展预留

当前绑定已复用 `app_users` 兼容层，不需要重建梦境表。后续如增加解绑、账户注销中的微信身份级联删除、Web/微信缓存迁移、小程序产品分析、支付、会员或深度记录恢复，都应作为独立 PR 处理。
