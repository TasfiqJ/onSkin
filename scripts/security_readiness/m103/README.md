# M1-03 private diagnostics

Every output is **NON_ADMITTING / UNREVIEWED**. Admission is always NONE. No runtime,
package script, workflow, source acceptance policy or frozen scanner consumes this
namespace. Original tools, rule hashes, exception dates and expiry remain unchanged.

Use Linux x86_64 / Python 3.12. `candidate.py prepare /root/onskin-overnight01-NAME`
requires a new private directory, downloads only exact official PyPI wheels and
retains upstream originals. The sole Semgrep derivative changes its exact MCP
requirement and RECORD. Installation uses the complete hash-pinned graph with
dependency resolution enabled; `pip check` and the installed tree are independently
checked. `candidate.py verify DIR` verifies integrity, never acceptance.

`adverse_install.py DIR` exercises actual dependency/launcher/wheel drift and restores
every private byte. `fixtures.py DIR NEW_WORK` invokes the unchanged upstream core
on synthetic vulnerable/benign code. Run `compatibility.py` with the candidate Python
through `sandbox.py HOME COMMAND...` for in-memory MCP lifecycle, certificate trust
and actual socket/listener refusal. Scans use a clean environment and inherited Linux
seccomp denial of IPv4/IPv6 sockets, connect, bind and listen. No source upload,
telemetry, credentials or found-credential validation is authorized.

`source_scan.py --candidate DIR --repo REPO --commit FULL_SHA --work NEW_WORK
--rules EXACT_RULE_DIRECTORY --pins ISSUED_CANDIDATE_TOOL_INPUTS.json` materializes
committed UTF-8 Git blobs only. Every tracked path retains its object and content
identity; nonregular/binary inputs remain explicit. All four exact bundles execute
independently with finite timeouts. Coverage, errors, findings and raw exits remain
separate. Raw outputs stay private; publish only inspected redacted derivatives.
Language applicability does not imply a rule actually executed; parsed rule IDs,
profiled rule IDs, skipped rules and unscanned targets remain available for review.

`reconcile.py --repo REPO --proof ORIGINAL_PROOF --sarif ORIGINAL_SARIF --output SAFE_JSON`
retains every original current/history finding with exact source/blob/range when
recoverable. Redaction can prevent proof; those records stay UNKNOWN. Public-input
hash proposals require exact committed input reproduction and the scanner's redacted
match, not entropy or appearance. No new disposition extends accepted history.

`node dependencies.mjs REPO FULL_SHA NPM_JSON OSV_JSON OUTPUT_JSON` binds every
available advisory to actual lock paths, dependency chains and dev/runtime exposure.
Mitigation tests do not renew an expired exception. Retain raw exits and primary
advisory snapshot identities separately. Candidate package exposure is distinct from
the application's npm graph.

Run deterministic/adversarial unit checks with `python -B -m unittest discover -s
scripts/security_readiness/m103 -p test_diagnostics.py -v`. These synthetic checks
prove tooling behavior only. Actual execution receipts and unresolved work live at
`docs/brain/checkpoints/M1-03/OVERNIGHT-01/`.
