# Exact source orientation

Relevant checked-out paths:

- `scripts/phase9/security_acceptance/test_secret_scan.py`: original CI original-secret contract; synthetic 36-commit fixture cleanup issue.
- `scripts/security_readiness/m103/candidate.py`: official-wheel hashes, derivative, installed_tree and verification; caches currently ignored.
- `scripts/security_readiness/m103/source_scan.py`: exact Git snapshot, rule execution, coverage; post-scan file verification gap and 26 failed SQL targets.
- `scripts/security_readiness/m103/sandbox.py`: controlled seccomp and credential-free child environment.
- `scripts/security_readiness/m103/reconcile.py` / `dependencies.mjs`: redacted provenance and dependency graph; source-specific triage unknowns.
- `scripts/security_readiness/m103/test_diagnostics.py`: three existing unit methods and new adversarial tests.
- `docs/brain/checkpoints/M1-03/OVERNIGHT-01/`: source-reported receipts, safe gzip finding coverage, `WORK_REMAINING.md`, `DATABASE_CUSTODY.md`, and `RESUME.md`.
- `docs/brain/m103-overnight01-active.json`: historical state of completed session; new immutable successor, no retroactive edits.

Prefer reading only these and affected callsites, not every old evidence archive or raw secret scan. Restricted JANUS patient records/photos/clinical data are never in context.
