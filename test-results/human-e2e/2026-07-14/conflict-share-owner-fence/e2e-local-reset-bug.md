# E2E Bug Report: local reset bypasses account-isolation cleanup

Severity: Medium
Surface: Expo web
Environment: Local Expo development server with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`
Feature: Dev-only `/?e2eReset=local` fixture
Date: 2026-07-14
Tester: Codex

## Reproduction Steps

1. Populate private local state on the Expo web origin.
2. Open `/?e2eReset=local`.
3. Attempt to use the origin again after the fixture returns to `/`.

## Expected Result

The fixture clears private records, their content key, plaintext staging, sensitive image memory, and query state inside the authorized account-isolation boundary.

## Actual Result

The route called `clearLocalPrivateData` directly. Private record removal rejected without an active private-KV account boundary, while key deletion could still succeed, leaving fail-closed orphan ciphertext on the populated origin.

The first repair draft exposed two additional risks: it caught cleanup failure and redirected anyway, and it ran outside AuthProvider's serialized session boundary. A successful clear also removed the owner claim without reclaiming the still-current authenticated owner, which could leave new local data unclaimed.

## Evidence

- E2E report: `test-results/human-e2e/2026-07-14/conflict-share-owner-fence/report.md`
- Source inspection: the launch route directly imported and called `clearLocalPrivateData` instead of `clearAccountIsolatedState`.

## Frequency

- Always on a populated origin when the protected private-record removal path is reached.

## Scope

- Affected route/screen: `/` with `?e2eReset=local`
- Affected account or fixture: dev-only local-reset fixture
- External service involved: None
- Destructive action involved: Yes, local private-state deletion

## Suspected Cause

The reset route bypassed the account-isolation coordinator, including its durable cleanup marker, producer drains, query cancellation, and private-KV authorization boundary. Route-owned cleanup also had no authority to fence concurrent auth refresh/session publication or reclaim the exact session owner after destructive cleanup.

## Minimal Fix Recommendation

Delegate to a dev-only AuthProvider single-flight operation. Queue it through the existing session boundary, keep `SessionBoundaryGate` locked on failure, retry there, reclaim the exact latest owner after cleanup (or remain explicitly signed out), and redirect only after successful session publication.

## Verification Flow After Fix

1. Run the onboarding route contract and account-isolation tests.
2. Open the fixture on a populated origin.
3. Confirm it returns to `/` and new private writes/readbacks work without orphan-ciphertext errors.

## Post-Fix Evidence

- Automated tests: focused reset, serialized-boundary, route, isolation, and RevenueCat-prepublication contracts passed (6 files, 45 tests).
- Static checks: mobile typecheck and scoped ESLint passed.
- Independent code re-review: clean; no remaining P0/P1 findings after 9 focused files / 70 tests, mobile typecheck, scoped ESLint, and diff checks passed.
- Human-simulated populated-origin rerun: blocked on 2026-07-15 because the required in-app Browser runtime reported no available backend (`agent.browsers.list()` returned `[]`). No unsupported runner was substituted and no E2E proof is claimed.

## Remaining Risk

- Untested branches: native-device reset with active native producers
- Missing fixtures: None
- Follow-up needed: rerun the populated-origin Expo web reset flow when the in-app Browser backend is available
