CAMPAIGN19 — PR22 HISTORICAL COMPATIBILITY, OWNER-PRIVACY REGRESSION & PHASE4 PROJECTION REPAIR
Authority: BRAIN-M1X-ONBOARDING-COMPATIBILITY19-REPAIR-01

You are the autonomous Codex implementation engineer. The independent ChatGPT Brain makes the source-acceptance and later ordinary main-promotion decisions. The founder ONLY transfers this ZIP, prompt and final report; do not ask for architecture, version, implementation, privacy, test or Git decisions. No spending authorized.

I. Authenticate + read current source
The founder attached ONE NEW Campaign19 context ZIP. Safely extract into a NEW EMPTY folder. Reject zip-slip, absolute/parent path, symlinks/reparse/special/nonregular members, duplicate Unicode/case-insensitive names and overwrites. Use the separately supplied EXTERNAL manifest SHA256 (never just a digest from inside the ZIP) to run from extracted root:
python -B verify_packet.py --expected-manifest-sha256 <EXTERNAL_SHA256_FROM_BRAIN>
Require VERIFIED and exact inventory, prompt-triad byte equality. If it fails STOP CONTEXT_INVALID. Do not compare chat-rendered text byte-for-byte with the internal prompt; the verified TASK_DIRECTIVE.md is authoritative. Read packet files 00 through 04, then TASK_DIRECTIVE.md. Independently re-fetch live GitHub PR22 / exact branch and Git commits, plus applicable AGENTS.md, CLAUDE.md, source-of-truth release and human-simulated E2E docs. Packet observations are dated, GitHub truth governs.

II. Immutable base, new draft and explicit autonomy
Repo TasfiqJ/onSkin; immutable PR22 https://github.com/TasfiqJ/onSkin/pull/22. Source pin is final evidence HEAD 149d18f3ae3c49f966a9e2b1a679901d1d15b3b6, tree 061b8e8565f21e871fb1d57bed1316cc1a76e5d6, branch stage/m1-onboarding-owner-privacy18; PR22 based on PR21 f9709e02420d6c03cc9b9586cf60d89bfde7d8a3. Verify SHA, tree, parents, status and no unexpected changed ref. Make ONE NEW isolated one-writer branch `stage/m1-onboarding-compatibility19` exactly from pinned PR22 commit and open ONE NEW DRAFT PR whose base is PR22 branch. GitHub chooses the PR number; never predict it. NEVER modify/rebase/merge/force-push PR22, PR21, PR10-20, main, or other workers' branches. Keep auto-merge and maintainer edits OFF. If live PR22 SHA drifted, do not silently substitute; use the pinned immutable commit and report drift, or safely stop only unsafe parts. Work through safe obstacles and perform substantive independent engineering without founder technical questions.

III. Repair ALL 21 historically meaningful failing tests; do not trade privacy for green
GitHub at final PR22 HEAD reports exactly 21 failed tests in six suites: productsFooter16 (10), quizNavigation16 (3), onboardingRoutes (3), coreJourney.campaign06 (2), OnboardingContext (2), healthLifecycleRoutes (1). See authenticated 02_EXACT_21_FAILURES.md for precise paths and original meaning. FIRST independently reproduce; map each failure to a missing current lease/consent test facade, genuinely broken user behavior, or obsolete exact string-shaped assertion. Then resolve completely. In tests requiring the shared provider, prefer real synthetic runAccountGenerationOperation + setActiveHealthProcessingEpoch + current-consent fixture with cleanup and true assert/capture lease, not generic `isCurrent: () => true` or bypassing owner validation. If only a unit facade makes architectural sense, make it correctly fail closed and *test denial/regrant* with the real semantics. Preserve all original test names/count and behavioral expectations, including 0/1/2/3/20 Shelf states, remover double-tap/write failure, quiz Next/Back and consent, direct missing goals, health lifecycle no pre-consent private I/O, and local-save failure/pending/success raw answer rules. For shape-coupled source tests, replace now-invalid syntax predicates with stronger AST/behavior invariants and explicit negative mutation showing the same protection still catches a regression; never delete/skip/xfail an original failure. Add targeted tests as needed for owner A->B->A, same-owner regrant, expired/withdrawn authority, React re-render/old handler, async save race, and no stale pregnancy/sensitivity/profile leak. If production code genuinely fails these, repair only within finite grant and disclose exact hazard; do NOT weaken code to fit historical fixtures.

IV. Repair stale Phase4 worklist as an actual final-HEAD deterministic source artifact
Existing Quality job 40391231995 exit1 at `npm run phase4:source-worklist:check`: BOTH docs/phase-4/generated/source-worklist.json and .md are stale. Do NOT blindly paste an UNAPPLIED local patch. Run original, UNMODIFIED `scripts/phase4/build-source-worklist.mjs` on the newly committed clean frozen Campaign19 source; verify it against original producer, source index and HEAD; do not generate from dirty staged/working status. After checked projection commits and final EVIDENCE tail, independently re-run `npm run phase4:source-worklist:check` at exact clean final HEAD and in a fresh separate full checkout. Its success must be reported with exit 0 and Git mode/blob evidence. If strict final check cannot pass without forbidden generator changes, do not lie or loosen the check: disclose blocker and keep candidate blocked.

V. End-to-end safety & comprehensive validation
Re-test provider/privacy state and retained profile end-to-end using synthetic person and a real Expo web build. Goals->Quiz->Products->Analyzing->Reveal, failed save and retry, owner switch while save pending, withdrawn consent/reentry, Products draft with keyboard and duplicate removal. Use 360x640 with 200% text and keyboard pressure plus 375x667, 390x844, 430x932; inspect visible actual glyphs/action regions and capture screenshots/traces/console failures truthfully. No real account/patient/photo/secret, no production provider. Run all focused tests, exact historical six suites and four previously repaired tests, full forced root mobile+operator tests with zero cache acceptance, lint/typecheck, all 151 original semantic negatives, Release08-19 additive non-admitting source guard with all Release18 175 negatives, Release08 65/38 and 47/51 identities, independent Git blob/mode/path tree inventory vs PR22, full-checkout 0/1/0 tamper restoration and artifact verification. Run source-only iOS and Expo iOS/Android exports, canonical credential-free DB and PostgreSQL 15/17 where available; verify exact final-head GitHub Quality/iOS/Security/DB/PG/Expo jobs. Never rebrand web/export success as physical iPhone, VoiceOver or Apple clearance. No waivers/skipped failures, preserve honest NOT_RUN/environmental statuses.

VI. Finite edit/create authority (everything else READ ONLY)
MAY EDIT EXISTING exactly these runtime paths ONLY when a concrete failing semantic check/reproduction justifies it:
- apps/mobile/src/features/onboarding/OnboardingContext.tsx
- apps/mobile/src/app/onboarding/goals.tsx
- apps/mobile/src/app/onboarding/quiz.tsx
- apps/mobile/src/app/onboarding/products.tsx
- apps/mobile/src/app/onboarding/analyzing.tsx
- apps/mobile/src/app/onboarding/reveal.tsx
MAY EDIT EXISTING these SIX failing historical test files as needed to modernize REAL semantics, preserving negative protections:
- apps/mobile/src/features/onboarding/productsFooter16.test.ts
- apps/mobile/src/features/onboarding/quizNavigation16.test.ts
- apps/mobile/src/features/onboarding/onboardingRoutes.test.ts
- apps/mobile/src/features/shelf/coreJourney.campaign06.test.ts
- apps/mobile/src/features/onboarding/OnboardingContext.test.ts
- apps/mobile/src/features/healthConsent/healthLifecycleRoutes.test.ts
MAY EDIT EXISTING these recent tests ONLY to add explicit regressions:
- apps/mobile/src/features/onboarding/onboardingOwner18.test.ts
- apps/mobile/src/features/onboarding/onboardingRoute18.test.ts
- apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts
- apps/mobile/src/features/onboarding/quizFocus17.test.ts
- apps/mobile/src/features/onboarding/productsDraft17.test.ts
MAY EDIT EXISTING support/projections:
- docs/USER_FLOW_TREE.md (additive Campaign19 section only)
- scripts/release/full-app-j01/check.py (APPEND Release19 successor, inherited Release08-18 guards byte/AST semantically immutable)
- docs/phase-4/generated/source-worklist.json and docs/phase-4/generated/source-worklist.md (only outputs of original unchanged generator)
- ONSKIN_BRAIN_HANDOFF.txt (factual newest pointer, no positive gate claim)
MAY CREATE ONLY:
- apps/mobile/src/features/onboarding/onboardingCompatibility19.test.ts
- apps/mobile/src/features/onboarding/onboardingConsent19.test.ts
- scripts/m1/onboarding_compatibility19_browser.mjs
- scripts/release/full-app-j01/source_consumer19.test.py
- docs/brain/contracts/M1X-19/**
- docs/brain/task-specs/M1X-19/**
- docs/brain/checkpoints/M1-02/ONBOARDING-COMPATIBILITY-19/**
Everything not listed is READ-ONLY: original age/consent/scoring/private KV/skinProfileStore and health lease/auth definitions, Shelf store, native app, DB/Supabase/RLS, dependencies, .github, original Security scanner/G97/PR10, phase4 producer, prior PR10-22 checkpoints and source guards, receipt matrices, old protected negative cases, payments/provider/J01. If real repair needs a forbidden file, stop ONLY that unsafe stream, state exact UNAPPLIED path and proceed safely elsewhere. DO NOT access confidential Security or import local commit 3bc6b787; no credential/data/paid account changes.

VII. Evidence, release gates & honest final handoff
Deliver source commits followed by exactly ONE compact evidence-only final commit with new independently authenticatable checkpoint: exact external manifest SHA256, source/evidence SHA+trees, finite path/mode/blob/SHA256 inventories every intermediate commit, commands/exits, screenshots/traces, original six suite results, 151 negatives, full test counts and CI jobs including any failures/skips, real full checkout 0/1/0 and artifact tamper. Produce ONE return ZIP and complete FINAL_REPORT.md plus ZIP and return manifest SHA256. Report Git branch/PR URLs, checkout clean/no unpushed work, PR22/main frozen, USD0, no merges and no positive acceptance. G97 FAIL/NO_GO, original qualified Security outstanding, DB06/DB08/R2B NOT_ACCEPTED, M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED, M2 NOT_AUTHORIZED, J01/native/device/clinical/legal/Apple/provider/public release CLOSED regardless of local DB CI. First public release remains complete genuinely working non-Korean F01-F17/F19-F20 + all 12 C and 6 P contract groups, required F09 private manual photo history, PLUS exactly J01 Visible Pores after qualified G1/G2/G3/G5 (G4 for change). F18 and J02-J27 including J05 deferred. No release date/spend promise. End the final answer literally: Codex is done.
