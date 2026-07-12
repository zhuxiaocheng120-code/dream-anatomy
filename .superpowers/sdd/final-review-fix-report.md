# Dream Home PR #4.1 Final Review Fix Report

Date: 2026-07-12
Branch: `codex/dream-home`
Commit subject: `Fix Dream Home final review findings`

## Scope

This fix addresses every locally actionable final-review finding without changing DeepSeek, `dreamSync.js`, schema, migrations, server, prompts, or authentication flows outside `handleLogout`.

## RED Evidence

The preserved initial focused run was:

```text
node --test tests/dreamHome.test.js tests/authDiagnostics.test.js tests/dreamQuotes.test.js
34 tests: 27 passed, 7 failed
```

The seven expected failures demonstrated:

1. logout did not publish a null session before deferred `signOut` settled;
2. rejected `signOut` did not recover from authoritative `getSession`;
3. streak rendered `2` rather than `2 Nights`;
4. a recent Dream Home click did not pass its raw row;
5. cloud/local identifier clicks did not pass their raw rows;
6. the actual app detail bridge could not render a cloud-only row; and
7. required copy, semantic mobile order, and desktop grid areas were absent.

The explicit singular test was then run independently:

```text
node --test --test-name-pattern='formats a one-night streak' tests/dreamHome.test.js
1 test: 0 passed, 1 failed
TypeError: DreamHome.formatDreamStreak is not a function
```

The new stale-success-after-logout, stale-error-after-logout, and exact quote tuple tests passed at baseline because they lock already-correct behavior and approved data rather than reproduce production defects.

## Changes

- `src/dreamHome.js`: passes `local_record_id || localRecordId || id` and the raw record to the existing detail bridge; formats streaks as `N Night` or `N Nights`.
- `src/app.js`: accepts an optional detail fallback row, uses visible journal records first, and normalizes a raw cloud fallback with `DreamSync.mapSupabaseRowToLocalRecord` when available.
- `src/auth.js`: changes only `handleLogout`; it publishes signed-out UI/session state synchronously, then safely restores only the authoritative `getSession` result after a failed sign-out.
- `src/index.html`: adds the exact welcome line, explicit important-dream explanation, streak support copy, and semantic quick-actions-before-recent order.
- `src/style.css`: preserves recent dreams on the desktop left through grid areas while mobile follows semantic quick-actions-first order.
- `tests/dreamHome.test.js`: covers raw bridge fallback, differing cloud/local IDs, both logout stale-request outcomes, streak labels, copy, and responsive order.
- `tests/authDiagnostics.test.js`: covers deferred and rejected logout behavior.
- `tests/dreamQuotes.test.js`: locks all ten approved text/author/source tuples exactly.

## GREEN Evidence

Focused tests after implementation:

```text
node --test tests/dreamHome.test.js tests/authDiagnostics.test.js tests/dreamQuotes.test.js
35 tests: 35 passed, 0 failed
```

Syntax checks passed for `src/dreamHome.js`, `src/app.js`, `src/auth.js`, `src/dreamQuotes.js`, and all three focused test files.

Full suite:

```text
npm test
40 tests: 40 passed, 0 failed
```

`git diff --check` passed. The final protected-file scan found only the eight allowed source/test files plus this explicitly requested report.

## Self-Review

- Existing one-argument `openDreamDetail(recordId)` calls remain valid.
- The fallback does not create a second detail page and is normalized only when the visible journal cannot supply the record.
- Dream Home still renders user-derived data with `textContent`.
- No full error, session, token, dream text, or key logging was added.
- Login, registration, verification, password reset, and recovery behavior were not changed.
- Stale success and stale error responses cannot repopulate Dream Home after logout.
- Mobile keyboard and visual order are both quick actions then recent dreams; desktop remains recent-left and actions-right.
- No protected implementation files or out-of-scope features were changed.

## Concerns

No live Supabase account, RLS, or browser-account evidence is claimed. Those checks still require configured external accounts. Automated coverage verifies the local client bridge, logout timing/recovery, record isolation behavior, and responsive source contract.

## Commit

The focused commit containing this report uses subject `Fix Dream Home final review findings`; its exact hash is returned with the completion status.
