# Web 与微信账户绑定部署说明

本说明对应 migration：

```text
supabase/migrations/20260728001000_create_account_binding.sql
```

当前账户绑定采用：

```text
Web 邮箱登录用户生成一次性绑定码
→ 微信小程序已登录用户输入绑定码并确认合并
→ Render 服务端验证双方身份
→ Supabase 事务合并 app_users 和 dream_records
```

绑定后，Web 邮箱账户与微信小程序身份共享同一个 `public.app_users.id` 和同一批 `public.dream_records`。本功能不创建小程序专属梦境表，也不把微信 Session 伪造成 Supabase Session。

## Supabase SQL Editor

请先确认已执行：

```text
supabase/migrations/20260720000000_create_wechat_auth.sql
supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql
```

然后在 Supabase SQL Editor 执行：

```text
supabase/migrations/20260728001000_create_account_binding.sql
```

执行后确认：

- `public.account_binding_tokens` 已创建；
- `public.account_binding_attempts` 已创建；
- `account_binding_tokens` 已启用并强制 RLS；
- `account_binding_attempts` 已启用并强制 RLS；
- `anon` 和 `authenticated` 对 `account_binding_tokens` 没有直接权限；
- `anon` 和 `authenticated` 对 `account_binding_attempts` 没有直接权限；
- `public.confirm_wechat_account_binding(...)` 函数存在；
- 没有新增 `miniprogram_dream_records`、`wechat_dream_records` 或其他独立梦境表；
- 没有删除、清空或重建 `public.dream_records`。

## Render 环境变量

账户绑定需要以下 server-only 配置：

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ACCOUNT_BINDING_TOKEN_SECRET=
ACCOUNT_BINDING_GENERATE_PER_MINUTE=3
ACCOUNT_BINDING_CONFIRM_PER_MINUTE=5
```

同时继续需要微信身份桥接配置：

```text
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
WECHAT_IDENTITY_HASH_SECRET=
WECHAT_SESSION_HASH_SECRET=
```

说明：

- `ACCOUNT_BINDING_TOKEN_SECRET` 用于对一次性绑定码做 HMAC-SHA256。
- 绑定码明文只在创建成功时返回一次，数据库只保存 hash。
- 不要把 `ACCOUNT_BINDING_TOKEN_SECRET`、`SUPABASE_SERVICE_ROLE_KEY`、微信 AppSecret 或 Session Hash Secret 放入前端、小程序源码、`runtime-env.js`、GitHub、测试 fixture 或 PR 描述。
- `ACCOUNT_BINDING_GENERATE_PER_MINUTE` 限制 Web 生成绑定码的频率。
- `ACCOUNT_BINDING_CONFIRM_PER_MINUTE` 限制小程序确认绑定码的频率。

## API

Web 端：

- `POST /api/account-binding/wechat/token`
- `GET /api/account-binding/status`

Web 请求必须带：

```text
Authorization: Bearer <supabase_access_token>
```

小程序端：

- `POST /api/miniprogram/account-binding/confirm`
- `GET /api/miniprogram/account-binding/status`

小程序请求必须带：

```text
Authorization: Bearer <wechat-session-token>
```

服务端只信任已验证 Session 解析出的身份，不接受客户端传入的 `user_id`、`userId`、`targetUserId`、邮箱、openid、unionid 或 account id。

## 绑定码安全机制

- 绑定码由服务端使用加密安全随机数生成。
- 绑定码有效期为 10 分钟。
- 绑定码只能使用一次。
- 数据库只保存 HMAC hash，不保存明文。
- 成功绑定后立即写入 `used_at`。
- 错误尝试会按微信账户记录失败次数；多次失败后短时锁定，成功绑定后清除失败记录。
- 错误码、过期、已使用或竞争绑定会返回稳定错误结构。
- 服务端日志不得记录绑定码明文、邮箱、openid、unionid、Session Token、Service Role Key 或梦境正文。

## 梦境合并规则

绑定时保留 Web 与小程序已有梦境，不静默删除用户内容：

- 最终身份使用 Web 邮箱账户对应的 `app_users.id`。
- 小程序侧 `dream_records.user_id` 会迁移到该 Web `app_users.id`。
- `deleted_at` tombstone 会保留，不会把已删除记录恢复为活跃记录。
- `local_record_id` 相同且内容相同的记录会去重。
- `local_record_id` 相同但内容不同的记录会生成带 `_wechat_conflict_` 后缀的冲突副本。
- 整个合并在数据库事务函数中执行；失败时整体回滚。

## Web 手动验收

1. 使用邮箱账户登录 Web。
2. 打开“隐私与数据”。
3. 找到“微信账户”卡片。
4. 点击“生成微信绑定码”。
5. 确认页面只显示短绑定码和 10 分钟有效期，不显示内部用户 id。
6. 重新生成时旧码不应被前端保留为隐藏字段。

## 微信开发者工具手动验收

1. 打开 `miniprogram/`。
2. 进入“我的”，点击“使用微信身份继续”。
3. 成功建立微信身份后，输入 Web 端生成的绑定码。
4. 点击“确认绑定”，确认弹窗应显示：

```text
绑定后，网页端与小程序端的梦境记录将合并并共享。
```

5. 确认后应显示：

```text
已完成账户绑定，梦境记录已合并。
```

6. 再次同步或恢复时，不应产生重复梦境。
7. Web Dream Journal 和小程序梦境日记应看到合并后的同一批云端记录。

## 当前限制

- 不支持自动解绑。
- 不支持一个微信身份绑定多个邮箱账户。
- 不支持多个微信身份绑定同一个邮箱账户。
- 不在小程序内输入邮箱和密码。
- 不提高微信身份的 AI 免费额度。
- 不修改 AI Prompt、合规文案、支付、会员或深度记录状态。

## 隐私与日志边界

绑定审计和错误诊断只应记录事件类别、稳定错误码、时间、匿名化或 hash 后的 actor 标识和 correlation id。不得记录：

- 绑定码明文；
- 邮箱；
- openid / unionid；
- auth.users UUID；
- Dream Anatomy Session Token；
- Service Role Key；
- 梦境正文；
- 完整 AI 响应。
