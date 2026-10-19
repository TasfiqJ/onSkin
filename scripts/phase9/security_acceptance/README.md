# G97 exact-source security acceptance proposal

INACTIVE. No owner key, signature, acceptance, integration, replay or release
authorization is included. The accepted three-file forge correction is unchanged.

This separate proposal is valid only from 2026-10-18T00:00:00Z until
2026-10-21T00:00:00Z. It does not amend the expired October 17 exception policy.
There is no automatic renewal. Both old exception validators and all existing
Security, Quality, DB06, native, hosted and release gates retain their behavior.

`contract.py source` checks the complete reviewed source manifest. `collect.py`
runs npm 11.20 installed and lock-only audit, the complete dependency graph,
CycloneDX SBOM, OSV 2.3.8, full-all-ref Gitleaks 8.24.3, full-history verified
TruffleHog 3.99.2, all four captured Semgrep 1.177.0 rulesets and the coupled
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
accepted as an exclusion. PNG/JPEG images, gzip witness containers and fourteen
oversize nonexecutable bindings/generated E2E logs have individually listed
reasons for independent BRAIN review. Opaque JPEG data historically stored with
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

All npm fields remain in raw evidence. Registry-derived outer ranges,
fixAvailable upgrade suggestions, effects and non-advisory via edges are not
acceptance authority. Every affected package/path/severity and full primary
advisory is bound; each reported record must reach a primary advisory. The full
installed graph and exact lock independently bind dependency paths. An upgrade
recommendation cannot clear a finding or authorize a dependency change.

The 3,264 history witnesses carry Git commit/path/line/blob, source SHA-256 and an
opaque matched-value SHA-256. `history.py` reopens the actual Git blobs, re-extracts
each pinned rule capture, checks its hash and independently reruns each disposition
proof. Every finding, including the synthetic rehearsal seed, must reproduce.
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

The additional workflow is manual-only. Its Windows runner uses Git for Windows
Bash explicitly, so the runtime command language matches the pinned GitHub
Actions rule's embedded Bash parser. Quoted runner paths and strict shell failure
handling preserve the existing commands and owner boundary. It first collects and checks evidence,
then requests the separately protected owner environment. The owner must provision
an independent trusted key, required reviewers, prevent self-review and supply a
receipt for the exact collected evidence. No environment, secret, rule, required
status or repository setting is created by this candidate. Existing Security CI
continues to enforce its original gates; this workflow cannot make it green.

The narrow residual risk for owner review is reliance on local tooling backports
while version scanners still flag two unpatched published versions and their
propagation records, together with acceptance of exactly source-proven historical
noncredential material. This is not scanner cleanliness or a future-CVE waiver.
Any new finding, advisory, source, copy, failure or expiry requires fresh review.
No genuine live credential has been established; no provider rotation is claimed.

Retained local evidence contains 16 Semgrep partial-parsing warnings and a taint
fixpoint timeout: four warnings concern the original PowerShell blocks in this
new workflow; twelve warnings and the timeout concern inherited source. The
workflow has been corrected to Bash, but elimination of its four warnings must
be established by an actual fresh Semgrep run. No retained warning was erased.
Native file-symlink tests cannot run on this Windows host.
The proposed contract rejects those gaps; they are not covered by owner signature
or an exception. A clean supported runner/engine validation is required first.

Run the adversarial unit suite with Python's unittest runner against
`test_contract.py`. Its explicitly synthetic complete SAST vector exists only to
exercise subsequent boundaries; the real partial result is separately rejected.
