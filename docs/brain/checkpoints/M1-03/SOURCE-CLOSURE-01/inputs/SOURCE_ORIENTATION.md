# Essential repository paths, read selectively

- `ONSKIN_BRAIN_HANDOFF.txt` — predecessor checkpoint and high-context stop.
- `docs/brain/checkpoints/M1-03/SECURITY-HARDEN-01/README.md`, `RESUME.md`, `WORK_REMAINING.md`, `completion-report.json`, `evidence/scan-summary.json` — current facts/limits.
- `scripts/security_readiness/m103/{candidate,integrity,capsule,sandbox,source_scan,test_integrity,test_diagnostics}.py` — private diagnostic candidate; never used in `.github` active workflows.
- `scripts/phase9/security_acceptance/test_secret_scan.py` — original CI test fixture already green; avoid needless edits.
- `scripts/brain/{test_m103_cont01_profile,test_m103_security_harden01_profile,test_m103_overnight01_profile,m103_profile}.py` — observed governance failures and exact history scope.
- `scripts/phase9/security_acceptance/{contract,history,collect,workflow_admission}.py`, `.github/workflows/security.yml` — READ ONLY protected baseline.
- `scripts/phase2/staging-deployment-evidence-lib.mjs` and `scripts/phase2/deploy-supabase-staging.mjs` — DB06 issuer/consumer READ ONLY.
- `docs/phase-4/generated/source-worklist.{json,md}` — only authorized derived regeneration with unchanged generator.
