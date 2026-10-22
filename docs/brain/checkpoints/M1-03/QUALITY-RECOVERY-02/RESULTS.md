# Measured source results

Measured `dcfb51b107019f31f2be96d099e424991c8fbb34` / tree `5169c4895bb6e17ec26b4f04d7ee7881328c87fd`. Source-only; no independent acceptance.

| Check | Actual outcome |
| --- | --- |
| R1 external context anchor | PASS,15 members |
| Pre-edit Git blob/SHA256 preimages | PASS,11 writable +8 protected |
| npm11.20.0 final fresh ci | PASS,1,032 packages; real postinstall |
| Four patches / nested lock delta | PASS,4 direct patches +drawer-layout4.2.11→4.2.12 required by router; no unrelated entries |
| Official changed tarball provenance | PASS,5 artifacts independently rehashed to registry SRI |
| Widget native original equivalence | PASS,10/10; custom store absent upstream;11 payloads unchanged |
| Widget idempotent/adverse tests | PASS,25/25 |
| iOS extension contract | PASS,42/42; overlaps widget suite |
| Native privacy provenance | PASS,4 lock entries +10 installed pins;3 digest fields only |
| Strict canonical privacy audit/check | PASS;source_candidate/archive_required retained |
| Privacy fixtures | PASS,77/77 |
| Archive privacy fixtures | PASS,238/238; tests do not supply an archive |
| Store source inspection | PASS,source gates;original release warnings remain |
| Forced root tests | PASS,6,067/6,067;24 console +6,043 mobile;0 cached tasks |
| Forced typecheck/lint | PASS;0 cached tasks each |
| Full Linux governance | PASS,83 passed +2 Windows-only skips;85 run,including8 new adverse tests |
| Original secret fixtures | PASS,12/12 |
| Original Security technical contracts | FAIL,70 run;failures=23, errors=2;exit1 |
| Official Expo check | FAIL,exit1;notifications57.0.23→expected~57.0.24 outside grant |
| Expo Doctor1.21.5 | FAIL,20/21;exit1;same notifications mismatch |
| Canonical worklist | Clean canonical generation,0 warnings;strict check recorded after evidence publication |
| Strict M1-03 report | Committed regular Git artifacts required;final validation receipt is published separately |

The first original Security run had23 failure events and5 errors. Three errors were missing historical objects. The first bounded hydration covered177 frozen-witness objects;the second full suite had23 failure events and3 errors. One additional object named by the protected current-source fixture was then hydrated;all192 required objects are now present. The final full suite has failures=23, errors=2, preserving the authentic `WORKFLOW_SBOM_UNRELATED_FAILURE_OR_DRIFT` failures. All three runs are retained. Historical fixtures were never substituted or refreshed.

The first Phase4 producer observed uncommitted evidence and warned DIRTY. Its log is preserved. After committing diagnostics, the original canonical producer regenerated from a clean source checkout with zero warnings; the final committed worklist is that clean result. No source producer was changed.

Measured-head CI details, actual job IDs, safe log excerpts and decoded-log hashes are in `evidence/measured-ci.json`. Quality source job119903278725 passed installed privacy audit, then failed Expo dependency compatibility on notifications. Canonical DB job119903279211 failed `Data limit exceeded`;PG15/PG17 succeeded separately. Original Security jobs failed; iOS workflow source-only succeeded,with an older in-progress job-list snapshot preserved. Final-head results are separate terminal observations.
