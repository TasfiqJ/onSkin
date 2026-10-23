# Trusted pointers and useful original checks

Original toolchain source: `scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt` and `proposal.json`. Original installer: `bootstrap_tools.py`. Original runtime: `workflow_contract.mjs` / `workflow_admission.py`. Original source inventory: `source-manifest.json` and `scan-targets.json.gz` (protected; remain frozen). Do not infer scan coverage from unit tests.

GHSA-84m7-p3x7-pcfv published by modelcontextprotocol/python-sdk: mcp 1.x affected <1.30.0, patched 1.30.0; verify latest official references and independent wheel metadata. GHSA-xcq7-p3pf-p88h for opentelemetry-api: patched 1.45.1; note entire opentelemetry exporter/instrumentation family compatibility requirements. Relevant official online sources are GitHub security advisories, PyPI and OSV; all tool inputs need SHA256 and exact source. Do not download credentials or any restricted individual JANUS data.

GitHub exact latest stage CI references: Quality https://github.com/TasfiqJ/onSkin/actions/runs/39997349019, Security https://github.com/TasfiqJ/onSkin/actions/runs/39997349147, iOS https://github.com/TasfiqJ/onSkin/actions/runs/39997349006. Root tests and original Security fixtures may pass while original provider Security still fails.
