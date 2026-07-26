# Phase 3 Review Packet Index

Status: packet and detached-signoff gate implemented; professional signoff missing
Last updated: 2026-07-09

This index tells reviewers what to inspect. The generated manifest from
`npm run phase3:review-packet` records hashes, file sizes, source Git SHA, and
Git worktree status for auditability. Final reviewer signoff evidence must use
a generated packet that shows `Git status: clean`; treat `Git status: DIRTY` as
investigation evidence only.

`npm run phase3:review-worklist` generates a machine-readable reviewer worklist
from the legal/regulatory, clinical, cosmetic chemistry, privacy/security, and
IP/FTO review logs. It is an operator handoff only: it keeps launch gates
blocked until named reviewers sign off against the exact source hashes.

`npm run phase3:review-operator-queue` converts that worklist into a ranked
operator queue for founder, counsel, clinical, chemistry, privacy/security, and
IP/FTO handoffs. The queue records what can be sent to reviewers and what stays
blocked in `docs/FOR_TAS_TO_DO.md`; it never supplies reviewer names or
decisions.

`npm run phase3:review-signoff-template -- --list` exposes the exact item IDs,
snapshot digests, states, and safe output filenames. Item mode prefills only the
immutable item ID, digest, and operator-selected draft disposition. It leaves
attestor identity, credential or role, date, conditions, evidence reference,
and any deferred production gate as rejected placeholders. It refuses dirty or
stale source, duplicate evidence, overwrites, and output outside the direct
signoff directory.

Every `Approved` or `Deferred` worklist row must also have exactly one JSON
record under `docs/phase-3/signoffs/`. The signoff references a deterministic
`reviewSnapshotSha256` calculated from the item identity, required reviewer,
review context, and exact source path/byte/SHA-256 records. This avoids a
circular packet-signing contract while invalidating the signoff whenever its
reviewed context or source changes.

The machine gate checks completeness, consistency, freshness, and file
integrity. It cannot authenticate a person or establish professional
qualification. Tas must verify the reviewer or decision owner and retain the
original signed evidence outside git; the JSON stores only a non-secret
reference.

## Packet Contract

- `package.json`
- `scripts/phase3/build-review-packet.mjs`
- `scripts/phase3/build-review-worklist.mjs`
- `scripts/phase3/build-review-operator-queue.mjs`
- `scripts/phase3/create-review-signoff-template.mjs`
- `scripts/phase3/review-signoff-template-smoke.mjs`
- `scripts/phase3/audit-copy.mjs`
- `scripts/phase3/check-production-release.mjs`
- `scripts/phase3/check-production-release-smoke.mjs`
- `apps/mobile/phase3-review-evidence.js`
- `apps/mobile/src/lib/appConfig.test.ts`
- `apps/mobile/app.config.js`
- `scripts/phase9/lib.mjs`
- `docs/phase-3/review-packet-index.md`
- `docs/phase-3/review-signoff.schema.json`
- `docs/phase-3/review-signoff.template.json`
- `docs/phase-3/signoffs/README.md`

## Production Release Disposition Contract

`PHASE3_RELEASE_CLEARANCE=cleared` is not sufficient by itself. Production
Expo config and `npm run phase3:check-production-release` load the generated
review worklist and fail unless all of these are true:

- the worklist was generated from a clean worktree and has no contract blocker,
  warning, or missing source;
- all five legal/regulatory, clinical, cosmetic chemistry, privacy/security,
  and IP/FTO domains are present;
- every inventory item has an explicit `Approved` or `Deferred` status;
- every approved or deferred item records a named reviewer or decision owner
  and a valid `YYYY-MM-DD` date;
- every approved or deferred item has one detached signoff whose attestor and
  date match the review log, whose credential or role and retained evidence
  reference are non-placeholder, and whose disposition and explicit condition
  state are release-compatible;
- every detached signoff references the current deterministic item snapshot,
  and its embedded record exactly matches the current source-controlled JSON;
- every review-log and item source still matches the recorded byte count and
  SHA-256 hash.

`Deferred` is a release disposition, not content approval. Use it only when the
surface is excluded from production exposure and the row records the reason and
owner. Its detached signoff must also record the concrete production-gate state,
reason, and owner. Regenerate the worklist after any source, review context,
status, reviewer, date, or signoff change. The current worklist remains
unresolved, has zero professional signoffs, and correctly blocks release.

## Legal/Regulatory Packet

- `docs/phase-3/legal-regulatory-review-log.md`
- `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`
- `docs/phase-3/regulatory-positioning-memo.md`
- `docs/phase-3/launch-claims-vocabulary.md`
- `docs/phase-3/data-inventory.md`
- `docs/phase-3/consent-matrix.md`
- `docs/phase-3/store-metadata-review.md`
- `docs/phase-3/app-review-notes.md`
- `docs/phase-3/google-play-health-declaration-notes.md`
- `apps/mobile/src/features/onboarding/consentCopy.ts`
- `apps/mobile/src/lib/legal/disclaimer.ts`
- `apps/mobile/src/lib/legal/policyLinks.ts`
- `apps/mobile/src/lib/legal/storeMetadata.ts`

## Clinical Packet

- `docs/phase-3/clinical-review-log.md`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`
- `docs/phase-3/generated/review-worklist.json`
- `docs/phase-3/generated/review-worklist.md`
- `docs/phase-3/generated/review-operator-queue.json`
- `docs/phase-3/generated/review-operator-queue.md`
- `apps/mobile/src/features/intelligence/rules.ts`
- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts`
- `apps/mobile/src/features/intelligence/pao.ts`
- `apps/mobile/src/features/recommendations/catalog.ts`
- `apps/mobile/src/features/community/notes.ts`
- `apps/mobile/src/features/ask/answer.ts`
- `apps/mobile/src/features/ask/copy.ts`

## Cosmetic Chemistry Packet

- `docs/phase-3/cosmetic-chemistry-review-log.md`
- `docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md`
- `docs/phase-3/generated/review-worklist.json`
- `docs/phase-3/generated/review-worklist.md`
- `docs/phase-3/generated/review-operator-queue.json`
- `docs/phase-3/generated/review-operator-queue.md`
- `apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts`
- `apps/mobile/src/features/intelligence/tags.ts`
- `apps/mobile/src/features/intelligence/pao.ts`
- `apps/mobile/src/features/recommendations/catalog.ts`
- `apps/mobile/src/features/commerce/stacks.ts`
- `apps/mobile/src/features/shelf/categories.ts`

## IP/FTO Packet

- `docs/phase-3/ip-fto-review-log.md`
- `docs/phase-3/quiz-fto-summary.md`
- `apps/mobile/src/features/onboarding/quiz.ts`
- `apps/mobile/src/app/onboarding/quiz.tsx`
- `apps/mobile/src/app/onboarding/reveal.tsx`

## Privacy/Platform Packet

- `docs/phase-3/privacy-security-review-log.md`
- `docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md`
- `docs/store-privacy-inventory.md`
- `docs/phase-3/data-inventory.md`
- `docs/phase-3/consent-matrix.md`
- `apps/mobile/src/features/settings/actions.ts`
- `apps/mobile/src/features/settings/localDeviceExport.ts`
- `apps/mobile/src/features/settings/localDeviceExport.test.ts`
- `apps/mobile/src/lib/storage/privateKV.ts`
- `apps/mobile/src/lib/storage/privateKV.test.ts`
- `supabase/functions/account-deletion/index.ts`
- `supabase/functions/_shared/storagePath.ts`
- `supabase/functions/_shared/storagePath.test.ts`
- `supabase/functions/data-export/index.ts`
- `supabase/functions/consent-withdrawal/index.ts`
- `scripts/phase2/check-env.mjs`
- `scripts/phase3/audit-copy.mjs`
