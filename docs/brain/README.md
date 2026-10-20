# Durable Brain state and succession

Latest authority: [Brain REVIEW-01](reviews/M0-02/REVIEW-01/README.md), verdict **FIX_REQUIRED**, M0-02 / FIX-01 from `da9fa04759164b402ee3b2abd1c80e14261614fb`. This versioned overlay supersedes prior submission/review status, while the original state/input bytes below remain immutable. Current observations use schema 3 and [report/evidence contract v3](contracts/FIX-01-v3.md). The [original submitted report](checkpoints/M0-02/completion-report.json) is historical; the new [FIX-01 report](checkpoints/M0-02/FIX-01/completion-report.json) is separate. Only Brain can accept or authorize an exact-head main promotion; this repair does neither.

Start at [V2 authority](../v2/README.md), [approved state](state/brain_state.json), [acceptance ledger](state/ACCEPTANCE_LEDGER.json), [ADRs](state/ADR_REGISTRY.json), [blockers](state/BLOCKERS.json) and [approved roadmap](state/roadmap.json). These are the exact Brain-approved bytes supplied for M0-02. [Current observations](current.json) are a separate Codex overlay and cannot modify acceptance. The original Codex [M0-01 evidence](checkpoints/M0-01/REVIEW_EVIDENCE.md) is preserved beside the separately attributed [Brain audit](checkpoints/M0-01/BRAIN_AUDIT_M0-01.md) and [Brain machine observations](checkpoints/M0-01/BRAIN_REVIEW_OBSERVATIONS.json).

Only one writer and one issued task are permitted. M0-02 installs non-runtime planning controls; no M1 task is issued. Ready selection lists outstanding dependencies, priority predecessors and external gates but never issues work, starts a process, merges or purchases anything. M0-01 diagnostic acceptance satisfies only this explicitly independent M0-02 dependency. All baseline, DB06/DB08/R2B, source custody, device, provider, research and release constraints remain open.

Evidence vocabulary for new observations: `SOURCE_REPORTED` (an attributed claim), `INDEPENDENTLY_OBSERVED` (read metadata/logs/source), `INDEPENDENTLY_REPRODUCED` (actually reran an exact check), `DECIDED` (attributed authorized decision), `UNKNOWN`. Existing richer historical vocabulary remains intact in the approved snapshot, rather than being silently normalized. A reproduced source test never closes another evidence axis. FAIL, NOT_RUN and BLOCKED cannot become PASS. Artifact identities can remain unknown/null; missing research/parents never become admitted zero values.

From repository root, using the installed Python interpreter:

```text
python scripts/brain/brain.py validate
python scripts/brain/brain.py mirrors --check
python -B -m unittest discover -s scripts/brain -p "test_*.py" -v
python scripts/brain/brain.py report docs/brain/checkpoints/M0-02/FIX-01/completion-report.json
python scripts/brain/brain.py ready
python scripts/brain/brain.py pack --task M0-02 --output <absolute-external-new-path.zip>
python scripts/brain/brain.py verify-pack --task M0-02 --output <absolute-external-existing-path.zip>
```

`mirrors` without `--check` regenerates the planning views. Check mode is non-writing and byte-exact. Run it after approved snapshot integration or an observed source delta, inspect the delta, and never change the immutable inputs to suppress a refusal. Existing source hashes can differ (for example M0-01 changed PROGRESS); `source-reconciliation.json` records that freshness difference without overwriting historical truth. The launch contract itself must remain byte-identical during M0-02.

The M0-02 pack command rebuilds the **already issued input context for audit**, not a new task authorization or updated research bundle. Its 48 explicit inputs come from the Brain's supplied task manifest, including the historical builder as explicitly selected text reference. `CONTEXT_MANIFEST.json` is new deterministic packaging metadata; the inherited `TASK_MANIFEST.json` stays unchanged. The original ZIP's compression/timestamps differ, so its hash intentionally differs from the integrated deterministic ZIP. No full history/research archive is copied.

Future task specs belong under `task-specs/` only after separate Brain issuance/review. Each spec binds an issue manifest by SHA256, exact source/archive names, bytes, file hashes and context bounds. Source/test code needs explicit code review in that issue allowlist. Positive future-task tests use synthetic fixtures only. A declarative issue record is not a cryptographic signature: reviewing its commit/author/custody is the Brain's responsibility. Codex must not fabricate a record to admit an unknown task.

The installed authority anchor deliberately admits the supplied M0-02 state/version only. A future accepted-state transition requires a newly reviewed immutable snapshot/version and corresponding validator-anchor review, together with its issued task spec; adding a spec alone cannot authorize execution. Preserve old snapshots and record the successor's provenance. Do not rotate the current anchor to silence an unissued-task refusal.

Packaging rejects traversal, absolute/drive/UNC/ADS names, case/Windows aliases, links and reparse points (including junctions), hard-linked files, private/restricted paths, credentials, binary signatures, archives, non-UTF8/control text, altered input hashes, unknown/unissued tasks, collisions, excessive file/byte counts, linked output ancestors and output inside the input root. It reads explicit files only, uses fixed sorted stored ZIP entries, CRC checks, exact content hashes and canonical byte comparison. These controls complement human input review; a text suffix is not a proof that arbitrary text is public. Never place private reports, personal images or raw clinical data on any allowlist.

At every session end, fetch/reconcile without rewriting shared history, commit/push safe work plus [root handoff](../../ONSKIN_BRAIN_HANDOFF.txt), and place sanitized evidence/report under the task checkpoint. Use [report v2](contracts/README.md) to distinguish measured source/test snapshots from the final delivery ref. Obtain delivery HEAD from the live pushed branch after the report commit. Push failures are `PUSH_BLOCKED`, never force-pushed. Stop for independent Brain review; only it can accept M0-02.

The proposal's actual expiry remains **2026-10-21T00:00:00Z**. Inspect the current UTC clock when reviewing; an expired proposal stays expired. Do not refresh its date, owner pins, inventory or exception policy. [Remediation packet](checkpoints/M0-02/BASELINE_REMEDIATION_PROPOSAL.md) is proposal-only. No owner action or paid/authenticated route is required to finish M0-02.
