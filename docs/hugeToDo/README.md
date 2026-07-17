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
- [BRAND-03 Knockout Search Record](./BRAND-03-knockout-search-record-2026-07-12.md)
- [BRAND-03 Governed Public-Research Evidence](./evidence/BRAND-03/public-research/brand03-public-knockout-2026-07-16/evidence.json)
- [IOS-10 Export-Compliance Gate](./IOS-10-EXPORT-COMPLIANCE-GATE.md)
- [IOS-02 Widget Lifecycle Source Checkpoint](./IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md)
- [IOS-09 iOS Privacy Source Checkpoint](./IOS-09-IOS-PRIVACY-SOURCE-CHECKPOINT-2026-07-16.md)
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

BRAND-03 is complete only for the governed 2026-07-16 preliminary public
knockout scope. The sequence for counsel review remains `RoutineKind`,
`Ritunera`, then lower-confidence `Ritualoom`; `Rituvia` is suspended. The
record includes UKIPO, TMview, public-handle, national-register, store, domain,
and common-law issue spotting with explicit result-set limits. BRAND-06 remains
externally pending for comprehensive WIPO/Madrid, final-country,
company/trade-name, common-law, linguistic, priority, goods/services, and
qualified-counsel analysis plus a written decision. BRAND-07 remains the later
authenticated reservation gate. No candidate is described as legally clear,
available, registrable, non-infringing, reserved, Apple-approved, or guaranteed
to pass App Review.

IOS-02 is also an `in_progress` native source checkpoint, not a released
feature. The reviewed source candidate now replaces the RoutineKind stock
whole-value timeline path with an App Group SQLite authority, rotating
authority-nonce CAS, a durable action outbox, an exact current-plus-stale
timeline, owner/snapshot-bound reconciliation, finite RoutineKind Live Activity
deadlines, a generation-bound coordinator/host slot, lock-held lease-close
quiescence, and unconditional native privacy cleanup across withdrawal,
deletion, sign-out, and account-boundary paths. At a planned health-lease close,
the same cross-process store lock that guards App Intent append durably records
an exact quiescence receipt and captures the final outbox before releasing the
lock. One receipt/authority/owner/snapshot/revision-bound reconciliation may
commit a nonempty captured outbox before the receipt is replaced by the ordinary
closed sentinel; an empty capture is converted under the same lock before
quiescence returns. Native `outbox_pending` publication and stale-Activity
results are bounded retryable states, so accepted actions remain durable for a
later foreground pass rather than being purged. Privacy reduction otherwise
durably verifies `privacy-closing-v1` and returns a synchronous closed-admission
receipt before the queued full purge. Withdrawal and account cleanup start this
native closure at the boundary before JavaScript writer drains or
replacement-owner publication. The exact `expo-widgets` `56.0.23` patch is
hash-pinned and checked during local and EAS installation.

Interactive publication and Live Activity start nevertheless remain disabled
by literal generated Info.plist flags; ordinary JavaScript or OTA configuration
cannot enable them. The current five-minute health-processing status lease,
with 30 seconds reserved for reconciliation, makes personalized widget content
short-lived. A reviewed longer purpose-limited local-display authorization is
still required before enabling a persistent personalized widget. The current
WidgetKit provider/render path also synchronously takes the exclusive `flock`
and opens SQLite read-write, so Instruments and contention measurements on
supported physical iPhones remain a release gate.

This Windows checkpoint has no Xcode or Swift compiler and therefore does not
prove that the patched source compiles, that a WidgetKit/ActivityKit extension
is generated or signed, or that a binary contains the expected SQLite linkage,
entitlements, capabilities, privacy manifest, and final identity. Signed-
archive, physical-iPhone, process-death/restart, locked-state, accessibility,
interaction, cleanup, actual ActivityKit dismissal, privacy/legal/security
review, and App Review evidence remain open. The artifact-bound lifecycle
packet must still bind the exact source, build, identities, signed artifacts,
reports, physical device, scenario proofs, and named signoff. Setting QA
booleans or passing source tests alone cannot clear IOS-02, establish legal
compliance, guarantee Apple acceptance, or support a revenue claim.

IOS-09 now has a deterministic installed-source privacy audit and an exact-hash
repair for the invalid empty `NSPrivacyAccessedAPITypes` array shipped by the
reviewed `react-native-view-shot` package. The current result is
`archive_required`: 63 native packages, 14/14 source-valid manifests, 139
podspecs, 16 XCFramework candidates, ten Apple SDK-list intersections, zero
errors, and 15 warnings. These are npm-source observations only. First-party
and generated native sources have separate validators, while evaluated
CocoaPods/SPM output, the production archive, merged privacy report, required
API use, SDK signatures, entitlements, symbols, processing warnings, observed
traffic/storage, final labels, and named privacy/legal/device signoffs remain
open. A typed archive-evidence-index path now binds the EAS source/build/log,
full reviewed image and resolved toolchain, `.xcarchive.zip` or IPA, ten
candidate-local review artifacts, a single tracked RC-only evidence commit,
manifest identity, and distinct named approval metadata. No completed production index
or underlying archive evidence has been supplied; the validator proves index
integrity, not the truth of opaque reports. Source validity does not establish legal compliance, App Review
acceptance, or revenue.

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
