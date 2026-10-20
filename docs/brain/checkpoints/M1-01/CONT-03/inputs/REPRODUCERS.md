# REVIEW-03 reproduction and next-step map

## Exact reviewed identity
Head `fdf040cf28a4b3576f98b60d3b8d96a54bf689b0`; tree `2be9159a7eca917a7e0cbbc083c4c1ec6f3fa0ea`; branch `stage/m1-retained-safety`. Original task base `6aa01995f6dcb94fd28d358badc9f8d1e0273d39`, previous continuation base `6b137a4f57ed9ad11cef0c91b49ca0bfaf71427a`. Do not reset to any historical pin.

## What already reproduces successfully
Independent commands and outside-root raw paths/hashes are in REVIEW_OBSERVATIONS.json. From repo root: `npm run test -- --force`, `npm run typecheck -- --force`, `npm run lint -- --force`; `python -B -m unittest discover -s scripts/brain -p test_*.py -v`; `python -B scripts/brain/brain.py --profile M1-01 report docs/brain/checkpoints/M1-01/CONT-02/completion-report.json`; `node --test scripts/core01/metro-linked-dependencies.test.cjs scripts/core01/native-age-assurance-source-contract.test.mjs scripts/e2e/retained-safety-assertions.test.mjs`; unchanged worklist strict check. Old completion reports remain historical and may correctly fail current-source-tail checking once new implementation exists; do not rewrite them to pass.

Actual maintained runner: `node scripts/e2e/onboarding-first-session.mjs --account-isolation`, `--retained-safety`, or `--account-upgrade`. Use unique ONBOARDING_E2E_EVIDENCE_DIR/PORT/DEBUG_PORT/VIEWPORT_WIDTH/VIEWPORT_HEIGHT. For guarded deletion transport use ONBOARDING_E2E_DELETION_RECOVERY=pending_then_completed_manual. Brain's six exact invocations/ports are in the observation record; all ended and own processes were torn down. Never reuse an evidence folder or touch a founder browser profile.

## Missing scenario, not a reproduced leak
The source `accountIsolationE2E.ts` currently supplies A and sign-out state; it has no actual B browser path. The report CSV marks owner closeout PARTIAL_TESTED. A real app A-to-B replay has not been run. Root tests include mounted authority races but do not execute a browser transition. `--account-upgrade` uses same-owner semantics and is not a substitute. Add a portable guarded synthetic transport path through existing authority, then complete B usability and the negative cases specified by TASK.md. Do not inject processing/age/consent state to skip it.

Useful source entry points: AuthProvider.applySessionBoundary and completed publication; SessionBoundaryGate; accountGeneration/privateKV queue; sessionOwner/localAccountIsolation; AgePolicyGate and AgeReverificationRights; healthConsent lifecycle/activation; retained-safety-assertions and maintained E2E runner. Trace actual source before edits. Preserve widget capability deletion's narrow key set and serialization. Existing guarded deletion fixture stores only synthetic transport phase, not a real receipt.

## CI
Use exact run/head and distinguish PR merge checkout. Final Quality39470402671/DB118793354045 completed success after an earlier pending observation. Preserve historical ECR failures as availability risk; no protected replay authority follows. Security raw refusal in job118792630280 was independently read. The unmodified source-only proposal expires2026-10-21T00:00:00Z. No protected date/control renewal is allowed.
