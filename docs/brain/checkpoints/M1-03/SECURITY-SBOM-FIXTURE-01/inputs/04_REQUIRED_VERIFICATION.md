# Evidence acceptance matrix — TRUE results only

| Gate | Expected measurement | Required safety |
|---|---|---|
| Context and source preimages | External SHA-256 VERIFIED; every 25 preimages byte/blob/hash match | STOP on even one drift |
| Candidate patch | Exactly one file; exact committed patch SHA256 and exact postimage | No protected contract source/wrapper/workflow edits |
| Baseline | Original targeted test actually FAILS before edit | Do not discard raw failure |
| Unit fixture | All original 70 PASS; six named adversarial tests PASS | Test-only; never provider acceptance |
| Original secret fixtures | All 12 PASS | Not substitute for live provider secret scan |
| Historical real provider packet | Previously FAILED for unreviewed advisories, new PR CI REQUIRED for freshness | No re-dated fixture/source/advisory exceptions |
| Repository suite | Fresh npm ci, forced 6,067 tests, typecheck and lint, zero cache | Do not weaken tests |
| Governance | Original full 103-case discovery PASS, two genuine Windows-only skips | Never edit earlier governance source |
| Worklist / source provenance | Strict canonical Phase4 check; record honest status | If the checkpoint needs new write authorization, STOP |
| New exact-head GitHub CI | Inspect actual Quality, Security, iOS jobs on draft PR if opened | Keep real FAILED/PENDING/NOT_RUN distinct |
| Canonical ECR | Original image stays frozen, no pull by this task | DATA_LIMIT_EXCEEDED remains custodian blocker |

Preserve exact source SHA/tree, separate code implementation from evidence-only commit(s), commands/cwd, time/tool versions, raw exit codes, truthful failures and committed regular Git artifact hashes. Do not include secrets, raw scanner findings, patient or credential material. If a test runs but is canceled/timed-out, label it as such.
