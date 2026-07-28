# 微信身份桥接架构

## 为什么使用独立身份桥接

Dream Anatomy 的 Web 账户使用 Supabase Auth 邮箱登录。微信小程序使用独立的微信身份桥接，不需要也不应该创建假的 Supabase Session、合成邮箱用户或自定义 Supabase JWT。

当前架构不创建假的 Supabase Session，也不把微信身份包装成 Web 邮箱账户。Web 邮箱账户与微信身份的绑定通过独立的一次性绑定码完成，绑定后仍由服务端解析到统一的 `public.app_users.id`。

因此本轮采用：

```text
wx.login()
→ Render POST /api/v1/wechat-auth/login
→ 微信 jscode2session
→ Dream Anatomy wechat_account
→ 不透明 Session Token
```

小程序微信账户与 Web Supabase 邮箱账户默认独立；用户主动完成绑定后，微信身份会归并到 Web 邮箱账户对应的内部 `app_users`，两端共享统一的 `dream_records`。

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
- `cloudSyncAvailable: true` 表示当前微信身份可以调用小程序云同步接口；这不代表已绑定 Web 邮箱账户。

## 数据库结构

`public.wechat_accounts` 保存：

- app_id
- openid_hash
- unionid_hash
- linked_supabase_user_id（绑定邮箱账户后写入对应 Supabase Auth 用户 id）
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

`public.app_users` 是当前的小型兼容层：

- Web 邮箱用户使用 `app_users.id = auth.users.id`，保留既有 `dream_records` RLS 策略。
- 微信小程序用户通过 `wechat_accounts.id` 查找或创建对应的 `app_users.id`。
- `dream_records.user_id` 指向 `app_users.id`。绑定时，服务端事务会把微信侧 `dream_records` 迁移到 Web 邮箱账户的 `app_users.id`，并按 `local_record_id` 去重或生成冲突副本。
- 绑定码只在 Web 创建成功时返回一次，数据库只保存 HMAC hash，不保存明文码、邮箱、openid 或 unionid。

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
- 小程序梦境先保存在本机，用户主动开启后通过 Render 服务端同步到统一 `dream_records`。
- Web/微信绑定不会改变 AI 额度、提示词或小程序合规文案。
- 深度引导继续显示“正在开发中”。
- Web Auth、Dream Home、Dream Journal、Dream Detail、AI analytics 和产品 analytics 不受本轮影响。

## 后续扩展

后续扩展可以在当前绑定基础上增加解绑、多个设备会话管理、账户注销时的微信身份级联删除，以及 Web/微信双端更完整的缓存迁移。当前不支持自动解绑、一个微信绑定多个邮箱、多个微信绑定同一邮箱，且继续避免把微信身份伪装成 Supabase Session。
