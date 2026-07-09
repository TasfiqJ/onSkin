# Generated Packet Status Audit

Generated: 2026-07-09T21:35:39.886Z
Status: blocked
Strict mode: yes

This generated audit scans committed phase packet outputs for dirty-worktree
status and stale recorded file hashes. It does not prove external launch
evidence; it only prevents a local dirty or stale generated packet from
being treated as trustworthy launch evidence.

## Summary

- Generated files scanned: 49
- Files with dirty text: 26
- Files with non-empty gitStatus: 13
- Hash references checked: 979
- Stale hash references: 0
- Blockers: 39
- Warnings: 0

## Files

| File                                                      | Kind | Dirty text matches | Non-empty gitStatus fields | Hash refs | Stale hash refs |
| --------------------------------------------------------- | ---- | ------------------ | -------------------------- | --------- | --------------- |
| docs/phase-10/generated/closed-beta-packet.json           | json | 1                  | 1                          | 34        | 0               |
| docs/phase-10/generated/closed-beta-packet.md             | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-10/generated/support-handoff-packet.json       | json | 1                  | 1                          | 5         | 0               |
| docs/phase-10/generated/support-handoff-packet.md         | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-11/generated/public-launch-packet.json         | json | 1                  | 1                          | 40        | 0               |
| docs/phase-11/generated/public-launch-packet.md           | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-operator-queue.json         | json | 1                  | 1                          | 234       | 0               |
| docs/phase-3/generated/review-operator-queue.md           | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-packet-manifest.json        | json | 1                  | 1                          | 53        | 0               |
| docs/phase-3/generated/review-packet.md                   | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-worklist.json               | json | 1                  | 1                          | 238       | 0               |
| docs/phase-3/generated/review-worklist.md                 | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/beta-coverage-report.json          | json | 1                  | 1                          | 25        | 0               |
| docs/phase-4/generated/beta-coverage-report.md            | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/catalog-qa-report.json             | json | 1                  | 1                          | 25        | 0               |
| docs/phase-4/generated/catalog-qa-report.md               | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/cosing-fixture-import.json         | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/obf-fixture-import.json            | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/source-worklist.json               | json | 0                  | 0                          | 111       | 0               |
| docs/phase-4/generated/source-worklist.md                 | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-5/generated/device-qa-packet.json              | json | 1                  | 1                          | 28        | 0               |
| docs/phase-5/generated/device-qa-packet.md                | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-6/generated/payments-qa-packet.json            | json | 1                  | 1                          | 33        | 0               |
| docs/phase-6/generated/payments-qa-packet.md              | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-7/generated/core-loop-qa-packet.json           | json | 1                  | 1                          | 29        | 0               |
| docs/phase-7/generated/core-loop-qa-packet.md             | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-8/generated/growth-store-qa-packet.json        | json | 1                  | 1                          | 47        | 0               |
| docs/phase-8/generated/growth-store-qa-packet.md          | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-9/generated/dependency-inventory.json          | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/dependency-inventory.md            | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-catalog-rate-limit.json       | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-catalog-rate-limit.md         | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-consent-withdrawal.json       | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-consent-withdrawal.md         | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-data-rights.json              | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-data-rights.md                | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-edge-auth.json                | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-edge-auth.md                  | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-order-report-poll.json        | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-order-report-poll.md          | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-public-forms.json             | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-public-forms.md               | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-revenuecat-webhook.json       | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-revenuecat-webhook.md         | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-supabase-adversarial.json     | json | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/live-supabase-adversarial.md       | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/release-engineering-qa-packet.json | json | 1                  | 1                          | 77        | 0               |
| docs/phase-9/generated/release-engineering-qa-packet.md   | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-9/generated/store-build-inspection.json        | json | 0                  | 0                          | 0         | 0               |

## Blockers

- docs/phase-10/generated/closed-beta-packet.json contains dirty generated-packet text.
- docs/phase-10/generated/closed-beta-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-10/generated/closed-beta-packet.md contains dirty generated-packet text.
- docs/phase-10/generated/support-handoff-packet.json contains dirty generated-packet text.
- docs/phase-10/generated/support-handoff-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-10/generated/support-handoff-packet.md contains dirty generated-packet text.
- docs/phase-11/generated/public-launch-packet.json contains dirty generated-packet text.
- docs/phase-11/generated/public-launch-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-11/generated/public-launch-packet.md contains dirty generated-packet text.
- docs/phase-3/generated/review-operator-queue.json contains dirty generated-packet text.
- docs/phase-3/generated/review-operator-queue.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-3/generated/review-operator-queue.md contains dirty generated-packet text.
- docs/phase-3/generated/review-packet-manifest.json contains dirty generated-packet text.
- docs/phase-3/generated/review-packet-manifest.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-3/generated/review-packet.md contains dirty generated-packet text.
- docs/phase-3/generated/review-worklist.json contains dirty generated-packet text.
- docs/phase-3/generated/review-worklist.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-3/generated/review-worklist.md contains dirty generated-packet text.
- docs/phase-4/generated/beta-coverage-report.json contains dirty generated-packet text.
- docs/phase-4/generated/beta-coverage-report.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-4/generated/beta-coverage-report.md contains dirty generated-packet text.
- docs/phase-4/generated/catalog-qa-report.json contains dirty generated-packet text.
- docs/phase-4/generated/catalog-qa-report.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-4/generated/catalog-qa-report.md contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-5/generated/device-qa-packet.md contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-6/generated/payments-qa-packet.md contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-7/generated/core-loop-qa-packet.md contains dirty generated-packet text.
- docs/phase-8/generated/growth-store-qa-packet.json contains dirty generated-packet text.
- docs/phase-8/generated/growth-store-qa-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-8/generated/growth-store-qa-packet.md contains dirty generated-packet text.
- docs/phase-9/generated/release-engineering-qa-packet.json contains dirty generated-packet text.
- docs/phase-9/generated/release-engineering-qa-packet.json records non-empty gitStatus: M apps/mobile/src/app/onboarding/analyzing.tsx
 M apps/mobile/src/app/onboarding/products.tsx
 M apps/mobile/src/app/onboarding/quiz.tsx
 M apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
 M docs/USER_FLOW_TREE.md
 M package.json
?? docs/e2e-bug-reports/2026-07-09-onboarding-first-session-430-stress-clearance.md
?? scripts/e2e/onboarding-first-session.mjs
- docs/phase-9/generated/release-engineering-qa-packet.md contains dirty generated-packet text.

## Warnings

- None.
