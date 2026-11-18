# Engineering29 actual validation index

Final clean source b29e731097984be98f5b06024d11255dbb732809 / bb63940c79e1fde4c946c8162f401baeac2b90c1. CURRENT_RUN_RECEIPTS contains39 complete command receipts with timestamps, exact argv, before/after HEAD and dirty state, exit, log size and SHA256. A receipt whose HEAD is the earlier commit and whose porcelain is nonempty is an intermediate dirty run, not a clean checkpoint. CURRENT_ORIGINAL_INVENTORY pins complete selected text and omitted binary hashes. Incomplete final files are separately listed, never repaired into receipts.

| Source checkpoint / check | Actual result | Evidence |
| --- | --- | --- |
| Final b29 root, uncached |8708 tests /584 files; mobile7996/556, professional688/21, operator24/7;3tasks/0cached PASS | current/root-tests-final2.json and .log |
| Final b29 typecheck / configured lint |4tasks/0cached each PASS; types existing no-lint placeholder | current/typecheck-final2.json/.log; current/lint-final2.json/.log |
| Final b29 queue browsers |375x667 and430x932 PASS; synthetic HTTP positives | current/professional-queue375-final2.json/.log; current/professional-queue430-final2.json/.log |
| Final b29 consumer/professional builds | FAILED ENOSPC; both receipt JSON files zero bytes | current/consumer-build-final2.log; current/professional-build-final2.log; INCOMPLETE_RECEIPTS.json |
| Final b29 owner browser375 | Failed attempt during full-disk condition; Node.js-only log, no complete receipt | current/professional-owner375-final2.log |
| Final b29 focused/mapping/outcome/owner430/optional browsers | NOT_COMPLETED / NOT_RUN; no pass claimed | Environment block in TOOLING_NOTES.md |
| Earlier clean f8 root/typecheck/lint |8708/584 and configured checks PASS | current/root-tests-final.json/.log; current/typecheck-final.json/.log; current/lint-final.json/.log |
| Earlier clean f8 consumer Expo/professional Vite builds | PASS; consumer existing Sentry/color/forced-exit warnings retained | current/consumer-build-final.json/.log; current/professional-build-final.json/.log |
| Earlier clean f8 focused privacy/recovery |532 tests/17files PASS | current/privacy-focused-final.json/.log |
| Earlier clean f8 connected template mapping |375x667/390x844/430x932 PASS; synthetic trust/key/serial ports and real local API/domain/crypto | current/mapping-browser-final.json/.log and directory |
| Earlier clean f8 connected consumer outcome |375x667/390x844/430x932 PASS; real onboarding/crypto/stores, synthetic acknowledgement faults | current/outcome-browser-final.json/.log and directory |
| Earlier clean f8 owner regressions |375x667/430x932 PASS; synthetic HTTP positives | current/professional-owner375-final.json/.log; current/professional-owner430-final.json/.log |
| Earlier clean f8 queue regressions | FAILED missing template dependency in manually compiled browser fixture; repaired in b29 without changing original assertions | current/professional-queue375-final.log; current/professional-queue430-final.log |

Real RED/GREEN: actual-outcome-red vs actual-outcome-green (false no-apply message after a committed write with lost acknowledgement); actual-navigation-ack-red vs actual-navigation-ack-green (late apply cache rollback after blur/refocus); actual-outcome-adversarial covers clear/retraction siblings and original-intent inspection; template-retirement-status-red vs template-retirement-status-green and mapping-browser-r3 vs r4 (known retired-family rejection incorrectly becoming503/unknown). Source patches retain all tests.

Other failures are explicitly test-development errors: mapping-capability-red missing new module baseline; template-mapping-integration-pre wrong owner index field import; first mapping browser invalid section selector; r2 malformed CSS quote; initial outcome browser wrong key-name probe. Final f8 corrected probe hashes the genuine content-key slot without disclosing the key; exact encrypted-map equality demonstrates observational inspection. No protected assertions, fixtures, skips or timeouts were weakened.

New tests cover exact revisions/ordered mappings/omissions, duplicate/missing/conflicting/retired choices, unshelved no-write, current/final authority/source/billing changes, exact uncertain retry, immutable received provenance, owner/navigation/cancel fences, and read-only unknown/missing/unsupported inspection. Complete root includes protected privacy/key/photo/export/withdrawal/source regressions at b29. The separate532-case focused run is pinned to f8.

Binary screenshots are omitted from the readable publication with original size/hash inventory; complete selected DOM/state/command/response text remains. Existing servers and browsers were stopped; evidence RAM process is stopped at delivery. No native/provider/security/clinical/J01/physical-device/whole-app accessibility qualification follows. Historical unchanged E28 logs are linked from the immutable handoff rather than republished.
