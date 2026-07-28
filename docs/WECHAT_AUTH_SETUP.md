# 微信身份桥接部署说明

本说明对应 migration：

```text
supabase/migrations/20260720000000_create_wechat_auth.sql
```

微信身份桥接用于建立 Dream Anatomy 小程序登录态。当前小程序已经可以在用户主动确认后使用该身份同步梦境到统一的 `dream_records` 云端模型；也可以通过 Web 端生成的一次性绑定码与邮箱账户合并。它仍没有微信支付，也不会把微信身份伪造成 Supabase Session。

## Supabase SQL Editor

1. 打开 Supabase 项目。
2. 进入 SQL Editor。
3. 执行 `supabase/migrations/20260720000000_create_wechat_auth.sql`。
4. 确认 `public.wechat_accounts` 和 `public.wechat_sessions` 已创建。
5. 确认两张表已启用并强制 RLS，且 `anon` / `authenticated` 没有直接访问权限。

两张表仅供 Render 服务端通过 server-only Service Role 操作，小程序和浏览器都不应直连读写。

## Render Dashboard 环境变量

在 Render Dashboard 配置以下 server-only 变量：

```text
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
WECHAT_IDENTITY_HASH_SECRET=
WECHAT_SESSION_HASH_SECRET=
WECHAT_LOGIN_REQUESTS_PER_MINUTE=5
```

说明：

- `WECHAT_MINIPROGRAM_APP_SECRET` 只允许出现在 Render 环境变量里。
- `WECHAT_IDENTITY_HASH_SECRET` 用于对微信身份做 HMAC-SHA256。
- `WECHAT_SESSION_HASH_SECRET` 用于保存 Dream Anatomy 不透明 Session Token 的哈希。
- 不要把这些值放进小程序源码、`runtime-env.js`、GitHub、测试 fixture 或 PR 描述。
- 如果任一必要配置缺失，服务端会返回 `WECHAT_AUTH_UNAVAILABLE`。

## 微信开发者工具验证

1. 在微信公众平台准备测试 AppID 和 AppSecret。
2. 在 Render Dashboard 配置上面的变量并重新部署。
3. 用微信开发者工具打开 `miniprogram/`。
4. 进入“我的”页面。
5. 点击“使用微信身份继续”。
6. 成功后应显示“微信身份已建立”。
7. 页面应显示“同步到云端”数据管理入口；首次检测到本机待同步梦境时，应询问用户是否同步。
8. 退出当前身份后，应回到“游客模式”，并停止展示当前身份的云同步状态。

## 当前边界

- 当前小程序云同步通过 Render 服务端接口完成，部署步骤见 `docs/MINIPROGRAM_CLOUD_SYNC_SETUP.md`。
- 当前 Web/微信账户绑定通过 Render 服务端接口完成，部署步骤见 `docs/ACCOUNT_BINDING_SETUP.md`。
- 当前不请求微信昵称、头像、手机号、地理位置或好友信息。
- 当前不提高 AI 免费额度。
- 快速解析仍调用现有 `POST /api/v1/dream-analysis`，不把微信 Session Token 当作 Supabase token。
- 完整微信账户注销仍需要后续隐私 PR 设计；本轮只支持退出当前 Session，以及同步接口内的梦境软删除。
