# CAT-04 Search, Barcode, and Recovery Source Checkpoint

Date: 2026-07-18
Status: `in_progress` source candidate; blocked by `CAT-03`, `H-07`, and `H-08`

## Decision

CAT-04 may advance as a local source candidate only. The current changes make
catalog search, barcode lookup, wrong-match reporting, no-match recovery, manual
fallback, and reconnect recovery fail closed around the reviewed first-party
catalog. They do not establish an active production catalog, legal clearance,
App Store acceptance, or commercial results.

The release posture is:

- barcode frames are decoded on device and are never stored;
- decoded barcodes and search terms may be sent to the app's first-party Edge
  Function only to service the current request;
- migration `0059` purges and seals the legacy raw `shelf_scans` history;
- `catalog_lookup_events` retains only the owner-linked bounded dimensions
  `lookup_type`, `result`, and time. Migration `0059` clears and thereafter
  prohibits raw queries, barcodes, matched-product IDs, source keys, and quality
  grades in that table;
- an offline retry is an explicit user action stored in encrypted,
  account/health-consent-bound device storage. It becomes logically ineligible
  seven days after enqueue; its encrypted bytes are purged on the next app
  activation, queue read/maintenance, local export, or account/consent lifecycle
  cleanup, not necessarily at that wall-clock instant while the OS has the app
  suspended or terminated;
- reconnect can produce only a minimal reviewed candidate and can never mutate
  Shelf data without a visible accept/reject decision;
- a missing-product or wrong-match report is a separate first-party user action.
  Before `Send report`, the route displays the exact product-identity fields,
  account linkage, first-party operator recipient, export/deletion treatment,
  and third-party catalog-recipient boundary. Service intake requires bounded,
  actionable identity before persistence. No report is sent to Open Beauty
  Facts or another catalog source;
- network responses are treated as untrusted. Only exact reviewed, currently
  servable product projections are accepted; external, unreviewed, malformed,
  extra-field, or mismatched-barcode responses become the existing safe manual
  fallback.

## Primary-source research and implementation consequences

### Apple

1. [App Review Guideline 2.5.14](https://developer.apple.com/app-store/review/guidelines/)
   requires explicit consent and a clear visual or audible indication when the
   camera records or otherwise captures user activity. Entering the dedicated
   Scan route is treated as the user-initiated context for the system camera
   prompt; the visible camera preview/reticle is the active indication. Physical
   iPhone proof remains required.
2. Apple requires
   [`NSCameraUsageDescription`](https://developer.apple.com/documentation/bundleresources/information-property-list/nscamerausagedescription)
   whenever camera APIs are used. The archive must be rechecked to prove the
   final purpose string is present, specific to barcode/label capture, and
   matches runtime behavior.
3. Apple's [privacy Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/privacy/)
   say permission should be requested in context. If an extra pre-alert is
   essential, it should have one action such as `Continue`, must not imitate the
   system `Allow` action, and should not add a cancel path. CAT-04 therefore
   requests the system prompt directly on the focused user-opened Scan route;
   the post-denial recovery action is named `Continue` or `Open settings` as
   appropriate.
4. Guidelines 5.1.1 and 1.6 require accurate privacy disclosures, consent,
   withdrawal/deletion paths, purpose strings, and appropriate safeguards.
   Guideline 5.1.3 treats health data as especially sensitive, and Guideline
   1.4.1 subjects medical or accuracy claims to greater scrutiny. CAT-04 adds no
   diagnosis, treatment, safety verdict, or accuracy promise.
5. Guidelines 2.1 and 2.3 require a complete, stable build and accurate
   metadata. Fixtures are development-only and cannot establish App Review
   completeness. A real backend, review account, URLs, physical-device matrix,
   and release archive remain open.
6. Guidelines 5.2.1 and 5.2.2 require rights to third-party material and services.
   Runtime OBF requests and unapproved external candidates remain excluded;
   CAT-01/CAT-03 source-rights and curation gates still control what may serve.
7. Apple's [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
   define collection as off-device transmission retained beyond servicing the
   real-time request and state that on-device-only processing is not collected.
   The final App Privacy answers must separately classify retained Shelf,
   correction-report, account, health, usage, and processor data. This source
   memo does not decide the App Store Connect answers for the legal entity.

### Identifier integrity

GS1's current [2D Barcodes at Retail Point-of-Sale Implementation Guideline](https://ref.gs1.org/guidelines/2d-in-retail/)
distinguishes GTIN-8, GTIN-12/UPC-A, GTIN-13/EAN-13, and GTIN-14, identifies
UPC-E as an eight-digit carrier for a GTIN-12, and explains that leading zeroes
used to fit a shorter GTIN into a fixed 14-digit carrier are filler rather than
a new identifier. GS1's [check-digit guidance](https://www.gs1.org/services/how-calculate-check-digit-manually)
also treats the final digit as an integrity check derived from the preceding
digits. CAT-04 therefore validates the checksum, expands complete UPC-E to its
GTIN-12/UPC-A identity, collapses zero-padded aliases at intake, and prohibits
noncanonical aliases in reviewed database serving rows. This verifies number
shape and identity consistency only; it does not prove GS1 ownership,
assignment, product category, or catalog accuracy.

### United States and Canada

1. The FTC's [Mobile Health App Interactive Tool](https://www.ftc.gov/business-guidance/resources/mobile-health-apps-interactive-tool)
   says consumer health apps may be outside HIPAA while still being subject to
   the FTC Act and potentially the Health Breach Notification Rule. The current
   [16 CFR Part 318](https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-318)
   expressly covers many mobile health tools and treats unauthorized access or
   disclosure of unsecured PHR-identifiable health information as a potential
   breach. Applicability must be decided by U.S. privacy counsel from the final
   entity, data sources, and integrations; the app must not claim that HIPAA is
   the governing or exclusive privacy rule.
2. Washington's [My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true)
   requires a consumer-health-data privacy policy, purpose-specific collection
   consent or necessity, separate sharing consent or necessity, withdrawal and
   deletion handling, processor restrictions, and reasonable security. The
   first-party lookup purpose must remain disclosed and narrow; a catalog or
   affiliate recipient cannot be added without a fresh legal/data-flow review.
3. The Canadian privacy regulators' [Guidelines for Obtaining Meaningful Consent](https://www.priv.gc.ca/en/privacy-topics/business-privacy/collecting-personal-information/consent/gl_omc_201805/)
   call for understandable disclosure of what is collected, recipients,
   purposes, and meaningful risks; express consent is generally expected for
   sensitive information. Consent is not permission for indiscriminate
   collection. Removing duplicate raw scan/search history is therefore a
   substantive control, not just copy work.
4. Quebec's [Act respecting the protection of personal information in the private sector](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1)
   requires privacy governance, privacy impact assessment for a new or overhauled
   information system involving personal information, necessity/minimization,
   highest confidentiality settings by default, appropriate security, express
   consent for sensitive use/communication, and a cross-border assessment before
   communication outside Quebec. The required professional PIA and contractual
   processor review remain external gates.
5. California's [CCPA guidance](https://oag.ca.gov/privacy/ccpa) identifies health
   information and certain inferences as sensitive personal information, but
   statutory applicability depends on facts such as entity type and thresholds.
   Counsel must decide applicability; the implementation follows minimization,
   access, correction, deletion, and purpose-limitation principles regardless.

These sources are current research inputs, not legal advice. Laws, regulator
interpretations, Apple policies, the final business entity, storefronts, and
actual production data flows can change. Qualified counsel and the relevant
privacy/security owners must review the final build and evidence.

## Implemented source controls

- UPC-E expands deterministically to UPC-A. Manual eight-digit input requires
  an explicit EAN-8 or UPC-E choice; incomplete manual UPC-E is rejected;
  supported UPC/EAN/GTIN input is canonicalized and checksum-gated before
  persistence. Fixed-length zero-padded GTIN aliases collapse to the same
  natural key, and reviewed database serving rows cannot retain an invalid or
  noncanonical alias. Code 128 is rejected because no strict GS1 application-
  identifier parser exists.
- Search generations prevent stale responses from replacing a newer query.
- Search/report/save actions use `try`/`catch`/`finally`, preserve user input,
  show route-owned errors, and do not leave controls permanently busy.
- Missing/wrong-match reports require the explicit confirmation described
  above. UI feedback distinguishes confirmed success, not configured,
  offline/withdrawn, busy/retryable, rate limited, request conflict, invalid
  input, and generic failure. One random content-free request ID is bound to
  the exact owner, health epoch, and sanitized report body; an ambiguous retry
  returns the committed current-status receipt instead of duplicating operator
  work. Only a newly created confirmed receipt emits the privacy-safe
  `reported` outcome.
- The wrong-product scan path carries the exact reviewed product UUID into a
  minimal `wrong_match` report; missing reports require a normalized barcode or
  bounded product name. Identifier-free or malformed reports fail before the
  service RPC.
- Shelf creation uses a stable per-submission operation UUID so an uncertain
  retry returns the already-created row instead of duplicating it.
- Scan analytics contain only a bounded result bucket. Raw barcode/product
  identity is absent from the analytics call and from both database scan logs.
- Migration `20260718000059_catalog_scan_minimization.sql` purges and force-RLS
  seals `shelf_scans`, removes it from caller export and direct owner probes,
  and makes outcome-only `catalog_lookup_events` an enforced database invariant.
  It also read-seals correction rows, makes one validated top-level GTIN the
  only barcode lane, nonrecursively sanitizes hostile legacy report JSON,
  bounds report identity/payloads and timestamps, and leaves reporter-facing
  fields available only through the sanitized exact-owner service export. The
  deprecated external-contribution queue is purged and force-RLS sealed; its
  compatibility RPC is inert and executable by no runtime role.
- The encrypted device reconnect queue has strict decoding, unique normalized
  barcodes, 64-item capacity, a seven-day logical TTL, capped exponential
  backoff, single-flight foreground drain, exact owner/health-lease admission,
  and physical byte purge on the next activation, read/export, or lifecycle
  cleanup. The source does not promise wall-clock deletion while the OS suspends
  or terminates the app. When an account owner is verified, local export removes
  foreign-owner residue before reading the exact-owner snapshot; a verified
  unclaimed local store preserves its validated live queue records while the
  recursive export sanitizer removes embedded owner identifiers. Lookup
  revalidation, stale-write protection,
  and exact candidate accept/reject primitives remain enforced. Rejection or a
  successful accepted Shelf mutation consumes the item; a
  failed/canceled/stale operation does not silently discard it. Final retention
  wording and legal treatment remain subject to qualified privacy/legal review.
- Camera denial, Settings handoff failure, catalog offline/error, no-match,
  wrong-match, and manual/search/OCR exits remain visible and recoverable.
- Label photos are moved under one app-managed cache prefix and are never
  uploaded. Cancel, Continue, retake, capture failure, and unmount request
  idempotent deletion; startup scavenging removes a bounded batch and keeps
  capture visibly paused until retries prove no managed stale files remain.

## Verification at this checkpoint

Passing local source checks at the integrated source-candidate checkpoint
include:

- combined barcode, report, encrypted-queue, reconnect, export, label-photo,
  route, health-admission, and idempotent-store mobile lane: 15 files / 200
  tests;
- CAT-04 runner contracts: 14/14;
- Phase 4 source-policy/import/QA/promotion/serving-Edge lanes: 27/27, 20/20,
  17/17, 23/23, and 23/23 respectively;
- focused report/export/health Deno lane: 35/35;
- Phase 2 local source contract and Phase 9 data-rights, policy, RLS, and
  security code gates: pass, including 10/10 RLS smoke assertions with expected
  warnings where live evidence is absent;
- mobile typecheck and full mobile test suite: 289 files / 3,360
  tests.

These are local source checks. The deterministic Expo-web runner declares 15
scenarios across 375 x 667, 390 x 844, and 430 x 932 (45 scenario executions)
plus 18 fixture-group consent bootstraps. It deliberately cannot fabricate a
production lookup that turns a persisted offline request into a ready candidate
across restart, so a real hosted ready-candidate accept/reject cycle remains
outside that matrix. Generated evidence must bind to the exact committed source
SHA and pass the human-E2E manifest gate before it is cited as current.

## Release gates that remain open

- CAT-03 has no real approved 2,000-record launch catalog or current signed
  production readback; CAT-04 therefore cannot prove a real eligible match.
- Fresh hosted migration `0059` reset, pgTAP, RLS, account switch, withdrawal,
  export, deletion, backup, and zero-residue evidence is absent.
- Physical iPhone/TestFlight evidence is required for the real system camera
  prompt, denial and Settings return, preview indicator, barcode acquisition,
  UPC-E/UPC-A/EAN/GTIN reads, duplicate suppression, torch, interruptions,
  VoiceOver, keyboard, Dynamic Type, reduced motion, and supported devices.
- Current web human-simulated E2E must pass all three declared launch viewports
  for the deterministic 45-scenario/18-bootstrap contract without treating web
  fixtures as native or backend proof. A real hosted restart/reconnect ready-
  candidate accept/reject cycle remains separately required.
- App Store Connect privacy answers, privacy-policy/consumer-health-policy text,
  support and deletion URLs, review notes, non-expiring review access, and final
  archive metadata must be reconciled to observed production traffic and the
  governed final app identity.
- Qualified U.S./Canadian privacy, consumer-protection, source-rights,
  security, cosmetic/OTC-adjacent, and Quebec cross-border/PIA review remains
  required for the final entity and launch markets.

`CAT-03`, `H-07`, and `H-08` remain blocking dependencies: the first must supply
an active reviewed catalog, the second current professional decisions tied to
the exact release, and the third supported physical-iPhone evidence. CAT-04
stays `in_progress` until these and the hosted/evidence gates above close. No
statement in this checkpoint guarantees Apple approval, legal compliance,
catalog accuracy, user adoption, or revenue.
