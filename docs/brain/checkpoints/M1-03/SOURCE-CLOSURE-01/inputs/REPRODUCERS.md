# Independent adversarial reproductions and evidence limits

## F1: Historical governance fixtures (real clean clone, Windows)

Environment: Windows Python3.9.13, fresh no-hardlink clone, exact `49a39b7f5b194d5c356a21c690e3f1bdb09edfa1` / tree `1ca412f1fc6550124445adae7d4b0e748429b11e`; `python -B -m unittest discover -s scripts/brain -p test_*.py`. Result: `Ran 65 tests ... FAILED (failures=4, errors=1, skipped=2)`. Details:

- `test_m103_security_harden01_profile.Hardening.test_exact_issuance_prior_interval_and_gate_types`, `.test_intermediate_unauthorized_commit_and_malformed_preimage_refuse`, `.test_sandbox_digest_discrepancy_is_not_permission_to_edit`: synthetic `update-ref`/`read-tree` fails due `error: object directory .../.git/objects? does not exist; check .git/objects/info/alternates`. This is the synthetic alternate or its backing path, not justification to turn validators off.
- `test_m103_cont01_profile.M103Continuation.test_positive_report_and_wrong_base_tree_branch_digest_authority`: error inside `_validate_cont01`, historical profile authorization.
- `test_m103_cont01_profile.M103Continuation.test_extra_source_and_unmeasured_allowed_source_and_false_acceptance`: expected `Implementation differs` but observed `CONT-01 path outside exact source-edit authorization`. Preserve both checks and establish correct historical fixture source setup/sequence.

Four failed, one error and two Windows symlink skips are genuine separate outcomes. Keep all older signed/immutable task documents untouched.

## F2: Linux missing historical objects

In an independent Linux clone after exact `npm ci`, the 70-test `scripts/phase9/security_acceptance/test_contract.py` suite had **3 errors** because `git cat-file blob e5ac82670fa8ff72ca39048faba8f1a964fd3995:apps/mobile/src/lib/auth/AuthProvider.tsx` was not present in that clone's object store. Source pack/protected fixture proof requires historical object custody; supply verified actual old Git objects or return exact BLOCKED, never inject synthetic substitutes. Original GitHub supported 70 passed under its own broader history environment.

## F3: candidate private-tool result is NOT full scan

From the published SHA-bound evidence at measured 8e8983f5: four exact bundles raw exit0, but 173 failed tracked targets, four unresolved SAST findings, and 333 fixpoint warnings; explicit OWASP SQL probes had186 errors and secrets SQL40, plus one TS PartialParsing. Raw exits0 do not establish rule/target coverage. New final-head full scan NOT_RUN.

## F4: malformed prior preimage

Former issuance `scripts/security_readiness/m103/sandbox.py` preimage length62: `fe2c5580115c7f4b791edc7d72851044c0677e464bc53c467a42d9ce508b15`; independently inspected **actual** 64-hex SHA at new base: `fe2c5580115c7f4b791edc7f7a72851044c0677e464bc53c467a42d9ce508b15`. Only the latter is an exact source-edit candidate in this issuance. No retrospective rewrite of old input or policy.

## F5: CI final-head independent truth

At review observation, Quality39598570423 repository/PG15/PG17/Expo platform jobs succeeded and canonical DB job119217196867 was in_progress; Security39598570047 failed, including code/static/review acceptance and current-source secret findings, while original 12 secret fixture tests passed; source-only iOS39598570370 succeeded. Refresh all head/run/job outcomes when new HEAD arrives.
