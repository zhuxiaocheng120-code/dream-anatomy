# 微信小程序架构说明

## 当前范围

本轮实现微信小程序原生基础工程与游客版核心闭环。小程序位于 `miniprogram/`，使用微信原生 JavaScript、WXML 和 WXSS，不使用 Taro、uni-app、React、Vue 或新的路由框架。

游客版核心闭环：

1. 首页进入快速解析。
2. 用户输入梦境并显式同意法律文件。
3. 小程序通过 `wx.request` 调用现有 Render 后端 `POST /api/v1/dream-analysis`。
4. 当前结果页显示快速解析和梦境画像。
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

## 本机存储

游客梦境只保存在当前微信本机，存储 key 为：

```text
dream_anatomy_guest_records_v1
```

每条记录包含 `localRecordId`、创建和更新时间、梦境原文、睡眠质量、分析类型、分析正文、梦境画像和 `storageVersion`。本轮上限为 100 条，超过后提示用户先导出或删除旧记录，不会静默删除。

## 法律文件与同意

小程序通过 `miniprogram/services/legalDocuments.js` 保留小程序根目录内的法律文件版本和精简文案。自动化测试会和 Web 端 `src/legalDocuments.js` 比对版本号，避免版本漂移；运行时不跨出 `miniprogramRoot` 读取 Web 文件。游客第一次快速解析前必须主动勾选同意；本机保存的版本落后时需要重新同意。

## 功能边界

- 不接入微信登录。
- 不调用 `wx.login` 或 `code2Session`。
- 不保存 openid、unionid、session_key 或自定义 JWT。
- 不接入 Supabase 登录或云同步。
- 不接入微信支付、会员或数据库。
- 不写入产品行为分析事件。
- 深度引导保持“正在开发中”，不能触发 AI 请求或创建深度引导记录。

## 视觉结构

小程序视觉语言复用 Web 端已经确定的 aged paper / quiet archive / psychological studio 方向，但保持原生小程序轻量实现。共享视觉样式集中在 `miniprogram/app.wxss`，页面只保留必要的局部 WXSS。

主要页面视觉定位：

- 首页：最完整的品牌视觉锚点。
- 快速解析：梦境记录工作台和手稿输入区。
- 结果页：心理档案报告。
- 梦境日记：私人梦境档案和索引卡列表。
- 梦境详情：手稿记录与分析报告。
- 隐私与数据：可信的档案文书。
- 我的：本机游客档案和印章感。

原创装饰仅通过 WXML/WXSS 绘制，不依赖远程图片、字体文件或版权不明素材。完整视觉说明见 `docs/MINIPROGRAM_VISUAL_LANGUAGE.md`。

## 页面与服务

- `miniprogram/pages/home/`：首页、快速解析入口、本机最近梦境、深度引导禁用展示。
- `miniprogram/pages/quick/`：梦境输入、法律同意、AI 请求。
- `miniprogram/pages/result/`：解析结果、梦境画像、保存到本机日记。
- `miniprogram/pages/journal/`：本机梦境日记列表。
- `miniprogram/pages/detail/`：本机梦境详情和删除。
- `miniprogram/pages/privacy/`：法律文件、导出、清除本机数据。
- `miniprogram/pages/profile/`：游客状态说明。
- `miniprogram/services/apiClient.js`：请求 Render 后端。
- `miniprogram/services/dreamStorage.js`：本机梦境记录 CRUD。
- `miniprogram/services/resultCard.js`：梦境画像规范化。

## 后续扩展预留

如果未来要接入微信登录，应新增独立后端登录流程，不能把 AppSecret 放入小程序。云同步、支付、会员、小程序产品分析和深度引导恢复都应作为独立 PR 处理。
