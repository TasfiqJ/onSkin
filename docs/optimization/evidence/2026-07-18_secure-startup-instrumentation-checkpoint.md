# Secure Startup Instrumentation Checkpoint

Date: 2026-07-18 (America/Toronto)

Branch: `optimization`

Checkpoint parent: `878e145224197cee0a4fafb20d43484edf9a5d8d`

Items: `PERF-P0-009`, `OPT-107`, and the startup extension to `OPT-208`

## Outcome

The current secure-bootstrap path now exposes every locally observable boundary
as a fixed, content-free monotonic milestone. The implementation adds no upload,
does not weaken or reorder an authorization gate, and does not claim that the
unapproved mounted-shield or startup-parallelization design in `OPT-DEC-004` is
accepted.

`OPT-107` is locally implemented. `PERF-P0-009` remains `investigating` because
the plan still requires repeated signed supported-iOS distributions and any
future gate-concurrency or shield/remount work remains decision-gated.

## Fixed Milestones

The bounded in-memory contract contains 13 sole-owner phases:

1. JavaScript started.
2. Root render started.
3. Font decision complete.
4. Authentication hydration complete.
5. Account-generation decision complete.
6. Plaintext recovery complete.
7. App-lock decision complete.
8. Vault decision complete.
9. Navigation ready.
10. First meaningful route content.
11. First route pointer/touch observed.
12. First critical data ready.
13. Startup reconciliation complete.

The explicit plaintext-recovery phase is an additional safety boundary beyond
the plan's twelve named timings. App Lock and vault owners record their decision
before publishing the state that can reveal nested children. Navigation remains
inside `SessionBoundaryGate`, `PlaintextStagingStartupGate`, `AppLockProvider`,
and `PrivateDataAvailabilityGate`. Reconciliation records only after its first
flush and invalidations succeed for the current owner scope.

## Secure-State Contract

`docs/optimization/SECURE_STARTUP_TRUTH_TABLE.md` records all 11 required plan
states: fresh install; returning user; the 200-Shelf/long-history/50-photo stress
class; App Lock; photo lock; signed-out retained owner; same-user refresh;
account A to B; missing/malformed/future/unavailable keys or records; offline;
and low storage or memory.

The executable audit fails closed when a phase is dynamic or misplaced,
navigation escapes any secure gate, a decision marker can publish after its gate
reveals children, a required state disappears, or the no-relaxation boundary is
removed. Its accepted report is:

```json
{
  "status": "pass",
  "startupPhasesAudited": 13,
  "runtimeMarkerCallsAudited": 13,
  "secureGatesAudited": 4,
  "navigationInsideAllSecureGates": true,
  "scenariosAudited": 11,
  "localDiagnosticsSchemaVersion": 2,
  "authorizationGateChanges": 0,
  "telemetryUploadsAdded": 0
}
```

## Content-Free Diagnostics

The development/staging-only diagnostics schema advances from v1 to v2 with one
canonical startup-phase list. The adapter accepts only the fixed phase enum,
deduplicates first values, rejects non-finite/negative values, bounds elapsed
milliseconds, and returns phases in contract order. It exposes no event payload,
route, account, query, product, photo, token, error, free text, or identifier.

## Human-Simulated E2E

The actual Expo web app was opened directly at `/settings/diagnostics` in the
Codex in-app browser with a 390 x 844 viewport. The visible development screen
rendered `fixed schema v2` and the `STARTUP MILESTONES` card. The initial DOM
snapshot contained JavaScript, root, font, authentication, account-generation,
plaintext, App Lock, vault, navigation, and first-content milestones. After the
route was admitted, reconciliation also appeared.

The first pointer refresh exposed that a desktop pointer did not trigger the
touch-only interaction observer. The shared `Screen` now routes both pointer and
touch input through one idempotent literal marker. The same surface was rerun;
the card displayed `first route interaction observed`, Refresh remained usable,
and browser error logs were empty. The review also moved App Lock and vault
decision markers ahead of their reveal-state setters so a child navigation
effect cannot timestamp itself before a parent decision.

Evidence:

- `test-results/human-e2e/2026-07-18/secure-startup-diagnostics-current/secure-startup-diagnostics-390x844.png`
- `docs/e2e-bug-reports/2026-07-18-secure-startup-pointer-observation.md`

The direct diagnostics route intentionally does not own the index route's
`first_critical_data_ready` decision; its ownership is covered by the exact
source contract and must be sampled in the native state matrix.

## Deterministic Verification

```text
node scripts/optimization/secure-startup-audit.mjs --json
PASS: 13 phases, 13 sole-owner calls, 4 gates, 11 states, schema v2,
      zero authorization changes, zero uploads

node scripts/optimization/secure-startup-audit-smoke.mjs
PASS: baseline plus five fail-closed drift mutations

npm.cmd --workspace apps/mobile test -- [focused startup matrix]
6 files / 18 tests PASS

npm.cmd test
330 files / 3,972 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

Expo web development bundling completed successfully. The expected placeholder
Supabase configuration warnings remained non-blocking; the diagnostics browser
tab itself recorded no error logs.

## Remaining Proof

- Repeated cold, warm, and resumed signed supported-iOS distributions.
- Empty, median, stress, locked, offline, vault-failure, low-storage, and
  low-memory samples with content-free device/build context.
- Approved absolute/regression thresholds and an independent signoff owner.
- Any mounted-shield, remount, gate-parallelization, or gate-order proposal after
  the authoritative OPT-DEC-004 architecture/privacy decision.

No native latency, frame, memory, threshold, or authorization claim is inferred
from Expo web or deterministic source tests.
