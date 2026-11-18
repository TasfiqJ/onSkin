# All 38 requirements and 18 gates

Source `efd3af803a2a71bd2fdd644ecfd500c619fb996c` / tree `83670a073910a840c69368f1760d5cb59d021054`. All rows and gates remain **UNACCEPTED**, readyForIndependentAcceptance=false; release **NO_GO**. Exactly one Korean assessment: J01 Visible Pores. F18 and J02–J27 remain deferred.

Each row separates local implementation from missing product/qualification. Evidence points to real tests; no passing JavaScript suite admits security or scientific acceptance.

## F01 — Brand and legal identity

- **Implemented:** Brand/configuration and policy-link refusal guards exist.
- **Missing:** Cleared public identity, seller, territories, final assets and authenticated public destinations.
- **Tests/evidence:** Brand/configuration regression; frozen source refs. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Install only independently approved identity/assets/destinations and test refusal for incomplete configuration.
- **External qualification:** Founder, counsel, trademark/content rights and domain/account owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## F02 — Accounts, age, privacy and consent

- **Implemented:** Owner/account-generation, age, health lifecycle and original-lease gates precede private reads/writes; all three durable draft families join export and withdrawal. E25 key reads are non-mutating.
- **Missing:** Genuine complete account/link/recovery/backend authority and production cross-device rights lifecycle.
- **Tests/evidence:** 490 focused privacy tests; root regression; synthetic onboarding/browser. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Finish genuine auth integration and durable tombstone/restore contracts after authorized custody; preserve denial before payload reads.
- **External qualification:** Auth/DB/security custodians, native SecureStore and device qualification.
- **Independent acceptance:** UNACCEPTED; not ready.

## F03 — Full Shelf intake

- **Implemented:** Shelf manual intake and bottle transcription have explicitly saved encrypted drafts, list/resume/discard/review/confirm and restart recovery; no automatic observation success.
- **Missing:** Admitted OCR/catalog input and qualified physical camera intake.
- **Tests/evidence:** bottleDrafts/manualIntakeDrafts tests; current manual browser; E20 bottle browser. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Connect approved catalog/OCR adapters; improve bounded unavailable/conflict recovery without inferring unknown payloads.
- **External qualification:** Catalog rights, native OCR/camera and device owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## F04 — Rights-reviewed catalog

- **Implemented:** Catalog import/report/operator quality/refusal foundations remain.
- **Missing:** Rights-reviewed serving membership, approved installed content and genuine reviewer/correction operations.
- **Tests/evidence:** Catalog operator 24 tests; frozen source refs. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete serving/correction interfaces and operator lifecycle once actual source and reviewer authority are supplied.
- **External qualification:** Catalog rights reviewers, DB/security and operating staff.
- **Independent acceptance:** UNACCEPTED; not ready.

## F05 — Reviewed conflict guidance

- **Implemented:** Conflict-checking/refusal foundations and reviewed-source boundaries exist.
- **Missing:** Admitted current clinical/cosmetic corpus, claims, jurisdiction and review lifecycle.
- **Tests/evidence:** Root conflict/refusal regressions; no clinical validation. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Wire approved versioned corpus and conservative coverage/refusal UX; no fabricated advice.
- **External qualification:** Clinical/cosmetic/regulatory reviewers and content rights.
- **Independent acceptance:** UNACCEPTED; not ready.

## F06 — Version-aware routine builder

- **Implemented:** Actual routine records and immutable intended plan/version records remain separate; a response does not mean actual use.
- **Missing:** Complete intended-to-actual application bridge, immutable professional templates and unshelved-item resolution.
- **Tests/evidence:** Routine/plan regression; professional browser uses synthetic intended records. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement explicit exact-version review/application and template UX against approved authority interfaces.
- **External qualification:** Professional/DB custody and qualified clinical plan content.
- **Independent acceptance:** UNACCEPTED; not ready.

## F07 — Today and adherence

- **Implemented:** Today records actual use separately from optional self-report history. Durable optional drafts require explicit fresh review; latest collapsed panel directly opens Saved change drafts.
- **Missing:** Hosted synchronization/delete-wins restore and full native/accessibility qualification.
- **Tests/evidence:** 48 mounted panel cases; current optional browser; root history tests. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Finish approved sync/tombstone protocol; validate direct saved-draft entry across real navigation and accessibility modes.
- **External qualification:** DB custody and native/device accessibility QA.
- **Independent acceptance:** UNACCEPTED; not ready.

## F08 — Cycle, ramp and recovery

- **Implemented:** Cycle/ramp/recovery source rules, explicit observations and conservative refusal remain.
- **Missing:** Admitted reviewed cadence, safety content and exact-build physical behavior.
- **Tests/evidence:** cycleReadiness/planRecovery regression; E27R mock adapters preserve original assertions. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete approved recovery presentation and connect reviewed rules without asserting causality from self-report.
- **External qualification:** Clinical review, native reminders and supported devices.
- **Independent acceptance:** UNACCEPTED; not ready.

## F09 — Private photo diary and comparison

- **Implemented:** Encrypted photo diary/history/manual comparison, purpose-bound delete journals and exact ciphertext provenance exist. Source-missing recovery requires retained pre-move proof; uncertain orphan data is preserved.
- **Missing:** Qualified native capture/key/filesystem/EXIF/deletion lifecycle, complete authenticated remote cleanup and product recovery for uncertain data.
- **Tests/evidence:** photoDeleteR3/encryptedStorage focused tests; current native NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Design explicit safe recovery for refused/orphaned ciphertext and source-bound remote deletion; preserve no-guess rules.
- **External qualification:** Physical camera/filesystem, security/DB and privacy review.
- **Independent acceptance:** UNACCEPTED; not ready.

## F10 — Local OS reminders

- **Implemented:** Local reminder scheduling/cancellation and privacy/account boundary coordination exist.
- **Missing:** Signed-device delivery, permission/background/timezone/DST and failure recovery qualification.
- **Tests/evidence:** Root reminder tests; native source ledger only, no current OS delivery. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Close device-discovered scheduling/cancellation defects only after authentic traces.
- **External qualification:** Apple/native devices and notification qualification.
- **Independent acceptance:** UNACCEPTED; not ready.

## F11 — Standard subscriptions

- **Implemented:** Verified subscription/entitlement boundary and conservative unavailable states exist.
- **Missing:** Genuine supported StoreKit/provider purchase, restore, refund/revocation and commercial operations.
- **Tests/evidence:** Root entitlement/refusal tests; payment NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete authorized native/provider adapters and exact receipt lifecycle; no local paid flags as authority.
- **External qualification:** Apple/merchant/provider owners and sandbox qualification.
- **Independent acceptance:** UNACCEPTED; not ready.

## F12 — Compliant introductory offer

- **Implemented:** Approved Apple-managed offer strategy and current-subscriber terms are retained; unsafe custom reverse grant remains unavailable.
- **Missing:** Actual eligible offer configuration, classification, purchase/restore and pre-charge lifecycle.
- **Tests/evidence:** Frozen contract/offer refusal regression; no offer qualification. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement only approved offer/eligibility interfaces after commercial decision.
- **External qualification:** Apple, merchant/provider and counsel.
- **Independent acceptance:** UNACCEPTED; not ready.

## F13 — Reviewed recommendations

- **Implemented:** Recommendation/refusal foundations preserve source boundaries.
- **Missing:** Rights-reviewed recommendations, eligible corpus and operational updates.
- **Tests/evidence:** Root recommendation/refusal regression, no recommendation acceptance. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Connect approved versioned recommendations with explanation and bounded refusal.
- **External qualification:** Clinical/content reviewers and rights/operations.
- **Independent acceptance:** UNACCEPTED; not ready.

## F14 — Provider-real safe Ask

- **Implemented:** Ask safety/unavailable boundaries exist.
- **Missing:** Provider-real authenticated safe service, reviewed answers, privacy/retention and operator response lifecycle.
- **Tests/evidence:** Root unavailable/safety tests; no paid/API calls. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Build approved backend/provider interfaces and negative lifecycle once authorized; maintain unavailable default.
- **External qualification:** Provider, security/clinical/legal and staffed operations.
- **Independent acceptance:** UNACCEPTED; not ready.

## F15 — Private-safe sharing

- **Implemented:** Explicit selected private-safe briefs and local rights export exist; strict owner-bound draft codecs join export.
- **Missing:** Native share residue qualification, original-source professional bridge and durable hosted rights fulfillment.
- **Tests/evidence:** localDeviceExport/selectiveCleanup focused tests; professional owner browser uses synthetic fixtures. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete source-authenticated selection/export and tombstone fulfillment adapters; preserve unknown/refused data.
- **External qualification:** Native privacy QA, legal retention and DB custody.
- **Independent acceptance:** UNACCEPTED; not ready.

## F16 — Commerce and replenishment

- **Implemented:** Commerce/replenishment domain and conservative unavailable boundaries remain.
- **Missing:** Actual merchant/provider rails, inventory, orders/refunds and operational fulfillment.
- **Tests/evidence:** Root commerce/refusal regressions; real commerce NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement approved commerce adapters and negative lifecycle after authorized terms.
- **External qualification:** Merchant/provider/account and funded operations.
- **Independent acceptance:** UNACCEPTED; not ready.

## F17 — Moderated community / Skin Notes

- **Implemented:** Skin Notes/community source/refusal foundations exist.
- **Missing:** Real staffed moderation/report/escalation/appeal/deletion service and enforceable permissions.
- **Tests/evidence:** Root community/refusal tests; no staffed moderation evidence. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete moderation tooling/role lifecycle and conservative publication only after operations plan.
- **External qualification:** Named moderation lead, legal/privacy and backend owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## F19 — Widgets and Live Activities

- **Implemented:** Signed widget/snapshot and privacy-lifecycle foundations exist; cross-process admission remains constrained.
- **Missing:** Qualified atomic App Group delivery, interactive widgets/Live Activities and real privacy boundary behavior.
- **Tests/evidence:** Root widget lifecycle tests; native ledger NOT_QUALIFIED. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Close authenticated native App Group/readback failures with exact trace; do not use JS tests as cross-process proof.
- **External qualification:** Apple entitlement/signing, native/device and security owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## F20 — Operator, support and administration

- **Implemented:** Operator catalog console and content-free support/administrative domain rules exist.
- **Missing:** Complete real privileged operator roles, support tooling, audit/incident/backup and staffed capacity.
- **Tests/evidence:** 24 catalog tests and professional authority tests; no staffed operation acceptance. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete least-privilege administrative UX/adapters and durable audit/restore protocols after custody.
- **External qualification:** Named security/support/release operators and backend role owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C01 — Access/consent/rights

- **Implemented:** Current original owner/processing lease and persisted lifecycle authorize draft/record access; withdrawal removes classified draft keys and export enforces owner.
- **Missing:** Genuine hosted account, recovery, consent rights requests and durable restore/delete-wins.
- **Tests/evidence:** 490 focused privacy tests incl. export/cleanup/admission. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Integrate authorized auth/rights adapters; retain strict stale-owner/epoch refusal and exact readback.
- **External qualification:** Security/DB/legal custodians and physical-device privacy testing.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C02 — Formula-aware intake

- **Implemented:** Formula-aware bottle observations and manual intake support explicit encrypted saved drafts and exact source review before confirmation.
- **Missing:** Admitted OCR/catalog and complete cross-device formula provenance.
- **Tests/evidence:** Bottle/manual tests; current manual browser at 375/390/430. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Connect approved intake source and conflict recovery; preserve exact snapshot and operation IDs.
- **External qualification:** Rights/native OCR/DB owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C03 — Change ledger

- **Implemented:** Append-only use/correction history remains. E23 separates raw envelope CAS proof from v5 inner completion/event-predecessor proof; exact readback governs retirement.
- **Missing:** Genuine original-record ingestion, hosted idempotency/tombstones and recoverable unsupported legacy states.
- **Tests/evidence:** optionalChangeDraftProof23 and completion/history tests; legacy schema2 refused. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Finish authenticated ingestion and explain bounded proof refusal without rebuilding proofs from current data.
- **External qualification:** DB/source custody and security review.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C04 — Optional exceptions

- **Implemented:** Optional add/correct/retract drafts are encrypted, durable, bounded, reviewed and explicitly resumed/refreshed/discarded. Direct Today inventory entry uses original authority/focus generation.
- **Missing:** Native and full navigation accessibility qualification; richer safe handling of unprovable legacy/unknown saves.
- **Tests/evidence:** 48 mounted cases; current optional browser; 490 privacy subset. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Test/directly improve refusal recovery while preserving exact facts, target hash, revision, original lease and explicit review.
- **External qualification:** Native/device and security custodians.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C05 — Current plan/version

- **Implemented:** Current intended version, immutable plan hashes and owner responses remain distinct from actual use.
- **Missing:** Exact intended-to-actual application, unshelved resolution and real source ingestion.
- **Tests/evidence:** Professional 651 tests and synthetic queue/owner journeys. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Build explicit source-bound application/reconciliation UX after bounded domain review.
- **External qualification:** Professional/DB/clinical authority.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C06 — Product decisions

- **Implemented:** Product-decision refusal and ordinary-record foundations exist.
- **Missing:** Complete advanced decision engine and atomic three-free quota authority.
- **Tests/evidence:** Root product/entitlement tests; no advanced quota qualification. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement bounded decision/quota transaction and explicit failure states without restricting ordinary records.
- **External qualification:** Approved clinical sources, genuine entitlement and DB authority.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C07 — Private progress/capture

- **Implemented:** Private photo capture/history/manual comparison remains separate from J01; no automated positive measurement admitted.
- **Missing:** Signed-device image/privacy lifecycle and qualified J01 optical pipeline.
- **Tests/evidence:** Photo focused regressions; all device/scientific qualifications NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Close source-authenticated photo recovery/deletion gaps; keep scientific results closed.
- **External qualification:** Native/security/rights and J01 G1-G5 reviewers.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C08 — Appointment brief

- **Implemented:** Selected appointment/pre-visit records, history/export/offboarding and contradiction refusal exist.
- **Missing:** Genuine original immutable owner-record source adapter and fully connected authorized professional flow.
- **Tests/evidence:** Professional pre-visit tests; synthetic owner HTTP fixtures. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement authenticated original source adapter, scope projection and safe retention/purge.
- **External qualification:** Legal retention, professional/DB custody and source rights.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C09 — Reminders

- **Implemented:** Local reminders honor lifecycle and account cleanup; billing safety reminder remains separate from health-purpose deletion.
- **Missing:** Real permission/delivery/background/cancellation and accessibility behavior.
- **Tests/evidence:** Root notifications/cleanup tests; no native qualification. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Close exact-device lifecycle defects based on real traces.
- **External qualification:** Apple/device QA and privacy review.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C10 — Consumer packaging/billing

- **Implemented:** Ordinary private records, subscription refusal and approved offer strategy remain separate from advanced entitlement.
- **Missing:** Real provider authority, quota accounting, compliant offer and purchase/restore lifecycle.
- **Tests/evidence:** Root billing/offer tests; payment gate NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete verified entitlement/quota integration after owner commercial authorization.
- **External qualification:** StoreKit/provider/merchant and Apple.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C11 — Accessible recovery/IA

- **Implemented:** Six generic local recovery rows expose status for bottle, manual, optional, photos, reminders and widgets without private names/counts; draft inventories support explicit actions.
- **Missing:** Whole-app VoiceOver, larger text, contrast, keyboard/focus and error/recovery coverage on actual devices.
- **Tests/evidence:** Current recovery browser; mounted focus tests; narrow viewport evidence is not full accessibility qualification. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Perform bounded UX/accessibility work and improve explanation of safe refusal; validate latest direct entry with real navigation.
- **External qualification:** Native accessibility QA and independent review.
- **Independent acceptance:** UNACCEPTED; not ready.

## V2-C12 — Support/measurement

- **Implemented:** Content-free support/measurement boundaries and local diagnostics exist.
- **Missing:** Staffed support capacity, incident/backup/restore response and privacy-qualified measurement operations.
- **Tests/evidence:** Root support/refusal tests; operational qualification NOT_RUN. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete bounded support/audit interfaces and operational runbooks after named ownership.
- **External qualification:** Support/security/privacy and funded operations.
- **Independent acceptance:** UNACCEPTED; not ready.

## P01 — Workspace roles

- **Implemented:** Universal role/action and workspace isolation rules require current membership, adult session, AAL2/TOTP and appropriate step-up; roles do not imply client-content access.
- **Missing:** Real verified identity/licence/MFA, membership/seat management and current server authority.
- **Tests/evidence:** 651 professional domain/client tests; positive browser authority is synthetic. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Connect authorized identity/roster/seat providers and explicit negative lifecycle.
- **External qualification:** Professional identity/licence/DB/security owners.
- **Independent acceptance:** UNACCEPTED; not ready.

## P02 — Client grants/web

- **Implemented:** Practice/client grants bind fields, purpose, versions/epochs, health state, assignment, licence and billing before private plan reads; default real API503.
- **Missing:** Installed trusted backend/custody and genuine grant, session and serial transaction drivers.
- **Tests/evidence:** Authority/revoked-read ordering tests; real API refusal in professional browser. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement approved authenticated adapters without browser/client JSON authority.
- **External qualification:** DB/security/legal/professional custodians.
- **Independent acceptance:** UNACCEPTED; not ready.

## P03 — Pro plans/templates

- **Implemented:** Immutable intended plans and exact owner acknowledgement/decline exist independently of actual routine.
- **Missing:** Practice-scoped templates, complete authoring/issue/apply path and unshelved-item handling.
- **Tests/evidence:** Plan/receipt/capacity tests; synthetic plan browser. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement provider-free versioned template and review UX on bounded domain interfaces; real issuance remains gated.
- **External qualification:** Clinical content, practitioner identity and trusted backend custody.
- **Independent acceptance:** UNACCEPTED; not ready.

## P04 — Queue/reconciliation

- **Implemented:** Review queue hashes/material revisions and exact intended versions exist; E20 latest explicit owner response projection is source-hash bound, not inferred outcome.
- **Missing:** Real original owner event adapter, named staff assignment/calendar/digest/delivery and operational reconciliation.
- **Tests/evidence:** 651 professional tests; current queue browser including unknown retry/stale callbacks. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete scoped assignment/reconciliation UX and genuine immutable source adapter; retain unknown-save idempotent retry.
- **External qualification:** Practice roster/grants, DB, lawful communications and staff operations.
- **Independent acceptance:** UNACCEPTED; not ready.

## P05 — Pre-visit/offboarding

- **Implemented:** Selected mixed pre-visit records validate referenced actual-use facts and exact routine provenance; retained history/export/offboarding is distinct from grant access.
- **Missing:** Genuine original source adapter, independent practice copy/retention/purge policy and tombstone-first hosted restore.
- **Tests/evidence:** Contradiction/row-order tests and current owner browser synthetic fixtures. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Implement authenticated source projection and lawful retention/purge protocol after legal/custody decision.
- **External qualification:** Legal, DB and genuine owner/practitioner access.
- **Independent acceptance:** UNACCEPTED; not ready.

## P06 — Workspace billing/capacity

- **Implemented:** Separate billing/capacity domains gate writes; access denial precedes plan read and receipt/capacity commit remains atomic under local transaction fixture.
- **Missing:** Real provider/serial driver, membership/seats, downgrade notices and capacity administration.
- **Tests/evidence:** 651 professional tests; no live payment or commercial operation. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Complete safe billing/admin adapter and negative effective-downgrade lifecycle after authority supplied.
- **External qualification:** Merchant/provider, staffed capacity and hosted serial transactions.
- **Independent acceptance:** UNACCEPTED; not ready.

## J01 — Visible pores

- **Implemented:** Visible Pores is the only Korean assessment in scope. Capture/privacy/retake/unavailable boundaries exist; positive counts, dimensions, scores, diagnosis and change claims stay disabled.
- **Missing:** Authenticated research/rights intake, optics/calibration, person-disjoint frozen evaluation, supported-stratum errors/abstention, longitudinal qualification and signed-device lifecycle.
- **Tests/evidence:** Refusal/capture regressions and frozen scope; no positive measurement evidence. Full exact-source root test run passes 8652 tests; this is regression evidence, not full row qualification. See TEST_EVIDENCE_INDEX.md for source/time/scope.
- **Remaining code:** Only bounded refusal/intake work is locally permissible after separate assignment; no fabricated labels, model result or scientific/device validation.
- **External qualification:** G1/G2/G3/G5 for single scan and G4 separately for change, scientific/rights/privacy/clinical/device reviewers.
- **Independent acceptance:** UNACCEPTED; not ready.

## Acceptance gates

### G97 — UNACCEPTED

Frozen status: FAIL/NO_GO. Owner: Original Security custodian. Required acceptance: Original rules/pins/tool/secret/OSV/source inventory and exact-source acceptance; expiry 2026-10-21T00:00:00Z unchanged

Original protected Security/candidate findings remain unwaived; ordinary JS privacy tests do not admit this gate. Original custodian must review rules/pins/expiry/source inventory and exact-source scanner findings. No scanner rerun/provider credential probe performed.

### DB — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Canonical DB06/DB08/R2B custodian. Required acceptance: DB06/DB08/R2B qualified owner exact-environment admission remains absent; hosted canonical technical success is separate evidence

Canonical DB06/DB08/R2B custody/acceptance absent. Local serial adapters and historical PostgreSQL rehearsals are distinct. Custodian admission and genuine production-style serial/restore/deletion evidence.

### M1-03 — UNACCEPTED

Frozen status: BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED. Owner: Independent Brain and protected custodians. Required acceptance: Whole M1-03 acceptance from authentic exact-source Security/DB evidence, not alternate PG rehearsal

Blocked external Security/DB custody; latest local checkpoint does not alter acceptance. Independent Brain plus original protected custodians.

### M2-01 — UNACCEPTED

Frozen status: NOT_AUTHORIZED. Owner: Independent Brain. Required acceptance: Accepted M1-03 then separate finite implementation authorization; ADR038 corrections remain due

Not authorized by local engineering or this evidence relay. Actual accepted M1-03 and a separate finite authorization.

### G1 — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Physical iPhone imaging engineer. Required acceptance: Real native pixels, resolving power, capture region/device/light/distance and repeatability evidence; no upscaling-as-detail

No current native optical/resolving-power qualification. Real supported-device capture region/light/distance/repeatability.

### G2 — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Source-rights counsel, image scientist and statistician. Required acceptance: Authenticated exact J01 dossier, target/rights/consent/annotation and frozen person-disjoint evaluation manifest

Authenticated J01 research/rights and frozen independent evaluation absent. Person-disjoint data, rights/consent/annotation/target definition and scientific intake.

### G3 — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Independent image scientist and statistician. Required acceptance: Locked single-scan pipeline, independent supported-stratum errors, coverage and honest abstention at each claim granularity

No qualified single-scan pipeline/errors/coverage/abstention. Frozen independent per-stratum evaluation; local synthetic tests cannot provide it.

### G4 — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Independent longitudinal reviewer. Required acceptance: Separate common-support repeatability/noise/change study; absent now, no pore change/trend

No qualified longitudinal change/noise/repeatability study. Separate common-support longitudinal study; no trend/change claim.

### G5 — UNACCEPTED

Frozen status: NOT_ACCEPTED. Owner: Privacy/security, clinical/regulatory reviewers and native release operator. Required acceptance: Exact signed build, image lifecycle/zero-egress if claimed, fairness, cosmetic copy, device and operations evidence

No current exact signed-build image lifecycle/fairness/privacy/claims admission. Security/privacy/clinical/native independent review and actual devices.

### RIGHTS — UNACCEPTED

Frozen status: GATED. Owner: IP/content/source-rights reviewer. Required acceptance: Exact catalog/code/weights/data/image/text licences and permitted distribution; articles do not supply imaging labels

Real corpus/code/data/weights/image/text distribution rights not accepted. Exact-source licences and permitted-use review by rights owners.

### CLINICAL — UNACCEPTED

Frozen status: GATED. Owner: Dermatologist, cosmetic chemist and regulatory counsel. Required acceptance: Exact corpus/claim/country/use review with credentials, conditions and source/build hash; no blanket approval

No blanket clinical/cosmetic/regulatory acceptance. Qualified reviewers, exact corpus/claim/country/use/build and conditions.

### PROVIDER — UNACCEPTED

Frozen status: NOT_RUN. Owner: Provider/merchant operator. Required acceptance: Actual supported service and terms, deployment, negative lifecycle, access/recovery and operational evidence

Real supported backend/professional services deliberately unavailable. Approved provider/terms/deployment and real negative lifecycle/operations.

### PAYMENT — UNACCEPTED

Frozen status: NOT_RUN. Owner: StoreKit/RevenueCat and workspace billing owners. Required acceptance: Real verified sandbox/native/provider lifecycle and commercial permission; no local paid flag or free quota authority

No genuine purchase/restore/provider lifecycle executed. Approved merchant/StoreKit/provider sandbox and commercial permission.

### MODERATION — UNACCEPTED

Frozen status: NOT_RUN. Owner: Named moderation lead. Required acceptance: Actual staffed report/escalation/appeal/deletion coverage and enforceable tooling; no placeholder policy

No actual staffed moderation qualification. Named coverage, enforceable reports/escalations/appeals/deletion.

### OPERATIONS — UNACCEPTED

Frozen status: NOT_RUN. Owner: Support/security/release operators. Required acceptance: Named funded coverage, incident, backup/restore/tombstone and capacity evidence before real hosted promises

No named/funded production incident/support/backup/restore capacity evidence. Operational owners and authentic tombstone/capacity/incident drills.

### DEVICE — UNACCEPTED

Frozen status: NOT_RUN. Owner: Physical-device QA. Required acceptance: Exact signed supported-iPhone flows, accessibility, photos/reminders/widgets/purchase and cancellation evidence

Current Windows web tests/builds are not iPhone qualification. Exact signed supported-device accessibility/photos/reminders/widgets/purchases/cancellation.

### APPLE — UNACCEPTED

Frozen status: NOT_AUTHORIZED. Owner: Apple account/release owner and Apple. Required acceptance: Actual agreements/identity/signing, privacy/offer classification, signed install, App Review; no account mutation authorized here

No account/signing/App Review authorization in this relay. Owner-controlled agreements/identity/signing/privacy/offers and actual signed install/review.

### PUBLIC — UNACCEPTED

Frozen status: NOT_AUTHORIZED. Owner: Founder after independent Brain review. Required acceptance: All38 required contract rows and all applicable gates satisfied at one exact build, then separate explicit public availability authorization

Release remains NO_GO; evidence publication is not product availability. All38 and applicable gates at one exact build, independent Brain review, then explicit founder release authorization.
