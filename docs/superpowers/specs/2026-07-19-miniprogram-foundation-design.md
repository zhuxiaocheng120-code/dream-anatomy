# WeChat Mini Program Foundation Design

## Goal

Build a native WeChat Mini Program foundation for Dream Anatomy that supports the guest-mode core loop: record a dream, call the existing Render AI backend for quick analysis, show the structured result and Dream Result Card, save the result locally, review it in a local journal, view details, delete/export/clear local data, and read legal documents. This PR does not implement WeChat login, Supabase login, cloud sync, payment, membership, deep guidance, or product analytics event sending.

## Confirmed Architecture

Use a native WeChat Mini Program under `miniprogram/` with JavaScript, WXML, and WXSS. The Mini Program calls only the existing Render backend (`POST /api/v1/dream-analysis`) through `wx.request`; it never calls DeepSeek directly and never contains server secrets. Guest data is stored only in WeChat local storage through a centralized storage service.

## Approach Options

### Option A: Copy Web Logic Directly Into Mini Program

This would duplicate Web legal text, result-card normalization, and dream storage patterns inside page files. It is fast initially but creates high drift risk and page files would become difficult to test.

### Option B: Mini Program Services + Version Consistency Tests

Create small platform-specific services in `miniprogram/services/` and keep reusable logic behind service interfaces. Use tests to ensure Mini Program legal document versions match the Web legal module and that Result Card normalization preserves Web field semantics. This keeps the new platform independent while preventing silent drift.

### Option C: Extract a Shared Cross-Platform Package First

Move Web result-card and legal logic into a new shared package and refactor Web and Mini Program to consume it. This is architecturally clean, but it risks a large Web regression surface for this first Mini Program PR.

## Decision

Use Option B. It keeps this PR focused on the Mini Program foundation, avoids large Web refactors, and still protects the important cross-platform contracts with tests.

## Directory Structure

```text
miniprogram/
  app.js
  app.json
  app.wxss
  sitemap.json
  project.config.example.json
  config/
    config.example.js
  services/
    apiClient.js
    authAdapter.js
    dreamStorage.js
    errorMessages.js
    legalDocuments.js
    productAnalyticsAdapter.js
    resultCard.js
  utils/
    dates.js
    ids.js
    safeRender.js
    validation.js
  components/
    loading-state/
    error-state/
    confirmation-modal/
    legal-document/
    result-card/
  pages/
    home/
    quick/
    result/
    journal/
    detail/
    privacy/
    profile/
```

Every page stays thin. Services handle API, storage, legal versions, auth state, and Result Card normalization. Components are simple WXML/WXSS building blocks, not a third-party UI framework.

## API Flow

`miniprogram/services/apiClient.js` sends:

```json
{
  "analysisType": "quick",
  "dreamText": "用户输入的梦境",
  "clientPlatform": "wechat_mini_program"
}
```

The request uses `wx.request`, a configurable `API_BASE_URL`, a timeout, and no Authorization header in this PR. It maps stable API errors such as `DAILY_LIMIT_REACHED`, `RATE_LIMITED`, `REQUEST_IN_PROGRESS`, `UPSTREAM_TIMEOUT`, `UPSTREAM_UNAVAILABLE`, `GENERATION_INCOMPLETE`, `FEATURE_DISABLED`, and `INVALID_REQUEST` to Simplified Chinese messages. Failed requests do not create mock results.

The current backend ignores `clientPlatform`, so no server change is required unless tests reveal stricter validation. If compatibility is needed, the only server change allowed is a minimal allowlist addition for `wechat_mini_program`; `clientPlatform` must not be used for identity or permissions.

## Guest Local Data

`dreamStorage.js` owns all keys and schema details:

```js
{
  localRecordId,
  createdAt,
  updatedAt,
  dreamText,
  sleepQuality,
  analysisType,
  reportContent,
  dreamResultCard,
  storageVersion
}
```

Storage key: `dream_anatomy_guest_records_v1`. Maximum records: 100. When storage already has 100 records, saving a new record returns a typed limit result and the UI asks the user to export or delete old records. The service never logs dream text.

## Legal Consent

Mini Program legal documents expose the same three document types and versions as Web:

- Privacy Policy
- Terms
- AI Disclaimer

Guest legal consent is stored locally with current versions. The first quick analysis requires explicit checkbox consent; default is unchecked. Version changes require re-consent. Mini Program consent is browser/device local and is never described as a cloud consent record.

## Result Card

The Mini Program uses the quick analysis response’s `dreamResultCard`; it does not call AI again. `resultCard.js` normalizes missing scores to `null` and displays `暂不可用` instead of `0`. It strips unsafe deterministic language through a conservative text helper and keeps the safety reminder. No `rich-text`, HTML rendering, image download, or WeChat sharing is included.

## Pages

- Home: brand, “记录一个梦”, recent local dreams, disabled deep guidance card marked “正在开发中”, and navigation to journal/privacy/profile.
- Quick: dream input, character count, AI disclaimer, explicit legal consent gate, submit loading state, duplicate-submit prevention, and stable error display.
- Result: quick analysis sections, Dream Result Card, save to journal, and return home.
- Journal: local records sorted by date descending, empty state, and detail navigation.
- Detail: original dream, AI analysis, Dream Result Card, delete with confirmation.
- Privacy: legal document links, export local JSON, clear local records, product analytics “稍后支持”, no Web account deletion.
- Profile: guest mode with copy that WeChat login and cross-device sync will come later.

## Security Boundary

The Mini Program must not contain `DEEPSEEK_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANALYTICS_HASH_SECRET`, WeChat `AppSecret`, `openid`, `unionid`, `session_key`, custom JWT logic, product analytics installation identifiers, or fake Authorization headers. It must not call `wx.login` or DeepSeek. It must not write product behavior events in this PR.

## Testing Strategy

Node tests cover platform-independent modules and static Mini Program source checks:

- config does not contain secrets and points to Render by default;
- `authAdapter` is guest-only;
- API request payload is correct, sends no Authorization, maps errors, and never falls back to mock;
- duplicate quick submission uses one in-flight request;
- local storage save/load/delete/clear/export behavior and 100-record limit;
- legal versions match Web and guest consent changes when versions change;
- Result Card normalization avoids fake zero scores and preserves required fields;
- WXML does not use `rich-text`;
- pages/components exist and required Chinese copy is present;
- Web tests continue to pass.

Manual validation is required in WeChat Developer Tools and on a device. This PR must not claim real-device validation unless it is actually performed.

## Documentation

Add `docs/MINIPROGRAM_SETUP.md` and `docs/MINIPROGRAM_ARCHITECTURE.md`. Update `README.md`, `docs/PROJECT_STATUS.md`, and `.gitignore` for Mini Program setup and private config boundaries.
