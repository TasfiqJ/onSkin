# Campaign26 immutable finite implementation plan

Authority: `BRAIN-M1X-FIRST-VALUE-RECOVERY26-REPAIR-01`, directly issued by the user on 2026-10-29. This is a source implementation plan and confers no acceptance. Context ZIP independently preflighted, safely extracted into a new empty directory, externally anchored, then verified by the exact external command: exit 0 / VERIFIED, 14 members, identical directive triad. External manifest SHA256: `9d87a26cb84ed81c5f0deb950a919ae0899c1f8805ebea7e386eace05a7db112`.

Pinned parent: open/draft/unmerged PR29 `52a3d01ebb36a6845d0ac21935ad35520732633f`, tree `ef49a81ca814f3d82b8a868e0308b6dda09c9cca`, branch `stage/m1-real-first-value25`. Immutable PR28 `d0ccef65bcbe0c90483e6c0f691ed95f92228c6c`, tree `22f91455d651a81296ab8724f9db7cfead65af08`. Live GitHub metadata and a fresh complete remote clone independently agree. This plan is the only path in the only first-child commit. One source integration writer applies bounded worker patches; workers use separate checkouts and cannot update the integration branch.

## Chosen repairs and first observations

1. R26-01: manual entry retains component-local fields; ShelfLayout currently preserves only `opened`, so a private Shelf query error unmounts `manual`. Continue resets intake and navigates without a synchronous current Query/health lease/session fence. Use the existing same-generation hidden mounted boundary for manual, keep the current query authoritative, and add synchronous opaque draft identity/revision checks in IntakeContext without changing original session semantics. Guard every manual input, picker, category, Continue and Cancel callback, mounted lifetime and duplicate continuation. Retire old content on owner/grant/session replacement. No new persistence, authority, provider response or private-core change. The optional boundary edit is limited to necessary focus/keyboard retirement or readiness correctness discovered by tests.
2. R26-02: local ProductDetailActionSheet fixes header/body outside its unbounded ScrollView; large text can exhaust its viewport. Put overflowing content in a bounded shrinkable scroll region, preserve a reachable close/cancel affordance, account for safe area and keyboard, and bind destructive confirmation to the exact mounted current owner/source lease. No backdrop/cancel/stale callback may delete a product. Preserve the app's design language and existing lifecycle semantics.
3. R26-03: independently inspected actual candidate run `40824550384`, Ubuntu `123284459157`, Windows `123284459457`; both authentic exact-PR29 checkouts fail the unchanged Release24 consumer at `inherited-full-prefix-exact / R24_FUNCTION_SCOPE`. Independently replayed the original consumer locally at exact PR29 before changes: exit 1 with the same failure. Route unchanged original24 to authentic pinned PR28 and original25 to authentic pinned PR29 using fresh complete isolated clean sources, authenticated scripts/tools, explicit receipts and fail-closed refusal controls; run new26 against exact current head. Keep the separate actual public readiness failure (`candidateReady=false`) and qualified custody requirements.

Application before-tests will run against exact PR29 before modifying their relevant source. Replay original C25 three-manual failure assertions byte-for-byte in a disposable test harness, preserving actual failure outputs and the first failed guard. Reproduce the actual detail sheet on Expo web at 360x640 with measured 200% glyphs before editing geometry. Add real mounted Query/Intake/private Shelf/account-health controls; external/native render and hardware boundaries alone may be controlled. Recorded C25 browser evidence is supplier evidence until independently reproduced.

## Exact machine-readable finite grant

Selected existing application paths: 5 of 9 permitted. New application test/helper paths: 3 of 12 permitted. Existing tests, intakeSession, useShelf, mutations and firstValue25TestPorts remain unchanged. Permission is limited to the three repairs above; an unused selected path need not change.

```json
{
  "schema": 1,
  "authority": "BRAIN-M1X-FIRST-VALUE-RECOVERY26-REPAIR-01",
  "baseHead": "52a3d01ebb36a6845d0ac21935ad35520732633f",
  "baseTree": "ef49a81ca814f3d82b8a868e0308b6dda09c9cca",
  "existingAppPaths": [
    "apps/mobile/src/app/shelf/manual.tsx",
    "apps/mobile/src/app/shelf/[id].tsx",
    "apps/mobile/src/app/shelf/_layout.tsx",
    "apps/mobile/src/features/shelf/ShelfDataAvailabilityGate.tsx",
    "apps/mobile/src/features/shelf/IntakeContext.tsx"
  ],
  "newAppTestHelperPaths": [
    "apps/mobile/src/features/shelf/manualDraftRecovery.campaign26.test.ts",
    "apps/mobile/src/features/shelf/detailActionSheet.campaign26.test.ts",
    "apps/mobile/src/features/shelf/firstValue26TestPorts.ts"
  ],
  "otherExistingPaths": [
    ".github/workflows/security-candidate22.yml",
    "scripts/release/full-app-j01/check.py",
    "docs/USER_FLOW_TREE.md",
    "docs/phase-4/generated/source-worklist.json",
    "docs/phase-4/generated/source-worklist.md",
    "ONSKIN_BRAIN_HANDOFF.txt"
  ],
  "otherNewPaths": [
    "docs/brain/task-specs/M1X-26/SCOPE_PLAN.md",
    "docs/brain/task-specs/M1X-26/TASK.md",
    "docs/brain/contracts/M1X-26/source26.v1.json",
    "scripts/release/full-app-j01/source_consumer26.test.py",
    "docs/brain/checkpoints/M1-02/FIRST-VALUE-RECOVERY-26/README.md",
    "docs/brain/checkpoints/M1-02/FIRST-VALUE-RECOVERY-26/REPORT.md",
    "docs/brain/checkpoints/M1-02/FIRST-VALUE-RECOVERY-26/manifest.json",
    "docs/brain/checkpoints/M1-02/FIRST-VALUE-RECOVERY-26/payload.zip",
    "docs/brain/checkpoints/M1-02/FIRST-VALUE-RECOVERY-26/verify26.py"
  ]
}
```

Observed parent blobs, all mode 100644: manual `34b56cc5206b55d57f92ef7cd438420b965caf2a`; detail `346c05cb4977fff9f8af4fdc468b6c3fa4d26e0a`; layout `d2759eda605bb47f4326561b4eaca22cb38c04e4`; availability `89919c71e5506c686cbd73134c8262695bb53974`; IntakeContext `6e67fb727aaaecfc1d565dd929d5310d494d5f79`; candidate workflow `8efdbd6d83685f432c92de1fb392a7510ae9b50b`; checker `cc5ea944b02c76c19181aefca44007ad941af486`. The source/checkpoint verifier must independently bind every per-commit/tree/blob/mode identity, not trust this descriptive list alone.

## Threat model and verification

Challenge A-to-B-to-A, same-owner regrant, withdrawal/expiry, retired health epochs, replacement drafts, synchronous queued callbacks before rerender, invalidated/replaced Query, offline error/refetch, first entry, duplicate Continue and rapid navigation. Hidden drafts must be invisible/inert and absent from accessibility/focus; genuine same-authority recovery preserves all exact typed fields and picker state. Exercise actual encrypted store/mutation and canonical readback without fabrication.

Challenge destructive callbacks before confirmation, after Close/backdrop/unmount, after owner/grant/source change and duplicate presses; no product removal from cancellation. Measure 360x640 at actual doubled glyphs and 375x667, 390x844, 430x932 with long text, scrolling, keyboard, safe areas, roles/focus, no horizontal overflow. Actual Expo web UI and mounted tests remain distinct from synthetic geometry and from NOT_RUN installed iPhone/VoiceOver/native signing.

Run old Campaign25 24 cases, original photo layout15/focused97, forced mobile baseline6317 plus additive26, operator24, typecheck/lint, normal npm ci and mandatory postinstall, relevant unchanged launch/native/privacy source contracts, original151 negatives, original historical09-25 consumers at authentic immutable sources, new26 positive/negative/malformed/swapped/missing/stale/wrong-checkout/hidden-index/refuted/raw-corruption controls. Diagnose unchanged legacy core05 77PASS/1FAIL read-only on PR29 and authentic PR28; canonical CORE-05 SQL proof is a separate axis. Run canonical credential-free database and PG15/17 where genuinely available, both clear-cache unsigned Expo exports and unchanged strict Phase4; preserve real failures and NOT_RUN.

Append Release26 source-only governance; preserve every inherited Release08-25 definition, historical assertion and negative fixture. Verify finite per-commit and cumulative scope, immutable first-child plan, full Git/object/ref identities and aliases, raw tracked blobs plus hidden staged/index/untracked state, protected-source byte equality, false acceptance controls and exact freeze shape. From a clean committed substantive source, run the unchanged Phase4 producer once and commit exactly one worklist-only child. Add exactly one five-file checkpoint plus handoff evidence-only tail. No source edits after freeze. Final CI is collected externally after the tail, with no circular final hashes or second tail.

Two independent fresh complete final remote clones with separate Git objects must each pass full source/checkpoint and unchanged strict Phase4. Actually mutate/refuse/restore protected source and corrupt/refuse/restore artifact: 0/1/0 with exact restoration and clean final state. Return one safe exact-inventory downloadable ZIP, externally anchored manifest/verifier, independently downloaded/hash-checked actual bytes, a minimal Git bundle requiring PR29, complete identities and honest before/after/CI/browser records. Final categorization is FIXED_AND_PROVED / IMPLEMENTED_NOT_EXECUTED / OPEN_REQUIRED / BLOCKED_EXTERNAL_CUSTODY / NOT_RUN, as supported.

Protected consent/privateKV/auth/security/photo/DB/Phase2/subscription/Apple/provider/native/clinical/J01 and original Security workflow remain unchanged. Out-of-grant repairs are UNAPPLIED proposals. G97 FAIL/NO_GO; DB06/DB08/R2B NOT_ACCEPTED; M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED; M2 NOT_AUTHORIZED; J01 qualification and all native/VoiceOver/provider/paid/professional/clinical/legal/licensing/Apple/public release gates CLOSED. Full scope remains genuine F01-F17/F19-F20, C01-C12, P01-P06, private manual F09 and exactly independently qualified J01 Visible Pores; F18 and J02-J27 including J05 deferred. USD0. NO MERGES. SUBMITTED_REVIEW_REQUIRED / NO_GO. Brain alone retains later source acceptance.
