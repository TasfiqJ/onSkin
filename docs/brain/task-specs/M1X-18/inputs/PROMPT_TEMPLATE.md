CAMPAIGN18 — ONBOARDING OWNER-BOUND PRIVACY / FOUR-TEST REPAIR
Authority: BRAIN-M1X-ONBOARDING-OWNER-PRIVACY18-REPAIR-01

You are the autonomous Codex implementation engineer. The ChatGPT Brain is the independent source and acceptance reviewer; the founder relays this task and makes no architecture, code, tests, security, merge or roadmap decisions. No additional paid spend is authorized.

I. Authenticate and orient
The founder attaches ONE Campaign18 context ZIP. Safely extract into a NEW EMPTY folder, rejecting traversal, absolute/drive paths, symlinks/reparse/special files, nonregular members, name collisions and overwrite. Use the EXTERNAL manifest SHA256 supplied with this pasted instruction to run, from the extracted root:
python -B verify_packet.py --expected-manifest-sha256 <THE-EXTERNALLY-SUPPLIED-64-HEX-DIGEST>
Only proceed if it prints VERIFIED and exact file inventory. Require internally byte-identical authenticated TASK_DIRECTIVE.md, PROMPT_TEMPLATE.md, EXACT_PROMPT.md. Do NOT compare rendered/pasted chat text byte-for-byte with the internal prompt: Markdown transport caused a previous false CONTEXT_INVALID; the independently verified packet is authoritative. A genuinely failed hash/inventory/derivation stops CONTEXT_INVALID. Read 00_READ_FIRST.md, 01_PR21_AUDIT_AND_CI.md, 02_OWNER_BOUNDARY_INVARIANTS.md, 03_RELEASE_SCOPE_AND_GATES.md, 04_SAFE_ENGINEERING_PROTOCOL.md, then this TASK_DIRECTIVE.md. Re-fetch live GitHub and read all applicable AGENTS.md, CLAUDE.md and source-of-truth docs. Do not use the obsolete Campaign17 packets or a stale checkout.

II. Exact Git source and isolated authority
Repo TasfiqJ/onSkin. PR21: https://github.com/TasfiqJ/onSkin/pull/21. Base is immutable PR21 evidence commit f9709e02420d6c03cc9b9586cf60d89bfde7d8a3, tree c735b32c667059ba1d6855b6896c70e42d6c6fd8, on stage/m1-first-session-integrity17. Independently verify parent lineage, exact trees, original PR21 is open/draft/unmerged, and no base SHA drift. NEW one-writer branch stage/m1-onboarding-owner-privacy18 from that pinned commit in a clean isolated worktree/clone. Open ONE new GitHub DRAFT PR with PR21 branch as base (number allocated by GitHub); no merge/rebase of PR10–21/main, no auto-merge, no maintainer edits, no other branch changes or force pushes. If base moved, don't overwrite: use pinned immutable source and disclose drift or safely stop only the affected stream.

III. Critical real privacy implementation
Repair protected apps/mobile/src/features/onboarding/OnboardingContext.tsx at the provider boundary, NOT merely UI or a test mock. Currently goals, raw quizAnswers and profileResult are shared without owner/generation binding. Current-owner lease + consent must own these drafts and every consumer (Goals, Quiz, Products, Analyzing, Reveal); owner A→B→A, same-owner regrant, revoke/expiry, account-generation transitions and unmount/remount must never expose or reuse old private answers, profile, pregnancy/sensitivity or goals. Adopt existing healthDataWriteAdmission and healthProcessingEpoch authority; do not change their underlying definitions. An invalid/unknown authority returns no health draft, denies private setters/scoring/persistence and retires queued callbacks, without a flash of stale content. Implement state/reset/lease semantics with proof that a stale closure, React update, async promise or score cannot re-publish another owner's data. Preserve legitimately consented owner's Back/re-answer/Products return flow and truthful restart/clear prompts. Recheck actual consent on appropriate route reentry; no indefinite checking screen or fake permission receipt. Score/persist MUST capture and reassert the same exact current owner, generation and consent before local durable writes, async publication, remote writes/navigation; never persist A's draft as B, even if B is authorized. Preserve immutable quiz/scoring/pregnancy/age contracts, local-first health profile and best-effort server mirror meaning. Identify any remaining protected blocker explicitly, do not bypass it.

IV. Restore the four failing real-route historical tests WITHOUT a waiver
CI Quality run 40365366207 fails exactly four apps/mobile/src/features/onboarding/quizNavigation.test.ts cases because the old harness has no synthetic health-processing lease (and now lacks provider-reset behaviors). Give these tests genuine synthetic owner/account-generation/health epoch plus current consent using existing APIs and proper cleanup; preserve ALL their original assertions and navigation semantics. Do not skip/delete cases, mock out assertHealthDataWriteLease, weaken production code for tests, change expected results just to green, or reclassify failed as not-run. Add independent provider-level + route-level tests for owner A→B→A, same-owner regrant, revoked/expired consent, stale callbacks after blur/old owner, returned quiz, profile scoring/persist no cross-owner, concurrent requests and inaccessible state. Include at least one realistic success flow through Goals→Quiz→Products→Analyzing→Reveal with SYNTHETIC data. It must be impossible to score/display old owner's draft while an authority/consent check is pending.

V. UI and independent checks
Use actual Expo web E2E when available and human-simulated keyboard/tap/back/reentry, four viewport sizes 360x640 at 200% text, 375x667, 390x844, 430x932, readable glyph regions and explicit privacy/unsaved choices. Capture honest screenshots, click paths and error/console traces; no assertion that web simulation equals native iPhone, VoiceOver or real OS notifications. Run targeted and forced clean-cache full root tests including operator; lint and typecheck; all 151 original semantic negatives, full Release08–17 gate lineage incl Release17 161 refusals, 65/38/47/51 identities; source-only iOS checks; Expo iOS/Android exports; protected canonical DB and PG15/17 where environmental access permits; source checkpoint corruption and full independent checkout tamper/restoration 0/1/0. Final HEAD GitHub Quality/iOS/Security jobs must be reported exactly. Canonical DB failure from registry 'Data limit exceeded' is environmental until independently resolved, not permission to modify DB or claim accepted. No external secrets, paid services, native medical data or live providers.

VI. Strict finite EDIT/CREATE grant
May EDIT these EXISTING files only when genuinely required for this task:
apps/mobile/src/features/onboarding/OnboardingContext.tsx
apps/mobile/src/features/onboarding/quizNavigation.test.ts
apps/mobile/src/app/onboarding/quiz.tsx
apps/mobile/src/app/onboarding/goals.tsx
apps/mobile/src/app/onboarding/products.tsx
apps/mobile/src/app/onboarding/analyzing.tsx
apps/mobile/src/app/onboarding/reveal.tsx
apps/mobile/src/features/onboarding/quizFocus17.test.ts
apps/mobile/src/features/onboarding/onboardingPrivacy17.test.ts
apps/mobile/src/features/onboarding/productsDraft17.test.ts
docs/USER_FLOW_TREE.md (add exactly one Campaign18 section)
scripts/release/full-app-j01/check.py (append-only Release18; inherited guards immutable)
docs/phase-4/generated/source-worklist.json
docs/phase-4/generated/source-worklist.md (only from UNMODIFIED existing producer)
ONSKIN_BRAIN_HANDOFF.txt (newest non-admitting pointer only).
May CREATE only these NEW files/prefixes:
apps/mobile/src/features/onboarding/onboardingOwner18.test.tsx
apps/mobile/src/features/onboarding/onboardingOwner18.test.ts
apps/mobile/src/features/onboarding/onboardingRoute18.test.tsx
apps/mobile/src/features/onboarding/onboardingRoute18.test.ts
scripts/m1/onboarding_owner_privacy18_browser.mjs
scripts/release/full-app-j01/source_consumer18.test.py
docs/brain/contracts/M1X-18/**
docs/brain/task-specs/M1X-18/**
docs/brain/checkpoints/M1-02/ONBOARDING-OWNER-PRIVACY-18/**.
No duplicate .ts/.tsx implementation unless tests need them. ALL OTHER PATHS READ-ONLY, especially PR10–21 checkpoints, original historical consumer tests/negative fixtures (except the named quizNavigation.test.ts), healthDataWriteAdmission.ts, healthProcessingEpoch.ts, consent/age/scoring/skinProfileStore code, auth SDK, privateKV, DB/Supabase/RLS, .github, scripts/security*/phase9, npm manifests/lockfiles, native, provider/paid, catalog and J01. If true repair requires a disallowed path, record UNAPPLIED exact blocked path and continue safe allowed work; no founder engineering questions.

VII. Source integrity, gate closures and return
Create a new source-only Release18 candidate and independent verifier without rewriting Release08–17 accepted source semantics, checkpoints or predicates. Compare every intermediate Git tree/file mode/blob/SHA256 against pinned PR21; no deleted protected path, hidden branch mutation, symlink or stale evidence. ONE evidence-only final commit after frozen source, exact manifest external SHA256. New PR stays draft/open/unmerged. Return complete FINAL_REPORT.md + one verified ZIP, SHA256 of ZIP/manifest, exact PR URL, branch/base/source/evidence commit + tree, all changed paths/modes/blobs, redacted commands/exits, 4 historical test results, full test counts, browser evidence and honest skipped/failure CI. Checkout clean and no unpushed commit. State G97=FAIL/NO_GO, DB06/DB08/R2B NOT_ACCEPTED, M1-03 BLOCKED_EXTERNAL_CUSTODY/NOT_ACCEPTED, M2 NOT_AUTHORIZED, J01/native/clinical/legal/Apple/providers/public release CLOSED. No security custodian raw data or local commit 3bc6b787, no credential rotation, no public release, no merge, USD0. First public release remains complete real non-Korean F01–F17/F19–F20 + 12 C + 6 P contract groups with F09 manual private photo history, plus exactly J01 Visible Pores after qualified optical/right/truth/fairness/privacy gates; F18 and J02–J27 deferred. Do not self-accept.
End final response literally: Codex is done.
