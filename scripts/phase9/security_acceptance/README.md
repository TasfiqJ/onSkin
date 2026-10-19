# G97 exact-source security acceptance proposal

INACTIVE. No owner key, signature, acceptance, integration, replay or release
authorization is included. The accepted three-file forge correction is unchanged.

This separate proposal is valid only from 2026-10-18T00:00:00Z until
2026-10-21T00:00:00Z. It does not amend the expired October 17 exception policy.
There is no automatic renewal. Both old exception validators retain their expired-policy refusals. The existing
Security workflow proposes an exact-evidence independent approval route below.
Quality, DB06, native, hosted and release gates retain their behavior.

`contract.py source` checks the complete reviewed source manifest. `collect.py`
runs npm 11.20 initial cold-cache, installed and lock-only audits, the complete dependency graph,
CycloneDX SBOM, OSV 2.3.8, full-all-ref Gitleaks 8.24.3, full-history verified
TruffleHog 3.99.2, all four captured Semgrep registry rulesets using the reviewed 1.181.0 Linux source build and the coupled
regressions. It keeps raw streams, actual exits, exact rules and package archives.
The original scanner finding and failure statuses are retained.

Semgrep coverage is now an exact source-bound partition in scan-targets.json.gz,
never a minimum count. Every required target name, auxiliary generic input and
explicitly proposed exclusion resolves to its exact SHA-256 in the complete
source-manifest; the two recursive binding documents are resolved by their
policy/owner-bound byte identities. The collector validates actual bytes and
classification before and after scanning. Omitted, substituted, invented or
duplicate normalized targets fail. Added or changed source ignore files fail,
including ignored .semgrepignore files hidden from Git's untracked listing.

The 26 SQL files under supabase/tests are passed as additional explicit targets
to overcome Semgrep's inherited default test-directory omission. No SQL test is
accepted as an exclusion. PNG/JPEG images, four exact gzip witness containers and the reviewed scanner
engine runtime archive have individually listed exclusion reasons. All text,
including the previously oversized bindings and logs, is required and scanned
with the explicit four MiB target limit. Unexpected compressed source rejects. Opaque JPEG data historically stored with
.png names appears in Semgrep's generic target list: those auxiliary identities
are bound too, but are never claimed language-parsed code. No source, rule or
finding is suppressed. The legacy minimumFiles policy field is retained solely
for BRAIN's unchanged regression precondition; acceptance never reads it.

The test-fixtures target names were deliberately updated as SYNTHETIC test data
for the exact new inventory. Its retained warning/timeout entries remain. It is
not raw evidence and cannot replace a fresh complete scan or signed receipt.
F2 deletion and severity modification are separate tests with their specific
UNVERIFIED_AUDIT_REFERENCE and SCANNER_RECORD_DRIFT rejection expectations.

The collector verifies the whole npm CLI source tree, the private Semgrep
installation including its dependencies and executable .pth inputs,
and each native scanner binary before execution. It invokes the verified Semgrep
package directly, with a fresh bytecode-cache location. Generated top-level CLI
wrappers and installation RECORD metadata are excluded from that installation
digest; they are not executed. An arbitrary wrapper
claiming the expected version is insufficient. Git object-format checks use
Git's read-only `hash-object --stdin`; source-byte bindings remain SHA-256.

`contract.py check --evidence <directory>` rejects missing/extra evidence,
changed primary advisories or affected package/path identities, unrooted audit
records, incomplete SAST coverage, missing or
changed history, wrong original SRI, unexpected installed copies, unpatched bytes,
failed or skipped required regressions, source drift and evidence older than six
hours. A technical positive result explicitly remains INACTIVE. Local verification
may read an unchanged isolated accepted installation using `--installed-root`;
the activation path forbids that override.

The collector creates one new private audit cache. It retains the initial cold
report, then runs the installed and lock-only audits serially in that same cache.
Measured identical-source controls reproduce 25 or 27 initial candidate records
then 68 final records, and 25 then 67 main-baseline records. The initial report
must retain every primary root and contain only exact record identities present
in the mandatory complete final audit. Its severity counts are recomputed from
its actual records. Installed and lock-only final projections stay exact; all
raw reports and original nonzero exits are retained. The initial report cannot
introduce an unreviewed finding or be omitted. This fixed protocol does not repeat until a preferred status appears.
The retained older 27/67/68 reports remain separate historical evidence. A raw
count alone does not establish a source, npm version or complete audit coverage.

All npm fields remain in raw evidence. Registry-derived outer ranges,
fixAvailable upgrade suggestions, effects and non-advisory via edges are not
acceptance authority. Every affected package/path/severity and full primary
advisory is bound; each reported record must reach a primary advisory. The full
installed graph and exact lock independently bind dependency paths. An upgrade
recommendation cannot clear a finding or authorize a dependency change.

The original 3,264 history witnesses remain unchanged. A fresh full-ref scan adds
one ruleset-digest finding from the initial reconstruction commit. All 3,265
witnesses carry Git commit/path/line/blob, source SHA-256 and an
opaque matched-value SHA-256. `history.py` reopens the actual Git blobs, re-extracts
each pinned rule capture, checks its hash and independently reruns each disposition
proof. Every finding, including the synthetic rehearsal seed and the new ruleset digest,
must reproduce. The digest record is re-extracted from its real Git blob and tied
to the freshly rehashed captured ruleset; its fingerprint alone cannot authorize it.
No fingerprint allowlist or scanner ignore entry is added. Raw history scanning
continues. Witness hashes and categories alone cannot clear an unmatched record.

Every installed braces and node-forge copy is discovered physically and matched
to its exact lock path. The original tarball SRI is verified; every package byte
is compared to the original archive plus the five exact accepted payloads. The
two reviewable patches have SHA-256 identities and an independent application
test. Published package names, versions and integrity fields remain unchanged.

`contract.py accept` additionally requires a committed clean exact source tree,
the same-root installed graph, complete fresh evidence and a valid Ed25519 owner
signature. The trusted public key is supplied separately through the protected
environment `G97_TRUSTED_OWNER_PUBLIC_KEY`; a key inside the repository, evidence
or receipt is never trusted. The owner keeps the private key outside this system.
The receipt's payload has exactly: schema=1, proposalSha256 (canonical JSON),
sourceTree, evidenceSha256 (canonical receipt JSON), decision
`ACCEPT_EXACT_G97_SOURCE_MITIGATIONS_ONLY`, notBefore, notAfter, reviewer and
reviewReference. Its separate `signature` is base64 Ed25519 over the canonical
payload. A signed duration cannot exceed 72 hours or the proposal's absolute
expiry. Tests use ephemeral in-memory TEST keys and grant no actual approval.

The proposed admission route is inside the existing Security workflow. Its three
original jobs preserve all raw scanners and execute the unchanged expired policy.
Phase 9, SBOM, verified TruffleHog and complete SAST checks remain hard gates.
Only the exact reviewed npm/OSV/history dispositions proceed to the mandatory
same-workflow technical-decision job. Any other finding, missing artifact,
unrelated failure, skipped original job or malformed result rejects.

`workflow_admission.py` binds the original three jobs and their exact seven raw
artifact files to the full technical receipt, actual commit and run identifier.
The owner's signature covers a combined digest of that complete receipt and all
original raw evidence. The protected independent acceptance job rechecks the
installation, source and evidence before checking the separately supplied trusted
public key and receipt. Absent, forged, changed or expired approval keeps Security
red. The manual workflow only collects technical evidence; it has no acceptance
job and cannot replace Security. No workflow is dispatched by this candidate.

Before execution, the owner must provision independent required reviewers with
self-review prevented on `g97-source-security-acceptance`, and a genuine trusted
Ed25519 public key in its protected `G97_TRUSTED_OWNER_PUBLIC_KEY` secret. After
reviewing that run's technical descriptor and raw artifacts, the independent
reviewer signs its exact combined digest and supplies `G97_OWNER_RECEIPT` before
the protected job begins. The private key remains outside this system. There is
no key generation, automatic approval, fallback, window extension or authorization
to integrate in the source. Future exact-commit CI remains a reserved step.

The reproducible tool profile is Linux x86_64, Python 3.12 and Ubuntu 24.04 glibc.
`bootstrap_tools.py` installs all 66 hash-locked official wheels, verifies their
complete original tree and original core, preserves the fresh upstream core and
libraries, then applies the exact reviewed engine runtime archive from source.
It checks all archive members, final tool trees, official release downloads and
native executable identities. No hosted custom binary or signing service is
required. Whole-tool identities and original Windows pins remain in proposal.json.

The custom Semgrep engine is explicitly a G97 source build, not an official
release binary. Its official 1.181.0 source commit is
72d3525fe7e02f486428386078f192f8c4756804. The sole algorithm parameter change is
raising the hardcoded taint fixpoint CPU budget from 0.2 to finite 2.0 seconds.
The 30-second per-rule/file limit, 768 MiB scanner cap, all rules and other taint
limits remain. Official 1.177.0, official 1.181.0 and an unmodified local source
build reproduce the AuthProvider timeout; the finite-budget build resolves it
without editing AuthProvider. Comparative positive and clean controls cover all
four rule families. Native runtime packaging removes only nonallocated ELF
symbols and relocates library lookup; allocated algorithm sections are verified
unchanged. The exact source, patch, build pins, runtime closure, licenses and
comparative raw results are supplied in the outer evidence package. This custom
tool choice is an explicit residual-risk decision for independent review.

OSV also scans the new hash-locked Python scanner dependency file. It reports
GHSA-84m7-p3x7-pcfv in MCP 1.29.0, which the official Semgrep CLI pins exactly.
The upstream fix is MCP 1.30.0; that version conflicts with the official CLI's
exact requirement. No dependency metadata or published version is relabelled.
The vulnerable behavior is unbounded stateful Streamable HTTP server sessions.
This route only invokes the rigidly checked `scan` command. Its source-bound
entry additionally refuses actual IPv4/IPv6 listener binds before loading the
CLI, while permitting Unix-domain engine communication. A real bind negative and
real Unix-socket positive test this boundary. The complete raw advisory remains
in the proposal; this is a constrained CLI-use disposition for independent review,
not a claim that MCP itself is patched or safe to run as a server.

The narrow residual risk for owner review is reliance on local tooling backports
while version scanners still flag two unpatched published versions and their
propagation records, the explicitly constrained scanner-only MCP advisory, and
acceptance of exactly source-proven historical
noncredential material. This is not scanner cleanliness or a future-CVE waiver.
Any new finding, advisory, source, copy, failure or expiry requires fresh review.
No genuine live credential has been established; no provider rotation is claimed.

Retained attempts include parser diagnostics and a taint fixpoint timeout. They
remain failed or incomplete attempts. Fresh final evidence must independently show
zero parsing errors/timeouts and exact required coverage; neither signature nor
retained success can waive this. The native Linux installation also exercises the
four actual file-symlink cases and valid positive controls. Windows-specific case
collision refusal is separately retained with its measured host identity.

Run the adversarial unit suite with Python's unittest runner against
`test_contract.py`. Its explicitly synthetic complete SAST vector exists only to
exercise subsequent boundaries; the real partial result is separately rejected.
