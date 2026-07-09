# Generated Packet Status Audit

Generated: 2026-07-09T19:21:13.110Z
Status: pass
Strict mode: yes

This generated audit scans committed phase packet outputs for dirty-worktree
status and stale recorded file hashes. It does not prove external launch
evidence; it only prevents a local dirty or stale generated packet from
being treated as trustworthy launch evidence.

## Summary

- Generated files scanned: 47
- Files with dirty text: 0
- Files with non-empty gitStatus: 0
- Hash references checked: 964
- Stale hash references: 0
- Blockers: 0
- Warnings: 0

## Files

| File                                                      | Kind | Dirty text matches | Non-empty gitStatus fields | Hash refs | Stale hash refs |
| --------------------------------------------------------- | ---- | ------------------ | -------------------------- | --------- | --------------- |
| docs/phase-10/generated/closed-beta-packet.json           | json | 0                  | 0                          | 31        | 0               |
| docs/phase-10/generated/closed-beta-packet.md             | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-11/generated/public-launch-packet.json         | json | 0                  | 0                          | 35        | 0               |
| docs/phase-11/generated/public-launch-packet.md           | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-operator-queue.json         | json | 0                  | 0                          | 233       | 0               |
| docs/phase-3/generated/review-operator-queue.md           | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-packet-manifest.json        | json | 0                  | 0                          | 53        | 0               |
| docs/phase-3/generated/review-packet.md                   | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-3/generated/review-worklist.json               | json | 0                  | 0                          | 237       | 0               |
| docs/phase-3/generated/review-worklist.md                 | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/beta-coverage-report.json          | json | 0                  | 0                          | 25        | 0               |
| docs/phase-4/generated/beta-coverage-report.md            | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/catalog-qa-report.json             | json | 0                  | 0                          | 25        | 0               |
| docs/phase-4/generated/catalog-qa-report.md               | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/cosing-fixture-import.json         | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/obf-fixture-import.json            | json | 0                  | 0                          | 0         | 0               |
| docs/phase-4/generated/source-worklist.json               | json | 0                  | 0                          | 111       | 0               |
| docs/phase-4/generated/source-worklist.md                 | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-5/generated/device-qa-packet.json              | json | 0                  | 0                          | 28        | 0               |
| docs/phase-5/generated/device-qa-packet.md                | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-6/generated/payments-qa-packet.json            | json | 0                  | 0                          | 33        | 0               |
| docs/phase-6/generated/payments-qa-packet.md              | md   | 0                  | 0                          | 0         | 0               |
| docs/phase-7/generated/core-loop-qa-packet.json           | json | 0                  | 0                          | 29        | 0               |
| docs/phase-7/generated/core-loop-qa-packet.md             | md   | 0                  | 0                          | 0         | 0               |
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

- None.

## Warnings

- None.
