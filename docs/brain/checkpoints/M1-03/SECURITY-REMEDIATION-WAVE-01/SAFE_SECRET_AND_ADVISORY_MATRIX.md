**SAFE TRIAGE + REJECTED DISPOSABLE CANDIDATE; no source suppression or owner approval.**

Original provider run [39997349147](https://github.com/TasfiqJ/onSkin/actions/runs/39997349147) artifacts were downloaded privately through the connected GitHub plugin. Their downloaded archive SHA256s match GitHub artifact digests. Raw secret/SARIF/proof files remain outside the repository; the checkpoint exports only counts, tool identities, file/blob bindings and hashed path/range/commit locations. No Match, Secret, message, author/email or credential value is exported. [Sanitized secret summary](evidence/provider/safe-secret-summary.json), [hashed location matrix](evidence/provider/safe-secret-locations.json), [OSV summary](evidence/provider/safe-osv-summary.json) and [code summary](evidence/provider/safe-provider-code-summary.json) retain separate evidence axes.

| Axis | Measured provider result | Disposition |
| --- | --- | --- |
| Current Gitleaks | 1,121 findings; exit 2; all locations resolve to snapshot blobs | Unreviewed current findings; original job rejects |
| History Gitleaks | 4,351 findings; exit 2; full local-ref scope recorded | History review/rotation disposition required; no history rewrite |
| Current/history TruffleHog | Both exit 0; zero verified findings | Does not clear Gitleaks findings or prove no secrets |
| Tool errors | No execution error observed in those completed provider commands | Findings and tool failure are not conflated |
| npm audit | Six high propagated records, one primary node-forge advisory | Raw exit 1 preserved; no stage npm change |
| OSV | Four package/location records: original MCP and API pins, historical API requirements, current npm node-forge | Historical evidence and executable toolchain roots remain distinct |

Current Gitleaks rules: 1,119 generic-api-key, one sentry-access-token and one private-key. Partitions are one app/package location, one database/Edge location, ten tool/fixture locations, thirteen checkpoint/review locations and 1,096 other locations requiring individual classification. No partition is automatically allowlisted. A detected string is not asserted to be a live credential; conversely, a fixture-like location is not asserted harmless. Owner **TasfiqJ**, with a qualified security reviewer, must classify the blob/range hashes and arrange rotation/revocation if any credential is live. No owner receipt, exception renewal or rotation is supplied here.

The provider checked synthetic PR merge commit `5a5eee5dc6cd87eb5c69b463a955ed4327f36cf1`, tree `fc579c91528aa285f28f6364d7f4da8ee2aafd3b`, equal to the issued stage tree. The summary preserves the stage SHA separately. Original Secret-job Gitleaks is 8.24.3 and TruffleHog is 3.99.3; these are not silently conflated with the separate G97 collector's original TruffleHog 3.99.2 pin.

The primary npm root is [GHSA-86w9-cpqp-85rv](https://github.com/advisories/GHSA-86w9-cpqp-85rv), affecting node-forge <=1.4.0. The official advisory lists no patched release; registry latest remains 1.4.0, and current Expo CLI still requires `^1.4.0`. Downgrading Expo to npm's suggested 44.0.6 is not a compatible remedy for the supported app stack. Newer unrelated Expo upgrades are outside this stage scope and do not remove that declared forge dependency.

The tested diagnostic removes only the root direct node-forge declaration in a new no-hardlink clone, regenerates the real lock, runs fresh npm ci, audits and executes archive-privacy fixtures. [Candidate receipts](evidence/docker-npm-candidate/summary.json) and its explicitly NON_ADMITTING patch preserve the actual solver changes. Installation and archive tests pass; audit still exits 1 with six high records and node-forge becomes indirect. **Reject this candidate:** Expo certificate paths remain vulnerable. Passing consumers do not remediate the package. The stage package manifests and lock remain unchanged.

The expired October 17 exceptions remain expired, and the original Security proposal still expires October 21. Exception ownership is not transferred to Codex. No automatic signer/owner configuration, credential request, secret allowlist, npm audit suppression, hosted verification or paid service is used. The next exact source proposal addresses the scanner dependency barrier only; npm and real-secret owner actions remain independent blockers.
