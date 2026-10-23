# Finite source-edit authority; no union

This permission is conditional. **Allowed existing paths** only:

- `scripts/phase9/security_acceptance/bootstrap_tools.py` — add fail-closed, exact-version/SHA bound patch application to ONLY installed official Semgrep 1.181.0 `.dist-info/METADATA` after original verified wheel provenance, with auditable upstream-vs-custom tree identities. Do not disable an existing wheel/member/engine/tree/requires check.
- `scripts/phase9/security_acceptance/semgrep-requirements-linux-py312.txt` — only verified MCP and coherent OpenTelemetry family wheels/integrity/versions that pass independent dependency solver and tests; all other lines/whitespace stable.
- `scripts/phase9/security_acceptance/proposal.json` — only authentic derived `semgrepBuild.requirementsSha256`, `semgrepBuild.originalPackageTree`, `semgrepPackageTree` and if indispensable an explicitly evidenced custom metadata patch identity under preexisting compatible schema. **Do not alter** `notAfter`, owner, source manifest/coverage/rules, original scanner version/core/engine or acceptance. If exact source contract rejects the extra patch-binding schema, STOP source integration and report the requirement rather than weakening the contract.
- `scripts/phase9/security_acceptance/test_contract.py` — only additive exact metadata patch source/version/Requires-Dist/unknown-wheel tests. Preserve all existing test methods/assertions/negative cases byte-semantically.
- `.gitattributes` — append only -text input checkpoint path marker; old rules unchanged.
- `ONSKIN_BRAIN_HANDOFF.txt` — truthful status and receipt index only.
- `docs/phase-4/generated/source-worklist.json` and `.md` — canonical producer only, not manually edited.

**One new technical path allowed only after full compatibility proof:** `scripts/phase9/security_acceptance/semgrep-dependency-metadata.patch` as a deterministic UTF-8 patch of only reviewed Semgrep dist-info METADATA requirements. **Other new paths:** `docs/brain/checkpoints/M1-03/SECURITY-REMEDIATION-WAVE-02/**` only. Keep all pre-existing inputs and reviews unchanged.

**No edits** to `.github/**`, `supabase/**`, `apps/**`, `package*.json`, scanned original source manifest/targets, rules/engine/collector/exceptions/expiry, `secret_scan.py`, `docs/phase-9` original policy, existing `scripts/brain/**`, previous checkpoints, SQL/RLS/Edge/types or any clinical/patient/JANUS data. If implementation needs them, report a new exact authority request instead of editing. No self-authorized GO, M2, `main` merge or release.
