# Generated Packet Status Audit

Generated: 2026-07-15T04:25:07.846Z
Status: blocked
Strict mode: no

This generated audit scans committed phase packet outputs for dirty-worktree
status and stale recorded file hashes. It does not prove external launch
evidence; it only prevents a local dirty or stale generated packet from
being treated as trustworthy launch evidence.

## Summary

- Generated files scanned: 49
- Files with dirty text: 24
- Files with non-empty gitStatus: 12
- Hash references checked: 1634
- Stale hash references: 17
- Blockers: 53
- Warnings: 0

## Files

| File                                                      | Kind | Dirty text matches | Non-empty gitStatus fields | Hash refs | Stale hash refs |
| --------------------------------------------------------- | ---- | ------------------ | -------------------------- | --------- | --------------- |
| docs/phase-10/generated/closed-beta-packet.json           | json | 1                  | 1                          | 35        | 0               |
| docs/phase-10/generated/closed-beta-packet.md             | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-10/generated/support-handoff-packet.json       | json | 1                  | 1                          | 5         | 0               |
| docs/phase-10/generated/support-handoff-packet.md         | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-11/generated/public-launch-packet.json         | json | 1                  | 1                          | 42        | 0               |
| docs/phase-11/generated/public-launch-packet.md           | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-operator-queue.json         | json | 1                  | 1                          | 352       | 0               |
| docs/phase-3/generated/review-operator-queue.md           | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-packet-manifest.json        | json | 1                  | 1                          | 107       | 0               |
| docs/phase-3/generated/review-packet.md                   | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-worklist.json               | json | 1                  | 1                          | 356       | 0               |
| docs/phase-3/generated/review-worklist.md                 | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-4/generated/beta-coverage-report.json          | json | 0                  | 0                          | 27        | 6               |
| docs/phase-4/generated/beta-coverage-report.md            | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/catalog-qa-report.json             | json | 0                  | 0                          | 27        | 5               |
| docs/phase-4/generated/catalog-qa-report.md               | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/cosing-fixture-import.json         | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/obf-fixture-import.json            | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/source-worklist.json               | json | 1                  | 1                          | 149       | 0               |
| docs/phase-4/generated/source-worklist.md                 | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-5/generated/device-qa-packet.json              | json | 1                  | 1                          | 93        | 0               |
| docs/phase-5/generated/device-qa-packet.md                | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-6/generated/payments-qa-packet.json            | json | 1                  | 1                          | 61        | 0               |
| docs/phase-6/generated/payments-qa-packet.md              | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-7/generated/core-loop-qa-packet.json           | json | 1                  | 1                          | 110       | 4               |
| docs/phase-7/generated/core-loop-qa-packet.md             | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-8/generated/growth-store-qa-packet.json        | json | 1                  | 1                          | 49        | 2               |
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
| docs/phase-9/generated/release-engineering-qa-packet.json | json | 1                  | 1                          | 221       | 0               |
| docs/phase-9/generated/release-engineering-qa-packet.md   | md   | 2                  | 0                          | 0         | 0               |
| docs/phase-9/generated/store-build-inspection.json        | json | 0                  | 0                          | 0         | 0               |

## Blockers

- docs/phase-10/generated/closed-beta-packet.json contains dirty generated-packet text.
- docs/phase-10/generated/closed-beta-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-10/generated/closed-beta-packet.md contains dirty generated-packet text.
- docs/phase-10/generated/support-handoff-packet.json contains dirty generated-packet text.
- docs/phase-10/generated/support-handoff-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-10/generated/support-handoff-packet.md contains dirty generated-packet text.
- docs/phase-11/generated/public-launch-packet.json contains dirty generated-packet text.
- docs/phase-11/generated/public-launch-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-11/generated/public-launch-packet.md contains dirty generated-packet text.
- docs/phase-3/generated/review-operator-queue.json contains dirty generated-packet text.
- docs/phase-3/generated/review-operator-queue.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-3/generated/review-operator-queue.md contains dirty generated-packet text.
- docs/phase-3/generated/review-packet-manifest.json contains dirty generated-packet text.
- docs/phase-3/generated/review-packet-manifest.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-3/generated/review-packet.md contains dirty generated-packet text.
- docs/phase-3/generated/review-worklist.json contains dirty generated-packet text.
- docs/phase-3/generated/review-worklist.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-3/generated/review-worklist.md contains dirty generated-packet text.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.0 -> package.json: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.3 -> .env.example: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.9 -> supabase/functions/catalog-report/index.ts: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.13 -> scripts/phase9/lib.mjs: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.17 -> docs/phase-4/generated/source-worklist.json: sha256 does not match current file.
- docs/phase-4/generated/beta-coverage-report.json has stale hash reference sourceHashes.18 -> docs/phase-4/generated/source-worklist.md: sha256 does not match current file.
- docs/phase-4/generated/catalog-qa-report.json has stale hash reference sourceHashes.0 -> package.json: sha256 does not match current file.
- docs/phase-4/generated/catalog-qa-report.json has stale hash reference sourceHashes.13 -> supabase/functions/catalog-report/index.ts: sha256 does not match current file.
- docs/phase-4/generated/catalog-qa-report.json has stale hash reference sourceHashes.17 -> scripts/phase9/lib.mjs: sha256 does not match current file.
- docs/phase-4/generated/catalog-qa-report.json has stale hash reference sourceHashes.22 -> docs/phase-4/generated/source-worklist.json: sha256 does not match current file.
- docs/phase-4/generated/catalog-qa-report.json has stale hash reference sourceHashes.23 -> docs/phase-4/generated/source-worklist.md: sha256 does not match current file.
- docs/phase-4/generated/source-worklist.json contains dirty generated-packet text.
- docs/phase-4/generated/source-worklist.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-4/generated/source-worklist.md contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json contains dirty generated-packet text.
- docs/phase-5/generated/device-qa-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-5/generated/device-qa-packet.md contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json contains dirty generated-packet text.
- docs/phase-6/generated/payments-qa-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-6/generated/payments-qa-packet.md contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json contains dirty generated-packet text.
- docs/phase-7/generated/core-loop-qa-packet.json records non-empty gitStatus: M docs/e2e/generated/human-e2e-manifest.json
 M docs/e2e/generated/human-e2e-manifest.md
 M docs/hugeToDo/feature-inventory.json
 M docs/phase-4/generated/source-worklist.json
 M docs/phase-4/generated/source-worklist.md
 M docs/phase-5/generated/device-qa-packet.json
 M docs/phase-5/generated/device-qa-packet.md
 M docs/phase-6/generated/payments-qa-packet.json
 M docs/phase-6/generated/payments-qa-packet.md
- docs/phase-7/generated/core-loop-qa-packet.json has stale hash reference files.101 -> docs/phase-5/generated/device-qa-packet.json: sha256 does not match current file.
- docs/phase-7/generated/core-loop-qa-packet.json has stale hash reference files.102 -> docs/phase-5/generated/device-qa-packet.md: sha256 does not match current file.
- docs/phase-7/generated/core-loop-qa-packet.json has stale hash reference files.103 -> docs/phase-6/generated/payments-qa-packet.json: sha256 does not match current file.
- docs/phase-7/generated/core-loop-qa-packet.json has stale hash reference files.104 -> docs/phase-6/generated/payments-qa-packet.md: sha256 does not match current file.
- docs/phase-7/generated/core-loop-qa-packet.md contains dirty generated-packet text.
- docs/phase-8/generated/growth-store-qa-packet.json contains dirty generated-packet text.
- docs/phase-8/generated/growth-store-qa-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-8/generated/growth-store-qa-packet.json has stale hash reference sourceHashes.docs/phase-7/generated/core-loop-qa-packet.json -> docs/phase-7/generated/core-loop-qa-packet.json: sha256 does not match current file.
- docs/phase-8/generated/growth-store-qa-packet.json has stale hash reference sourceHashes.docs/phase-7/generated/core-loop-qa-packet.md -> docs/phase-7/generated/core-loop-qa-packet.md: sha256 does not match current file.
- docs/phase-8/generated/growth-store-qa-packet.md contains dirty generated-packet text.
- docs/phase-9/generated/release-engineering-qa-packet.json contains dirty generated-packet text.
- docs/phase-9/generated/release-engineering-qa-packet.json records non-empty gitStatus: M docs/hugeToDo/feature-inventory.json
- docs/phase-9/generated/release-engineering-qa-packet.md contains dirty generated-packet text.

## Warnings

- None.
