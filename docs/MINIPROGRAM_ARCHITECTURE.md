# 微信小程序架构说明

## 当前范围

小程序位于 `miniprogram/`，使用微信原生 JavaScript、WXML 和 WXSS，不使用 Taro、uni-app、React、Vue 或新的路由框架。当前产品展示名为 Dream Anatomy 梦境手札，定位为梦境记录、睡眠感受记录与 AI 辅助文字整理工具。当前已经在游客核心闭环上新增微信身份桥接，但不做云同步。

游客版核心闭环：

1. 首页进入 AI 整理梦境。
2. 用户输入梦境并显式同意法律文件。
3. 小程序通过 `wx.request` 调用现有 Render 后端 `POST /api/v1/dream-analysis`。
4. 当前结果页显示 AI 整理结果和梦境线索卡。
5. 用户保存到本机存储。
6. 用户在本机梦境日记查看列表、详情、删除、导出或清除本机数据。

## 数据流

```text
微信小程序游客用户
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

它不伪造 Supabase Session，不创建合成邮箱用户，不把微信 Session Token 当作 Supabase access token，也不做云同步。当前返回的身份状态始终包含 `cloudSyncAvailable: false`。

## 本机存储

游客梦境只保存在当前微信本机，存储 key 为：

```text
dream_anatomy_guest_records_v1
```

每条记录包含 `localRecordId`、创建和更新时间、梦境原文、睡眠质量、分析类型、AI 辅助整理正文、梦境线索卡和 `storageVersion`。本轮上限为 100 条，超过后提示用户先导出或删除旧记录，不会静默删除。

## 法律文件与同意

小程序通过 `miniprogram/services/legalDocuments.js` 保留小程序根目录内的法律文件版本和精简文案。自动化测试会和 Web 端 `src/legalDocuments.js` 比对版本号，避免版本漂移；运行时不跨出 `miniprogramRoot` 读取 Web 文件。游客第一次使用 AI 辅助文字整理前必须主动勾选同意；本机保存的版本落后时需要重新同意。

## 功能边界

- 不做云同步。
- 不调用 `code2Session`。
- 不保存 openid、unionid、session_key 或自定义 JWT。
- 不接入 Supabase 登录或云同步。
- 不接入微信支付、会员或数据库。
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
- `miniprogram/pages/result/`：AI 整理结果、梦境线索卡、保存到本机日记。
- `miniprogram/pages/journal/`：本机梦境日记列表。
- `miniprogram/pages/detail/`：本机记录详情和删除。
- `miniprogram/pages/privacy/`：法律文件、导出、清除本机数据。
- `miniprogram/pages/profile/`：游客状态说明。
- `miniprogram/services/apiClient.js`：请求 Render 后端。
- `miniprogram/services/dreamStorage.js`：本机梦境记录 CRUD。
- `miniprogram/services/resultCard.js`：梦境线索卡规范化。

## 后续扩展预留

如果未来要接入微信登录，应新增独立后端登录流程，不能把 AppSecret 放入小程序。云同步、支付、会员、小程序产品分析和深度记录恢复都应作为独立 PR 处理。
