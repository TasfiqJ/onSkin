# E2E Bug Report: Account transitions retained prior private query data

Severity: Critical
Surface: Mixed
Environment: Source audit, deterministic Vitest adapters, and Expo web fixture
Feature: Authentication, sign-out, account switching, and local private data
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Populate account A Shelf, skin profile, routine, completion, entitlement, and Progress queries.
2. Sign out or let Supabase replace account A with account B.
3. Observe the mounted route and account-agnostic TanStack Query cache while persisted private records are cleared.

## Expected Result

All data-bearing routes unmount before cleanup. Account A queries and in-flight private writes cannot survive the boundary, account B is not published until cleanup succeeds, and a cleanup failure remains behind a retryable neutral gate.

## Actual Result

Before the fix, `AuthProvider` cleared registered persisted records but never cancelled or cleared TanStack Query. The current route stayed mounted, query keys were not user-scoped, sign-out did not reset navigation, and no durable owner marker could detect a cold-start A-to-B mismatch. Account A Shelf, profile, routine, entitlement, or photo metadata could therefore remain in memory after the session changed.

## Evidence

- Screenshot: `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`
- Video: Not captured.
- Trace: Headless Chrome CDP snapshots and console/network logs in the evidence folder.
- Logs: Focused account-boundary, private-KV, encrypted-photo, cleanup, and Settings tests.
- UI snapshot: Cleanup failure, retry transition, signed-out Welcome, direct Shelf, and direct Today states.
- Terminal transcript: This Codex task.

## Frequency

- Always for already-cached query data under the prior implementation; visibility depended on the mounted route and render timing.

## Scope

- Affected route/screen: Any route backed by account-agnostic private queries, including Shelf, Today/routine, Progress, profile, and entitlement surfaces.
- Affected account or fixture: Sign-out, a signed-out cold start retaining owner metadata, A-to-B switching, cold-start owner mismatch, or any failed restore/cleanup path.
- External service involved: Supabase Auth; the memory leak itself was local.
- Destructive action involved: Sign-out/account switch cleanup.

## Suspected Cause

The session boundary treated persisted storage cleanup as the complete account boundary. It did not gate the route tree, clear in-memory query state, drain account-scoped writes, retain a local owner fingerprint, or provide failure recovery before publishing the next session.

## Minimal Fix Recommendation

Gate the full data-bearing tree during account changes; store only a domain-separated hash of the owning Supabase user ID; persist a separate cleanup-required control until every store succeeds; remove persisted auth on explicit sign-out; cancel and clear TanStack Query before and after persisted cleanup; block and drain private-record/photo reads and mutations; keep failed restore or cleanup retryable without publishing the next session; route account deletion through this one boundary; reset navigation only after success.

## Verification Flow After Fix

1. Prove same-user refresh and anonymous same-user upgrade do not clear data.
2. Prove sign-out, a signed-out cold start retaining owner metadata, A-to-B, and cold-start owner mismatch do clear data and query memory.
3. Delay private-record/photo reads, writes, removals, and marker writes across the boundary and verify cleanup waits or rejects them.
4. Force partial cleanup after the owner hash is removed and verify the durable control requires a full retry behind the recovery gate.
5. Retry, then open direct Shelf and Today routes and verify no account A names or state remain.

## Post-Fix Evidence

- Focused automated tests: 12 files / 100 tests passed across owner and durable cleanup markers, partial retry, boundary decisions, serialized route/provider contracts, persisted-auth removal, Welcome fallback, private-KV/photo operation draining, strict cleanup, RevenueCat reset, and root-owned account deletion.
- Full mobile verification: typecheck and lint passed; 183 files / 1881 tests passed.
- Human-simulated E2E: the maintained 360 x 640 run passed with a forced first cleanup failure, 56 px retry, neutral transition, signed-out Welcome, and direct empty Shelf/Today states containing none of account A's three product names. Evidence is in `test-results/human-e2e/2026-07-10/onboarding-account-isolation-current/`.

## Remaining Risk

- Live Supabase sign-out, token-expiry, cold-start mismatch, and A-to-B transitions require configured staging proof.
- Native iOS/Android backgrounding and secure-storage timing require physical-device QA.
