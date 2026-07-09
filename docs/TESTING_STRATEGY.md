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

## Performance Checks

Monitor:

- app startup time
- product add time
- barcode lookup latency
- routine generation time
- local photo loading
- memory use in photo timeline

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
npm run phase9:verify
npm run phase10:verify
npm run phase11:verify
```

Use strict variants only when live environment variables and evidence are available.
