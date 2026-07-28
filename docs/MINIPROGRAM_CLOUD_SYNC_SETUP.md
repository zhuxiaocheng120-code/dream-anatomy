# 微信小程序梦境云同步部署说明

本说明对应 migration：

```text
supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql
```

## 当前范围

小程序云同步采用 local-first 设计：

1. 新梦境先保存到微信本机存储。
2. 用户建立微信身份后，首次发现本机待同步记录时询问是否上传云端。
3. 用户选择“同步到云端”后，Render 服务端验证微信 Session，再写入统一的 `public.dream_records`。
4. 云端失败不会删除本机记录；记录会保留为待同步或同步失败。
5. 新设备登录同一微信身份后，可以从云端恢复记录到本机。

当前版本不实现 Web 邮箱账户与微信身份绑定，不提高 AI 免费额度，不修改 AI Prompt，不接支付或会员。

## 统一数据模型

本轮不创建小程序专用梦境表。Web 和微信小程序都面向同一张 `public.dream_records`：

- `public.app_users` 是兼容层。
- Web 邮箱用户：`app_users.id = auth.users.id`，继续兼容现有 `auth.uid() = dream_records.user_id` RLS。
- 微信小程序用户：Render 服务端根据已验证的 `wechat_sessions` 和 `wechat_accounts` 查找或创建 `app_users`。
- 小程序同步接口只信任服务端解析出的内部 `user_id`，不信任客户端传入的 `user_id`。
- `dream_records(user_id, local_record_id)` 继续用于幂等去重。

这为后续 Web 邮箱账户和微信身份绑定预留空间：绑定 PR 可以合并两个 `app_users`，迁移 `dream_records.user_id`，并继续使用 `local_record_id` 和软删除字段处理重复记录。

## Supabase SQL Editor

1. 确认已执行微信身份 migration：

```text
supabase/migrations/20260720000000_create_wechat_auth.sql
```

2. 在 Supabase SQL Editor 执行：

```text
supabase/migrations/20260728000000_add_miniprogram_cloud_sync.sql
```

3. 确认以下对象存在：

- `public.app_users`
- `dream_records.deleted_at`
- `dream_records.synced_at`
- `dream_records(user_id, local_record_id)` 唯一索引

4. 确认没有删除或重建 `dream_records`，没有新增小程序专用梦境表。

## Render 环境变量

云同步复用微信身份桥接和 Supabase server-only 配置：

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
WECHAT_SESSION_HASH_SECRET=
```

微信登录仍需要：

```text
WECHAT_MINIPROGRAM_APP_ID=
WECHAT_MINIPROGRAM_APP_SECRET=
WECHAT_IDENTITY_HASH_SECRET=
```

不要把 `SUPABASE_SERVICE_ROLE_KEY`、微信 AppSecret、Session Hash Secret 或任何 token 放入小程序源码、`runtime-env.js`、GitHub、测试 fixture 或 PR 描述。

## API

小程序云同步接口：

- `POST /api/miniprogram/dreams/sync`
- `GET /api/miniprogram/dreams`
- `PUT /api/miniprogram/dreams/:id`
- `DELETE /api/miniprogram/dreams/:id`

所有接口必须带：

```text
Authorization: Bearer <wechat-session-token>
```

服务端不会返回 openid、unionid、session_key、微信身份 hash、数据库账户 id 或 Service Role 信息。

## 手动验收步骤

1. 用微信开发者工具打开小程序。
2. 未登录时创建一条测试梦境，确认它保存在本机日记。
3. 进入“我的”，点击“使用微信身份继续”。
4. 首次检测到本机记录时，应显示：

```text
检测到本机保存的梦境记录，是否同步到云端，以便更换设备后恢复？
```

5. 点击“同步到云端”，确认记录状态变为“已同步”。
6. 再次点击同步，不应产生重复记录。
7. 在另一台设备或清空本机记录后登录同一微信身份，点击同步或恢复，应看到云端记录被恢复。
8. 删除已同步记录后，旧设备再次同步不应把已删除记录重新上传为活跃记录。
9. 断网或服务端失败时，本机记录仍可查看，状态显示为同步失败或待同步。

## 隐私与日志边界

- 梦境正文属于敏感内容。
- 普通服务端日志不得记录完整梦境正文。
- 错误诊断只记录请求类别、稳定错误码、记录数量、长度或匿名化身份摘要。
- 管理后台当前不提供普通查看梦境正文能力。
- 小程序 AI 整理请求仍不发送微信身份 Authorization header，继续使用现有 AI 接口规则和访客额度。

## 当前限制

- 未实现 Web 邮箱账户与微信身份绑定。
- 未实现微信账户注销和云端身份整体删除。
- 未接微信支付、会员、小程序产品分析或云端搜索。
- 未开放深度记录。
- 真机和跨设备验收需要在真实微信开发者工具、Render 和 Supabase 项目中完成。
