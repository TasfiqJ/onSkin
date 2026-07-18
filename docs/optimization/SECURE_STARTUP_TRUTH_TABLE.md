# Secure Startup Truth Table

Status: current-behavior contract; no authorization gate is relaxed or reordered.

Date: 2026-07-18 (America/Toronto)

## Fixed Gate Order

The locally enforced route-admission sequence is:

1. JavaScript/root and the synchronous embedded-font decision start.
2. Supabase session hydration settles.
3. Account-generation ownership/isolation completes.
4. Owner-bound photo mutation recovery completes before plaintext scavenging.
5. The app-lock preference resolves and any required native authentication succeeds.
6. App-owned private storage is exhaustively verified as readable.
7. The route tree and navigation observer mount.
8. Route-owned critical data decides the first usable surface.
9. Offline reconciliation runs after route admission and never gates private UI.

`SessionBoundaryGate`, `PlaintextStagingStartupGate`, `AppLockProvider`, and
`PrivateDataAvailabilityGate` remain nested in that order. The navigation
observer and route tree remain inside all four gates. Deferred reconciliation
cannot authorize or reveal content.

## Required State Matrix

| Startup state | Account/session boundary | Plaintext and private storage | Lock decision | Route admission and recovery |
| --- | --- | --- | --- | --- |
| Fresh install | Hydration settles with no prior authenticated owner; no owner handoff is inferred. | Empty known namespace is verified; recovery/scavenging may prove no work. | Missing preference follows its typed default; no unreadable value is rewritten. | Welcome/onboarding decision owns first critical data. |
| Returning onboarded user | Same owner generation is retained after hydration. | Owner-bound mutation recovery precedes plaintext scavenging; exhaustive private verification completes before mount. | Lock-off admits the vault only after the preference read. | Onboarding status redirects to Today; Today owns its plan/completion recovery UI. |
| 200 Shelf rows, long history, 50-photo metadata | Same as returning owner; volume does not change authority. | Exhaustive verification remains fail-closed; this checkpoint instruments cost but does not replace the scan. | Unchanged. | Route waits for its typed queries; native distribution measurement remains required. |
| App lock enabled | Session and owner settle first. | Plaintext recovery completes before the lock provider mounts; vault verification waits for unlock. | Native authentication must succeed; cancellation remains locked. | No route tree mounts before unlock and vault verification. |
| Photo lock enabled | Global startup authority is unchanged. | Global vault admission still completes first. | App lock remains independent from the later Progress photo-timeline lock. | Progress owns the additional photo lock after route admission. |
| Signed out with retained owner marker | Hydration and owner-marker reconciliation run before accepting a next owner. | Prior-owner recovery/cleanup must drain or the boundary stays unavailable. | No prior owner's preference can unlock a next owner. | Route admission is blocked until ownership is coherent. |
| Same-user token refresh | The current account generation remains valid. | No destructive cross-owner cleanup is started. | Existing valid same-owner work is not cancelled solely for token refresh. | Route authority remains with the same owner generation. |
| Account A to B | A operations are invalidated/drained and cleanup is verified before B is claimed. | A ciphertext is never translated into B empty/default state. | A prompt/result cannot publish over B. | Session boundary exposes only its fail-closed recovery surface until complete. |
| Missing, malformed, future, or unavailable keys/records | Owner identity remains captured; no replacement owner is invented. | Bytes are preserved; unreadable is not converted to empty and reads do not rotate/create keys. | Unreadable lock preference fails closed according to its typed recovery contract. | Private-data recovery UI is shown; route content remains unmounted or hidden. |
| Offline | Local hydration/owner/private gates still run; unavailable remote mirrors do not grant authority. | Local encrypted state remains usable only when verified. | Native/local lock policy is unchanged. | Local-first route state may render; deferred server reconciliation can remain incomplete. |
| Low storage or low memory | No authority shortcut is allowed. | Preparation failure keeps the app closed; memory warning purges sensitive decoded state. | Lock behavior is unchanged. | Recovery is explicit. Physical-device storage/memory proof remains open. |

## Content-Free Milestone Ownership

| Milestone | Sole owner and meaning |
| --- | --- |
| `javascript_started` / `root_render_started` / `font_decision_complete` | Root layout; process/root start and the non-blocking embedded-font decision. |
| `authentication_hydration_complete` / `account_generation_complete` | Session boundary after AuthProvider reports no boundary error. |
| `plaintext_recovery_complete` | Plaintext staging gate only after owner-bound recovery and scavenging succeed. |
| `app_lock_decision_complete` | App-lock provider after the typed preference resolves. |
| `vault_decision_complete` | Private-data gate only after unlocked storage verification succeeds. |
| `navigation_ready` | Root navigation observer mounted inside every secure gate and holding a real navigation state key. |
| `first_meaningful_content` | Shared route `Screen` after a secure route-owned surface commits, including explicit loading/recovery states. |
| `first_route_interaction_observed` | Shared route `Screen` on the first pointer or touch reaching an admitted route surface. It is an interaction observation, not proof that an arbitrary business mutation succeeded. |
| `first_critical_data_ready` | Welcome/returning-user decision after onboarding status leaves `checking`. |
| `startup_reconciliation_complete` | Offline reconciler only after its first owner-current completion flush and required invalidations resolve. |

Every marker is a fixed enum plus monotonic elapsed milliseconds. Markers retain
no route, account, query, product, photo, health, token, error, or free-text
value, remain bounded in memory, and are not uploaded. The development/staging-
only local diagnostics schema v2 exposes the allowlisted phase and elapsed
milliseconds for on-device inspection; unknown, duplicate, negative, and
unbounded values are rejected, deduplicated, or bounded before display.

## Deliberate Non-Changes

- This checkpoint does not parallelize, skip, cache, or reorder authorization work.
- It does not replace exhaustive private verification with a manifest.
- It does not let notification, offline, offering, or analytics work gate route admission.
- It does not approve the mounted privacy-shield redesign in OPT-DEC-004.
- It does not claim signed-device startup distributions, thresholds, or low-memory proof.

Run the read-only contract audit with:

```text
node scripts/optimization/secure-startup-audit.mjs
```
