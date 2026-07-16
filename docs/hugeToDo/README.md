# hugeToDo

This is the single home for the founder-directed, iOS-only, all-features launch
execution program.

Start here:

- [iOS All-Features Codex Execution Plan](./IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md)
- [Accepted iOS All-Features Master Plan Update](./2026-07-12-ios-all-features-master-plan-update.md)
- [Machine-Readable Launch Contract](./launch-contract.json)
- [Founder Enrollment and External Gates Packet](./FOUNDER_ENROLLMENT_AND_EXTERNAL_GATES_PACKET.md)
- [Apple Review Feature Acceptance Matrix](./APPLE_REVIEW_FEATURE_ACCEPTANCE_MATRIX.md)
- [PAY-01 Pricing and Unit-Economics Recommendation](./PAY-01-pricing-and-unit-economics-recommendation-2026-07-13.md)
- [Accounts and Vendor Decision Packet](./ACCOUNTS_AND_VENDOR_DECISION_PACKET.md)
- [DB-01–DB-11 Gap Matrix](./DB-01-11-GAP-MATRIX-2026-07-13.md)
- [DB-05 Credential-Free Local Reset Evidence](./DB-05-LOCAL-RESET-2026-07-14.md)
- [DB-06 Fresh-Staging Deployment Source Checkpoint](./DB-06-STAGING-DEPLOYMENT-SOURCE-CHECKPOINT-2026-07-15.md)
- [Legacy Brand Compatibility Checkpoint](./BRAND-LEGACY-COMPATIBILITY-CHECKPOINT-2026-07-14.md)
- [IOS-10 Export-Compliance Gate](./IOS-10-EXPORT-COMPLIANCE-GATE.md)
- [US Wave 1 Privacy and Consumer-Health Law Gate](./US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md)
- [Health-Consent Withdrawal, Processor, and Retention Matrix](./HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md)
- [Health Processor Inventory v1](./health-processor-inventory-v1.json)
- [Phase 9 Sign in with Apple Lifecycle Operations Runbook](../phase-9/apple-auth-lifecycle-operations-runbook.md)

Execution state and dependency artifacts in this directory are generated or
validated from the plan. Readiness remains evidence-based: a checked-in status
cannot substitute for live service, physical iPhone, professional, production,
or App Store proof.

The health-withdrawal matrix and inventory are source-candidate controls, not
production clearance. In particular, an empty separately reconciled external
processor list does not remove Supabase database, Storage, backup, DPA, region,
worker, or live zero-residue evidence gates.

DB-06 is also a source checkpoint and remains `in_progress`, blocked by
`ACCT-03`. The fresh-only path covers 54 migrations through `0055`, all 16 Edge
functions, an active traffic/provider freeze, and an immediate pre-push reread
of functions, public frozen responses, hosted Auth controls, migrations,
schema, Storage, and all Cron jobs. It leaves `DB06_TRAFFIC_FREEZE=frozen` for a
separate downstream live-gate release. No approved hosted target was used and
no live DB-06 evidence directory exists.

The Sign in with Apple lifecycle is also a source checkpoint, not launch
clearance. Migration 0055 and the mobile/Edge contracts implement nonce/state
capture, server code exchange, encrypted refresh-token retention, daily
validation, signed account events, no-retry terminal-event reconciliation
before code exchange, and exact-session denial. Hosted deployment,
primary-App-ID endpoint delivery, Vault/Cron, key rotation/recapture,
physical-iPhone/TestFlight, professional review, legal/privacy conclusions, and
App Review remain open. Successful daily validation advances both subject and
vault key versions, but dormant or failing rows still require zero-row evidence,
recapture/reauthorization, or lifecycle retirement before old-key removal.
The local 0055 replay gate is green: two clean resets, exact 54/0055 history,
the full structural suite plus 114/114 Apple pgTAP, lint, empty shadow diff,
temporary types, 20/20 focused event/lifecycle Edge tests, and the 47-test Apple
auth work lane. This is not hosted or device acceptance.

All new execution trackers, research packets, vendor comparisons, naming
artifacts, launch worklists, and completion reports created for this program
belong under this folder.

Existing repository source-of-truth documents remain at their established paths
because build scripts and generated evidence reference them. The execution plan
links and reconciles those sources rather than breaking their paths.
