# Optimization Baseline

Baseline date: 2026-07-12 (America/Toronto; execution time not recorded)
Branch: `optimization`
Baseline SHA: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`
Current SHA: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`
Plan: `docs/MAXIMUM_REACT_NATIVE_OPTIMIZATION_PLAN.md`

## Scope And Evidence Limits

This is the Phase 0 local repository baseline. It records the supplied command results without converting them into native performance, signed-artifact, release, or launch approval. No physical-device result, threshold approval, external signoff, or production result is claimed here.

The worktree was already dirty before Phase 0 documentation began. All pre-existing tracked and untracked changes are user-owned. They must be preserved, inspected before overlapping work, and must not be reset, cleaned, checked out, or overwritten.

## Device-Support Policy Conflict

The active worktree contains a newer launch contract that verifies an iOS-only, all-features launch posture with 20 features, 14 surfaces, and Android marked not applicable. Older source and generated documents still describe a dual-platform iOS/Android policy. The device-support audit therefore does not currently provide a coherent device matrix.

Until the authoritative source documents and generated artifacts are reconciled, optimization evidence must identify which contract it targets. No Android optimization item is being marked `not-applicable` from the launch-contract result alone, because the optimization plan and older architecture/product documents still include Android.

## Baseline Results

| Check                                            | Result | Recorded detail                                                                                       |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                              | PASS   | Root repository typecheck passed.                                                                     |
| `npm run lint`                                   | PASS   | Root repository lint passed.                                                                          |
| `npm test`                                       | PASS   | Root repository tests passed.                                                                         |
| `npm --workspace apps/mobile run typecheck`      | PASS   | Mobile TypeScript check passed.                                                                       |
| `npm --workspace apps/mobile run lint`           | PASS   | Mobile lint passed.                                                                                   |
| `npm --workspace apps/mobile run test`           | PASS   | 197 test files and 2,112 tests passed.                                                                |
| `npx expo install --check`                       | PASS   | Expo dependency compatibility check passed.                                                           |
| `npx expo-doctor`                                | PASS   | 21/21 checks passed; the run reported a Sentry organization/project environment warning.              |
| `npm run docs:performance-readiness-audit:check` | PASS   | Performance-readiness documentation audit passed. This is not a physical-device performance artifact. |
| `npm run docs:source-packet-audit:check`         | FAIL   | Generated JSON/Markdown source-packet artifacts are stale.                                            |
| `npm run docs:device-support-policy-audit:check` | FAIL   | Generated device-policy artifacts are stale and source phrase mismatches remain.                      |
| `npm run launch:contract:verify`                 | PASS   | Verified iOS-only, all-features, 20-feature, 14-surface contract with Android marked not applicable.  |

The initial task transcript remains the source for the baseline repository checks. Subsequent local export and focused-verification results are summarized under `docs/optimization/evidence/`; they are explicitly labeled dirty-worktree/local and are not native release evidence.

## Local Measurement Addendum

- Deterministic production Expo export analysis now records Hermes, compression, asset, and font statistics for iOS and Android.
- Deterministic empty, median, and stress fixtures now cover Shelf, completions, photo metadata, a future outbox shape, Ask messages, and more-than-1,000-row export pagination without image bytes.
- Bounded content-free operation/startup markers now cover private-KV work, captured-photo encryption, encrypted display decode, logical network requests, and the implemented startup privacy-gate decisions.
- `evidence/2026-07-12_local-verification-summary.md` records the focused local checks and the web-compatible sensitive-image E2E boundary.

These additions establish reproducibility, not threshold approval. The current reports were produced from the preserved dirty worktree at the baseline SHA.

## Known Baseline Gaps

- No signed iOS or Android artifact was measured.
- No physical-device startup, frame, memory, thermal, battery, camera, Keychain, Keystore, backup, or accessibility packet exists in this baseline.
- No approved absolute performance thresholds or named threshold/signoff owners are recorded.
- No canonical release artifact identity is recorded.
- No production export-size report, raw Instruments trace, or Perfetto trace is recorded here.
- The source-packet and device-support generated artifacts are stale.
- The authoritative device/platform launch scope is conflicted.
- Existing photo, storage, app-lock, launch-contract, documentation, and backend edits remain user-owned and unverified by this Phase 0 documentation slice.

## Next Baseline Actions

1. Reconcile the authoritative device policy before defining the official platform/device matrix.
2. Regenerate and review the stale source-packet and device-policy artifacts through their owning scripts; do not hand-edit generated outputs without following their workflow.
3. Re-run clean production export statistics after the selective optimization commit and compare them with the dirty-worktree diagnostic baseline.
4. Extend the fixtures into route/device performance harnesses without adding private content.
5. Predeclare thresholds and identify authorized threshold/signoff owners.
6. Establish signed release artifact identities and physical-device evidence when hardware, credentials, and authorization are available.
