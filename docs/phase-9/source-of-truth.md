# Phase 9 Source Of Truth

Phase 9 turns the exact release candidate into evidence. A build is not release-ready until the release-candidate folder for that build contains the exact git SHA, native build IDs, EAS channel/runtime, Supabase project, RevenueCat project, Sentry project, PostHog project, store records, QA evidence, rollback proof, and named signoff.

Do not treat generated scripts or templates as launch evidence. Non-strict checks prove the repo has the right gates. Strict checks require live staging/production evidence and named owner approval.

## Seven-Figure Standard

At a seven-figure subscription target, trust defects become revenue defects. Phase 9 blocks launch on known gaps in account deletion, export coverage, entitlement correctness, RLS isolation, observability payload privacy, store compliance, device QA, rollback ownership, and incident response.

## Release Candidate Rule

Every evidence packet must point to one immutable source revision and one pair of native builds. Evidence from an earlier build can inform investigation, but it does not sign off a later release candidate.

Before any `PHASE9_*_PASS=true` flag or `PHASE9_SIGNED_OFF_BY` value is accepted, set `PHASE9_RELEASE_CANDIDATE_DIR` to a non-template folder under `docs/phase-9/release-candidates/`. The Git worktree must be clean, the folder must contain the full RC packet, the manifest `Git SHA` must match the commit being verified, every RC file must be customized from the template, and every `TBD` or `BLOCKED` placeholder in the RC folder must be replaced with reviewed evidence.

Generated QA packets are supporting artifacts, not launch signoff by themselves. The packet must hash the packet builder, every Phase 9 verifier script, `.env.example`, the RC template/source docs required by the smoke gate, and any selected RC folder, and its Markdown summary must show whether it was generated from a clean or dirty Git worktree so reviewers can reject stale or mixed-worktree evidence.

Generated live evidence must also be minimized. Cleanup warnings may record only redacted error kinds or stable codes; they must not include raw provider/database messages, temporary test emails, synthetic order IDs, tokens, URLs, or other diagnostic payloads.

## Current Non-Code Blockers

- Final brand/domain/store identity must be approved.
- Live Supabase staging and production RLS tests must be run.
- Production Apple/Google/RevenueCat/PostHog/Sentry accounts must be configured.
- Physical iOS and Android QA must be attached.
- App Store and Play review packets must be completed from the final metadata.
- Closed beta metrics and launch kill criteria must be evaluated.
- Legal/privacy/clinical signoff must be named.
