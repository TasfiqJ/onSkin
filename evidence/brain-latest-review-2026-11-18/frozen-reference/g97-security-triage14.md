# Campaign14 source triage — candidate, no acceptance

Authorization: `BRAIN-M103-G97-SOURCE-TRIAGE14-CANDIDATE-01`, supplied directly in the human prompt. Context manifest external SHA256: `1e49ce39198a22621058e7608bb4c4111b770a875823febe7750ff70e8ec5474`. The packet verified eight authenticated files and exact prompt derivation. Context integrity grants no Security, DB, clinical or release evidence.

The immutable source anchor is PR17 `d0c5ad49ba22c8da7136d59a399589af1cea0e82`, tree `4cfe9c819df4c22fc5d19d79f9c0e89e0e24c973`. The new source is stacked on that exact evidence HEAD. Original releases, acceptance rules, source manifests, scan targets, workflows, dependencies, runtime publication code and native/provider code remain protected. Independent Brain alone reviews this candidate.

## Provenance buffer repair

The old test helper failed with `ENOBUFS` against a real synthetic Git index containing 14,000 docs paths and 1,484,000 output bytes. Its default Node stdout budget was approximately 1 MiB. The repair adds an explicit finite 8 MiB budget to `gitNulPaths`, preserves NUL termination and exact decoding, and refuses malformed UTF8, empty/unsafe paths and duplicate/normalized case collisions. Output is never truncated. Git errors and output beyond 8 MiB fail.

Two executable tests preserve a complete greater-than-1MiB inventory, reproduce the default-buffer failure, and demonstrate that a new unexpected `/generated/` path still fails the original strict equality. Malformed/truncated/colliding data and over-budget output are refused. Every original assertion and publication-unit count outside the helper and the two additive tests is byte-identical. `governed-evidence-chain.mjs` is unchanged.

## Finding triage and provenance

The independently fetched final PR17 Security run is `40208858991`, secret job `121215574747`. Artifact `12604063429` matches GitHub digest `109a94569a05f11067323fc6163166f0802006101ad4acc43e80a5c8b62b31b5`. Its scanned GitHub integration commit is `8dd35b816998c9d4c01804dd629ff8ce6daf8a2a`; both parents and its tree bind the immutable source and stack base. The proof contains 23,312 snapshot files, 21 refs, 2,737 reachable commits and 2,734 scanner patch commits.

| Rule | Current | Full history |
| --- | ---: | ---: |
| generic-api-key | 1,141 | 4,361 |
| private-key | 1 | 2 |
| sentry-access-token | 2 | 8 |
| aws-access-token | 0 | 4 |
| jwt | 0 | 10 |
| slack-bot-token | 0 | 1 |
| stripe-access-token | 0 | 1 |
| vault-service-token | 0 | 1 |
| **Total, all UNREVIEWED** | **1,144** | **4,388** |

Nine current-report fingerprints repeat across distinct records. The utility retains all records; it does not deduplicate findings or infer disposition from a name. Exact duplicate records, inconsistent full counts, malformed/truncated artifacts, unknown rules, wrong commands/exits, replaced scanner identity, off-root paths, unsafe ZIP members and missing source/run evidence fail `INCOMPLETE`. An intact report returns `UNREVIEWED`, exit1, `acceptanceGranted=false`; it never emits PASS. Metadata is externally digest-pinned transport evidence, not a qualified signature or proof of credential liveness.

The original [Gitleaks8.24.3 release](https://github.com/gitleaks/gitleaks/releases/tag/v8.24.3) and its pinned archive/binary hashes are checked alongside the unmodified scanner adapter. Verified-only TruffleHog exit0 does not clear Gitleaks. No token is checked against a provider. Raw artifact ZIPs are held in private, task-owned, ignored scratch outside Git; only complete-artifact/member hashes and public rule/category counts are eligible for source/evidence. No match, secret, original line, finding path or individual fingerprint is committed or printed.

## Independent source coverage

`scripts/security14/source_inventory.py` authenticates the original source manifest and scan targets, the proposal and scanner/rule witnesses; compares object-derived source SHA256, Git blobs and modes; checks the coverage bijection and every protected ignore-file absence; and produces a separate versioned **UNAPPLIED** crosswalk. It reads finite Git NUL streams and bounded blob batches without modifying Git, source or acceptance state.

At PR17, the original expected inventory has 11,922 files versus 23,312 tracked files: 11,390 additions and 118 changes, zero removals. Every addition/change is an unreviewed candidate requiring original-owner review. Identical-blob rename candidates are reported separately without removing either addition/removal from review. Synthetic controls exercise removals, renames, modes, malformed/replaced/duplicate manifests and coverage omissions. The unchanged original `contract.py source` still refuses `SOURCE_INVENTORY_DRIFT`.

## Dependency diagnosis and UNAPPLIED decisions

The exact prioritized owner packet is [g97-security-triage14.unapplied.json](g97-security-triage14.unapplied.json). Each task binds original source SHA256/blob/mode identities and records `owner_decision=NOT_PERFORMED`. No exception date, signature, rule hash or historical evidence is renewed.

- **Zod3.25.76:** the lock routes it through Expo CLI57.0.32, React Hooks lint tooling and a validation-error peer; no direct app/package source import was found. Expo's DevTools plugin schemas accept arrays without size bounds. The [upstream advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) lists4.6.6, while the [actual fix](https://github.com/colinhacks/zod/commit/a0ebf97) short-circuits explicitly bounded collections. In disposable scratch, 1,000 invalid elements produced1,001 issues with v3 `.max(2)`, one with v4.6.6, and1,000 with unbounded arrays in both versions. Two exact Expo schema modules passed minimal valid/invalid smoke in both versions. This does not establish full Expo compatibility, safe unbounded parsing or migration acceptance. Expo's v3 semver range prevents treating a forced v4 override as an ordinary compatible patch.
- **node-forge1.4.0:** root development and Expo certificate tooling can affect build integrity. The [current advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) still lists no patched release. Independently review the exact existing backport against nested DigestAlgorithm validation and valid-signature interoperability. Version strings and expired reviews cannot establish closure.
- **braces3.0.3:** the [advisory was withdrawn on2026-10-23](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). That upstream decision does not silently renew the original expired local policy. Original-owner reconciliation remains UNAPPLIED.
- **Scanner runtime:** PyPI opentelemetry-api1.37.0, certifi2026.10.18 and mcp1.29.0 are isolated scanner or inherited-evidence dependencies, not mobile npm packages. [OpenTelemetry](https://github.com/advisories/GHSA-xcq7-p3pf-p88h) requires a reviewed1.45.1 successor and ingress analysis. [MCP](https://github.com/advisories/GHSA-84m7-p3x7-pcfv) requires stateful HTTP reachability analysis and a reviewed1.30.0 successor; the original CLI Internet-bind refusal remains intact. For certifi, the [maintainer advisory](https://github.com/certifi/python-certifi/security/advisories/GHSA-6q48-6c7w-9gw2) identifies10.18 as removing emSign roots, while [aggregate metadata](https://github.com/advisories/GHSA-6q48-6c7w-9gw2) recommends10.19 and flags10.18. The exact wheel CA content, vendored copies and outbound TLS paths need owner reconciliation. This discrepancy is recorded, not converted to clearance.

The applied Vitest4.1.12 lock remains byte-identical. This grant changes no application, native, tool, scanner or dependency package/lock.

## Verification and handoff limits

Release14 adds a separate PR17-rooted path/index/history segment and authenticates the allocated draft PR integration event and tree. Release08–13 functions/globals/module entrypoints and semantic witnesses remain intact; the only source-guard change selects the new interval and exact finite paths. Existing immutable Quality wiring invokes the new source-only synthetic tests. These utilities are never live scanning, provider or acceptance controls.

The final evidence checkpoint records source and delivery commits separately, exact source SHA256/mode/blob identities, protected frontier and absences, sanitized command receipts, independently complete-checkout controls and actual final-head CI. Synthetic Git fixtures are labeled separately. Projections are generated only with the unchanged strict producer after source freeze:14 tasks,7 blocked/7 scaffold,420 occurrences.

G97 **FAIL/NO_GO**; DB06/DB08/R2B **NOT_ACCEPTED**; M1-03 **BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED**; M2 **NOT_AUTHORIZED**. Canonical DB registry failures and independent DB custody remain separate from local tests. J01 authenticated research intake and G1/G2/G3/G5 remain open, with G4 separate for change claims. F09 encrypted private history/manual comparison stays required; F18 and J02–J27 includingJ05 defer. No provider, Apple, clinical, phone/archive, paid or public release admission follows from this source work. USD0; no merge.
