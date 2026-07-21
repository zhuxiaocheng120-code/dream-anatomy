# Legal Documents And Readable Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish public beta legal documents and add a readable dream archive HTML export while preserving existing product logic.

**Architecture:** Keep legal text in `src/legalDocuments.js`, privacy-center behavior in `src/privacyData.js`, and public runtime configuration in `scripts/writeRuntimeEnv.js`. Add a tiny additive Supabase migration for cross-border consent fields. Export is generated client-side with escaped HTML and no scripts or remote resources.

**Tech Stack:** Plain JavaScript UMD browser modules, Node `node:test`, Supabase SQL migration, existing SPA controller patterns.

## Global Constraints

- Legal document versions and effective dates must be `2026-07-21`.
- Operator defaults must be `朱校成`, `个人运营者`, and `zhuxiaocheng120@gmail.com`.
- Render region copy must say `美国俄勒冈州（Oregon, US West）`.
- Supabase region copy must say `印度孟买（South Asia / Mumbai，ap-south-1）`.
- DeepSeek is the current AI service provider; do not invent filing or registration numbers.
- Do not modify AI prompts, parsing quality logic, payment, membership, deep guidance, Web/WeChat account binding, mini program cloud sync, ads, or default product analytics consent.
- Do not expose server secrets in browser runtime config.
- Do not use `innerHTML` for interactive UI rendering or unescaped user/AI content.

---

## File Structure

- Modify `src/legalDocuments.js`: versions, public operator helpers, full document content, cross-border version, acceptance check.
- Modify `src/privacyData.js`: legal confirmation card, dual consent checkboxes, HTML export, JSON backup export, analytics copy.
- Modify `scripts/writeRuntimeEnv.js`: public operator/model display fields only.
- Modify `.env.example`: public display env keys.
- Create `supabase/migrations/20260721000000_add_cross_border_legal_consent.sql`: additive legal consent fields.
- Modify `tests/legalDocuments.test.js`: public beta legal copy and forbidden-claim tests.
- Modify `tests/privacyData.test.js`: dual consent, HTML export, JSON backup, analytics copy.
- Modify `tests/supabaseSecurity.test.js`: runtime config and cross-border migration checks.
- Create/update docs: `docs/LEGAL_AND_PRIVACY_SETUP.md`, `docs/DATA_EXPORT.md`, `README.md`, `docs/PROJECT_STATUS.md`, `docs/PRIVACY_DATA_CONTROLS_SETUP.md`.

## Task 1: Public Legal Document Contract

**Files:**
- Modify: `tests/legalDocuments.test.js`
- Modify: `src/legalDocuments.js`

**Interfaces:**
- `getLegalVersions()` returns `{ privacyPolicyVersion, termsVersion, aiDisclaimerVersion, crossBorderConsentVersion, productAnalyticsVersion }`.
- `getLegalDocument(type, runtimeEnv)` returns `{ type, title, version, effectiveDate, note, sections }`.
- `hasAcceptedVersions(consentRow)` returns true only when all four required versions match.

- [ ] Write failing tests asserting the three legal docs use version `2026-07-21`, display operator/contact/provider information, include cross-border/minors/DeepSeek sections, avoid stale beta-review copy, avoid absolute liability, and include the legally required carve-out.
- [ ] Run `npm test -- tests/legalDocuments.test.js` and confirm RED.
- [ ] Update `src/legalDocuments.js` with the full public beta legal documents and helper defaults.
- [ ] Run `npm test -- tests/legalDocuments.test.js` and confirm GREEN.

## Task 2: Cross-Border Consent Storage And Runtime Public Config

**Files:**
- Create: `supabase/migrations/20260721000000_add_cross_border_legal_consent.sql`
- Modify: `scripts/writeRuntimeEnv.js`
- Modify: `.env.example`
- Modify: `tests/supabaseSecurity.test.js`

**Interfaces:**
- Migration adds `cross_border_consent_version text` and `cross_border_accepted_at timestamptz`.
- Runtime config exposes only public display keys.

- [ ] Write failing tests asserting the new migration exists and adds cross-border columns without weakening RLS, and runtime config exposes only public operator/model keys.
- [ ] Run `npm test -- tests/supabaseSecurity.test.js` and confirm RED.
- [ ] Add the migration and public runtime/env example fields.
- [ ] Run `npm test -- tests/supabaseSecurity.test.js` and confirm GREEN.

## Task 3: Privacy Center Consent UI And Guest Consent

**Files:**
- Modify: `tests/privacyData.test.js`
- Modify: `src/privacyData.js`

**Interfaces:**
- `acceptCurrentLegalVersions()` upserts legal and cross-border versions/timestamps.
- `ensureGuestAiConsent()` requires both general and cross-border confirmation.
- `validateRegistrationConsent()` requires both registration checkboxes when present.

- [ ] Write failing tests for default-unchecked general and cross-border consent, blocked save when either is missing, accepted status/time rendering, stale version detection, guest local versions, and account switch isolation.
- [ ] Run `npm test -- tests/privacyData.test.js` and confirm RED.
- [ ] Update `src/privacyData.js` render and consent logic.
- [ ] Run `npm test -- tests/privacyData.test.js` and confirm GREEN.

## Task 4: Readable HTML Archive Export And JSON Backup

**Files:**
- Modify: `tests/privacyData.test.js`
- Modify: `src/privacyData.js`

**Interfaces:**
- `exportReadableArchive()` downloads `dream-anatomy-archive-YYYY-MM-DD.html`.
- `exportData()` remains JSON export and downloads `dream-anatomy-export-YYYY-MM-DD.json`.
- HTML escaping function is internal and used for every user/AI field.

- [ ] Write failing tests for `.html` filename, no script tags, no remote resources, escaped user content, dream text/card/reflection/sleep feeling inclusion, secret exclusion, empty export support, and long text safety.
- [ ] Write failing tests that JSON export is labeled as `导出原始数据备份（JSON）` and still excludes sensitive data.
- [ ] Run `npm test -- tests/privacyData.test.js` and confirm RED.
- [ ] Implement readable HTML export and keep JSON backup as secondary action.
- [ ] Run `npm test -- tests/privacyData.test.js` and confirm GREEN.

## Task 5: Anonymous Statistics Copy And Documentation

**Files:**
- Modify: `tests/privacyData.test.js`
- Modify: `src/privacyData.js`
- Create: `docs/LEGAL_AND_PRIVACY_SETUP.md`
- Create: `docs/DATA_EXPORT.md`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/PRIVACY_DATA_CONTROLS_SETUP.md`

**Interfaces:**
- Privacy center displays `匿名使用统计（可选）`.
- Delete analytics action is inside `管理匿名统计数据`.

- [ ] Write failing tests for new analytics copy, default-off behavior, and required documentation phrases.
- [ ] Run targeted docs/privacy tests and confirm RED.
- [ ] Update privacy center copy and docs.
- [ ] Run targeted docs/privacy tests and confirm GREEN.

## Task 6: Regression, Review, Commit, PR

**Files:**
- All modified files.

- [ ] Run `node --check src/legalDocuments.js`.
- [ ] Run `node --check src/privacyData.js`.
- [ ] Run `node --check scripts/writeRuntimeEnv.js`.
- [ ] Run `git diff --check`.
- [ ] Run `npm test`.
- [ ] Request final code review; fix only Critical or Important findings.
- [ ] Commit with `git commit -m "Publish legal documents and readable data export"`.
- [ ] Push `codex/legal-documents-and-readable-export`.
- [ ] Create PR titled `Publish Legal Documents and Readable Dream Export`.

## Self-Review

- Spec coverage: legal documents, operator/contact, cross-border consent, readable export, JSON backup, analytics copy, docs, runtime public config, and migration are covered.
- Placeholder scan: no task contains `TBD`, `TODO`, or unspecified implementation placeholders.
- Type consistency: function names and version field names are consistent across tasks.
- Scope check: the plan stays within legal/data export and does not touch AI prompt, parser, payment, deep guidance, account binding, mini program sync, or product analytics behavior.

