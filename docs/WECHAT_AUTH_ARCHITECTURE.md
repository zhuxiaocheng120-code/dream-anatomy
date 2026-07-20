# 微信身份桥接架构

## 为什么使用独立身份桥接

Dream Anatomy 的 Web 账户使用 Supabase Auth 邮箱登录。微信小程序本轮只需要建立一个安全的小程序身份，不需要也不应该创建假的 Supabase Session、合成邮箱用户或自定义 Supabase JWT。

本轮不创建假的 Supabase Session，也不把微信身份包装成 Web 邮箱账户。

因此本轮采用：

```text
wx.login()
→ Render POST /api/v1/wechat-auth/login
→ 微信 jscode2session
→ Dream Anatomy wechat_account
→ 不透明 Session Token
```

小程序微信账户与 Web Supabase 邮箱账户在当前版本保持独立。

## 登录数据流

1. 用户在“我的”页面点击“使用微信身份继续”。
2. 小程序调用 `wx.login()` 获取一次性 `code`。
3. 小程序把 `code` 发送给 Render。
4. Render 使用 `WECHAT_MINIPROGRAM_APP_ID` 和 `WECHAT_MINIPROGRAM_APP_SECRET` 向微信服务端验证。
5. Render 不返回 openid、unionid 或 session_key。
6. Render 使用 `WECHAT_IDENTITY_HASH_SECRET` 对 openid / unionid 做 HMAC-SHA256。
7. Render 查找或创建 `public.wechat_accounts`。
8. Render 生成高熵不透明 Session Token。
9. 数据库只保存 token 的 HMAC 哈希。
10. 小程序保存原始 Session Token，并在会话检查和退出身份时通过 Bearer header 发送。

## Session 生命周期

- Session Token 是不透明随机值，不是 JWT。
- 第一版有效期为 7 天。
- 过期后小程序重新执行 `wx.login()`。
- `GET /api/v1/wechat-auth/session` 用于检查当前 Session。
- `POST /api/v1/wechat-auth/logout` 只撤销当前 Session。
- 小程序“退出当前身份”等同于退出当前 Session，不影响其他设备的 Session。
- `cloudSyncAvailable: false` 会一直返回，直到后续独立 PR 实现云同步。

## 数据库结构

`public.wechat_accounts` 保存：

- app_id
- openid_hash
- unionid_hash
- linked_supabase_user_id（当前保持 null，为未来绑定预留）
- created_at
- last_login_at
- disabled_at

`public.wechat_sessions` 保存：

- account_id
- token_hash
- created_at
- expires_at
- last_seen_at
- revoked_at

两张表启用并强制 RLS，撤销 `anon` 和 `authenticated` 直接权限。小程序不能直接读取或写入这两张表。

## 隐私边界

服务端不保存：

- 原始 openid
- 原始 unionid
- session_key
- 微信 code
- 微信昵称
- 微信头像
- 手机号
- 好友信息

API 不返回：

- openid
- unionid
- session_key
- identity hash
- 数据库 account id
- Service Role 信息

日志不应输出微信 code、Session Token、完整 hash、邮箱、梦境正文或完整 AI 响应。

## 与现有功能的关系

- 快速解析继续使用现有 AI 接口。
- 微信 Session Token 不会被当作 Supabase access token。
- 小程序梦境继续保存在本机。
- 深度引导继续显示“正在开发中”。
- Web Auth、Dream Home、Dream Journal、Dream Detail、AI analytics 和产品 analytics 不受本轮影响。

## 后续扩展

后续可以基于 `wechat_accounts.id` 设计小程序云同步，也可以通过 `linked_supabase_user_id` 设计 Web 账户绑定。但这些都必须作为独立 PR，并继续避免把微信身份伪装成 Supabase Session。
