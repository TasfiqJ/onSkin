# M1-03 / SECURITY-HARDEN-01 — one substantial implementation task

## Objective

Close **reproducible source-side Security-readiness defects** that prevent defensible M1-03 completion, without rewriting accepted V2 app behavior or manufacturing Security authority. Own the complete causal test/hardening/coverage/triage checkpoint end to end. No user feature redesign or M2 implementation.

Repository `TasfiqJ/onSkin`; existing branch `stage/m1-retained-safety`; task base `8babdad11791496ad6e8c45154b3b173bdddd36e` / tree `cf2ff58cc140956d8c3cda4a11c703733ebe6544`. Observed main `bbc28dc3d1f945191a81be56945b8bda7bb6ef73` remains read-only. Seven overnight commits are part of accepted staged ancestry. One writer; PR #9 draft/unmerged; all safe normal pushes to the same stage branch.

## Workstream 1 — make original scanner CI fixture deterministic

Actual final-head Security run 39545262842, original secret job 119041893805, failed in `test_safe_archive_and_byte_substitution_refuse_before_execution` with **nine passes and one error**, a `TemporaryDirectory` teardown `OSError: [Errno 39] Directory not empty: '.git'`. The scanner steps were skipped thereafter. Diagnose Git/test background process lifetime, explicitly synchronize/disable fixture-generated maintenance if justified, and prove cleanup under CI-like Linux setup. Fix only authorized test fixture code, never the active scanner or workflow. Retain original 36-commit coverage/merge/newest refusals, all original ten cases and wrong-tool/raw-result negatives. No retries-until-green or blanket ignore; repeat a finite declared Linux schedule, record failures and get actual new stage CI.

## Workstream 2 — harden the isolated scanner candidate

Independently reproduced: `candidate.installed_tree` excludes altered Python `__pycache__/*.pyc`; `source_scan.validate_inventory` accepts a committed inventory after exported content is modified. Correct complete interpreter/launcher/import/dependency/cache inputs and rehash current Git materialization before, during and after rule execution. Prevent symlink/hardlink/rename/race/TOCTOU substitutions; maintain no source-bearing network/telemetry/listener possibility. Add adversarial filesystem and process tests that fail old code and pass repaired code. Preserve exact Semgrep original/derived wheel identity, metadata-only MCP1.30.0 modification, certifi2026.10.19 and the 66-wheel dependency closure, with private non-admitting isolation. Do not install/activate into workflows or share node_modules.

## Workstream 3 — reduce real coverage gaps, preserve findings

Rerun on a fresh exact implementation SHA, not historical 18,782 static paths. Four pinned rule bundles; no rule/runtime/policy replacement. Diagnose 26 SQL tests not scanned, OWASP timeout on a historical evidence log, PartialParsing in `AgeReverificationRights.integration.test.ts`. Use safe bounded sharding/target-specific diagnostics where technically justified and prove no files/rules silently vanish; if upstream parser cannot handle a target, remain BLOCKED with exact reason. Every tracked Git path must be in exactly one of SCANNED/UNSUPPORTED/FAILED and every executed rule/path relation auditable. Existing three finding records remain unresolved until bounded proof or qualified review; no no-findings claims.

## Workstream 4 — review-quality triage and release-source evidence

Reconcile current original Gitleaks full-scope findings (historical 5,439 previous run only) to exact head/CI evidence, maintain redaction and source blob/range proofs; never republish raw scanner secrets or test credentials. Reconcile 68 npm and five OSV earlier source records and six unknown dependency routes to current actual lock where possible. Harmless public hash proposals require exact objects and scanner match; unknown remains UNKNOWN. Preserve meaningful segregated CI statuses, native/source-only success, protected DB06/DB08/R2B custody and expiry. Produce one precise residual founder/custodian packet only if a real indispensable external input is now blocking.

## Deliverables and stop

Maintain code under `scripts/security_readiness/m103`, meaningful negative tests, exact measured/executed source and security proof packet under `docs/brain/checkpoints/M1-03/SECURITY-HARDEN-01/`, and a tracked root `ONSKIN_BRAIN_HANDOFF.txt`. Install the supplied Brain review as an immutable successor at `docs/brain/reviews/M1-03/OVERNIGHT-REVIEW01/` with a minimal hardcoded independent profile, not a rewrite of prior records. Test runtime checks, 70 original supported Security contracts, 10 original scanner negatives, exact regression and governance, and finite original CI. Keep test/scan/parser/tool/provider/qualified axes separate; code green is not actual Security acceptance.

If a protected/external axis is blocked, complete other authorized independent work, checkpoint and push. Do not broaden source scope by inference or silently start M2. Stop for Brain review after safe final push. Context HIGH/compaction requires a sanitized exact resume checkpoint and stop.
