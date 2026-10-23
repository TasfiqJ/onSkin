# Results and actual exits

No result grants source admission or owner approval.

| Check | Observed result |
|---|---|
| External context, 24 preimages, fingerprint | PASS, exit 0; exact Git/working bytes; no hardlinks/alternates |
| Final new adverse suite | 22 PASS, exit 0, clean clone, Python 3.12.14 |
| Final independent inventories | exits 0/0; 45 identical files; 20,835 paths |
| Authentic bundle re-verification at a03 | exit 0; rebuilt every row and sidecar |
| Re-signed source SHA tamper at a03 | exit 1, INVENTORY_RECOMPUTATION_DRIFT; expected refusal |
| Original expiry tests at df171207 | 8/8 PASS, exit 0 |
| Strict canonical Phase4 worklist at df171207 | PASS, exit 0; no regeneration needed |
| Original source contract at df171207 | exit 1, SOURCE_INVENTORY_DRIFT; no SAST execution |
| Original Security70, Python 3.9 | exit 1; original PEP701 syntax unsupported |
| Original Security70, Python 3.12 | INCOMPLETE; exit 1 after 180s timeout; four failing subcases already observed |
| Original secret12, both Windows attempts | exit 1; 12 attempted, 10 errors / 1 skip / 1 pass; POSIX fixture URI incompatible with Windows |
| Ordinary governance103 | INCOMPLETE; raw child exits 1; controller interrupted at 314.000s and 43.156s under disk exhaustion |
| Root 6,067 / typecheck / lint | NOT_RUN; independent Python tooling, no app/package/TypeScript/native source change |

Commands, actual cwd, selected environment changes, interpreter, timeout, raw streams and exits are under `evidence/checks-python39/`, `checks-python312/`, `final-run-*-receipts/` and `bundle-integrity-checks/`. The interrupted governance runner's raw FAIL remains intact; completion status is INCOMPLETE because the suite did not finish. No alternate synthetic green. Original tests were never edited.

The four observed protected Security negative subcases are parsing diagnostics, taint diagnostics, engine_requested and skipped_rules. Their failures precede the historical Git-proof test stall. They remain open observations; no later claim replaces them.

Issued-tree CI independently observed: Security **40029099712 FAILURE**, Quality **40029099723 FAILURE** (canonical registry `Data limit exceeded`), repository quality and exports success, iOS **40029099736 success, source-only**. Original artifact commit `9eb12b8dacd7221c39f7350bc622daa42e2052b0` is the PR merge ref with the exact issued tree `f873f4ba961b078465234f33eb2f30728f343515`. SHA256-verified provider artifacts bind sanitized aggregates in `evidence/issued-*.json`.

Gitleaks: **1,132 current / 4,373 historical**, both exit 2, OWNER_UNREVIEWED. TruffleHog current/history exit 0. npm: seven high, zero critical; original enforcement failure. OSV: nine affected package entries and four advisory IDs; original enforcement failure. No found secret values, raw source dumps, credential tests or local ECR/hosted use.

Two OWASP approaches fail custody. All-four-rule claim false; original current SAST NOT_RUN; source/scan NO_GO. Proposal expiry and all owner gates remain unchanged. Context VALID; USD 0.
