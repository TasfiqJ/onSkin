# Generated Packet Status Audit

Generated: 2026-07-09T18:25:31.018Z
Status: blocked
Strict mode: yes

This generated audit scans committed phase packet outputs for dirty-worktree
status and stale recorded file hashes. It does not prove external launch
evidence; it only prevents a local dirty or stale generated packet from
being treated as trustworthy launch evidence.

## Summary

- Generated files scanned: 45
- Files with dirty text: 14
- Files with non-empty gitStatus: 7
- Hash references checked: 725
- Stale hash references: 9
- Blockers: 30
- Warnings: 0

## Files

| File                                                      | Kind | Dirty text matches | Non-empty gitStatus fields | Hash refs | Stale hash refs |
| --------------------------------------------------------- | ---- | ------------------ | -------------------------- | --------- | --------------- |
| docs/phase-10/generated/closed-beta-packet.json           | json | 0                  | 0                          | 31        | 0               |
| docs/phase-10/generated/closed-beta-packet.md             | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-11/generated/public-launch-packet.json         | json | 0                  | 0                          | 35        | 0               |
| docs/phase-11/generated/public-launch-packet.md           | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-packet-manifest.json        | json | 0                  | 0                          | 48        | 4               |
| docs/phase-3/generated/review-packet.md                   | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-worklist.json               | json | 1                  | 1                          | 237       | 0               |
| docs/phase-3/generated/review-worklist.md                 | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/beta-coverage-report.json          | json | 1                  | 1                          | 24        | 2               |
| docs/phase-4/generated/beta-coverage-report.md            | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/catalog-qa-report.json             | json | 1                  | 1                          | 25        | 0               |
| docs/phase-4/generated/catalog-qa-report.md               | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/cosing-fixture-import.json         | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/obf-fixture-import.json            | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/source-worklist.json               | json | 1                  | 1                          | 111       | 0               |
| docs/phase-4/generated/source-worklist.md                 | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-5/generated/device-qa-packet.json              | json | 1                  | 1                          | 28        | 1               |
| docs/phase-5/generated/device-qa-packet.md                | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-6/generated/payments-qa-packet.json            | json | 1                  | 1                          | 33        | 1               |
| docs/phase-6/generated/payments-qa-packet.md              | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-7/generated/core-loop-qa-packet.json           | json | 1                  | 1                          | 29        | 1               |
| docs/phase-7/generated/core-loop-qa-packet.md             | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-8/generated/growth-store-qa-packet.json        | json | 0                  | 0                          | 47        | 0               |
| docs/phase-8/generated/growth-store-qa-packet.md          | md   | 0                  | 0                          | 0         | 0               |
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
| docs/phase-9/generated/release-engineering-qa-packet.json | json | 0                  | 0                          | 77        | 0               |
| docs/phase-9/generated/release-engineering-qa-packet.md   | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-9/generated/store-build-inspection.json        | json | 0                  | 0                          | 0         | 0               |

## Blockers

- docs/phase-3/generated/review-packet-manifest.json has stale hash reference files.19 -> docs/phase-3/generated/review-worklist.json: sha256 does not match current file.
- docs/phase-3/generated/review-packet-manifest.json has stale hash reference files.20 -> docs/phase-3/generated/review-worklist.md: sha256 does not match current file.
- docs/phase-3/generated/review-packet-manifest.json has stale hash reference files.28 -> docs/phase-3/generated/review-worklist.json: sha256 does not match current file.
- docs/phase-3/generated/review-packet-manifest.json has stale hash reference files.29 -> docs/phase-3/generated/review-worklist.md: sha256 does not match current file.
- docs/phase-3/generated/review-worklist.json contains dirty generated-packet text.
- docs/phase-3/generated/review-worklist.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-3/generated/review-worklist.md contains dirty generated-packet text.
- docs/phase-4/generated/beta-coverage-report.json contains dirty generated-packet text.
- docs/phase-4/generated/beta-coverage-report.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.18 -> docs/phase-4/generated/catalog-qa-report.json: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.19 -> docs/phase-4/generated/catalog-qa-report.md: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.md contains dirty generated-packet text.
- docs/phase-4/generated/catalog-qa-report.json contains dirty generated-packet text.
- docs/phase-4/generated/catalog-qa-report.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-4/generated/catalog-qa-report.md contains dirty generated-packet text.
- docs/phase-4/generated/source-worklist.json contains dirty generated-packet text.
- docs/phase-4/generated/source-worklist.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-4/generated/source-worklist.md contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-5/generated/device-qa-packet.json has stale hash reference files.22 -> docs/USER_FLOW_TREE.md: sha256 does not match current file.
- docs/phase-5/generated/device-qa-packet.md contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-6/generated/payments-qa-packet.json has stale hash reference files.27 -> docs/USER_FLOW_TREE.md: sha256 does not match current file.
- docs/phase-6/generated/payments-qa-packet.md contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json records non-empty gitStatus: M LAUNCH_READINESS.md
 M apps/mobile/src/app/(tabs)/you.tsx
 M apps/mobile/src/features/settings/settingsRoutes.test.ts
 M apps/mobile/src/lib/analytics/eventRegistry.ts
 M apps/mobile/src/lib/analytics/track.test.ts
 M docs/FOR_TAS_TO_DO.md
 M docs/USER_FLOW_TREE.md
 M docs/phase-10/beta-source-of-truth.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-consent.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-barrier-basics.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stack-missing-stack-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-stacks.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/commerce-transparency.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-ask.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-note-missing-note-e2e.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community-people-like-you.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/community.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-disruption.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-phased-intro.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-procedure.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-recovery.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-settings.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-week.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/cycle-why-tonight.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/expo-web.log
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-success.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/paywall-upsell-feature-full-routine.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-capture.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress-review.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/progress.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-preferences.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations-stale-local-rec.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/recommendations.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/report.md
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-adaptation.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-plan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-ramp.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-reorder.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-streak.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-tolerance.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/routine-widgets.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-notifications.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-privacy.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-subscription.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/settings-timing.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-archive.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-manual.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-no-match.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-ocr.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-opened.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-scan.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf-search.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/shelf.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/summary.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today-routine-pm.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/today.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-fairness.png
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.json
 M test-results/human-e2e/2026-07-09/text-pressure-120-route-audit-current/trend-optin.png
?? apps/mobile/src/app/settings/beta-feedback.tsx
- docs/phase-7/generated/core-loop-qa-packet.json has stale hash reference files.17 -> docs/USER_FLOW_TREE.md: sha256 does not match current file.
- docs/phase-7/generated/core-loop-qa-packet.md contains dirty generated-packet text.

## Warnings

- None.
