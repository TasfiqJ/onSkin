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


C16 LOCAL SOURCE CHECKPOINT / PARTIAL_BLOCKED / PUSH_BLOCKED / NO_GO. No native starts79-86 were allocated. The actual Windows sandbox refuses the required dependency symlink (normal npm ci EPERM -4048); supported npm --install-links refuses the unchanged lockfile (EUSAGE missing packed decode-uri-component0.5.1), so neither install passed and dependencies/lock were not changed. Normal git push dry-run cannot launch the configured shell credential helper; a native invocation of the existing credential helper independently returns Failed to enumerate credentials [0x5] Access is denied. No GITHUB_TOKEN/GH_TOKEN is present. No account, credential, provider, signing or billing change was made. The available connector exposes per-file contents commits, not atomic publication of this reviewed source tree; it was not used to publish transient inconsistent code or trigger jobs. Current-source and zero-paid capacity qualifications cannot be completed here.
Brain contribution disposition: revised partial integration, not acceptance. Original15 helper controls PASS; a real-process output-overflow RED is retained. Bounded capture now terminates/reaps the overflowing child, retains actual bounded failure streams/operation/timing/hash/errno with explicit truncation, and refuses concurrent/terminal/late probes. All21 helper controls and3 coordinator integrations PASS on Windows Python3.9. Existing101 observer test names remain;3 current methods were adapted for prospective77-path scope, the same subprocess transport fixture and an anchored immutable78 workflow witness. Add3 prospective coordinator controls,104groups total; complete104 suite NOT_QUALIFIED. No original inventory/permission/active3/5/30 assertion was removed. A fixture-path correction replaces an unwritable drive-root temporary path with the existing user temp directory; real hardlink publication still fails honestly with WinError5. It was not mocked away or converted to PASS.
Development outcomes remain distinct: initial observer invocation interrupted without complete result; bounded101 invocation TIMED_OUT at120seconds with existing dependency/fixture failures; focused custody20 first has26errors from AppContainer MAX_PATH, then20/0failures/15errors after a shorter owned temp path, now exposing actual hardlink denial. Runtime157 executed with156PASS/1ERROR (WinError206 from redirected TEMP); signing15 and properties passed. Forced uncached root four-worker, typecheck, lint, install-hook, full30, workflow19/current-source and dependency-graph invocations failed setup with missing dependencies;7122 baseline was NOT_EXECUTED, never a zero-case PASS. Raw outputs retained outside source. No current-source equivalence or historical C15 pass erases these failures.
No app source or consent/owner/age/encryption/withdrawal/deletion/recovery policy changed. Source review traced explicit grant through authoritative lifecycle/activation routing and exact-window onboarding revalidation; it has not proved native67 causality or a new production defect. Native77 inventory mismatch and78 discovery cause remain unknown. Diagnostic79, clean build, ordinary3, internal5/export/removal are NOT_RUN. No current CI/native execution validates this local source. The native workflow is explicitly false until complete source and fresh capacity qualification; prospective183 guard is not an execution grant. Current source pins/scope are updated, but final SOURCE_FROZEN/worklist seal is not claimed while setup is blocked. All181 remote ancestors and frozen plan remain exact. Same draft/open/unmerged PR48; remote still181, auto-merge/maintainer edits OFF. Preserve this local append-only material and return it for independent Brain review; all38 requirements/18 owner gates remain unaccepted.


C16 RESUMED on updated CLI0.169.0. Verified clean local182 0626b82741163e901115c8c4c9377b3522ec217b/tree6a6fee6b87296331f5617e44b4cc6b80e55a4997 and published18151769a8f preserved. Actual active session danger-full-access/approval never differs from saved workspace-write/on-request; ordinary OS symlinks refuse1314, real hardlink/atomic replacement pass. No escalation mechanism is available and no security/privilege/configuration setting was changed. Normal exact-lock npm11.20.0 ci now PASSES including install hooks, unchanged package/lock hashes, and normal existing authenticated push dry-run passes. These current results supersede only those earlier blocked capabilities; historical failures remain retained.
Independently reviewed Brain d872dadfdee77340794afadf2a7907e2c313b160. Its readiness handshake starts the collection deadline only after the actual owned child emits partial stdout (with0.6s intentional startup delay); real collection/timeout/kill/reap remain unchanged. Added separate empty-prefix timeout/reaping coverage. Original21 helper controls and disposable corrected22 each pass. Integrate only this reviewed fixture; revised production helper59b6fd6c643e533bef6935c4fb6379d490b2d0a9b3e1c8ec1f129a14aa338cba remains exact. Existing prospective one-shot diagnostic count is184 for material183 then seal184; workflow remains explicitly false pending full exact-source validation and renewed capacity. No native allocation, ordinary/internal admission, source-frozen claim or acceptance at this preparation checkpoint. All104 existing observer groups and active3/5/30/inventory/security/privacy/owner assertions remain. Release NO_GO.
