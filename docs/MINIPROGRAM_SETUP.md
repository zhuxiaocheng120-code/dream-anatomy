# 微信小程序本地设置

本目录提供 **析梦 Dream Anatomy** 的原生微信小程序游客版基础工程。当前版本只做游客核心闭环：快速解析、梦境画像、本机保存、本机梦境日记、详情、删除、导出和清除本机数据。

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

当前仓库只提供基础工程和自动化静态/服务测试，尚未完成真机验收。发布前需要在微信开发者工具和真机上手动验证快速解析、保存、日记、详情、删除、导出和清除本机数据。

## 安全边界

- 不要在小程序中配置 AppSecret。
- 不要把 `DEEPSEEK_API_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、`ANALYTICS_HASH_SECRET` 或任何 token 放入小程序文件。
- 不调用 `wx.login`、`code2Session`、微信支付、Supabase Auth 或云同步。
- 游客请求不发送认证头。
- 深度引导入口保持可见，但显示“正在开发中”，不能触发 AI 请求。
