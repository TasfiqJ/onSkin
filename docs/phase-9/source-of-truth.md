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

The data-export registry is an executable security boundary. Its caller set must exactly match the canonical 30 owner-client tables, every service-only mutation must be rejected, and every backend read must use the verified JWT user ID with explicit output columns. Reverse-trial and subscription-event coverage now satisfy that source contract. DB-10 remains source-open because account deletion must still fail closed and scrub scalar plus alias/transfer service identities without damaging another account's retained record.

## RLS Evidence Contract

The migration-derived public-schema inventory is 63 tables: 30 owner-client private tables, 10 service-only private tables, and 23 authenticated catalog/editorial tables. Every table must be classified exactly once and have RLS enabled. Every one of the 40 private tables must be probed for cross-user access, a real signed-anonymous session, and a publishable-key client with no session; these identities are not interchangeable.

Negative database assertions accept only the exact expected PostgreSQL/PostgREST code, or exact empty rows for operations whose RLS semantics permit that result. Negative Storage assertions accept only typed authorization outcomes, with operation-specific not-found or empty-result allowances plus state-preserving owner/admin reads. Network failures, invalid requests or JWTs, missing buckets, and server failures must fail the harness. Cleanup must verify that synthetic database rows, Auth users, and Storage objects are gone.

The credential-free behavioral smoke and static contract prove the harness/source shape only. DB-09 remains live-blocked until all migrations, including `20260713000045_anonymous_photo_storage_guard.sql`, pass a reviewed reset and the full matrix produces redacted, clean-revision staging and production evidence. Evidence flags cannot substitute for those runs.

## Current Non-Code Blockers

- Final brand/domain/store identity must be approved.
- Live Supabase staging and production RLS tests must be run.
- Production Apple/Google/RevenueCat/PostHog/Sentry accounts must be configured.
- Physical iOS and Android QA must be attached.
- App Store and Play review packets must be completed from the final metadata.
- Closed beta metrics and launch kill criteria must be evaluated.
- Legal/privacy/clinical signoff must be named.
