# QR02 source-side acceptance matrix (no protected GO)

| Gate | Required verification | Never substitute |
|---|---|---|
| Q1 exact version resolution | Four SDK57 patch versions and npm lock graph/real registry integrity | Forged SRI, overrides, skipped compatibility checks |
| Q2 widget native equivalence | All ten upstream bytes match previous originals; custom store remains reviewed; actual postinstall+native adverse tests | Rehashed unreviewed Swift changes, dummy archive |
| Q3 privacy provenance | Three unchanged mapped native package version/integrity/source pins; only lock SHA strings rebound; strict canonical source audit green | Copying SHA without checking installed native bytes, source_candidate=archive |
| Q4 source contracts | Installed Expo check and Doctor green; root 6,067 forced tests, typecheck/lint, widget, governance full, original secret fixtures | Cached or partial green, suppressed validation |
| Q5 original Security | Run full original original suite, retain all real failures, especially SBOM drift and unreviewed source findings; produce sanitized owner evidence | Modify frozen Security fixture/workflow/policy or relabel failures green |
| Q6 CI and external blockers | Exact final-head PR9 Quality/Security/iOS job statuses/IDs; distinguish source-expo blocker vs ECR quota | Historic Quality green, PG15/17=canonical DB, iOS source=device |
| Q7 evidence/governance | Source/edit SHA preimages, new disjoint refusal tests, committed regular Git blobs/hashes, clean worklist/strict report, one stage push | Self-issued acceptance, report pass=source GO |

The Brain may independently accept **limited source diagnostics** if Q1–Q4 and Q7 genuinely pass while original Security/ECR/DB owner gates remain red. This cannot promote M1-03, authorize main, M2, protected source, hosted replay, clinical activity or release. Any infeasible source step within two distinct meaningful repair cycles remains BLOCKED with exact witness instead of false success.
