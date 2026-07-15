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
- Apple credential-state fail-closed behavior
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
- catalog lookup/search/report

## 2026-07-15 Source Checkpoint

The current source checkpoint passes:

- PostgreSQL 15 and 17 account-publication and entitlement-authority rehearsals.
- Two clean local Supabase resets across all 52 migrations through
  `20260714000053_entitlement_authority_lanes.sql`, plus pgTAP, database lint, and an
  empty shadow diff.
- Subscription reconciliation 20/20, subscription grants 8/8, atomic RevenueCat webhook
  20/20, durable account deletion 215/215, and the focused mobile server contract 2/2.
- Integrated repository verification: 244 test files / 2,780 tests, typecheck, lint, and
  format.

These results prove source contracts only. They do not close hosted migration/Cron/Vault,
live Supabase or RevenueCat, App Store sandbox/TestFlight, provider interruption and
recreation, physical-iPhone, professional-review, privacy/legal, or App Review gates.

Apple `TRANSFERRED` is now a tested fail-closed `credential_transferred` result. Release
testing must still prove initial authorization-code plus state/nonce capture, encrypted
rotating token storage, daily refresh-token validation, canonical signed server-notification
ingress, and an authoritative server session-access fence. A reviewed non-destructive
health-consent withdrawal flow and the exact privacy report, policy/support URLs, and
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
8. Cloud Ask consent, refusal, citation, quota, and outage recovery.
9. Commerce consent, safe retailer handoff, and disclosure.
10. Community post/report/block/contact and moderator recovery.
11. Trend opt-in, processing limits, fairness disclosure, and withdrawal.
12. Widgets, Live Activities, notifications, links, sharing, creator links,
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
- Central exact-session remote-admission tests covering controlled refresh, synchronous
  closure, child-request settlement, account replacement, and deletion handoff.
- Independent entitlement-lane, owner-derived projection, provider-watermark, and durable
  transaction-journal adversarial tests.
- privacy payload audit.
- edge auth smoke.
- dependency inventory/SBOM.
- account deletion and data export smoke.

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
