# Legal And Privacy Setup

Dream Anatomy public beta legal documents live in `src/legalDocuments.js`.

## Public Information

- Operator: 朱校成
- Entity type: 个人运营者
- Public support email: zhuxiaocheng120@gmail.com
- Current legal version: 2026-07-21
- Effective date: 2026-07-21

The same information appears in:

- `Dream Anatomy 用户协议`
- `Dream Anatomy 隐私政策`
- `Dream Anatomy AI 使用说明与风险提示`

## Service Providers

- Render: Web and API service, 美国俄勒冈州（Oregon, US West）
- Supabase: authentication and cloud database, 印度孟买（South Asia / Mumbai，ap-south-1）
- DeepSeek: AI dream analysis for user-requested analysis
- WeChat: mini program identity verification

## Cross-Border Processing / 境外处理

Dream Anatomy asks for separate cross-border processing consent because account, storage, and service requests may be processed or stored outside mainland China through Render and Supabase.

The privacy center stores:

- `cross_border_consent_version`
- `cross_border_accepted_at`

Apply:

```text
supabase/migrations/20260721000000_add_cross_border_legal_consent.sql
```

## Public Runtime Config

Browser runtime config may include:

```text
PUBLIC_OPERATOR_NAME=朱校成
PUBLIC_SUPPORT_EMAIL=zhuxiaocheng120@gmail.com
PUBLIC_AI_MODEL_NAME=
PUBLIC_AI_MODEL_FILING_NUMBER=
PUBLIC_AI_APP_REGISTRATION_NUMBER=
```

Do not expose service role keys, DeepSeek API keys, analytics secrets, WeChat secrets, access tokens, refresh tokens, or Authorization headers.

## 生成式 AI Release Gate

Before a broader public launch of generative AI features, confirm:

- The called model's filing or registration information.
- Whether Dream Anatomy needs application or feature registration.
- Whether model name, filing number, or launch number must be shown in product UI.

If real values are not confirmed, leave public filing fields empty. Current repository text and configuration 不代表获得任何行政许可或备案.

## Updating Versions

When a legal document changes materially:

1. Update the corresponding version constant in `src/legalDocuments.js`.
2. Update affected tests.
3. Confirm existing users without matching stored versions see `法律文件状态：待确认`.
4. Confirm `TOKEN_REFRESHED` does not repeatedly show the same prompt for an already checked session.
