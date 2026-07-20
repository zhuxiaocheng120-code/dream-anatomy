# 微信小程序本地设置

本目录提供 **析梦 Dream Anatomy** 的原生微信小程序基础工程。当前版本支持游客核心闭环，并新增安全的微信身份桥接：快速解析、梦境画像、本机保存、本机梦境日记、详情、删除、导出、清除本机数据，以及“我的”页面里主动点击“使用微信身份继续”。

小程序视觉语言已同步 Web 端的旧纸、私人档案、心理工作室和手稿记录风格。配色、字体层级、原创装饰资产和手动视觉验收清单见 [docs/MINIPROGRAM_VISUAL_LANGUAGE.md](MINIPROGRAM_VISUAL_LANGUAGE.md)。

## 导入微信开发者工具

1. 安装并打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择仓库根目录。
4. AppID 填写你自己的微信小程序 AppID。
5. 如果需要本机配置，复制 `miniprogram/project.config.example.json` 为 `miniprogram/project.config.json`，该文件已被 `.gitignore` 忽略。

## API 配置

小程序调用现有 Render 后端，不直接调用 DeepSeek。

默认示例配置在 `miniprogram/config/config.example.js`：

```js
API_BASE_URL = "https://dream-anatomy.onrender.com"
```

如需本地覆盖，可以复制为 `miniprogram/config/config.js` 并自行调整；该私有配置已被 `.gitignore` 忽略。当前页面代码默认读取 example 配置，后续如果需要多环境构建，可以再增加安全的配置加载逻辑。

## request 合法域名

微信公众平台后台需要配置 request 合法域名：

- `https://dream-anatomy.onrender.com`

开发版可以配合微信开发者工具的调试设置进行联调；体验版和正式版必须完成平台侧域名配置。

## 环境区别

- 开发版：用于本机和开发者工具调试。
- 体验版：用于少量测试用户在微信里体验。
- 正式版：提交审核并发布后面向真实用户。

当前仓库只提供基础工程、视觉样式和自动化静态/服务测试，尚未完成真机验收。发布前需要在微信开发者工具和真机上手动验证快速解析、保存、日记、详情、删除、导出、清除本机数据，以及首页、快速解析、结果页、日记页、详情页、隐私页和我的页面的视觉呈现。

## 安全边界

- 不要在小程序中配置 AppSecret。
- 不要把 `DEEPSEEK_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ANALYTICS_HASH_SECRET` 或任何 token 放入小程序文件。
- 微信身份使用 Render 后端桥接；`WECHAT_MINIPROGRAM_APP_ID`、`WECHAT_MINIPROGRAM_APP_SECRET`、`WECHAT_IDENTITY_HASH_SECRET` 和 `WECHAT_SESSION_HASH_SECRET` 只在 Render 配置。
- 小程序只在用户点击“使用微信身份继续”时调用 `wx.login`，不会在启动时反复弹出登录。
- 不在小程序中调用 `code2Session`、微信支付、Supabase Auth 或云同步。
- 快速解析请求不发送微信身份 Authorization header，当前仍按访客 AI 额度运行。
- 深度引导入口保持可见，但显示“正在开发中”，不能触发 AI 请求。

微信身份桥接的部署步骤见 [docs/WECHAT_AUTH_SETUP.md](WECHAT_AUTH_SETUP.md)。
