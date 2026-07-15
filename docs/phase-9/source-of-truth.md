# Phase 9 Source Of Truth

Phase 9 turns the exact release candidate into evidence. A build is not release-ready until the release-candidate folder for that build contains the exact git SHA, native build IDs, EAS channel/runtime, Supabase project, RevenueCat project, Sentry project, PostHog project, store records, QA evidence, rollback proof, and named signoff.

Do not treat generated scripts or templates as launch evidence. Non-strict checks prove the repo has the right gates. Strict checks require live staging/production evidence and named owner approval.

## Seven-Figure Standard

At a seven-figure subscription target, trust defects become revenue defects. Phase 9 blocks launch on known gaps in account deletion, export coverage, entitlement correctness, RLS isolation, observability payload privacy, store compliance, device QA, rollback ownership, and incident response.

## Release Candidate Rule

Every evidence packet must point to one immutable source revision and one pair of native builds. Evidence from an earlier build can inform investigation, but it does not sign off a later release candidate.

Before any `PHASE9_*_PASS=true` flag or `PHASE9_SIGNED_OFF_BY` value is accepted, set `PHASE9_RELEASE_CANDIDATE_DIR` to a non-template folder under `docs/phase-9/release-candidates/`. The Git worktree must be clean, the folder must contain the full RC packet, the manifest `Git SHA` must match the commit being verified, every RC file must be customized from the template, and every `TBD` or `BLOCKED` placeholder in the RC folder must be replaced with reviewed evidence.

Generated QA packets are supporting artifacts, not launch signoff by themselves. The packet must hash the packet builder, every Phase 9 verifier script, `.env.example`, the RC template/source docs required by the smoke gate, and any selected RC folder, and its Markdown summary must show whether it was generated from a clean or dirty Git worktree so reviewers can reject stale or mixed-worktree evidence.

Generated live evidence must also be minimized. Cleanup failures are blocking errors, not warnings. Evidence may record only authored assertion text, redacted error kinds, or stable codes; it must not include raw provider/database messages, temporary test emails, synthetic order IDs, tokens, URLs, or other diagnostic payloads.

Consent-withdrawal signoff additionally requires the protected staging artifact produced by
`phase9:live-consent-withdrawal:strict`. The artifact must match the current 0054 migration,
harness, evidence-contract and copy-contract hashes; the exact checked-out Git SHA and clean
tree; the independently reviewed canonical Supabase project; a seven-day timestamp window;
and the ordered eight-check manifest with no warnings or cleanup errors. The
`PHASE9_CONSENT_WITHDRAWAL_PASS` flag is review metadata only and cannot replace that artifact.
The current 15 copy-registry tuples remain `draft_blocked`, so the live grant setup cannot
pass until a reviewed migration-owner copy transition exists; this is an intentional launch
blocker, not evidence to bypass with direct ledger writes.

The data-export registry is an executable security boundary. Its caller set must exactly match the canonical 30 owner-client tables, every service-only mutation must be rejected, and every backend read must use the verified JWT user ID with explicit output columns. Reverse-trial and subscription-event coverage satisfy that source contract. The bounded account service-row scrub also fails closed, covers all seven subscription owner fields, deletes account-only events and clicks, deletes OBF contribution payloads, preserves another live owner, and attests zero residue before Auth deletion. OBF contribution ownership is mandatory and cascades on direct Auth deletion after legacy null-owner payloads are purged.

Migrations `20260713000048` through `20260713000052` and the durable account-deletion runtime close bounded server-lifecycle gaps for barriers, ordered worker leases, encrypted provider state, no-blind-redispatch reconciliation, account-owned rate-limit cleanup, locked Storage/service-row re-attestation, at-most-once Auth deletion, durable status/receipts, RevenueCat late-write tombstones, and exact-session publication admission. Migration 0052 seals short-lived publication capabilities, drains them atomically at deletion intake, allows local erasure only after exact authority end, and gates RevenueCat completion on a five-minute settle plus two claim-distinct full-family absence rounds at least 60 seconds apart. The source contract still requires hosted Edge/mobile proof that every publication path complies and an approved provider block, enforceable mandatory-version gate, or continuing re-deletion control for old/tampered clients. RevenueCat deletion requires REST API v2 and a V2 key; V1 credentials do not work with v2. Required-mode PostHog completion requires async status evidence and two interval-separated absence observations. Apple fixed-origin exchange must bind the returned token identity to the authenticated Apple subject, and only an exact exchange followed by Apple's exact `200` no-body revoke response may report automatic revocation. Missing or failed proof records a durable manual-revocation outcome instead of false success.

DB-10 remains launch-blocked on reviewed hosted clean-reset, publication-lease and exact-session concurrency, process-death/configure-in-flight/lost-release, Cron/Vault continuity, provider interruption/lost-response, Storage residue, mobile relaunch/status, RevenueCat alias/restore/recreation, PostHog async completion, Apple native revocation, old/tampered-client control, and production monitoring evidence. Migration 0055 and the mobile/Edge source now add nonce/state plus one-use-code capture, a versioned encrypted refresh-token vault, daily validation, signed Apple event ingress, native server invalidation, deletion-vault reuse, and exact-session denial across RLS, photo Storage, authenticated Edge functions, writes, and direct authenticated helper RPCs. The source observes Expo's supported iOS revoke event and checks the authenticated Apple subject before publishing a restored session and again at foreground. Unknown states or native check failures remain behind the retryable session gate; confirmed invalid credentials are durably quarantined before local/global sign-out. The quarantine stops account activity while retaining owner-bound local-first records; only a fresh matching owner can reopen them, while a different or unprovable owner clears them before publication. Every successful daily validation atomically re-derives the current subject digest and freshly seals the token under the current vault key; dormant, deferred, or failing rows do not advance from configuration alone, and an old key cannot be retired without zero-row evidence or affected-account recapture/reauthentication. This implementation does not replace hosted primary-App-ID event registration/delivery, worker/rotation drills, stale-JWT proof, or physical-iPhone/TestFlight evidence. Migration 0054 now detaches another user's report and moderation evidence when a withdrawing owner deletes a community question, while erasing the withdrawing owner's own reports; hosted proof and a named retention/legal decision remain open. Sentry pseudonym erasure/retention, waitlist/growth purpose-linked deletion, cross-owner community-handle cleanup, and staff-principal handling still require scoped implementation or named professional decisions. The exact operational contracts are `docs/phase-9/account-deletion-operations-runbook.md` and `docs/phase-9/apple-auth-lifecycle-operations-runbook.md`; source and rehearsal completion must not be described as race-free or production readiness.

Terminal signed-event closure does not depend on Apple delivering a duplicate.
A verified terminal event may transiently exact-match one Apple Auth identity;
when the event precedes that identity, first capture submits current and retained
subject aliases and reconciles the audience-bound keyed event under the owner
lock before code dispatch. The committed result is a no-vault terminal
lifecycle, session destruction, and the durable six-step deletion graph. The
raw Apple subject is never persisted, and exact duplicate promotion remains an
opportunistic idempotency path only.

The current migration-0055 local replay gate passed two clean resets, exact
54-migration history, the full structural pgTAP suite plus 111/111 Apple
lifecycle assertions, schema lint, an empty migration shadow diff, temporary
type generation, 20/20 focused Apple event/lifecycle Edge tests, and the
47-test Apple auth work lane. This evidence is local and disposable; it does not
replace reviewed hosted, provider-delivery, stale-JWT, or physical-device proof.

## RLS Evidence Contract

The migration-derived public-schema inventory is 80 tables: 30 owner-client private tables, 10 directly service-only private tables, 17 sealed service-private lifecycle tables, and 23 authenticated catalog/editorial tables. Migration `0054` adds seven force-RLS, sealed health-consent lifecycle/copy tables; migration `0055` adds three force-RLS, sealed Apple lifecycle/capture/event tables. Every table must be classified exactly once and have RLS enabled. The hosted matrix must register all 57 private tables exactly once: the 40 directly queryable tables receive row-positive owner/cross-user, real signed-anonymous, and publishable-key-with-no-session probes, while all 17 sealed tables must deny direct access to every API role, including `service_role`. These identities and denial lanes are not interchangeable.

Negative database assertions accept only the exact expected PostgreSQL/PostgREST code, or exact empty rows for operations whose RLS semantics permit that result. Negative Storage assertions accept only typed authorization outcomes, with operation-specific not-found or empty-result allowances plus state-preserving owner/admin reads. Network failures, invalid requests or JWTs, missing buckets, and server failures must fail the harness. Cleanup must verify that synthetic database rows, Auth users, and Storage objects are gone.

The credential-free behavioral smoke and static contract prove the harness/source shape only. DB-09 and DB-10 remain live-blocked until all migrations through `20260715000055_apple_auth_lifecycle.sql` pass a reviewed hosted reset and the expanded 80-table/57-private-table matrices produce redacted, clean-revision staging and production evidence. Evidence flags cannot substitute for those runs.

## Current Non-Code Blockers

- Final brand/domain/store identity must be approved.
- Live Supabase staging and production RLS tests must be run.
- Production Apple/Google/RevenueCat/PostHog/Sentry accounts must be configured.
- Physical iPhone QA must be attached; Android is source-health work, not iOS
  launch evidence.
- App Store and Play review packets must be completed from the final metadata.
- Closed beta metrics and launch kill criteria must be evaluated.
- Legal/privacy/clinical signoff must be named.
