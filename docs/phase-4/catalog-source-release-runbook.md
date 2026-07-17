# CAT-01 Catalog Source Release Runbook

Date: 2026-07-17
Status: source-control workflow implemented; external approvals, production
artifacts, signed archive evidence, hosted promotion, and live verification
pending

This runbook governs Open Beauty Facts (OBF) and CosIng source releases. It is
an engineering control, not a legal opinion, Apple approval, or authorization
to promote catalog rows. The checked-in trust registry, release scope, build
evidence, and approval templates are deliberately pending.

## Non-Negotiable Launch Boundary

- Importers perform no network I/O. OBF and CosIng are not runtime recipients.
- OBF images and every source image field remain excluded.
- Missing-product and wrong-match reports stay in OnSkin's owner-scoped,
  first-party correction workflow. No report or user lookup is published to a
  source.
- A fixture or unsigned candidate can test mechanics and compute exact hashes,
  but can never authorize production.
- Launch scope is exactly the United States. A new territory requires a new
  reviewed release scope and matching evidence.
- CosIng/OBF presence is provenance, not proof that an ingredient or product is
  approved, safe, effective, suitable, or recommended.

Current review references reinforce those boundaries. Apple App Review
Guidelines [1.4.1](https://developer.apple.com/app-store/review/guidelines/)
subjects medical apps and potentially inaccurate health information to greater
scrutiny and requires health-measurement accuracy claims to disclose supporting
data and methodology; sections 1.5, 2.1, 2.3, and 5.1 also make accurate support
contact, complete/live review surfaces, accurate metadata/claims, and privacy
handling release concerns.
The [FDA cosmetics-claims guidance](https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-claims)
requires truthful, non-misleading cosmetic claims and explains that disease or
structure/function claims can make a product a drug. The
[FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
requires adequate prior substantiation for express and implied health or safety
claims. Passing this runbook does not guarantee App Review or legal acceptance.

## 1. Freeze the Transformer Baseline

1. Use a clean, committed source tree. Do not approve or promote from a dirty
   checkout.
2. Run the source-policy, importer, and QA smoke suites.
3. Run `npm run phase4:source-policy-audit` against the deliberately pending
   baseline controls. A passing pending baseline proves fail-closed wiring; it
   does not prove a source or build is approved.
4. Record the baseline Git commit and audit output. The final approval-bound
   transformer descriptor is recorded later from build-candidate commit A.

The audit recognizes exactly three coherent control states:

1. baseline: pending trust registry / pending release scope / pending build
   evidence;
2. build candidate: active trust registry / approved release scope / pending
   build evidence;
3. release: active trust registry / approved release scope / verified build
   evidence.

Every other mix fails. Clean commit A is created in build-candidate state and is
the exact commit EAS builds. Evidence-only descendant B records the verified
build evidence bound to A; it must not change the approved transformer or build
configuration payload. Re-run the same audit at all three transitions.

## 2. Acquire and Inspect Non-Promotable Candidates

Acquire each source artifact outside the app and retain its source URL,
upstream hash, acquisition record, exact bytes, and snapshot date. Do not crawl
an API or use search-as-you-type. From the clean committed tree, create
hash-only candidates under the ignored `artifacts/phase4/` directory:

```bash
node scripts/phase4/import-obf-snapshot.mjs --candidate path/to/obf-products.jsonl artifacts/phase4/obf-candidate.json
node scripts/phase4/import-cosing-dictionary.mjs --candidate path/to/cosing.csv artifacts/phase4/cosing-candidate.json
```

Candidate outputs are `candidate_transform_not_approved` /
`candidate_hash_only`. Archive their exact source-artifact, transformer, and
transformed-payload hashes for reviewers, but never upload their rows to a
servable catalog. A preliminary candidate can expose malformed input early, but
only a candidate regenerated from final build-candidate commit A in step 4 may
supply the transformer and payload hashes used in an approval.

## 3. Activate the External Trust Registry

1. Create separate Ed25519 legal and engineering reviewer identities with
   distinct people, reviewer IDs, independence groups, and keys.
2. Populate `catalog-source-trust-registry.json` with bounded validity windows,
   an incremented epoch, and active reviewer records.
3. Sign the canonical registry payload with an external Ed25519 root. The root
   private key stays offline and outside the repository, EAS, app, and runtime.
4. Supply only the public root key ID/SPKI plus the exact current registry epoch
   and raw-file SHA-256 through `CATALOG_TRUST_ROOT_*` and
   `CATALOG_TRUST_REGISTRY_*`. The epoch/hash pin prevents replay of an older,
   otherwise valid root-signed registry.

Self-issued reviewer keys, reused reviewer identity, an expired/revoked key, a
missing external pin, or a root signature mismatch must fail closed.

## 4. Approve the Fixed Release Scope

Populate `catalog-release-scope.json` with evidence for the exact:

- cleared display name and iOS bundle ID;
- app version and iOS build number;
- final public host, support email, and attribution surface;
- US territory;
- approval and expiry window.

Choose and manually advance the reviewed 1-18 digit positive-decimal iOS build
number, with no leading zero, before creating commit A. Production
`app.config.js` requires and embeds
`CATALOG_RELEASE_IOS_BUILD_NUMBER`; `eas.json` uses `appVersionSource=local` and
`autoIncrement=false`. Never depend on EAS auto-increment for this release
binding. A changed build number requires a new fixed scope, build-candidate
commit, approval binding, and archive evidence.

The resolved production Expo config, `APP_VARIANT=production`,
`EXPO_PUBLIC_APP_ENV=production`, `CATALOG_RELEASE_TERRITORIES=US`, final-domain
values, and fixed scope must agree exactly.

Commit the active registry, approved scope, and still-pending build-evidence
record as clean build-candidate commit A. Run the audit in
active/approved/pending mode. Regenerate both exact candidates from A and record
A's Git commit/tree, Node version, policy/importer bytes, mobile build
configuration, package manifests, Phase 3 gate, launch contract, artifact hash,
and deterministic transformed-payload hash. Those are the only candidate
bindings reviewers may sign in step 5.

## 5. Produce Two-Signature Source Approvals

Create retained approval records from the OBF and CosIng templates; do not turn
the pending templates themselves into evidence by changing only `decision`.
Each approval binds the raw policy, registry, and release-scope hashes; exact
artifact bytes/hash/source/snapshot; current transformer bundle and runtime;
deterministic transformed-payload hash; territories and projected fields;
terms/acquisition/attribution evidence; source-specific determinations; and
named operations owners.

Both the active legal key and a distinct active engineering key sign the same
canonical approval payload. OBF approval additionally records counsel's exact
database classification and matching attribution, share-alike, offer-of-data,
component-separation, and machine-readable-delivery posture. CosIng approval
records exact reuse/attribution/third-party-rights treatment, the retained
glossary decision, and the informative-only claim boundary.

The current OBF filtering/normalization transformer permits only the
conservative `derivative_database` /
`entire_derivative_or_alterations_machine_readable` pair with deployed delivery
evidence. A collective-component legal conclusion does not fit this transformer
and requires a new reviewed policy/transformer revision; operators must not
force it through by changing approval text alone.

Evidence URIs and hashes are retained reviewer attestations. Syntax and
cryptographic binding do not prove that a public URL is live or that the
underlying legal conclusion is correct; a reviewer must inspect the retained
bytes and deployed surface.

## 6. Bind the Actual iOS Release Build

After EAS builds clean build-candidate commit A and its archive is inspected,
create evidence-only descendant B by replacing the pending
`catalog-release-build-evidence.json` with a verified record that binds:

- the real canonical lowercase EAS build UUID, `production` profile, `ios`
  platform, lowercase 40-hex source Git commit, and resolved Expo-config
  SHA-256;
- the inspected IPA and Info.plist hashes plus exact bundle ID, short version,
  and build number;
- a structured App Store release record that repeats the 5-20 digit numeric app
  ID with no leading zero, exact archive bundle ID/version/build, US-only
  territory list, and observation timestamp, plus retained resolved-config, EAS
  metadata, archive inspection, and App Store release evidence;
- one current active engineering verifier signature over the canonical build
  evidence.

EAS supplies `EAS_BUILD_PROFILE`, `EAS_BUILD_PLATFORM`, `EAS_BUILD_ID`, and
`EAS_BUILD_GIT_COMMIT_HASH` during the build. A post-build verification shell
must use the exact retained values for commit A. The release validator must
prove B is an allowed evidence-only descendant and that the approved
transformer/config payload did not drift. A manually typed flag is not archive
or App Store evidence, and the archive build number must equal the manually
reviewed number embedded in A.

The validator cross-checks that structured App Store record against the fixed
scope and inspected archive, and the signature binds it into the retained
record. This does not authenticate App Store Connect or prove the underlying
screenshot/export is truthful. The engineering verifier must inspect the
retained evidence and confirm the app, bundle/version/build, and US availability
correspond before signing.

## 7. Re-run the Exact Production Transforms and QA

Use the same source bytes and clean committed transformer that reviewers
approved:

```bash
node scripts/phase4/import-obf-snapshot.mjs --production path/to/obf-products.jsonl artifacts/phase4/obf-approved-transform.json --approval-manifest path/to/signed-obf-approval.json
node scripts/phase4/catalog-qa-report.mjs artifacts/phase4/obf-approved-transform.json artifacts/phase4/obf-catalog-qa.json

node scripts/phase4/import-cosing-dictionary.mjs --production path/to/cosing.csv artifacts/phase4/cosing-approved-transform.json --approval-manifest path/to/signed-cosing-approval.json
node scripts/phase4/catalog-qa-report.mjs artifacts/phase4/cosing-approved-transform.json artifacts/phase4/cosing-catalog-qa.json
```

Production QA must have zero blockers and zero warnings. It must revalidate the
embedded approval bytes and signatures, current policy/registry/scope,
transformer and Git identity, deterministic transformed payload, production
Expo/EAS identity, signed build evidence, exact source schema and provenance,
and the source-specific field limits. The convenience package scripts
`phase4:qa-report` and `phase4:qa-report-cosing` use checked-in fixture paths and
prove only local fixture coverage; approved evidence comes from the explicit
commands above.

## 8. Stage, Promote, Serve, and Roll Back

CAT-01 produces approved transform evidence; it does not mutate the database.
CAT-02 must load into staging, perform dedupe/conflict and human review, and
promote or roll back transactionally.

Migration `20260717000056_catalog_serving_eligibility_gate.sql` must be present
and pass its pgTAP contract on the exact hosted revision. Its service-only
barcode and search RPCs share one fail-closed eligibility boundary. A row is
servable only when its source is production-approved and legal-approved; the
product is active, reviewed, `verified` or `usable`, recommendation-eligible,
and correction-free; and its barcode mapping is reviewed when barcode lookup
is used. Live open/triaged corrections suppress serving even if a denormalized
counter drifts. Direct authenticated reads cannot bypass source withdrawal.

Unknown and held rows return the same no-match/manual fallback so internal
review or legal status is not disclosed. Opening a first-party correction must
suppress the row immediately. Emergency containment sets the affected source
to not production-approved, verifies both RPCs and direct reads return no rows,
then follows the CAT-02 batch rollback procedure. No rollback step publishes a
user report to OBF or CosIng.

## Release Record

Retain together:

- source bytes, upstream/acquisition evidence, and candidate hashes;
- exact policy, active root-signed registry, external epoch/hash pins, and
  approved release scope;
- dual-signed OBF/CosIng approvals and their reviewed evidence bytes;
- exact production transform outputs and zero-warning QA reports;
- signed EAS/archive/App Store release-build evidence;
- hosted migration/reset/pgTAP/type/schema-diff evidence through `0056`;
- catalog promotion, rollback, correction-SLA, and named reviewer/operator
  records.

Any changed source bytes, transformer, build-source Git tree, policy, trust
registry, reviewer key, release identity, build, territory,
attribution/data-delivery surface, approval window, or non-allowlisted path
after commit A requires a new exact release record. Descendant B's allowlisted
evidence files remain part of that same A-bound release record.
