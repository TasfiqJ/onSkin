# Phase 9 Source Of Truth

Phase 9 turns the exact release candidate into evidence. A build is not release-ready until the release-candidate folder for that build contains the exact build-source Git SHA, iOS EAS build ID, EAS channel/runtime, Supabase project, RevenueCat project, Sentry project, PostHog project, App Store records, QA evidence, rollback proof, and named signoff.

Do not treat generated scripts or templates as launch evidence. Non-strict
checks prove the repo has the right gates. Strict checks require recorded live
staging/production evidence and named-owner approval metadata, but the checks
do not authenticate the owner or substitute for the underlying human review.

## Seven-Figure Standard

At a seven-figure subscription target, trust defects become revenue defects. Phase 9 blocks launch on known gaps in account deletion, export coverage, entitlement correctness, RLS isolation, observability payload privacy, store compliance, device QA, rollback ownership, and incident response.

## Release Candidate Rule

Every evidence packet must point to one immutable source revision and one exact
production iOS build. Evidence from an earlier build can inform investigation,
but it does not sign off a later release candidate. Android release evidence is
not applicable under the current iOS-only launch contract.

The RC manifest `Build-source Git SHA` is the revision uploaded to EAS, not the
later evidence or generated-packet commit. The governed history has four
explicit states:

1. `S` is the immutable application/configuration/dependency/policy revision
   used to build the binary.
2. `E` is one non-merge evidence commit whose sole parent is `S`. The selected
   RC `evidence-chain.json` binds `S` and every other `S..E` changed path by an
   exact role, canonical repository path, and SHA-256. The ledger excludes
   itself, and the `S..E` diff must equal the ledger plus its entries exactly.
3. At least one strictly linear generated-packet commit must follow `E`; the
   last pre-readiness commit is `R`. Every `E..R` commit may change only exact
   governed generated-output paths. It cannot change direct evidence or any
   source, dependency, configuration, script, or policy path.
4. The readiness commit `F` is the sole direct child of `R`, is last, and
   changes only the two readiness outputs; no later commit may inherit its
   conclusion. A collapsed `S -> E -> F` chain is invalid.

Generated packets are published in dependency order, one exact pair per
single-parent commit: `E -> human manifest -> Phase 5 -> Phase 7 -> Phase 9
prerequisites -> Phase 9/remaining packets -> R -> readiness F`. Phase 5 must
consume the already committed human manifest, Phase 7 must consume the already
committed Phase 5 packet, and Phase 9 must consume the already committed Phase
5, Phase 7, and beta-coverage packets. Each packet's non-writing check proves
that its JSON/Markdown pair is the complete diff of the direct child of the
recorded pre-publication prefix, that replay inputs match that prefix, and that
neither output was edited later.

The Phase 4 beta prerequisite additionally binds the exact ignored mounted
aggregate input bytes and an exact six-key, all-true evidence inventory. Run
`npm run phase4:beta-coverage-report:check` after committing that pair and
before generating Phase 9. After readiness `F` is committed, run
`npm run release:governed-packets:check`; it executes all 16 implemented
deterministic non-writing replays in dependency order plus their focused
contracts. Units without a reviewed replay remain structurally verified only.
The aggregate never reruns live/mutating evidence collection, and the store
inspector remains a separately labelled current-state non-replay check. This is
a post-publication RC verifier and is intentionally separate from pre-`S`
source-health workflows that write new packets.

The central contract lives in
`scripts/launch/governed-evidence-chain.mjs`. The ledger is built from the exact
staged index with `scripts/phase9/build-evidence-chain-ledger.mjs`; it is not
assembled by trusting working-tree directory enumeration. The builder requires
`HEAD == S`, a normal collision-free index, stable single-link working files
matching their staged `100644` blobs, no unstaged tracked changes, and no
nonignored untracked file other than the ledger output. It writes the ledger
atomically and aborts on root, path, index, blob, worktree, or output drift.

The chain verifier ignores inherited Git repository/configuration and replace
selection, pins the real repository root and `HEAD`, rejects merges and
nonlinear ancestry, proves the exact `S..E` ledger equality, reads bounded Git
blobs, verifies every ledger digest and mode at `E` and `HEAD`, permits only the
central exact generated allowlist afterward, and rechecks a clean worktree and
normal complete index. Every required RC metadata file must also be an exact
`release-candidate` ledger entry and a stable tracked file matching `HEAD`.
This permits evidence and deterministic packets to be recorded after a build
without allowing a later build input or raw-evidence mutation to inherit that
binary's evidence.

The RC's tracked `signoff.md` Security/privacy owner/date must match the archive
JSON privacy review, and its Release manager owner/date must match the JSON
release review and `PHASE9_SIGNED_OFF_BY`. This identity binding prevents
contradictory reviewer metadata; it does not authenticate a person or prove the
underlying review truthful.

Before any `PHASE9_*_PASS=true` flag or `PHASE9_SIGNED_OFF_BY` value is accepted, set `PHASE9_RELEASE_CANDIDATE_DIR` to a non-template folder under `docs/phase-9/release-candidates/`. The Git worktree must be clean, the folder must contain the full RC packet, the manifest build-source SHA must match `PHASE9_IOS_SOURCE_GIT_SHA`, every RC file must be customized from the template and bound to the evidence commit, and every unresolved placeholder must be replaced with reviewed evidence.

Generated QA packets are supporting artifacts, not launch signoff by themselves. The packet must hash the packet builder, every Phase 9 verifier script, `.env.example`, the RC template/source docs required by the smoke gate, and any selected RC folder, and its Markdown summary must show whether it was generated from a clean or dirty Git worktree so reviewers can reject stale or mixed-worktree evidence.

Generated live evidence must also be minimized. Cleanup failures are blocking errors, not warnings. Evidence may record only authored assertion text, redacted error kinds, or stable codes; it must not include raw provider/database messages, temporary test emails, synthetic order IDs, tokens, URLs, or other diagnostic payloads.

Consent-withdrawal signoff additionally requires the protected staging artifact produced by
`phase9:live-consent-withdrawal:strict`. The artifact must match the current 0054 migration,
harness, evidence-contract and copy-contract hashes; the exact checked-out Git SHA and clean
tree; the independently reviewed canonical Supabase project; a seven-day timestamp window;
and the ordered eight-check manifest with no warnings or cleanup errors. The
`PHASE9_CONSENT_WITHDRAWAL_PASS` flag is review metadata only and cannot replace that artifact.
The current 15 copy-registry tuples remain `draft_blocked`, so the live grant setup cannot
pass until a reviewed migration-owner copy transition exists; this is an intentional launch
blocker, not evidence to bypass with direct ledger writes.

The data-export registry is an executable security boundary. Its caller set must exactly match the canonical 28 owner-client tables, every service-only mutation must be rejected, and every backend read must use the verified JWT user ID with explicit output columns. Reverse-trial and subscription-event coverage satisfy that source contract. The bounded account service-row scrub also fails closed, covers all seven subscription owner fields, deletes account-only events and clicks, preserves another live owner, and attests zero residue before Auth deletion. Migration `0059` purges and seals the deprecated OBF contribution queue, revokes its runtime table/enqueue authority, and removes it from executable export coverage while retaining historical erasure/zero-residue compatibility. Migration `0059` also purges legacy raw scan rows and seals `shelf_scans`; it is not a caller export lane or a reconnect queue. The same migration purges and constrains the owner-linked `catalog_lookup_events` identity columns to null, leaving only lookup type, bounded result, and timestamps in that export lane.

Migrations `20260713000048` through `20260713000052` and the durable account-deletion runtime close bounded server-lifecycle gaps for barriers, ordered worker leases, encrypted provider state, no-blind-redispatch reconciliation, account-owned rate-limit cleanup, locked Storage/service-row re-attestation, at-most-once Auth deletion, durable status/receipts, RevenueCat late-write tombstones, and exact-session publication admission. Migration 0052 seals short-lived publication capabilities, drains them atomically at deletion intake, allows local erasure only after exact authority end, and gates RevenueCat completion on a five-minute settle plus two claim-distinct full-family absence rounds at least 60 seconds apart. The source contract still requires hosted Edge/mobile proof that every publication path complies and an approved provider block, enforceable mandatory-version gate, or continuing re-deletion control for old/tampered clients. RevenueCat deletion requires REST API v2 and a V2 key; V1 credentials do not work with v2. Required-mode PostHog completion requires async status evidence and two interval-separated absence observations. Apple fixed-origin exchange must bind the returned token identity to the authenticated Apple subject, and only an exact exchange followed by Apple's exact `200` no-body revoke response may report automatic revocation. Missing or failed proof records a durable manual-revocation outcome instead of false success.

DB-10 remains launch-blocked on reviewed hosted clean-reset, publication-lease and exact-session concurrency, process-death/configure-in-flight/lost-release, Cron/Vault continuity, provider interruption/lost-response, Storage residue, mobile relaunch/status, RevenueCat alias/restore/recreation, PostHog async completion, Apple native revocation, old/tampered-client control, and production monitoring evidence. Migration 0055 and the mobile/Edge source now add nonce/state plus one-use-code capture, a versioned encrypted refresh-token vault, daily validation, signed Apple event ingress, native server invalidation, deletion-vault reuse, and exact-session denial across RLS, photo Storage, authenticated Edge functions, writes, and direct authenticated helper RPCs. The source observes Expo's supported iOS revoke event and checks the authenticated Apple subject before publishing a restored session and again at foreground. Unknown states or native check failures remain behind the retryable session gate; confirmed invalid credentials are durably quarantined before local/global sign-out. The quarantine stops account activity while retaining owner-bound local-first records; only a fresh matching owner can reopen them, while a different or unprovable owner clears them before publication. Every successful daily validation atomically re-derives the current subject digest and freshly seals the token under the current vault key; dormant, deferred, or failing rows do not advance from configuration alone, and an old key cannot be retired without zero-row evidence or affected-account recapture/reauthentication. This implementation does not replace hosted primary-App-ID event registration/delivery, worker/rotation drills, stale-JWT proof, or physical-iPhone/TestFlight evidence. Migration 0054 now detaches another user's report and moderation evidence when a withdrawing owner deletes a community question, while erasing the withdrawing owner's own reports; hosted proof and a named retention/legal decision remain open. Sentry pseudonym erasure/retention, waitlist/growth purpose-linked deletion, cross-owner community-handle cleanup, and staff-principal handling still require scoped implementation or named professional decisions. The exact operational contracts are `docs/phase-9/account-deletion-operations-runbook.md` and `docs/phase-9/apple-auth-lifecycle-operations-runbook.md`; source and rehearsal completion must not be described as race-free or production readiness.

Terminal signed-event closure does not depend on Apple delivering a duplicate.
A verified terminal event may transiently exact-match one Apple Auth identity;
when the event precedes that identity, first capture submits current and retained
subject aliases and reconciles the audience-bound keyed event under the owner
lock before code dispatch. The committed result is a no-vault terminal
lifecycle, session destruction, and the durable six-step deletion graph. The
raw Apple subject is never persisted, and exact duplicate promotion remains an
opportunistic idempotency path only.

The current migration-0055 local replay gate passed two clean resets, exact
54-migration history, the full structural pgTAP suite plus 114/114 Apple
lifecycle assertions, schema lint, an empty migration shadow diff, temporary
type generation, 20/20 focused Apple event/lifecycle Edge tests, and the
47-test Apple auth work lane. This evidence is local and disposable; it does not
replace reviewed hosted, provider-delivery, stale-JWT, or physical-device proof.

## iOS Privacy Source Audit Boundary

The deterministic installed-source audit is a required pre-archive gate. It
pins Apple's reviewed privacy baseline, the repository's explicit SDK mapping,
`package-lock.json`, installed package identities, strict plist semantics,
podspec source tokens, bounded native artifact candidates, and the generated
JSON/Markdown ledgers. The current result is `archive_required`: 63 native
packages, 14/14 source-valid privacy manifests, 14 manifest-resource source
bindings requiring archive verification, 139 podspecs, 16 XCFramework
candidates, no standalone frameworks or `.a`/`.dylib` candidates, ten exact
Apple SDK-list intersections, zero errors, and 15 warnings.

The `react-native-view-shot` repair is exact-hash and fail-closed. It changes
only the reviewed invalid empty `NSPrivacyAccessedAPITypes` key, and EAS runs a
read-only post-install check so drift cannot silently pass. This is installed
source validation, not evidence that evaluated Pods or a bundle contains the
manifest.

The audit excludes first-party/linked source, generated prebuild, resolved
CocoaPods/SPM output, and the production archive. Separate first-party config
validators and exact archive inspection must cover those surfaces. The typed
archive-evidence-index gate accepts only a repository-confined, regular
`.xcarchive.zip` or IPA. From the exact collected and hash-bound bytes, it
applies bounded ZIP flag/version/extra-field, path/collision,
contiguous-record, size, CRC, and DEFLATE checks and requires one exact
IPA/xcarchive app layout. It parses XML/binary app and archive property lists,
matches bundle/version/build/executable/team/application-path identity, and
requires the executable and `_CodeSignature/CodeResources`. It structurally
parses the embedded provisioning profile's CMS SignedData and matches its team,
App-ID prefix, production-distribution, iOS-platform, and build-time/current
validity fields. It then binds the container's size/hash to the current source
SHA, source-audit hash and ledgers, EAS UUID/Git SHA/log, release identity,
resolved toolchain, ten exact evidence artifacts, four explicit attestations,
and distinct named privacy and release approval metadata. It rejects path
escapes, links/hardlinks, duplicate/colliding paths or byte regions,
stale/tampered files, malformed or duplicate-key JSON, mutable image aliases,
false attestations, placeholder reviewers, and timestamp inversions.
The validator's pass means only that this evidence index is internally
consistent, contains the parsed release identity, and contains distinct named
approval metadata. It does not authenticate those reviewers, prove their
approvals truthful, cryptographically verify the app code signature, trust the
provisioning-profile CMS signature, validate DER-Encoded-Profile, interpret
privacy/API reports, or machine-interpret any other evidence report. It never
claims legal compliance or App Store acceptance.

Before IOS-09 can close, retain the exact completed
`ios-archive-privacy-evidence.json`, archive file, resolved native lock, merged
privacy report, per-bundle manifest ledger, required-API use/declaration
report, native-binary and SDK-signature evidence,
signing/entitlements/symbols/processing results, and supported-device evidence.
STORE-04 separately requires observed traffic/storage reconciled to final App
Privacy answers and named privacy/legal review. Source validity is not legal
clearance, App Review acceptance, or revenue proof, and a review boolean cannot
substitute for the evidence.

## RLS Evidence Contract

The migration-derived public-schema inventory is 80 tables: 28 owner-client private tables, eight directly service-only private tables, 22 sealed service-private lifecycle/authority tables, four sealed global clinical/editorial tables, four sealed catalog-authority tables, and 14 authenticated catalog/editorial tables. Migration `0054` adds seven force-RLS, sealed health-consent lifecycle/copy tables; migration `0055` adds three force-RLS, sealed Apple lifecycle/capture/event tables; migration `0057` moves `catalog_import_batches` and `catalog_quality_reports` from direct service access behind the exact catalog-import RPC lifecycle and seals `catalog_sources` because its legal approval and reviewer fields are release authority rather than client catalog data. Migration `0058` removes the active-only read policies and every API-role SELECT grant from `conflict_rules`, `sequencing_rules`, `creator_stacks`, and `creator_stack_items` until a separate evidence-bound B-DERM publication authority exists. It also removes direct API-role reads from the legacy/dictionary authorities `ingredient_tags`, `ingredient_pao_defaults`, `product_categories`, and `ingredient_tag_definitions`; bounded serving functions consume reviewed projections instead. Migration `0058` additionally creates seven `private`-schema sealed CAT-03 campaign/record/product-mutation/product-event/product-head/global-release-event/global-release-head authorities; they are outside the 80-public-table count and must deny every direct API-role path. Migration `0059` purges the legacy account-linked barcode history, removes all `shelf_scans` policies and API-role privileges, and force-RLS seals that relation. It also purges and seals `obf_contribution_queue`, revokes all runtime table/enqueue authority while retaining the empty relation for account-erasure compatibility, and purges/check-constrains every raw identity field in `catalog_lookup_events`; only its owner-linked lookup type, bounded result, and timestamps remain. Migration `0060` deletes every legacy `ingredient_pao_defaults` row, removes its read policy, force-RLS seals and revokes the relation, and validates an always-false check so it cannot be repopulated. `product_categories` remains sealed editorial/future-candidate metadata and is not a serving estimate. Migration `0061` limits authenticated PAO reads to bounded, reviewed `label`, `brand_label`, or `catalog` evidence tied to the exact parent product source; `category_default` and `unknown` remain excluded. Migration `0062` adds covered CAT-03 authority indexes and a bounded statement-level count/root-set guard while retaining the per-row checks. Migration `0063` adds 15 private CAT-08 operator-authority relations whose separate contract denies every raw API-role path. Migration `0064` adds fail-closed, hash-bound quiz/profile provenance without rewriting existing rows during upgrade. Migration `0065` repairs the operator transition's ambiguous conflict targets and closes PostgreSQL's global default PUBLIC function-execute ACL while preserving the existing exact-role gateway posture. Every public table must be classified exactly once and have RLS enabled. The current matrix source registers all 66 public-schema tables classified private exactly once: the 36 directly queryable tables receive row-positive owner/cross-user, real signed-anonymous, and publishable-key-with-no-session probes, while all 30 sealed public-schema tables deny direct access to every API role, including `service_role`. The regenerated hosted matrix must prove that 66-table posture and add the seven CAT-03 and 15 CAT-08 `private`-schema authorities as separate exact ACL/denial lanes. These identities and denial lanes are not interchangeable.

Negative database assertions accept only the exact expected PostgreSQL/PostgREST code, or exact empty rows for operations whose RLS semantics permit that result. Negative Storage assertions accept only typed authorization outcomes, with operation-specific not-found or empty-result allowances plus state-preserving owner/admin reads. Network failures, invalid requests or JWTs, missing buckets, and server failures must fail the harness. Cleanup must verify that synthetic database rows, Auth users, and Storage objects are gone.

The credential-free behavioral smoke and static contract prove the harness/source shape only. DB-09 and DB-10 remain live-blocked until the complete 64-migration chain through `20260726000065_catalog_operator_transition_conflict_target.sql` passes a reviewed hosted reset and the 80-public-table/66-public-schema-private classification plus seven-CAT-03/15-CAT-08-`private`-schema-authority matrices produce redacted, clean-revision staging and production evidence. Evidence flags cannot substitute for those runs.

## Current Non-Code Blockers

- Final brand/domain/store identity must be approved.
- Live Supabase staging and production RLS tests must be run.
- Production Apple, Google OAuth for iPhone, RevenueCat, PostHog, and Sentry
  accounts must be configured.
- Physical iPhone QA must be attached; Android is source-health work, not iOS
  launch evidence.
- The App Store review packet must be completed from the final metadata; Google
  Play review evidence is not applicable under the current iOS-only contract.
- Closed beta metrics and launch kill criteria must be evaluated.
- Legal/privacy/clinical signoff must be named.
