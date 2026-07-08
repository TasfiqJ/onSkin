# Phase 3 Review Packet Index

Status: packet scaffold implemented; reviewer signoff missing  
Last updated: 2026-07-04

This index tells reviewers what to inspect. The generated manifest from
`npm run phase3:review-packet` records hashes, file sizes, source Git SHA, and
Git worktree status for auditability. Final reviewer signoff evidence must use
a generated packet that shows `Git status: clean`; treat `Git status: DIRTY` as
investigation evidence only.

## Packet Contract

- `package.json`
- `scripts/phase3/build-review-packet.mjs`
- `scripts/phase3/audit-copy.mjs`
- `scripts/phase9/lib.mjs`
- `docs/phase-3/review-packet-index.md`

## Legal/Regulatory Packet

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
- `apps/mobile/src/features/intelligence/rules.ts`
- `apps/mobile/src/features/intelligence/pao.ts`
- `apps/mobile/src/features/recommendations/catalog.ts`
- `apps/mobile/src/features/community/notes.ts`
- `apps/mobile/src/features/ask/answer.ts`
- `apps/mobile/src/features/ask/copy.ts`

## Cosmetic Chemistry Packet

- `docs/phase-3/cosmetic-chemistry-review-log.md`
- `apps/mobile/src/features/intelligence/tags.ts`
- `apps/mobile/src/features/intelligence/pao.ts`
- `apps/mobile/src/features/recommendations/catalog.ts`
- `apps/mobile/src/features/commerce/stacks.ts`
- `apps/mobile/src/features/shelf/categories.ts`

## IP/FTO Packet

- `docs/phase-3/quiz-fto-summary.md`
- `apps/mobile/src/features/onboarding/quiz.ts`
- `apps/mobile/src/app/onboarding/quiz.tsx`
- `apps/mobile/src/app/onboarding/reveal.tsx`

## Privacy/Platform Packet

- `docs/store-privacy-inventory.md`
- `docs/phase-3/data-inventory.md`
- `docs/phase-3/consent-matrix.md`
- `supabase/functions/account-deletion/index.ts`
- `supabase/functions/data-export/index.ts`
- `scripts/phase2/check-env.mjs`
- `scripts/phase3/audit-copy.mjs`
