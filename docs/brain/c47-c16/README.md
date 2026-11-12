# Brain contribution: preparation probes

Base: 51769a8f19eb605ff1b36336c685c06e9668ab76 (PR48 candidate unchanged).
This isolated contribution is for Codex review and integration, not release or native acceptance.

Adds a small preparation-only probe implementation and 15 synthetic unit/child-process tests.
The integration patch targets exactly the base replay coordinator. It separates preparation
from active ACK timing, records static operation/timing/lengths without raw private arguments,
and reduces pre-runner process discovery polling from 10 ms to 250 ms. Preparation probes use
at most 15 seconds and the remaining ORIGINAL UI deadline. Active three-second subprocess,
five-second ACK and original user-journey assertions are not changed.

The patch changes only timeout_operation12, discover13 and observer13; 67 other function ASTs
are unchanged. Installed inventory equality is unchanged. Missing runner, terminal state,
late result, command failure and unknown identity cannot grant READY. Historical failure78's
specific command and OS cause remain unknown; this does not retroactively identify them.

Brain validation: 15 helper controls and 5 integration controls on a patched copy passed on
Linux, including a real delayed child that exceeds the old preparation cap and a real timeout.
Patch application and afterimage matching passed. No Xcode/Simulator, whole source suite,
Windows baseline or complete repository qualification was run by the Brain.

Integrate only after reviewing the code: copy the helper/test, apply the patch, refresh source
pins/worklists and current workflow guards, run affected/full required validation, then perform
the authorized native experiment. Do not merge this support branch into main or open another
product PR. Keep PR48 and its append-only candidate history. The new C16 owner handoff governs
execution authority; this contribution alone authorizes no native execution or spending.

Run focused helper tests:
python -B scripts/release/full-app-j01/observer_probe16.test.py

Apply integration after inspecting the exact preimage:
git apply --check docs/brain/c47-c16/observer-preparation16.patch
git apply docs/brain/c47-c16/observer-preparation16.patch

Coordinator preimage SHA-256:
d8fc43a49ec18afe44922bf09747f596457ac227a708e39b7070fe5d17ca4212
Patched coordinator SHA-256:
39bd1fb55259dd194be62c26fc44d2328b78271d4661f8c2b28e3fdacd295f77

This is a candidate engineering change. Codex must review the Brain-authored patch independently;
reviewing our own tests is not independent acceptance. All product/privacy/owner/release gates stay closed.
