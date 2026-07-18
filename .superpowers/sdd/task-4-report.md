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

---

## Important Findings Re-review Fix

### RED Evidence

`npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js` reported 56 passed and 3 failed. The new account A -> B test showed A's late enabled preference changed B's disabled state to enabled. The successful quick-analysis test showed `dream_input_abandoned` was emitted after a normal textarea blur before submit.

### GREEN Evidence

After adding a preference-load generation guard and moving quick-input abandonment to the quick-view exit path, the same focused command reported 59 passed and 0 failed. The new regression coverage confirms that a late account A response cannot overwrite account B, quick analysis success emits no abandonment event, and a started quick input is abandoned only when leaving the quick flow without submitting.

---

## Final Reviewer Important Findings Fix

### RED Evidence

`npm test -- tests/productAnalyticsFrontend.test.js` reported 16 passed and 2 failed. The delayed authenticated preference-write regression showed consent remained enabled while the disable upsert was pending. The guest-to-authenticated regression showed a queued guest `app_opened` event remained queued and could flush after the authenticated preference loaded.

### GREEN Evidence

`npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js tests/authDiagnostics.test.js` reported 86 passed and 0 failed. The authenticated opt-out test confirms new events are rejected and local queue/identifiers are cleared before a delayed or failed preference write settles. The guest-to-authenticated test confirms queued guest events and guest/session identity are cleared before an authenticated preference can enable tracking.

---

## Remaining Important Findings Fix

### RED Evidence

`npm test -- tests/productAnalyticsFrontend.test.js` reported 18 passed and 2 failed. A delayed enabled-preference write for account A re-enabled account B after B had loaded a disabled preference. A guest flush that began before session resolution sent its queued guest event after account B became authenticated and enabled.

### GREEN Evidence

`npm test -- tests/productAnalyticsFrontend.test.js` reported 20 passed and 0 failed. The required regression suite, `npm test -- tests/productAnalyticsFrontend.test.js tests/dreamJournal.test.js tests/privacyData.test.js tests/authDiagnostics.test.js`, reported 88 passed and 0 failed. `node --check src/productAnalytics.js && node --check src/app.js && node --check src/auth.js && node --check src/privacyData.js` and `git diff --check` also passed.
