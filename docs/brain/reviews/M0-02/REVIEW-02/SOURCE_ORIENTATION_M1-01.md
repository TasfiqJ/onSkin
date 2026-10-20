# M1-01 exact-source orientation

Read-only orientation observed at `6aa01995f6dcb94fd28d358badc9f8d1e0273d39`, tree `3a75ea56f12f9422affc6e09936993ffa9252c05`. These paths identify where to begin; existence is not a correctness claim. Trace actual imports and all relevant entry points before choosing fixes. No patient/research files are needed.

## Source instructions and current contracts
Read root `AGENTS.md`, `CLAUDE.md`, applicable nested agent files, `docs/v2/README.md`, this issued TASK and the approved successor state. Historical wider product/launch plans do not supersede adopted executive policy. For real surface work read `docs/HUMAN_SIMULATED_E2E_TESTING.md`, `docs/USER_FLOW_TREE.md`, `docs/E2E_TESTING_CHECKLIST.md` and `docs/DEVICE_SUPPORT_POLICY.md`.

Root AGENTS bytes2895 SHA256be3dbb304c30af6cc7a0f51e890ccb0e22a312690f8f455b88a710065da71a1a. Root CLAUDE bytes5635 SHA2562baa63ccb443800af7ffc6be239848b8d1a84cb078e163574a95792d882f68c0. Human E2E doc bytes10413 SHA256109f35402903500e5bc61054e52bf8f0dbe090d3ade395d96303ea008bb7bc50.

## Identity and publication
`apps/mobile/src/lib/auth/AuthProvider.tsx`, `SessionBoundaryGate.tsx`, `sessionBoundary.ts`, `sessionBoundaryQueue.ts`, `sessionOwner.ts`, `sessionOwnerKey.ts`, `accountGeneration.ts`, `accountPublicationController.ts`, `accountPublicationFence.ts`, `authMutationFence.ts`, `localAccountIsolation.ts`, `accountUpgrade.ts`, `providerAuthCommit.ts`. Relevant existing tests include account isolation/upgrade/first-session E2E helpers. Do not replace the substrate.

## Adult eligibility
`apps/mobile/src/features/onboarding/ageGate.ts` currently explicitly sets `MINIMUM_AGE = 16`; `AGE_POLICY_REVIEW_STATUS = 'draft_blocked'`; neutralDOB semantic tuple versiondraft-v1; old hash213a9fa27a479d336ca74edb858d780d568abf4166a43b586dd8bdc48f62fb1e. Read `ageGateStore.ts`, `AgePolicyGate.tsx`, their tests, `apps/mobile/src/app/onboarding/age.tsx`, onboarding/root layouts and direct entry. Storage accepts only the exact current receipt shape/hash and keeps a minimal re-verification tombstone for ineligibility; no DOB is persisted in that receipt. Preserve this minimization. Prior16+ proof is not proof of18+. ADR005 and029 authorize a new source policy tuple/hash, but not a legal-review approval or a Security/DB rebind.

## Consent, withdrawal, deletion and storage
`apps/mobile/src/features/onboarding/consentCopy.ts` keeps collection and withdrawal copy draft_blocked; grants in production refuse while withdrawal remains allowed. Do not mark copy approved. Read `features/healthConsent/` lifecycle/store/activationInterlock/pendingIntent/selectiveCleanup, `lib/consent/` healthProcessingEpoch/healthDataWriteAdmission/dependentConsentLifecycle/withdrawal, `features/settings/accountDeletion*`, `lib/auth/accountDeletion*`, `lib/storage/privateKV*`, `privateSecureStore.ts`, `PrivateDataAvailabilityGate.tsx`, and existing photo/reminder cleanup callers only where affected. No native security claim can be established by a web/mock pass.

## Manual Shelf and recovery
`apps/mobile/src/features/shelf/store.ts`, `mutations.ts`, `useShelf.ts`, `ShelfDataAvailabilityGate.tsx`, `IntakeContext.tsx`, `intakeSession.ts`, `addSubmissionAttempt.ts`, `catalogLookupRecovery.ts`, `apps/mobile/src/lib/offline/shelfMirrorQueue.ts`, routes `(tabs)/shelf.tsx`, `shelf/manual.tsx`, `shelf/add.tsx`, `shelf/[id].tsx`, `shelf/no-match.tsx`, `shelf/catalog-recovery.tsx`. Closed catalog/barcode/OCR capabilities must not be enabled to repair a manual fallback. Preserve source-approved product identity distinctions and no fabricated ingredient/claim data.

## Tools already observed
Windows Node20.20.2/npm11.20.0 and mobile Vitest/workspace tests exist. Working WSL `onskin-r6-verification` supplied LinuxPython3.12.3 for the Brain audit. `Ubuntu-22.04` is unavailable (missingVHD); do not repair or replace host distributions as a task shortcut. Confirm all tools freshly; no install, paid build or hardware assumption is an authorization.
