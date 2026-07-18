# Task 4 Report: Product Behavior Instrumentation

## Status

DONE

## RED Evidence

Command run:

```sh
npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js
```

Initial result: 66 passed, 1 failed.

The failing behavior test is `tracks export, deletion, and clearing only after each data action succeeds` in `tests/privacyData.test.js`. It expected `data_export_completed`, `dream_deleted`, and `all_dreams_cleared` after successful privacy data actions, but received no events. The failure is caused by missing instrumentation.

After the approved scope update, additional RED tests covered frontend behavior and explicit auth conversion. The focused test command initially reported 75 passed, 4 failed due to missing instrumentation.

## GREEN Evidence

Commands run:

```sh
npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js tests/authDiagnostics.test.js
node --check src/app.js && node --check src/auth.js && node --check src/privacyData.js && node --check src/productAnalytics.js
git diff --check
```

Result: 79 tests passed; all four syntax checks and `git diff --check` passed.

## Commit

`583a1d8661ea4b308b37fb304e267354d8394b4a` (`Track opt-in product behavior events`)

## Changed Files

- `tests/privacyData.test.js` (new failing behavior test)
- `tests/dreamJournal.test.js` (frontend behavior coverage)
- `tests/productAnalyticsFrontend.test.js` (explicit auth conversion coverage)
- `src/app.js` (opt-in product behavior instrumentation)
- `src/auth.js` (explicit auth conversion instrumentation)
- `src/privacyData.js` (success-only privacy action instrumentation)
- `.superpowers/sdd/task-4-report.md`

## Concern

The scope update explicitly authorized the narrowly scoped `src/privacyData.js` changes required for successful action events. No remaining concerns.

---

## Reviewer Fix: Behavior Wiring

- Exposed the app-created product analytics controller for explicit auth conversion tracking.
- Deferred once-per-session `app_opened` until authenticated analytics preference loading completes.
- Added real-factory integration coverage for auth conversion events and delayed authenticated opt-in startup.

Verification: 81 focused Task 4 tests passed, all required syntax checks passed, and `git diff --check` passed.

---

## Reviewer Re-review Fix: Session-Aware Tracking

### RED Evidence

`npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js tests/authDiagnostics.test.js` reported 79 passed and 3 failed: the deployed controller omitted the Bearer token, authenticated startup inherited guest consent, and `login_completed` was dropped before the remote preference resolved.

### GREEN Evidence

The same focused command reported 82 passed. The deployed-controller test now verifies the Bearer header and validates the emitted payload with the server product-event batch normalizer. Required syntax checks and `git diff --check` also passed.
