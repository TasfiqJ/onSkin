# Testing Strategy

## Principles

- Test safety-relevant logic with deterministic fixtures.
- Test launch gates so unreviewed features cannot leak into production.
- UI-facing work requires human-simulated E2E evidence.
- Device-dependent features require physical iOS/Android QA before public claims.

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

- small phone layout
- large text / Dynamic Type
- dark/light mode
- network offline
- camera permission denied
- notification permission denied
- direct-entry route back/close behavior
- relaunch persistence
- accessibility labels and touch targets

## Security Checks

Run or maintain:

- RLS smoke/adversarial tests.
- privacy payload audit.
- edge auth smoke.
- dependency inventory/SBOM.
- account deletion and data export smoke.

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
