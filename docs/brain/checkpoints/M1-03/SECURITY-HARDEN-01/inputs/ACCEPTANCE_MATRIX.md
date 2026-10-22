# M1-03 SECURITY-HARDEN-01 acceptance matrix

| Gate | Required positive | Required adverse / limits |
|---|---|---|
| SH-1 original scanner fixture | Original ten cases + CI Linux test step pass at actual candidate head; scoped fixture cleanup stable in declared repetitions | No hidden suppressed `rmtree`/Git failures, no change to scanner execution/coverage behavior |
| SH-2 candidate installed tree | Full launch-relevant byte/link/cache/install graph verifier and exact upstream/derivative/installed measurements | Tamper bytecode, source, cache, venv link, entrypoint, wheel and policy rejected before scan |
| SH-3 source snapshot | Exact Git head/tree/blob/contents; pre-/post-bundle source rehash and source-only execution proof | Modified/renamed/link/hardlinked exported bytes or post-scan rewrite rejected without destructive cleanup |
| SH-4 coverage | All four unchanged pinned bundles; every path/rule disposition; warranted SQL/parser/timeout improvements | Any unsupported/parse/timeout/blocked file remains UNAVAILABLE not zero; no rule excludes, no blind timeout increase |
| SH-5 findings | All raw findings kept in safe redacted/provenance form; current source identities, actual secret/advisory findings classified by evidence | No raw secrets, fake no-finding, invented public-hash proof or expired review renewal |
| SH-6 governance | Original issuance lineage, branch-only writes, approved state delta, exact source/test receipts and committed evidence | Extra path/fake acceptance, unbound CI/source data, stale source and local-only artifacts rejected |
| SH-7 CI | Fresh Quality, iOS source, Security original jobs at measured and delivery SHAs, actual source/PR-merge identities | Fail/pending/skip never pass; physical-device/hosted DB/qualified release remain CLOSED |

Do not chase green scans by removing data. The working candidate remains NON_ADMITTING even after tests pass. The actual Security admission requires a separate owner/qualified source/expiry decision.
