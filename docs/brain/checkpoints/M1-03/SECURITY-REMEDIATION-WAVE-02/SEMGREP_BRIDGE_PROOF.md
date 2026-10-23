# CUSTOM dependency bridge: candidate only

The genuine candidate uses the unchanged official Semgrep 1.181.0 wheel (`c142ec04a2ed144970cb0a92f6877651dd3c088505eec737bb7f4db7ae5f0ffa`) and the unchanged reviewed portable core/engine archive. No upstream wheel is rewritten. The installed distribution is CUSTOM; its METADATA is modified and its retained upstream RECORD is therefore not an assertion that the custom METADATA is official.

`evidence/bridge2/old-reproduction.json` reproduces the original requirements SHA, complete original package tree and complete assembled package tree against the issued proposal. All 66 old wheels and 13 new family wheels are independently authenticated against current non-yanked PyPI entries and every wheel RECORD/member digest (`evidence/wheel-proof/proof.json`). Every installed member of the 13 new wheels matches its official artifact, except pip's generated RECORD, which is explicitly accounted for. Semgrep source tag `v1.181.0` independently confirms the four constraints.

The exact deterministic patch is `evidence/bridge2/semgrep-dependency-metadata.patch`; its preimage, postimage and patch SHA256 are in `patch-identity.json`. Only these installed METADATA lines change:

| Requirement | Official | CUSTOM candidate |
| --- | --- | --- |
| mcp | `==1.29.0` | `==1.30.0` |
| opentelemetry-api | `~=1.37.0` | `~=1.45.1` |
| opentelemetry-sdk | `~=1.37.0` | `~=1.45.1` |
| opentelemetry-exporter-otlp-proto-http | `~=1.37.0` | `~=1.45.1` |

The original two instrumentation constraints admit the coherent 0.66b1 family and remain byte-identical. The candidate requirements retain all unrelated pins and add the required exporter transport/common distributions. Full requirements and official wheel metadata are in `evidence/official/`.

The candidate installs the official Semgrep wheel into a fresh venv without pip, verifies/patches its exact installed METADATA, and runs genuine dependency-aware pip dry-run and installation against the full hash-pinned requirements. Neither solver command uses `--no-deps`. `pip check` passes. Initial `--no-deps` commands reproduce the original installer or seed the authenticated wheel; they are not offered as dependency compatibility proof. Semgrep has no declared optional extras. An incompatible MCP CLI extra is independently refused by pip.

`evidence/bridge-runtime/candidate-trees.json` measures both custom original and assembled trees with the unchanged `contract.tool_tree` algorithm. Full before/after Semgrep dist-info digests are retained: every file except METADATA, including RECORD, is unchanged in the same installation. A separate full file delta retains generated cross-layout launcher/RECORD differences; the original tree algorithm already excludes those. No new tree exclusion was introduced. All canonical package deltas belong to the approved families or the four-line Semgrep metadata patch.

Old/new Semgrep 1.181.0 startup and core version pass. Final `evidence/integration3/` runs the actual original Semgrep MCP server registration and lifespan, client initialization, list-tools, ping, supported-languages tool, clean shutdown and stateful HTTP app lifecycle. Both old and new pass. Actual Semgrep `Telemetry.configure` sends synthetic protobuf spans to a local HTTP collector; trace propagation, thread context and exporter/transport/common imports pass. No external telemetry, credential use or Pro engine acquisition occurs.

The original target installation needs a real console entry on PATH for MCP subprocesses. Attempt 1 lacked that entry; attempt 2 used the collector's Python-only entry and failed the MCP `show --experimental` call. Attempt 3 dispatches the official installed `console_scripts.entrypoint.main` with the original bind guard and passes. Both real failures remain in `evidence/integration/` and `integration2/`. The old Pydantic incomplete-field warning is retained.

Tampered metadata, wrong package version, unknown wheel and double application refuse. Pip refuses incompatible MCP and an incompatible CLI extra; removing OTel API dist-info makes `pip check` exit 1, after which the exact original state is restored. Original source policy/expiry are untouched. Initial bridge proof assertions wrongly compared pip target/venv installer layouts; their failures are retained separately and the final proof compares same-installation pre/post bytes and the original canonical tree algorithm.

Three authentic original rule bundles run synthetic fixtures with exact old/new parity: two intended findings, a clean negative fixture, no scanner errors, no skipped rules or fixpoint events. The first fixture revision had no rule-specific taint source and produced zero findings; that observation is retained. The final fixture uses the actual original rule sources. No current source was scanned.

**Critical missing proof:** authentic pinned OWASP bytes were not recovered. Full four-rule compatibility/coverage is not established. Source bootstrap/proposal schema integration, additive live contract integration and the full source-edit eligibility gate are not attempted. The optional live patch file is not created. This candidate is retained for Brain review; stage technical edits remain zero.
