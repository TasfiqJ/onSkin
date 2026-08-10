# CAT-01 Open Beauty Facts Engineering Source-Rights Checkpoint

Date: 2026-07-17
Status: engineering research recorded; production legal approval pending

## Source

Open Beauty Facts is the cosmetic/personal-care sibling of Open Food Facts.

- Open Beauty Facts repository: https://github.com/openfoodfacts/openbeautyfacts
- Product Opener API documentation: https://openfoodfacts.github.io/openfoodfacts-server/api/
- Official license guide: https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side/
- ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Source-candidate use in Layerwell: reviewed offline catalog artifacts for product identity, brand/name/category, and ingredient text. Request-time lookup and external contribution are excluded from the launch architecture; no environment flag can add OBF to the runtime recipient graph.

## Primary-Source Findings (Not Legal Approval)

- Product Opener documentation describes an open database model with ODbL/database-content/image licensing distinctions.
- Product Opener's current API documentation identifies v3 as current and v2 as deprecated. This is recorded for source due diligence, not as authorization for Layerwell to call either version.
- Product Opener requires a custom User-Agent for API reads.
- Product Opener warns bulk users to use exports rather than API crawling.
- Search-as-you-type and bulk API import are disallowed for Layerwell until explicit permission exists.
- Product data is community-maintained and must be treated as possibly incomplete or inaccurate.
- The database, individual database contents, and images have different stated license layers. Packaging imagery can also carry rights outside those licenses, so product images stay disabled.
- ODbL permits commercial use but can impose attribution, share-alike, and offer-of-data duties for public derivative databases/produced works. Whether Layerwell's exact combination is derivative or collective remains a counsel decision.
- The current filtering/normalization transformer is deliberately narrower
  than that legal question: production validation accepts only the conservative
  derivative-database plus entire-derivative-or-alterations machine-readable
  delivery implementation. A collective-component conclusion requires a new
  reviewed transformer/policy revision rather than a manifest-only change.
- A user's exact barcode/product lookup is product-interest data and may be health-inferential. Sending it to Open Beauty Facts would create a live recipient that the current empty external-health-processor inventory, sharing notice, retention/deletion plan, and provider evidence do not cover.

## Engineering Preparation and Gated Candidate Transform

The following actions are not production promotion. Candidate mode computes the
deterministic exact hashes reviewers need and is always non-promotable.
Production mode requires a completed exact-artifact approval manifest, active
externally anchored trust registry, approved fixed release scope, and the exact
production environment; fixture and reviewed Layerwell-catalog flows do not:

- Fixture import from local sample data.
- Exact barcode lookup against reviewed rows already stored in the local Supabase catalog.
- Reviewed offline snapshot/export transformation with no user request attached and no runtime provider call.
- Hash-only candidate transformation under ignored `artifacts/phase4/` from a clean committed transformer tree.
- A production transform only after the exact artifact hash, snapshot date/source URL, attribution surface, database-component separation, forbidden uses, and named legal/engineering review are captured in a detached approval manifest.
- Source/last-updated/quality disclosure on product detail.
- Wrong-match and missing-product reports.

Production gates and launch exclusions:

- Bulk production promotion remains blocked pending legal/compliance signoff.
- OBF product images are excluded from the launch source projection.
- Request-time Open Beauty Facts API calls, including exact barcode lookup, are excluded. The retired `OBF_API_ENABLED` flag cannot enable transport.
- Public claims that Open Beauty Facts data is complete or always accurate are prohibited.
- OBF presence or facts must never be presented as proof that a product or ingredient is safe, effective, approved, or recommended.
- Contribution-back promises or publication are excluded. `OBF_CONTRIBUTION_ENABLED` is intentionally inert and cannot authorize transport.
- Search-as-you-type source API calls are excluded.

Runtime OBF lookup, source images, search-as-you-type, and external contribution
are not features that a legal signoff or environment flag silently enables.

## Implementation Notes

Schema support exists in `catalog_sources`, `catalog_import_batches`, `products`, `product_barcodes`, `product_ingredient_lists`, and `catalog_corrections`. The deprecated `obf_contribution_queue` relation remains only for migration and account-erasure compatibility.

Correction reporting remains enabled, but `catalog-report` does not enqueue contribution-back jobs. Migration `20260718000059_catalog_scan_minimization.sql` purges the legacy queue, removes every policy, force-RLS seals the retained relation, revokes all runtime table privileges, and replaces then revokes the enqueue RPC as an inert compatibility stub. Setting `OBF_CONTRIBUTION_ENABLED=true` emits a stable suppression warning and does not create a queue row. Restoring publication would require a new source-of-truth architecture decision, privacy/processor inventory, counsel approval, data-minimization and consent design, atomic withdrawal controls, and a separately reviewed implementation; the current launch contract provides no restoration path.

`catalog-lookup` queries only reviewed Supabase catalog rows. It contains no Open Beauty Facts origin, request helper, response parser, live API flag, or external-candidate response; a miss records owner-scoped `no_match` telemetry and returns the manual-entry fallback. Development/UI fixtures and offline import mappers are explicitly non-network and use non-routable `.invalid` provenance in app source.

Migration `20260717000056_catalog_serving_eligibility_gate.sql` makes barcode
and search use service-role-only RPCs over a shared positive eligibility
boundary. It hides sources without production/legal approval and products that
are inactive, unreviewed, below `usable`, recommendation-ineligible, or subject
to an independent product hold in `active` or `repair_attested` state.
Untrusted open intake remains owner-scoped; operator triage creates the hold,
and accepting, rejecting, closing, or deleting the report cannot release it.
Barcode mappings also require review;
direct authenticated reads cannot bypass source withdrawal. Every held reason
uses the same no-match/manual fallback.

The seeded `open_beauty_facts` source is `production_approved=false`, `requires_attribution=true`, `requires_share_alike=true`, and `allows_images=false`.

`docs/phase-4/catalog-source-policy.json` is the machine-readable fail-closed
control. `import-obf-snapshot.mjs` accepts only checked-in fixture files under
explicit `--fixture`, a non-promotable `--candidate`, or `--production` with a
current approval manifest bound to the exact input bytes/hash and deterministic
transformed payload. It emits the OBF component ID, policy/trust/scope/
transformer bindings, artifact hash, license posture, and fixed
`runtimeRequests/imagesIncluded/contributionBack=false` controls. It never
performs network I/O.

The import manifest also declares `catalog-transformed-payload-v1`. The canonical transformed-payload digest is calculated on records before `sourceSnapshotDate` enrichment. That sole exclusion is explicit and machine-enforced. The detached production approval signs both the exact digest (`artifact.transformationRecordSha256`) and `artifact.snapshotDate`; the importer copies the signed date into the manifest and each record, and QA rejects any contract, digest, or date-binding drift.

The operator follows
`docs/phase-4/catalog-source-release-runbook.md` and starts from
`obf-source-approval.template.json`. Distinct active legal and engineering
Ed25519 identities sign the same canonical approval. Production mode rejects
the untouched template, checked-in fixtures, missing or expired decisions,
changed artifacts/transformer, stale or replayed trust registries, unapproved
identity/fields/territories, placeholder or non-independent reviewers, absent
operations/evidence, and any attempt to enable images, runtime requests, or
contribution-back. Production QA also requires signed exact EAS/archive/App
Store evidence from `catalog-release-build-evidence.json` and revalidates the
embedded approval rather than trusting manifest shape.

For App Review and U.S. claims, the current operator packet must cross-check
[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
sections 1.4.1, 1.5, 2.1, 2.3, and 5.1; the
[FDA cosmetics-claims guidance](https://www.fda.gov/cosmetics/cosmetics-labeling/cosmetics-labeling-claims);
and the
[FTC Health Products Compliance Guidance](https://www.ftc.gov/business-guidance/resources/health-products-compliance-guidance).
Those sources reinforce heightened scrutiny for inaccurate health information,
supporting-data/methodology disclosure for health-measurement accuracy claims,
accurate support/live review surfaces, truthful non-misleading claims, privacy,
drug-claim boundaries, and prior claim substantiation. This engineering packet
cannot guarantee Apple or legal acceptance.

## Exit Criteria

- Legal approves ODbL/database contents/image posture.
- Final app name, version, contact email, and attribution URL exist.
- Bulk import runs only from exact-hash-bound, approved offline artifacts, never API crawling or request-time lookup.
- The external root-signed reviewer registry, separately pinned epoch/raw hash,
  approved US release scope, dual-signed exact OBF approval, and signed
  EAS/archive/App Store build evidence all validate for the same release.
- Release-network evidence proves OBF is not a runtime recipient and no user correction is published externally. Any future proposal is out of this launch scope and must begin as a new privacy/legal/architecture decision rather than enabling existing flags.
- QA report proves category filtering, barcode quality, parser confidence, and unresolved-correction gates.
- Hosted migrations `0056`/`0057` evidence proves ineligible sources/products
  cannot be returned by barcode, search, recommendation, or direct
  authenticated reads, and every promoted OBF projection retains exact batch
  lineage and non-destructive rollback evidence.
- Attribution and report-issue UI are visible before product-level recommendations use OBF-derived rows.
- Counsel records whether the OBF component is a derivative or collective database and approves the resulting attribution, share-alike, and offer-of-data operations.
