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
- [CAT-01 Phase 4 Catalog Control Index](../phase-4/README.md)
- [CAT-01 Catalog Source Release Runbook](../phase-4/catalog-source-release-runbook.md)
- [CAT-01 Open Beauty Facts Source-Rights Checkpoint](../phase-4/catalog-source-memo-open-beauty-facts.md)
- [CAT-01 CosIng Source-Rights Checkpoint](../phase-4/catalog-source-memo-cosing.md)
- [CAT-01 Fixed Source Policy](../phase-4/catalog-source-policy.json)
- [CAT-01 Pending Reviewer Trust Registry](../phase-4/catalog-source-trust-registry.json)
- [CAT-01 Pending Release Scope](../phase-4/catalog-release-scope.json)
- [CAT-01 Pending Release-Build Evidence](../phase-4/catalog-release-build-evidence.json)
- [CAT-02 Catalog Import, Promotion, and Rollback Runbook](../phase-4/catalog-import-promotion-runbook.md)
- [CAT-02 Transactional Lifecycle Migration](../../supabase/migrations/20260717000057_catalog_import_lifecycle.sql)
- [CAT-02 Adversarial Database Contract](../../supabase/tests/database/catalog_import_lifecycle.test.sql)
- [CAT-02 Offline Promotion Contract](../../scripts/phase4/catalog-promotion-contract.mjs)
- [CAT-03 Catalog Curation Release Runbook](../phase-4/catalog-curation-release-runbook.md)
- [CAT-03 Coverage/Quality Target Template](../phase-4/catalog-coverage-quality-targets.template.json)
- [CAT-03 Minimized Beta-Shelf Corpus Template](../phase-4/beta-shelf-corpus.template.json)
- [CAT-03 Qualified Curation Review Template](../phase-4/catalog-curation-review.template.json)
- [CAT-03 Exact CAT-02 Membership Proof Template](../phase-4/catalog-cat02-membership-proof.template.json)
- [CAT-03 Signed Database Readback Template](../phase-4/catalog-curation-database-readback.template.json)
- [CAT-03 Offline Curation Contract](../../scripts/phase4/catalog-curation-contract.mjs)
- [CAT-03 Coverage/Quality Report](../../scripts/phase4/catalog-coverage-quality-report.mjs)
- [CAT-03 Immutable Staging/Atomic Release/Retirement Migration](../../supabase/migrations/20260717000058_catalog_launch_curation.sql)
- [CAT-03 Adversarial Database Contract](../../supabase/tests/database/catalog_launch_curation.test.sql)
- [CAT-04 Search, Barcode, and Recovery Source Checkpoint](./CAT-04-SEARCH-BARCODE-RECOVERY-SOURCE-CHECKPOINT-2026-07-18.md)
- [CAT-04 Scan/Lookup Minimization Migration](../../supabase/migrations/20260718000059_catalog_scan_minimization.sql)
- [CAT-05 Native OCR Source Checkpoint](./CAT-05-NATIVE-OCR-SOURCE-CHECKPOINT-2026-07-18.md)
- [Phase 9 Sign in with Apple Lifecycle Operations Runbook](../phase-9/apple-auth-lifecycle-operations-runbook.md)

Execution state and dependency artifacts in this directory are generated or
validated from the plan. Readiness remains evidence-based: a checked-in status
cannot substitute for live service, physical iPhone, professional, production,
or App Store proof.

The health-withdrawal matrix and inventory are source-candidate controls, not
production clearance. In particular, an empty separately reconciled external
processor list does not remove Supabase database, Storage, backup, DPA, region,
worker, or live zero-residue evidence gates.

CAT-01 is also an `in_progress` source-control checkpoint, not production
catalog clearance. OBF and CosIng imports are offline-only and exact-artifact
bound; fixtures and hash-only candidates cannot be promoted. Production
validation requires a current externally root-signed reviewer registry with a
separately pinned epoch/raw-file hash, fixed US release scope, distinct legal
and engineering signatures over each exact source approval, the same committed
transformer and deterministic payload, signed production EAS/archive/App Store
build evidence, and zero-warning source-specific QA. The current OBF transformer
accepts only the conservative derivative-database machine-readable-delivery
implementation; counsel must still decide the legal posture, and a different
classification requires a new reviewed policy/transformer revision.

The CAT-01 audit permits only three coherent control states:
pending/pending/pending baseline; active/approved/pending build-candidate commit
A; and active/approved/verified release descendant B. EAS builds clean A, and B
may add only the verified evidence bound to A without transformer/config drift.
Every other trust/scope/build combination fails closed.

Migration `0056` supplies the local fail-closed serving boundary: barcode and
search share service-role-only positive eligibility rules, direct reads cannot
bypass source withdrawal, operator-reviewed `triaged` or `accepted` correction
holds suppress rows, and held reasons use
the same no-match/manual fallback. Missing-product and wrong-match reports stay
inside the app's first-party correction operation; OBF/CosIng are not runtime
recipients and the legacy contribution lane is inert. External legal/source
decisions, cleared identity and live URLs, actual source artifacts, active
reviewer keys, production EAS/archive/App Store evidence, hosted database
verification, beta coverage, device QA, and named signoffs remain open.

Migration `0057` and the CAT-02 offline tooling now provide a local
source-control candidate for signed provenance, exact receipt-bound review,
bounded staging, Unicode-aware dedupe/conflict detection, one-transaction
promotion, dependency-closed serving, immutable correction lineage, and
non-destructive rollback. No real OBF/CosIng batch has been approved, staged,
promoted, or rolled back, and local single-connection evidence cannot replace
the required hosted two-connection race/retry drill. The current 214-assertion
pgTAP contract is statically plan-matched but still requires a fresh Docker
reset and execution; the last executed CAT-02 baseline covered only an earlier
35-assertion revision. These controls support
accurate source and health-information handling under current Apple App Review,
FDA cosmetics-claim, and FTC health-claim guidance, but cannot guarantee App
Review, legal compliance, or revenue.

CAT-03 is now an `in_progress` source checkpoint. Its offline contract binds a
target policy signed before outcomes, a separately consented and privacy-
minimized **defined beta-shelf coverage corpus**, a deterministic curation/
untouched-holdout split, an independently witnessed full-record decision,
confidence-bound quality gates, exact multi-batch/four-scope CAT-01/CAT-02
lineage with exactly one target-lineage primary artifact, primary-barcode-only
serving, qualified row review, staged reviewer-root/operator signatures, and a
database snapshot that seals every client-readable field and child-row set. A
hard release floor now
requires at least 2,000 independently sourced, reviewed, activation-eligible
records, every required-category minimum, and at least 100 demand-prioritized
eligible rows. Migration `0058` adds campaign-scoped non-serving product
authorization, a single exact-set atomic global campaign release, independently
signed point-in-time readback, immutable retirement, and RPC-only `service_role` access, and makes
the active global campaign a positive serving dependency. Every mutation of
sealed served state appends a per-product event under the release lock. Outcome
reviewers bind each current `servedStateMutationRootSha256` and the campaign root
set, so exact byte restoration, correction-hold closure, source reapproval, or
batch restoration cannot resurrect old authority; recovery requires a newly
reviewed successor campaign and readback. Beta demand
prioritizes independently sourced rows; it never becomes a product fact. The
planned self-selected beta cannot support a market-representative claim. The
legacy beta coverage report and an offline-only approval are informational
only. No real consented corpus, witnessed pre-outcome target/decision, qualified
catalog or U.S. OTC-adjacent review, 2,000-record launch campaign, exact local/
hosted `0058` evidence, current signed database readback, sealed holdout result, or
active catalog exists, so CAT-03 is not complete and no Apple, legal, product-
quality, market, or revenue outcome is implied.

CAT-04 is now an `in_progress` source checkpoint, blocked by `CAT-03`, `H-07`,
and `H-08`. The candidate normalizes UPC-E/manual package codes, rejects
malformed or unreviewed network projections, prevents stale search results,
requires identity-bearing first-party correction reports, preserves every
failure fallback, and makes Shelf creation idempotent across an uncertain
retry. Migration `0059` purges and seals the legacy raw `shelf_scans` relation
and enforces outcome-only `catalog_lookup_events`; raw search terms, barcodes,
matched-product IDs, source keys, and quality grades cannot be retained in that
analytics table. Offline retry is an explicit encrypted,
account/health-consent-bound, seven-day device queue whose reviewed result requires visible user confirmation
before any Shelf change. Apple, FTC, Washington, Canadian, Quebec, and
California primary-source analysis is recorded in the CAT-04 checkpoint. Local
source checks pass 15 focused mobile files / 200 tests, 16/16 runner contracts,
Phase 4 source-policy/import/QA/promotion/serving-Edge lanes at 27/27, 20/20,
17/17, 23/23, and 23/23, the 35/35 focused report/export/health Deno lane, the
data-rights/policy/RLS/security code gates, and the full 289-file / 3,361-test
mobile baseline. Governed CAT-04 Expo-web evidence passes all 45 scenario
executions and all 18 consent bootstraps at 375 x 667, 390 x 844, and 430 x 932
with zero browser failures, 365 tracked files, and 144 screenshots. It remains
fixture-only evidence with `nativeDeviceProof=false`. A real hosted ready-
candidate reconnect cycle, live hosted owner/withdrawal/export/deletion
evidence, active-catalog proof, physical-iPhone camera/accessibility matrix,
App Privacy reconciliation, and professional privacy/security/legal review
remain open; CAT-04 is not launch-clear.

CAT-05 is now a `source candidate / launch-blocked` checkpoint. A strict local
Expo module pins Apple Vision text recognition revision 3, `.accurate`
recognition, automatic language detection, bounded request/response and image
inputs, cancellation/timeout handling, editable confidence-aware Unicode/RTL
review, a user-edit fence, manual recovery, minimized categorical/coarse
analytics, and bounded managed plus Expo Camera startup cleanup. Only the
internal EAS `staging` profile enables the candidate; `development` and
`production` remain disabled. The governed deterministic Expo-web packet bound
to source `fec382eddd0e79f73b4c38b5de30d996928a8fc9` passes 15/15 UI scenario
executions across the three supported viewports and 4/4 explicit-consent
bootstraps with zero browser failures. It retains 139 non-summary artifacts,
including 55 PNGs, at
`test-results/human-e2e/2026-07-18/cat05-native-ocr-web-ui-current/`. The packet
records `nativeDeviceProof=false`: it does not execute or prove Apple Vision,
the Swift module, a camera, an iOS binary, physical-device behavior, native
privacy cleanup, OCR accuracy or latency, native accessibility, archive
linkage, App Review acceptance, legal clearance, or revenue. The 375 x 667
manual-handoff PNG does not show the Ingredients field or its prefill, so that
compact visual handoff is unproven. The fixture includes multilingual Unicode
but no Arabic or Hebrew RTL sample, so RTL remains source/physical-device
unproven. The macOS/Xcode compile remains unverified and pending. Exact signed-
archive linkage, two physical iPhones, the governed 25-label/50-run matrix,
zero-network and cache-digest proof, VoiceOver/Dynamic Type, performance,
corpus rights, and qualified privacy/security/legal review remain open. CAT-05
remains `in_progress` and launch-blocked; no commercial outcome is implied.

DB-06 is also a source checkpoint and remains `in_progress`, blocked by
`ACCT-03`. The fresh-only source procedure now covers all 58 migrations through
`0059`, all 16 Edge functions, an active traffic/provider freeze, and an
immediate pre-push reread of functions, public frozen responses, hosted Auth
controls, migrations, schema, Storage, and all Cron jobs. It leaves
`DB06_TRAFFIC_FREEZE=frozen` for a separate downstream live-gate release. No
approved hosted target was used and no live DB-06 evidence directory exists.

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
