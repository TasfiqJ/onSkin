# Query Retry-Classification Checkpoint

Date: 2026-07-25 (America/Toronto)
Branch: `optimization`
Checkpoint parent SHA: `8d6a10a756baef94b6f392506007b6fb8e5e1c36`
Evidence class: `command`, `decision`, agent review, real TanStack lifecycle tests, and web `e2e`

This sanitized checkpoint covers the remaining local retry-classification
portion of OPT-110. It does not claim signed-native connectivity, process
restart, provider recovery, energy, latency, accessibility, or physical-device
verification.

## Problem And Result

The shared client previously retried every query twice unless a call site
overrode it. Routine order and Progress added their own retry count, while cycle
anchor, profile, photo, onboarding, and other deterministic reads had
inconsistent overrides. A deterministic encrypted-storage, schema, owner, or
privacy failure could therefore execute repeatedly before the truthful recovery
surface appeared. Queries wrapping `requestPolicy` could also multiply its
bounded inner attempts.

The client is now deny-by-default. Rejected errors remain stable across mount,
focus, and reconnect; successful stale snapshots keep ordinary lifecycle
refresh. Every reviewed exceptional behavior is explicit:

| Policy or domain              | Current behavior                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Global default                | Zero outer retries; successful stale state may refresh; rejected errors require an explicit recovery action                      |
| Deterministic encrypted/local | `networkMode: 'always'`; no automatic mount/focus/reconnect recovery; one owning manual refetch                                  |
| Date-sensitive local          | Same deterministic policy, with current-local-day focus/reconnect refresh only while state is not errored                        |
| Request-policy-owned          | Zero TanStack retries; bounded inner attempts remain exact; successful fallback may heal when stale/reconnected                  |
| RevenueCat offering           | No numeric retry of owner/config/identity fences; typed successful unavailable state retains healthy stale refresh               |
| Onboarding status             | Every non-error mount revalidates even a fresh cache; an error remount stays idle until visible Retry                            |
| Profile                       | Local unreadable/corrupt success remains stable; only server-derived or server-unavailable payload objects can lifecycle-refresh |

Sensitive query data remains unpersisted. Photo query `gcTime: 0`, owner
generation query keys, local-day query identity, account clearing, and the
existing React Native focus/online bridge remain unchanged.

## Exact Lifecycle Proof

Real TanStack `QueryClient` and `QueryObserver` tests cover:

1. A deterministic private-KV failure invokes its query function once.
2. Observer unmount/remount, focus loss/return, and offline/online transitions
   do not invoke the errored query again.
3. The owning explicit `refetch()` invokes exactly one later attempt and
   publishes recovered data.
4. A local encrypted query still executes when TanStack considers the device
   offline.
5. A request policy with two inner attempts remains two transport calls and one
   outer query call; one explicit later refetch adds exactly one successful
   transport call.
6. A successful null/offline fallback can refresh after reconnect.
7. Onboarding revalidates a fresh successful cache, preserves an errored cache
   on observer remount, and executes exactly one explicit recovery attempt.
8. Profile lifecycle classification refreshes server/unavailable-server
   payloads, but not deterministic unreadable-local payloads or errored state.

Two independent agents audited the complete query inventory and current diff.
Their findings drove the remount/focus/reconnect guards, photo and Community
reaction classifications, removal of the RevenueCat numeric retry, the
Onboarding always-unless-error policy, and hybrid Trend/Profile fallback
handling. The final inventory review reported no remaining retry-classification
gap.

## Commands And Results

| Command or review                              | Result                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Focused query/domain matrix                    | Pass, 15 files / 200 tests                                                                             |
| Independent inventory and current-diff reviews | Final review completed after all findings were incorporated                                            |
| Mobile TypeScript check                        | Pass                                                                                                   |
| Exact changed-file ESLint with zero warnings   | Pass                                                                                                   |
| `git diff --check`                             | Pass                                                                                                   |
| Full mobile Vitest run                         | 358 files / 4,277 tests pass; four known unrelated failures in two user-owned notification/Shelf areas |

The full-suite failures are the preserved dirty-worktree baseline: one
behavioral-notification snapshot and three Shelf expiry/provenance assertions.
None intersects this slice.

## Human-Simulated Expo-Web Evidence

Host: Windows development workspace
Surface: Expo web through the Codex in-app Browser
Origin: fresh `127.0.0.1`
Viewport: requested 390 x 844; observed 390 x 845
Fixture: 10 generated, non-user Progress photos
Failure injection: `EXPO_PUBLIC_E2E_PROGRESS_STORAGE_FAILURE=unavailable_once`

Actions and observations:

1. Opened `/progress`, activated the development-only local Pro trial, and
   reached the actual Progress surface.
2. Confirmed the first photo read produced the exact `Private storage` /
   `Your timeline could not open` alert. The alert stated that photos and notes
   were unchanged and exposed one accessible
   `Retry opening progress photos` action.
3. Left the error surface idle and confirmed it remained mounted rather than
   silently publishing Timeline content.
4. Activated Retry once.
5. Confirmed the complete Progress comparison surface returned in place with
   `9 weeks · 10 photos · all on this phone`, Compare, Timeline, both date
   controls, and the comparison slider.
6. Document client and scroll widths were both 390 after recovery. There was no
   horizontal overflow and no JavaScript dialog.
7. Browser diagnostics contained no errors. The only three warnings were the
   expected development placeholders for Supabase URL/key and unsupported web
   push-token listening.

## Verification Boundary

OPT-110 remains `implemented`, not `verified`. Required remaining proof includes
signed supported-iOS background/foreground behavior, airplane mode,
offline/online flapping, VPN and captive-portal transitions, process restart,
provider recovery, query-count traces, accessibility, energy/latency impact,
and physical-device evidence. Web and Node lifecycle proof cannot substitute
for those native gates.
