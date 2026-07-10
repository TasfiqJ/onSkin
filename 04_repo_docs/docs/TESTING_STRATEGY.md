# Testing Strategy

## Principles

- Test safety-relevant logic with deterministic fixtures.
- Test launch gates so unreviewed features cannot leak into production.
- UI-facing work requires human-simulated E2E evidence.
- Device-dependent features require physical iOS/Android QA before public claims.
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
- subscription entitlement helpers
- privacy/consent logic
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
- RevenueCat webhook -> entitlements
- Supabase RLS owner isolation
- account deletion/export
- catalog lookup/search/report

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

Reference:

- `docs/HUMAN_SIMULATED_E2E_TESTING.md`
- `docs/USER_FLOW_TREE.md`
- `docs/E2E_TESTING_CHECKLIST.md`

## Manual QA

Manual QA must cover:

- supported small phone layout from `docs/DEVICE_SUPPORT_POLICY.md`
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
record baseline measurements on supported iOS and Android physical devices and
attach the measurement artifact, device model/OS, build ID, and named owner
signoff in `docs/FOR_TAS_TO_DO.md`. The local guard is:

```bash
npm run docs:performance-readiness-audit:check
```

That audit verifies the performance evidence contract remains visible in the
launch docs. It does not replace real-device or beta telemetry.

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
