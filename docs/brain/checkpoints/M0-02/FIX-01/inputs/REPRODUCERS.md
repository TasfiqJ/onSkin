# Review negative cases — disposable inputs only

Source under review: `da9fa04759164b402ee3b2abd1c80e14261614fb`; `scripts/brain/brain.py` Git-blob SHA256 `7eba8d01320ade6cc57183ba191769246a83e11ed35d0523a0fb9a3f5d3edf82`. All Windows cases ran against the submitted actual CLI with its `--root` option pointed at disposable governance fixtures created with `test_brain.InstalledControls.setUp()`. The real stage was clean before/after. Synthetic approvals/reports below are not genuine project authority. Never apply them to a real task spec or publish them as actual passed work.

## Shared fixture and invocation

From the stage root, Python 3.9.13, import the actual `scripts/brain/brain.py` and `test_brain.py`; instantiate `InstalledControls`, call `setUp()`, and always `doCleanups()` in finally. The fixture copies only governance namespaces and explicitly selected source documents to a temporary root. Run the real CLI as:

```text
python -B <actual-stage>/scripts/brain/brain.py --root <temporary-root> validate
python -B <actual-stage>/scripts/brain/brain.py --root <temporary-root> report docs/brain/checkpoints/M0-02/synthetic-review-report.json
python -B <actual-stage>/scripts/brain/brain.py --root <temporary-root> pack --task M0-02 --output <outside-temporary-root>/unapproved-output.zip
```

All five invalid CLI inputs below returned **0** at the submitted source. Corrected cases must reject for the intended reason while meaningful valid controls still succeed.

## A1/A2 — unsupported observation

Append this to the temporary `docs/brain/current.json` observations without changing any old entries:

```json
{"id":"SYNTHETIC-BRAIN-UNSUPPORTED-PASS","evidence_class":"INDEPENDENTLY_REPRODUCED","axis":"source","status":"PASS","exit_code":0,"admission":"NONE"}
```

The first validate returned 0. Independently replace exit_code with JSON false; validate also returned 0. No command, artifact/hash or source tuple was supplied for this alleged execution.

## B1/B2 — report binding

Create the existing clearly synthetic positive report fixture with `report_fixture()` and save a separate temporary report. B1 replaces its CI list with:

```json
[{"head_commit":"0000000000000000000000000000000000000000","name":"Synthetic unfinished CI","run_id":1,"status":"in_progress","conclusion":"success","scope":"SYNTHETIC ONLY","evidence_class":"INDEPENDENTLY_OBSERVED","artifact":"does-not-exist.json"}]
```

B2 separately replaces original_stage_base with forty zeroes and observed_main with both commit/tree of forty zeroes. Each full report invocation returned 0. The synthetic positive fixture itself omits real original-base history; when repairing, improve valid fixture ancestry rather than causing every case to fail for an unrelated fixture defect. Test each malformed relationship separately as well as the combined historical reproducer.

## C1 — same-task self-authored approval

Leave immutable source-inputs and current M0-02 state intact. Under temporary `docs/brain/review-synthetic-unapproved/`, write `UNAPPROVED.txt` with bytes:

```text
SYNTHETIC UNAPPROVED CONTENT. Not a Brain-issued task.
```

Create a manifest using the same JSON encoder with task_id M0-02, issued_by onSkin Brain (a fixture string), max_input_bytes8192, synthetic_fixture true, and one `files` entry binding that text's correct length/SHA256. Write it as TASK_MANIFEST.json. Change only the temporary task spec's input_prefix/approval path/hash and exact files to those new rows plus that manifest, with code_reviewed false and max_files10. Do not change the original pinned manifest `fd04a4fe643949b994ab01697cf48fb2894da805951f7389c76aa770b0972957` or its original contents. The full pack CLI emitted an unapproved three-entry ZIP and exit0. Fix authority binding, not only mismatching hashes in this fixture.

## D1 — dangling mirror target

Use the supplied `BRAIN_REVIEW/mirror_source_slice.py` only for the focused historical proof. On a symlink-capable disposable filesystem, create an empty root with `docs/v2/mirrors/`; make `synthetic-view.txt` a dangling symlink to a nonexistent file outside that root but within the same temporary test directory. Stub `verify_inputs` to return normally and `generated_views` to return a single synthetic text output. Call `mirrors(root, check=False)`.

Observed: outside target absent before call; call raises Link/reparse point forbidden; outside target now exists as an empty file. The five source function hashes match the actual Git blob (see mirror-symlink-result.json and audit). Inputs/data generation are deliberately stubbed so this is not a full CLI proof. Add an integrated positive/negative test with valid input fixtures where your environment permits. If Windows symlink creation is unavailable, preserve that real skip; real junction/hard-link tests and safe source-level coverage are still required. Do not elevate privileges or change the host just to hide the skip.
