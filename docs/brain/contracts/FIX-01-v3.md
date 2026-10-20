# M0-02 FIX-01 evidence contract v3

Current submissions use [completion-report.v3.schema.json](completion-report.v3.schema.json). The original v2 schema, report and evidence remain historical bytes; the repaired CLI rejects v2 as a current submission. The Brain's [REVIEW-01](../reviews/M0-02/REVIEW-01/README.md) says FIX_REQUIRED, not accepted. Current state schema 3 references that immutable review overlay and keeps all thirteen blockers and every external axis unchanged.

Executed PASS/FAIL observations and report tests require an integer exit (booleans/strings reject), command, working directory, environment, exact existing source commit/tree, outcome and a SHA256-bound JSON execution receipt. The source must be an ancestor of the local stage. A receipt has schema_version 1, kind LOCAL_EXECUTION, claim_origin CODEX_REPORTED_EXECUTION, matching command/directory/environment/source/status/exit, and an output object with path and SHA256. Optional counts are either null (unknown/not applicable) or exact nonnegative integer passed/failed/skipped counts. An all-skipped or failed test set cannot establish PASS. Reports list both receipt and output in their hash-checked artifact inventory. Non-execution observations retain attributed OBSERVED/UNKNOWN/NOT_RUN/BLOCKED states, have no execution exit and never acquire invented command/result fields.

CI report rows bind repository, workflow_id, run_id, name, head_commit, status and conclusion to one listed/hash-checked structured observation. Observation format: schema_version 1, kind CI_OBSERVATION, claim_origin CODEX_OBSERVED_PROVIDER_METADATA, evidence_class INDEPENDENTLY_OBSERVED, repository TasfiqJ/onSkin, recorded_at_utc (UTC ISO seconds) and runs containing those exact row fields. Duplicate or missing runs, wrong artifact/hash/source/workflow, and inconsistent states reject. Queued/in_progress runs require pending; completed runs require a final conclusion. Skipped/cancelled/failure are retained. A historical row's source is explicit and cannot establish a different head's success.

The validator verifies actual Git commit objects/trees and ancestry from original stage base to task base, repair base, measured implementation and local stage. It also verifies observed-main, executed-test, CI and past pushed identities and their applicable ancestry. The fixed bases are independent of report content. Synthetic tests read those historical objects through a local read-only object alternate and create isolated fixture commits; no source history is rewritten and no synthetic CI record is represented as genuine provider evidence.

These are **offline consistency checks of attributed claims**, not proof that an author ran a command or that JSON originated at GitHub. Actual execution/provider readback and independent Brain review remain necessary. The CLI performs no network request or hidden provider action. It never grants source GO, professional/device/provider/clinical/commercial/release acceptance or main promotion.

The original M0-02 pack still rebuilds its exact reviewed inputs. The fixed-code issuance map binds the task to the original manifest SHA256, exact path and input prefix independently of mutable task specs. A future task needs a separately reviewed successor authority; an issuer string or a mutually consistent spec/manifest/payload cannot approve itself. Positive generic packaging tests inject a clearly synthetic authority only within the test process; the production CLI has no authority-injection flag.

Mirror generation preflights all lexical destinations and ancestors before directory/file creation. Dangling/reparse links, nonregular and hard-linked outputs reject before writes. New files use exclusive creation; existing handles are checked before truncation. This addresses the reproduced static-link defect and common replacement races; it is not a claim of a general adversarial multi-process filesystem transaction. Platform filesystem skips remain explicit.

Commands from repository root:

```text
python -B -m unittest discover -s scripts/brain -p "test_*.py" -v
python -B scripts/brain/brain.py validate
python -B scripts/brain/brain.py mirrors --check
python -B scripts/brain/brain.py report docs/brain/checkpoints/M0-02/FIX-01/completion-report.json
python -B scripts/brain/brain.py pack --task M0-02 --output <new external path.zip>
python -B scripts/brain/brain.py verify-pack --task M0-02 --output <external path.zip>
```
