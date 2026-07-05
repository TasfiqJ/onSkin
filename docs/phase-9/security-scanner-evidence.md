# Security Scanner Evidence

This file defines the scanner artifacts that must be attached to every release-candidate security workflow run.

## Required Artifacts

| Artifact | Producing job | Required contents | Release review |
| --- | --- | --- | --- |
| `code-security-evidence-<run_id>` | `code-gates` | `code-gates-outcomes.json`, `npm-audit-high.json` | Verify Phase 9 verification, dependency SBOM, and high/critical npm audit all report `success`. Review `npm-audit-high.json` for zero high or critical advisories. |
| `secret-scanner-evidence-<run_id>` | `secret-scan` | `secret-scan-outcomes.json` | Verify Gitleaks and TruffleHog both report `success`. Review workflow logs only if either scanner fails. Do not paste secret values into tickets or reports. |
| `static-scanner-evidence-<run_id>` | `static-analysis` | `static-analysis-outcomes.json` | Verify Semgrep and OSV both report `success`. Review linked scanner findings before accepting any warning or advisory. |

## Required Workflow Behavior

- Scanner jobs write evidence manifests with the Git SHA, GitHub run ID, and each scanner step outcome.
- Scanner and gate steps use `continue-on-error: true` only long enough to write and upload evidence after a failure.
- Each job has a final enforcement step that fails the job unless every scanner outcome is `success`.
- Artifact uploads use `if: always()`, `if-no-files-found: error`, and 30-day retention.
- The `phase9:security-ci-smoke` gate fails if scanner artifacts, outcome manifests, or enforcement steps are removed.

## Release Use

Set `PHASE9_DEPENDENCY_AUDIT_PASS=true`, `PHASE9_OBSERVABILITY_PAYLOAD_PASS=true`, and `PHASE9_BETA_EVIDENCE_PASS=true` only after the release owner has reviewed the uploaded artifacts for the exact release candidate commit. The local code gates can prove that evidence collection is configured, but they do not replace archived CI artifacts.
