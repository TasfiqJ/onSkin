# Non-negotiable test and acceptance matrix

| Gate | Expected audit evidence | Never substitute |
|---|---|---|
| T1 issuance | externally anchored ZIP manifest; exact base; every pinned existing source/protected preimage; one writer/clean branch | fresh hash computed by Codex alone |
| T2 Expo | npm 11.20.0 deterministic lock, official registry tarball and integrity; fresh npm ci; **mobile-app** `expo install --check` and Doctor | root-dir irrelevant green, exclusions, unreviewed version bump |
| T3 widget/native | unchanged patch installer/native Swift; actual postinstall check and 25 widget tests/42 extension tests; strict native source proof | generated native re-patching without identity verification |
| T4 mapped privacy | exact four old mapped lock entries and ten installed source-pin hashes unchanged; only three new lock SHA fields; strict privacy producer/check; 77 privacy/238 archive fixture tests | archival privacy approval or editable review rules |
| T5 root | force `npm test -- --force` (baseline 6,067), `npm run typecheck -- --force`, `npm run lint -- --force`; no cached task substitutions | prior head counts or cached green |
| T6 governance | full Linux Python `scripts/brain` discovery 85 baseline + new tests, genuine only-platform skips; expected wrong-authority failures preserved | deleting negative tests, `SKIP` manufactured for source issues |
| T7 Security | full original secret12 and original Security contract70, actual raw failures preserved; frozen G97 findings/expiry kept red | local passing safety fixtures = Security source GO |
| T8 delivery | strict M1 report + clean Phase4 source worklist, SHA256-bound *committed regular Git blobs*, CI Quality/Security/iOS at exact new head, protected issuer/DB blockers | code SHA borrowed from evidence SHA, stale provider CI, self-acceptance |

Use a separate clean no-hardlink Git checkout for crucial tests; no shared installs. WSL/Windows runtime and platform skip semantics must be honestly stated. Require reviewed installed toolchain, pinned npm and exact Git SHA/tree in execution receipts. Preserve all first failures, meaningful retries, current failures and ECR status. This narrowly completes the source-independent Quality dependency path **only if every in-scope source check is green**; it never grants full M1-03 or `main` acceptance.
