# 微信小程序本地设置

本目录提供 **Dream Anatomy 梦境手札** 的原生微信小程序基础工程。当前版本定位为个人梦境记录、睡眠感受记录与 AI 辅助文字整理工具，支持本机优先核心闭环，并新增安全的微信身份桥接与用户主动开启的小程序云端梦境同步：AI 整理梦境、梦境线索卡、本机保存、本机梦境日记、详情、删除、导出、清除本机数据，以及“我的”页面里主动点击“使用微信身份继续”和“同步到云端”。

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

## 真机网络排查

AI 整理请求会带上 `X-Request-Correlation-Id`，小程序和 Render 服务端只记录安全诊断字段：请求路径、HTTP 状态、安全错误码和 correlation id，不记录梦境正文、微信身份 token、邮箱或密钥。

如果真机点击“保存并整理”后仍显示网络连接提示，请先查看微信开发者工具或真机调试日志：

- `WX_REQUEST_DOMAIN_NOT_CONFIGURED`：当前 AppID 没有把 `https://dream-anatomy.onrender.com` 配到 request 合法域名，Render 不会收到该请求。
- `WX_REQUEST_TIMEOUT`：请求超时，需要结合 Render 日志中的同一个 correlation id 排查。
- `WX_REQUEST_DNS_ERROR`：设备或网络没有解析到服务域名，Render 通常不会收到请求。
- `WX_REQUEST_TLS_ERROR`：HTTPS 证书或 TLS 握手失败，Render 通常不会收到完整请求。
- HTTP `4xx` 或 `5xx`：请求已经到达 Render，请用同一个 correlation id 查看服务端安全日志。

## 环境区别

- 开发版：用于本机和开发者工具调试。
- 体验版：用于少量测试用户在微信里体验。
- 正式版：提交审核并发布后面向真实用户。

当前仓库只提供基础工程、视觉样式和自动化静态/服务测试，尚未完成真机验收。发布前需要在微信开发者工具和真机上手动验证 AI 整理梦境、保存、日记、详情、删除、导出、清除本机数据、微信身份建立、首次同步提示、手动同步、换设备恢复，以及首页、AI 整理结果页、日记页、详情页、隐私页和我的页面的视觉呈现。

小程序备案与审核口径见 [docs/MINIPROGRAM_COMPLIANCE_COPY.md](MINIPROGRAM_COMPLIANCE_COPY.md)。其中明确说明本小程序是梦境记录、睡眠感受记录与 AI 辅助文字整理工具，不提供封建迷信、医疗、心理诊断或心理治疗服务。

## 安全边界

- 不要在小程序中配置 AppSecret。
- 不要把 `DEEPSEEK_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ANALYTICS_HASH_SECRET` 或任何 token 放入小程序文件。
- 微信身份使用 Render 后端桥接；`WECHAT_MINIPROGRAM_APP_ID`、`WECHAT_MINIPROGRAM_APP_SECRET`、`WECHAT_IDENTITY_HASH_SECRET` 和 `WECHAT_SESSION_HASH_SECRET` 只在 Render 配置。
- 小程序只在用户点击“使用微信身份继续”时调用 `wx.login`，不会在启动时反复弹出登录。
- 不在小程序中调用 `code2Session`、微信支付或 Supabase Auth；小程序云同步只通过 Render 服务端接口完成，不直连 Supabase。
- AI 整理请求不发送微信身份 Authorization header，当前仍按访客 AI 额度运行。
- 深度记录入口保持可见，但显示“正在开发中”，不能触发 AI 请求。

微信身份桥接的部署步骤见 [docs/WECHAT_AUTH_SETUP.md](WECHAT_AUTH_SETUP.md)。
小程序云同步的迁移和验收步骤见 [docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md](MINIPROGRAM_CLOUD_SYNC_SETUP.md)。
