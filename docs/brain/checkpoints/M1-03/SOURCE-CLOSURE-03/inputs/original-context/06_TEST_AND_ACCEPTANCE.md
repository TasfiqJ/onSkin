# Finite cloud execution acceptance matrix

| Gate | Actual exact-head evidence required | Refusal if missing |
|---|---|---|
| K01 cloud custody | source SHA/tree/preimages, published connected cloud environment, genuine Linux runner identity, safe disk/CPU, original immutable SC01/SC02 | HEAD_DRIFT, CLOUD_CAPABILITY_BLOCKED, or PUSH_PERMISSION_BLOCKED; no Windows fallback |
| K02 historical proof | real 112 commit/blob refs, 3,265 primary witnesses, no synthetic or live-object-alternate substitutions, positive and adversarial acquisition + pack/import in isolated cloud | BLOCKED_OBJECT_CUSTODY, with exact OID/ref/error |
| K03 governance | complete clean original 65 + prior SC01 3 + genuinely new tests, true OS skips, no omissions; original supported independent Linux70 in real full history | exact PASS/FAIL/ERROR/SKIP/ABORT counts; do not borrow provider 70/70 |
| K04 candidate isolation | private graph of all 66 verified wheels, original Semgrep core, isolated METADATA/RECORD derivative, nine+ real adversarial tests, enforced no-network runtime | BLOCKED_CLOUD_CAPABILITY or BLOCKED_CANDIDATE; no open-network substitute |
| K05 final exact scan | new four unchanged bundled rule sources; entire committed code-source target inventory, per-file/rule/language SCANNED/UNSUPPORTED/FAILED, four findings and parser/fixpoint errors as observations, no waived records | honest NOT_RUN / engine limitation / failed state |
| K06 quality | fresh `npm ci`, forced root test/typecheck/lint where feasible; original GitHub Quality/Security/iOS all exact final stage head run/jobs and PR checkout; Expo and ECR limits separate | no cross-head green or candidate-to-original substitution |
| K07 delivery | strict report with exact preimage, implementation, measured, evidence tail and pushed stage refs, every safe artifact digest verified, bad/blocked matrix and one owner packet | partial/BLOCKED, Brain-only acceptance |

**Review outcomes available only to Brain:** `ACCEPTED_SOURCE_DIAGNOSTIC_ONLY`, `PARTIAL_ACCEPTED_FIX_REQUIRED`, `BLOCKED_EXPLICITLY`. No result in this task by itself grants M1-03, original G97 Security, DB06/08/R2B, M2, main or release acceptance.
