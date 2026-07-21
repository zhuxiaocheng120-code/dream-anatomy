# Legal Documents And Readable Export Design

## Goal

Publish the Dream Anatomy public beta legal documents and make user data export readable for non-technical users, without changing AI prompts, parsing, payments, deep guidance, account binding, mini program sync, or core product logic.

## Scope

This PR updates:

- `src/legalDocuments.js` with full Chinese public beta documents and version `2026-07-21`.
- `src/privacyData.js` with clearer legal confirmation state, separate cross-border processing consent, readable HTML archive export, retained JSON backup export, and refined anonymous usage statistics copy.
- `scripts/writeRuntimeEnv.js` and `.env.example` with public operator/support/model display configuration only.
- Supabase migration to append cross-border consent fields to `public.legal_consents`.
- Tests and docs for legal copy, consent, export, and deployment boundaries.

It does not update backend account deletion semantics except through documentation of existing behavior, and does not add any new AI, payment, membership, WeChat sync, or product analytics data flow.

## Legal Document Positioning

The three user-visible documents are:

- `Dream Anatomy 用户协议`
- `Dream Anatomy 隐私政策`
- `Dream Anatomy AI 使用说明与风险提示`

All three use version and effective date `2026-07-21`. User-visible copy says the documents apply to the current public beta. It no longer says the text is a technical beta draft awaiting legal review.

The copy avoids absolute compliance, absolute security, absolute disclaimers, permanent retention claims, and complete-anonymity claims. Liability limitation uses `在适用法律允许的最大范围内`, with an explicit carve-out that legally non-excludable liability is not excluded or limited.

## Public Operator Configuration

Default public values:

- Operator: `朱校成`
- Entity type: `个人运营者`
- Support email: `zhuxiaocheng120@gmail.com`

Runtime config may override:

- `PUBLIC_OPERATOR_NAME`
- `PUBLIC_SUPPORT_EMAIL`
- `PUBLIC_AI_MODEL_NAME`
- `PUBLIC_AI_MODEL_FILING_NUMBER`
- `PUBLIC_AI_APP_REGISTRATION_NUMBER`

These are public display values only. Service role keys, DeepSeek keys, analytics secrets, access tokens, refresh tokens, and WeChat secrets remain server-only and must not enter `runtime-env.js`.

## Privacy Policy Content

The privacy policy describes the Web and WeChat mini program public beta, operator/contact information, processed data categories, service providers, data processing regions, cross-border processing, retention principles, user rights, security measures, minors, updates, and contact.

Required factual service information:

- Render provides Web/API service in Oregon, US West.
- Supabase provides authentication and cloud database in South Asia / Mumbai, `ap-south-1`.
- DeepSeek receives the dream content needed for the user's active AI request.
- WeChat is used for mini program identity verification and current code does not request nickname, avatar, phone number, or friend data.

The privacy policy explicitly states that AI usage analytics does not store dream text, full AI replies, email, full Supabase UUID, access token, refresh token, Authorization header, or raw IP.

## Cross-Border Consent

Because Web/API and database infrastructure are outside mainland China, the privacy center and registration/AI consent flow must require a separate cross-border processing checkbox. It is default unchecked and separate from general legal consent.

Authenticated users store:

- `cross_border_consent_version`
- `cross_border_accepted_at`

Guest users store the current versions in the browser-local guest consent object.

No existing user is treated as having cross-border consent unless the stored row/local record has the matching version.

## User Agreement Content

The agreement states that Dream Anatomy is a dream journaling, AI-assisted organization, and self-exploration tool. It is not medical care, psychological diagnosis, psychotherapy, emergency intervention, fortune telling, auspicious/inauspicious judgment, future prediction, legal advice, or financial advice.

Users retain lawful rights in their dream content. Dream Anatomy receives only limited permissions needed to store, show to the current user, analyze, sync, export, delete, secure, and troubleshoot the service. It does not claim unlimited, permanent, resale ownership of dreams.

The agreement describes account rules, prohibited conduct, AI boundaries, beta availability, liability limits, service limits/termination, intellectual property, governing law, dispute handling, and contact information.

## AI Usage Notice Content

The AI notice states the current primary model provider is DeepSeek API. Optional public runtime fields can show model name, filing number, or app registration number only when configured. The UI must not invent or show fake numbers.

The notice explains that AI output is self-exploration reference, not diagnosis, therapy, prediction, or psychological measurement. Limited-evidence mode is described as a lower-information state, not a statement about the user.

It also states that dream content is sent to DeepSeek for the current request, while sleep feeling and user reflection are not currently sent to AI unless future notice and consent are added.

## Privacy Center UI

The legal confirmation card shows:

- `法律文件状态：待确认` or `已确认当前版本`
- `隐私政策 v2026-07-21`
- `用户协议 v2026-07-21`
- `AI 使用说明 v2026-07-21`
- `境外处理说明 v2026-07-21`
- View buttons for each document
- Two default-unchecked checkboxes:
  - `我已阅读并同意用户协议、隐私政策和 AI 使用说明`
  - `我已阅读境外处理说明，并单独同意必要的境外处理`
- `确认并继续`

After confirmation, the card shows the accepted time. It does not require re-confirmation on every visit unless stored versions are missing or stale.

Registration and first guest AI use reuse the same version requirements: both general legal consent and cross-border consent are required.

## Data Export

The primary export is:

- Button: `导出可阅读的梦境档案`
- Filename: `dream-anatomy-archive-YYYY-MM-DD.html`
- UTF-8 HTML
- Offline readable
- No external scripts, fonts, images, or remote resources
- No executable JavaScript
- Styled with the parchment / quiet archive visual language
- Printable / PDF-friendly

Each dream includes date/time, raw dream text, summary, sleep feeling, emotions, symbols, AI analysis, Dream Result Card, four dimensions, user reflection, and safety reminder when available.

All user and AI content is HTML-escaped before insertion.

The existing JSON export remains as a secondary/advanced action:

- Button: `导出原始数据备份（JSON）`
- Filename: `dream-anatomy-export-YYYY-MM-DD.json`
- Copy explains it is suitable for backup, migration, or technical processing.

Both export formats exclude tokens, Authorization headers, email, full user UUID, principal hashes, WeChat identity hashes, session tokens, and admin statistics.

## Anonymous Usage Statistics Copy

The privacy center renames the product analytics card to `匿名使用统计（可选）`.

It explains that enabling records page/function usage such as whether analysis or saving is completed, but not dream text, AI analysis text, email, or direct identity information. It remains default off.

The delete action moves into a lower-distraction `管理匿名统计数据` area.

## Documentation

Add or update:

- `docs/LEGAL_AND_PRIVACY_SETUP.md`
- `docs/DATA_EXPORT.md`
- `README.md`
- `docs/PROJECT_STATUS.md`
- existing privacy/security setup docs where necessary

Docs must note the real operator/contact, provider regions, legal versions, cross-border process, HTML vs JSON export, generative AI registration release gate, and that current documentation does not represent an administrative license or filing.

## Testing

Tests cover:

- Legal version/date/operator/provider-region copy.
- No stale beta technical-review user-visible copy.
- Liability language boundaries.
- Cross-border consent migration and UI behavior.
- Guest/authenticated consent version checks.
- HTML export escaping, no scripts/remote resources, inclusion of dream content/card/reflection/sleep feeling, exclusion of secrets.
- JSON backup still works with existing privacy filtering.
- Product analytics copy/default-off behavior.
- Regression for quick analysis, Dream Result Card, Dream Journal, Dream Detail, Auth, deletion, account deletion, WeChat code, mini program, syntax, and full test suite.

