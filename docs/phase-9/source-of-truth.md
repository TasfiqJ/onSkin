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

The data-export registry is an executable security boundary. Its caller set must exactly match the canonical 30 owner-client tables, every service-only mutation must be rejected, and every backend read must use the verified JWT user ID with explicit output columns. Reverse-trial and subscription-event coverage satisfy that source contract. The bounded account service-row scrub also fails closed, covers all seven subscription owner fields, deletes account-only events and clicks, deletes OBF contribution payloads, preserves another live owner, and attests zero residue before Auth deletion. OBF contribution ownership is mandatory and cascades on direct Auth deletion after legacy null-owner payloads are purged.

Migrations `20260713000048` through `20260713000052` and the durable account-deletion runtime close bounded server-lifecycle gaps for barriers, ordered worker leases, encrypted provider state, no-blind-redispatch reconciliation, account-owned rate-limit cleanup, locked Storage/service-row re-attestation, at-most-once Auth deletion, durable status/receipts, RevenueCat late-write tombstones, and exact-session publication admission. Migration 0052 seals short-lived publication capabilities, drains them atomically at deletion intake, allows local erasure only after exact authority end, and gates RevenueCat completion on a five-minute settle plus two claim-distinct full-family absence rounds at least 60 seconds apart. The source contract still requires hosted Edge/mobile proof that every publication path complies and an approved provider block, enforceable mandatory-version gate, or continuing re-deletion control for old/tampered clients. RevenueCat deletion requires REST API v2 and a V2 key; V1 credentials do not work with v2. Required-mode PostHog completion requires async status evidence and two interval-separated absence observations. Apple fixed-origin exchange must bind the returned token identity to the authenticated Apple subject, and only an exact exchange followed by Apple's exact `200` no-body revoke response may report automatic revocation. Missing or failed proof records a durable manual-revocation outcome instead of false success.

DB-10 remains launch-blocked on reviewed hosted clean-reset, publication-lease and exact-session concurrency, process-death/configure-in-flight/lost-release, Cron/Vault continuity, provider interruption/lost-response, Storage residue, mobile relaunch/status, RevenueCat alias/restore/recreation, PostHog async completion, Apple native revocation, old/tampered-client control, and production monitoring evidence. The mobile source now observes Expo's supported iOS revoke event and checks the authenticated Apple subject before publishing a restored session and again at foreground. Unknown states or native check failures remain behind the retryable session gate; confirmed invalid credentials are durably quarantined before local/global sign-out. The quarantine stops account activity while retaining owner-bound local-first records; only a fresh matching owner can reopen them, while a different or unprovable owner clears them before publication. This source implementation does not replace physical-iPhone/TestFlight evidence, and Apple's server-to-server `consent-revoked` endpoint and delivery evidence remain external gates wherever that path is selected or required. Sentry pseudonym erasure/retention, waitlist/growth purpose-linked deletion, cross-owner community-handle cleanup, shared moderation/report retention, and staff-principal handling still require scoped implementation or named professional decisions. The exact operational contract is `docs/phase-9/account-deletion-operations-runbook.md`; source and rehearsal completion must not be described as race-free or production readiness.

## RLS Evidence Contract

The migration-derived public-schema inventory is 70 tables: 30 owner-client private tables, 17 service-only private tables, and 23 authenticated catalog/editorial tables. Migrations `0048`, `0051`, and `0052` add seven force-RLS, service-only lifecycle/tombstone/publication tables. Every table must be classified exactly once and have RLS enabled. Every one of the 47 private tables must be probed for cross-user access, a real signed-anonymous session, and a publishable-key client with no session; these identities are not interchangeable.

Negative database assertions accept only the exact expected PostgreSQL/PostgREST code, or exact empty rows for operations whose RLS semantics permit that result. Negative Storage assertions accept only typed authorization outcomes, with operation-specific not-found or empty-result allowances plus state-preserving owner/admin reads. Network failures, invalid requests or JWTs, missing buckets, and server failures must fail the harness. Cleanup must verify that synthetic database rows, Auth users, and Storage objects are gone.

The credential-free behavioral smoke and static contract prove the harness/source shape only. DB-09 and DB-10 remain live-blocked until all migrations through `20260713000052_account_publication_fence.sql` pass a reviewed reset and the expanded 70-table/47-private-table matrices produce redacted, clean-revision staging and production evidence. Evidence flags cannot substitute for those runs.

## Current Non-Code Blockers

- Final brand/domain/store identity must be approved.
- Live Supabase staging and production RLS tests must be run.
- Production Apple/Google/RevenueCat/PostHog/Sentry accounts must be configured.
- Physical iOS and Android QA must be attached.
- App Store and Play review packets must be completed from the final metadata.
- Closed beta metrics and launch kill criteria must be evaluated.
- Legal/privacy/clinical signoff must be named.
