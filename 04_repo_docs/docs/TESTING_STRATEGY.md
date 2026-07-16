# Testing Strategy

## Principles

- Test safety-relevant logic with deterministic fixtures.
- Test launch gates so unreviewed features cannot leak into production.
- UI-facing work requires human-simulated E2E evidence.
- Device-dependent launch features require physical iPhone QA before public
  claims. Android checks are source-health/resilience work, not release evidence.
- Every Phase 2-11 validator and evidence builder reads the iOS all-features
  contract at `docs/hugeToDo/launch-contract.json`.
- Device and viewport support floors are defined in
  `docs/DEVICE_SUPPORT_POLICY.md`.

## Unit Tests

Required for:

- ingredient parsing
- tag normalization
- conflict rules and severity modulation
- PAO/expiry badges
- routine generation
- check-off persistence
- independent RevenueCat/no-card entitlement projection and reconciliation helpers
- durable store-transaction admission and recovery journal
- exact-session remote admission, controlled refresh, and synchronous closure
- privacy/consent logic
- Apple native state/nonce generation and echo, ID-token/capture composite
  admission, exact one-use authorization-code routing, lifecycle response
  bounds, and credential-state fail-closed behavior
- Apple JWS/JWKS verification, event replay/staleness ordering, encrypted vault
  AAD/key-version behavior, daily validation classification, worker secret
  authentication, and account-access coverage
- Apple terminal-event races: no-lifecycle exact Auth-identity closure,
  pre-identity keyed `unknown_subject` capture reconciliation before code
  dispatch, audience/HMAC/version mismatch rejection, no raw-subject storage,
  and duplicate promotion treated as opportunistic rather than required
- claim-safety copy scans

Example commands:

```bash
npm test
npm --workspace apps/mobile run test
```

## Integration Tests

Required for:

- shelf add -> conflict detection
- shelf add -> routine builder
- routine check-off -> progress/adherence
- RevenueCat webhook -> ordered `entitlements` projection
- subscription grant -> independent `reverse_trial_grants` lane
- bounded authenticated RevenueCat reconciliation using provider `request_date`
- owner-derived no-argument entitlement projection RPC -> combined client evidence
- purchase/restore -> durable transaction journal -> confirmed promotion or blocked retry
- Supabase RLS owner isolation
- account deletion/export, including delayed export versus sign-out/A-to-B,
  exact server owner, post-write invalidation, same-user refresh, central remote-admission
  closure, RevenueCat drain, and durable deletion handoff
- Apple capture -> encrypted lifecycle -> daily validation -> access fence;
  native/server-event invalidation -> session denial -> durable deletion
- catalog lookup/search/report

## 2026-07-15 Source Checkpoint

The prior fully verified source checkpoint passes:

- PostgreSQL 15 and 17 account-publication and entitlement-authority rehearsals.
- The combined database run completed two clean local Supabase resets across all 53
  migrations through `20260715000054_health_consent_withdrawal_lifecycle.sql`, plus 261
  pgTAP assertions (46 schema + 215 health-consent lifecycle), 77/77 public tables with RLS,
  an exact 54-private-table classification (40 directly queryable + 14 sealed), database lint,
  and an empty shadow diff.
- Subscription reconciliation 20/20, subscription grants 8/8, atomic RevenueCat webhook
  20/20, durable account deletion 215/215, and the focused mobile server contract 2/2.
- Health-consent Phase 9 verification: 104 Deno tests plus 7 evidence tests.
- Mobile workspace verification: 266 test files / 3,026 tests, typecheck, and lint.

These results prove the prior source contracts only. They do not close hosted migration/Cron/Vault,
live Supabase or RevenueCat, App Store sandbox/TestFlight, provider interruption and
recreation, physical-iPhone, professional-review, privacy/legal, or App Review gates.

The subsequent migration-0055 source candidate implements initial Apple
authorization-code plus state/nonce capture, owner/subject/client-bound
encrypted token storage, daily refresh-token validation, canonical signed
server-notification ingress, native invalidation, and an authoritative exact-session
access fence. Focused tests cover the mobile permit/capture contract, Apple network and
worker classifications, signed-event verification/idempotency, encrypted keyrings,
database lifecycle/RLS behavior, authenticated Edge coverage, account-deletion vault
reuse, and the 60-second export URL bound. Apple `TRANSFERRED` remains a tested
fail-closed `credential_transferred` result, not an approved transfer policy.

The current post-0055 local gate passed two clean resets, exact 54-migration
history, the full structural pgTAP suite plus 114/114 Apple lifecycle
assertions, schema lint, an empty migration shadow diff, temporary type
generation, 20/20 focused Apple event/lifecycle Edge tests, and the 47-test
Apple auth work lane. The current full mobile suite also passes 273 test files /
3139 tests. The race assertions include terminal-before-lifecycle,
terminal-before-identity, capture-time no-retry reconciliation, and no code
dispatch after the committed `blocked` result.

Release testing must still deploy the coherent candidate to a reviewed hosted project
and prove fresh and existing-account capture, real Apple code exchange, registered event
delivery, Vault/Cron continuity, key rotation/rollback, exact stale-JWT denial across
RLS/Storage/Edge/direct RPCs, provider outage recovery, physical-iPhone/TestFlight, and
deletion. Vault and subject-HMAC keyrings allow up to three overlapping versions, and
each successful daily validation must atomically re-derive the current subject digest
and freshly seal the token under the current vault key. Dormant, deferred, and failing
rows do not advance from configuration alone, so old-key retirement still needs
zero-row evidence or fail-closed recapture/reauthentication. Subject-key
retirement must also prove zero unresolved terminal `unknown_subject` rows for
that version, or a reviewed reconciliation/disposition, so the no-retry bridge
cannot be orphaned. The non-destructive health-consent withdrawal source
contract now has local two-reset and focused test evidence;
reviewed hosted worker/Storage/backup, two-device, physical-iPhone, and professional evidence
remain open. The exact privacy report, policy/support URLs, and
non-expiring demo review access also remain launch blockers.

## E2E Tests

Human-simulated E2E is required for UI-facing work.

Priority flows:

1. First-run onboarding.
2. Shelf product add.
3. Conflict detail and override.
4. Today routine completion.
5. Progress photo capture/review.
6. Paywall purchase/restore.
7. Settings privacy/export/delete.
8. Apple sign-in/linking cancellation and success, capture ambiguity, relaunch,
   revoked/not-found/transferred state, same-owner recovery, account switching,
   and deletion.
9. Cloud Ask consent, refusal, citation, quota, and outage recovery.
10. Commerce consent, safe retailer handoff, and disclosure.
11. Community post/report/block/contact and moderator recovery.
12. Trend opt-in, processing limits, fairness disclosure, and withdrawal.
13. Widgets, Live Activities, notifications, links, sharing, creator links,
    review prompt, and operator workflows.

Reference:

- `docs/HUMAN_SIMULATED_E2E_TESTING.md`
- `docs/USER_FLOW_TREE.md`
- `docs/E2E_TESTING_CHECKLIST.md`

## Manual QA

Manual QA must cover:

- supported compact iPhone layout from `docs/DEVICE_SUPPORT_POLICY.md`
- large text / Dynamic Type
- dark/light mode
- network offline
- camera permission denied
- notification permission denied
- direct-entry route back/close behavior
- relaunch persistence
- accessibility labels and touch targets
- stress-only 320 x 568 / 480 / 430 / 390 / 370 / 360 browser viewports when
  they protect critical flows, without treating those sub-floor sizes as launch
  blockers

## Security Checks

Run or maintain:

- RLS smoke/adversarial tests.
- Two-reset full migration replay, pgTAP, database lint, and empty shadow diff.
- Sealed Apple table/function ACL tests; active/non-Apple/blocked/stale-session
  RLS and Storage tests; direct authenticated RPC fence tests; and terminal
  Apple-event-to-deletion assertions.
- Apple lifecycle Edge tests for exact request/response schemas, nonce and
  subject verification, code single use, vault AAD/tampering/key overlap,
  worker secret negatives, daily validation/defer/invalidate outcomes, signed
  event JWKS caching/replay/staleness, and account-deletion vault reuse.
- Database tests for event-before-lifecycle and event-before-identity races must
  prove one owner under the account-deletion lock, a terminal no-vault lifecycle,
  six-step deletion reuse, session destruction, losing-capture `blocked` before
  exchange dispatch, exact audience plus paired HMAC/key-version matching, and
  no plaintext subject in lifecycle/event rows. The test must not assume Apple
  delivers a duplicate event.
- Central exact-session remote-admission tests covering controlled refresh, synchronous
  closure, child-request settlement, account replacement, and deletion handoff.
- Independent entitlement-lane, owner-derived projection, provider-watermark, and durable
  transaction-journal adversarial tests.
- privacy payload audit.
- edge auth smoke.
- dependency inventory/SBOM.
- account deletion and data export smoke.

Hosted Apple verification must additionally retain redacted evidence for the
registered primary-App-ID endpoint, actual signed event delivery, exactly one
one-minute Vault-backed Cron job, worker interruption and recovery, 72-hour
fail-closed behavior, existing-account recapture, and 60-second photo signed
URL expiry. Source mocks or manually posted lookalike JWS values cannot satisfy
Apple-delivery evidence.

## Generated Evidence Checks

Generated launch packets record whether source files were dirty when the packet
was produced. Packet builders intentionally ignore other generated evidence
outputs so Phase 3-11 packets can be refreshed together, but they still report
non-generated source changes as dirty. After any multi-packet refresh, run:

```bash
npm run docs:generated-packet-status-audit:check
```

That audit is the gate that proves committed generated packet hashes are current
and no packet records dirty source evidence.

Phase 9, Phase 10, and Phase 11 verification commands must also run the strict
generated-packet status audit immediately after their release, closed-beta, or
public-launch packet builders. This prevents RC/beta/launch verification from
leaving a freshly generated packet set with stale recorded hashes.

Standalone Phase 11 verification must rerun the Phase 10 local evidence
normalization, beta readiness, beta analytics, support handoff, and beta packet
gates before public-launch readiness. Public launch verification cannot rely on
a previously built beta packet when the underlying beta contract has changed.

## Non-Mutating Launch Readiness Sweep

Use the root readiness sweep after source changes that should not rebuild
packets:

```bash
npm run launch:verify
```

This command runs the source-packet, Tas-owned blocker, readiness-status, strict
brand, device-support-policy, performance-readiness, generated-packet, and
human-E2E manifest checks; the Phase 5 native config guard; the Phase 7
core-loop and Phase 8 growth/store code gates; Phase 9 release smoke, Phase 10
beta readiness, Phase 10 beta analytics audit, Phase 11 launch readiness, and
launch ring gates; then typecheck, lint, and tests. It does not replace the
phase packet builders after generated evidence changes.

The current root sweep must include these non-mutating gates:

- `npm run docs:source-packet-audit:check`
- `npm run docs:tas-todo-audit:check`
- `npm run docs:readiness-status-audit:check`
- `npm run brand:audit:strict`
- `npm run docs:device-support-policy-audit:check`
- `npm run docs:performance-readiness-audit:check`
- `npm run docs:generated-packet-status-audit:check`
- `npm run e2e:human:manifest:check`
- `npm run phase5:check-native-config`
- `npm run phase7:check-core-loop`
- `npm run phase8:check-growth-store`
- `npm run phase10:beta-analytics-audit`
- `npm run phase10-11:verify`

## Performance Checks

Monitor:

- app startup time
- product add time
- barcode lookup latency
- routine generation time
- local photo loading
- memory use in photo timeline

Performance readiness is not closed by local unit tests. Before closed beta,
record baseline measurements on supported physical iPhones and
attach the measurement artifact, device model/OS, build ID, and named owner
signoff in `docs/FOR_TAS_TO_DO.md`. Thresholds must be defined before
measurement, and each required metric needs at least five raw samples per
required platform. The validator calculates nearest-rank p50/p95 and max from those
observations and rejects mismatched hand-entered summaries. Use the blocked
template and strict validator documented in
`docs/phase-5/performance-evidence-runbook.md`:

```bash
npm run phase5:performance-evidence:template:check
PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
npm run phase5:performance-evidence:summarize
PHASE5_PERFORMANCE_EVIDENCE_PATH=/path/to/performance-evidence.json \
npm run phase5:performance-evidence:strict
```

The non-mutating documentation and contract guard is:

```bash
npm run docs:performance-readiness-audit:check
```

That audit verifies the performance evidence contract, template, validator,
smoke coverage, and launch wiring remain current. It does not replace the real
device measurements required by `phase5:performance-evidence:strict` or later
beta telemetry.

## Accessibility Checks

Required:

- minimum 44 pt tap targets
- no color-only meaning
- VoiceOver labels
- focus order
- text reflow
- Reduce Motion behavior

## Commands Placeholder

```bash
npm run typecheck
npm run lint
npm test
npm --workspace apps/mobile run typecheck
npm --workspace apps/mobile run lint
npm --workspace apps/mobile run test
npm run phase2:rls-smoke
npm run phase9:apple-auth-work-lane-smoke
npm run phase3:audit-copy
npm run phase4:qa-report
npm run phase5:qa-packet
npm run phase6:qa-packet
npm run phase7:qa-packet
npm run phase8:qa-packet
npm run brand:audit:strict
npm run launch:verify
npm run phase9:verify
npm run phase10:verify
npm run phase11:verify
```

Use strict variants only when live environment variables and evidence are available.
