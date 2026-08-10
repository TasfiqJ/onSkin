# Phase 4 Beta Coverage Report

Generated: 2026-08-10T01:37:25.257Z
Status: blocked
Git SHA: fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f
Git status: DIRTY

Dirty paths:

```
M .env.example
 M .github/workflows/ios-simulator-compile.yml
 M .github/workflows/quality.yml
 M 04_repo_docs/AGENTS.md
 M 04_repo_docs/README.md
 M 04_repo_docs/docs/CODEX_IMPLEMENTATION_PROMPT.md
 M 04_repo_docs/docs/DECISIONS.md
 M 04_repo_docs/docs/MASTER_PLAN.md
 M 04_repo_docs/docs/TESTING_STRATEGY.md
 M AGENTS.md
 M BLOCKERS.md
 M CLAUDE.md
 M COMPLIANCE_SUPPORT_MAP.md
 M DATA_FLOW_MAP.md
 M DECISIONS.md
 M LAUNCH_READINESS.md
 M PATCH_NOTES_SECURITY.md
 M PROGRESS.md
 M SECURITY_AUDIT_REPORT.md
 M SECURITY_TEST_PLAN.md
 M THREAT_MODEL.md
 M apps/catalog-operator-console/README.md
 M apps/catalog-operator-console/package.json
 M apps/catalog-operator-console/src/auth.ts
 M apps/catalog-operator-console/src/main.ts
 M apps/mobile/app.base.json
 M apps/mobile/app.config.js
 M apps/mobile/assets/images/android-icon-background.png
 M apps/mobile/assets/images/android-icon-foreground.png
 M apps/mobile/assets/images/android-icon-monochrome.png
 M apps/mobile/assets/images/favicon.png
 M apps/mobile/assets/images/icon.png
 M apps/mobile/assets/images/splash-icon.png
 M apps/mobile/metro.config.js
 M apps/mobile/modules/native-age-assurance/ios/NativeAgeAssurance.podspec
 M apps/mobile/modules/native-label-ocr/ios/NativeLabelOcr.podspec
 M apps/mobile/package.json
 D apps/mobile/plugins/withRoutineKindWidgetPrivacyManifest.js
 M apps/mobile/src/app/(tabs)/_layout.tsx
 M apps/mobile/src/app/ask/consent.tsx
 M apps/mobile/src/app/cycle/disruption.tsx
 M apps/mobile/src/app/cycle/settings.tsx
 M apps/mobile/src/app/onboarding/goals.tsx
 M apps/mobile/src/app/onboarding/reveal.tsx
 M apps/mobile/src/app/paywall/upsell.tsx
 M apps/mobile/src/app/progress/review.tsx
 M apps/mobile/src/app/recommendations/[id].tsx
 M apps/mobile/src/app/recommendations/index.tsx
 M apps/mobile/src/app/recommendations/preferences.tsx
 M apps/mobile/src/app/settings/skin-profile.tsx
 M apps/mobile/src/app/shelf/opened.tsx
 M apps/mobile/src/app/shelf/scan.tsx
 M apps/mobile/src/features/ask/answer.ts
 M apps/mobile/src/features/ask/consent.test.ts
 M apps/mobile/src/features/ask/consent.ts
 M apps/mobile/src/features/ask/intent.ts
 M apps/mobile/src/features/ask/routeContract.test.ts
 M apps/mobile/src/features/ask/store.test.ts
 M apps/mobile/src/features/ask/store.ts
 M apps/mobile/src/features/catalog/client.ts
 M apps/mobile/src/features/catalog/ingredientParser.ts
 M apps/mobile/src/features/catalog/obf.test.ts
 M apps/mobile/src/features/commerce/attribution.test.ts
 M apps/mobile/src/features/commerce/claimsafety.test.ts
 M apps/mobile/src/features/commerce/copy.ts
 M apps/mobile/src/features/commerce/links.ts
 M apps/mobile/src/features/commerce/stacks.ts
 M apps/mobile/src/features/commerce/store.test.ts
 M apps/mobile/src/features/commerce/store.ts
 M apps/mobile/src/features/community/notes.ts
 M apps/mobile/src/features/community/reactionStore.test.ts
 M apps/mobile/src/features/community/reactionStore.ts
 M apps/mobile/src/features/community/store.test.ts
 M apps/mobile/src/features/community/store.ts
 M apps/mobile/src/features/growth/cardCopy.test.ts
 M apps/mobile/src/features/growth/cardCopy.ts
 M apps/mobile/src/features/growth/publicLinkAdmission.test.ts
 M apps/mobile/src/features/growth/shareAdmission.test.ts
 M apps/mobile/src/features/growth/shareLinks.test.ts
 M apps/mobile/src/features/growth/shareProjection.test.ts
 M apps/mobile/src/features/healthConsent/dependentConsentCleanup.test.ts
 M apps/mobile/src/features/healthConsent/lifecycleStore.ts
 M apps/mobile/src/features/healthConsent/pendingIntent.ts
 M apps/mobile/src/features/healthConsent/selectiveCleanup.test.ts
 M apps/mobile/src/features/intelligence/concentration.ts
 M apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.test.ts
 M apps/mobile/src/features/intelligence/conflictRuleCorpus.v1.ts
 M apps/mobile/src/features/intelligence/engine.ts
 M apps/mobile/src/features/intelligence/overrides.test.ts
 M apps/mobile/src/features/intelligence/overrides.ts
 M apps/mobile/src/features/intelligence/pregnancySafety.ts
 M apps/mobile/src/features/intelligence/presentation.ts
 M apps/mobile/src/features/intelligence/scheduler.ts
 M apps/mobile/src/features/intelligence/tags.ts
 M apps/mobile/src/features/notifications/copy.ts
 M apps/mobile/src/features/notifications/deliver.test.ts
 M apps/mobile/src/features/notifications/deliver.ts
 M apps/mobile/src/features/notifications/policy.ts
 M apps/mobile/src/features/notifications/sentStore.test.ts
 M apps/mobile/src/features/notifications/sentStore.ts
 M apps/mobile/src/features/notifications/store.test.ts
 M apps/mobile/src/features/notifications/store.ts
 M apps/mobile/src/features/onboarding/AgePolicyGate.lifecycle.test.ts
 M apps/mobile/src/features/onboarding/OnboardingContext.tsx
 M apps/mobile/src/features/onboarding/ageGate.ts
 M apps/mobile/src/features/onboarding/healthConsentStore.test.ts
 M apps/mobile/src/features/onboarding/healthConsentStore.ts
 M apps/mobile/src/features/onboarding/quiz.ts
 M apps/mobile/src/features/onboarding/quizContract.ts
 M apps/mobile/src/features/onboarding/serverSkinProfile.test.ts
 M apps/mobile/src/features/onboarding/serverSkinProfile.ts
 M apps/mobile/src/features/onboarding/skinProfileStore.test.ts
 M apps/mobile/src/features/onboarding/skinProfileStore.ts
 M apps/mobile/src/features/photos/consent.test.ts
 M apps/mobile/src/features/photos/consent.ts
 M apps/mobile/src/features/photos/copy.ts
 M apps/mobile/src/features/photos/encryptedStorage.test.ts
 M apps/mobile/src/features/photos/encryptedStorage.ts
 M apps/mobile/src/features/photos/progressCapturePrivacy.ts
 M apps/mobile/src/features/photos/quality.ts
 M apps/mobile/src/features/photos/sharePhoto.test.ts
 M apps/mobile/src/features/photos/store.test.ts
 M apps/mobile/src/features/photos/store.ts
 M apps/mobile/src/features/photos/timelapse.test.ts
 M apps/mobile/src/features/photos/timeline.ts
 M apps/mobile/src/features/photos/usePhotos.ts
 M apps/mobile/src/features/recommendations/catalog.ts
 M apps/mobile/src/features/recommendations/claimsafety.test.ts
 M apps/mobile/src/features/recommendations/copy.ts
 M apps/mobile/src/features/recommendations/engine.test.ts
 M apps/mobile/src/features/recommendations/engine.ts
 M apps/mobile/src/features/recommendations/fit.test.ts
 M apps/mobile/src/features/recommendations/fit.ts
 M apps/mobile/src/features/recommendations/goalAdmission.ts
 M apps/mobile/src/features/recommendations/goalProvenance.ts
 M apps/mobile/src/features/recommendations/preferences.ts
 M apps/mobile/src/features/recommendations/replenishment.test.ts
 M apps/mobile/src/features/recommendations/store.test.ts
 M apps/mobile/src/features/recommendations/store.ts
 M apps/mobile/src/features/review/prompt.test.ts
 M apps/mobile/src/features/review/prompt.ts
 M apps/mobile/src/features/routine/activationAnalytics.test.ts
 M apps/mobile/src/features/routine/activationAnalytics.ts
 M apps/mobile/src/features/routine/cycleAnchor.test.ts
 M apps/mobile/src/features/routine/cycleAnchor.ts
 M apps/mobile/src/features/routine/generate.ts
 M apps/mobile/src/features/routine/orderStore.test.ts
 M apps/mobile/src/features/routine/orderStore.ts
 M apps/mobile/src/features/routine/ramp.ts
 M apps/mobile/src/features/routine/rampStore.test.ts
 M apps/mobile/src/features/routine/rampStore.ts
 M apps/mobile/src/features/routine/routineSequencingCorpus.v1.ts
 M apps/mobile/src/features/routine/sequencing.ts
 M apps/mobile/src/features/scheduler/classes.ts
 M apps/mobile/src/features/scheduler/cycleStore.test.ts
 M apps/mobile/src/features/scheduler/cycleStore.ts
 M apps/mobile/src/features/scheduler/orchestrate.test.ts
 M apps/mobile/src/features/scheduler/orchestrate.ts
 M apps/mobile/src/features/scheduler/profile.ts
 M apps/mobile/src/features/scheduler/profileMapping.ts
 M apps/mobile/src/features/scheduler/useCycle.ts
 M apps/mobile/src/features/settings/accountDeletionClientState.ts
 M apps/mobile/src/features/settings/accountDeletionForeignOwnerPreservation.test.ts
 M apps/mobile/src/features/settings/accountDeletionNotice.test.ts
 M apps/mobile/src/features/settings/localDeviceExport.test.ts
 M apps/mobile/src/features/settings/localDeviceExport.ts
 M apps/mobile/src/features/settings/localPrivateData.test.ts
 M apps/mobile/src/features/settings/localPrivateDataKeys.test.ts
 M apps/mobile/src/features/settings/localPrivateDataKeys.ts
 M apps/mobile/src/features/shelf/catalogLookupRecovery.test.ts
 M apps/mobile/src/features/shelf/catalogRecoveryAsync.test.ts
 M apps/mobile/src/features/shelf/categories.ts
 M apps/mobile/src/features/shelf/freshness.test.ts
 M apps/mobile/src/features/shelf/freshness.ts
 M apps/mobile/src/features/shelf/intakeSession.ts
 M apps/mobile/src/features/shelf/labels.ts
 M apps/mobile/src/features/shelf/paoProvenance.ts
 M apps/mobile/src/features/shelf/scanLog.ts
 M apps/mobile/src/features/shelf/store.test.ts
 M apps/mobile/src/features/shelf/store.ts
 M apps/mobile/src/features/shelf/useShelf.ts
 M apps/mobile/src/features/streak/milestoneStore.test.ts
 M apps/mobile/src/features/streak/milestoneStore.ts
 M apps/mobile/src/features/subscription/ProGate.tsx
 M apps/mobile/src/features/subscription/conflictQuota.test.ts
 M apps/mobile/src/features/subscription/conflictQuota.ts
 M apps/mobile/src/features/subscription/copy.ts
 M apps/mobile/src/features/subscription/dismissPaywall.ts
 M apps/mobile/src/features/subscription/entitlement.test.ts
 M apps/mobile/src/features/subscription/entitlement.ts
 M apps/mobile/src/features/subscription/entitlementE2EFixture.web.ts
 M apps/mobile/src/features/subscription/gatedRoutes.ts
 M apps/mobile/src/features/subscription/lifecycle.test.ts
 M apps/mobile/src/features/subscription/lifecycle.ts
 M apps/mobile/src/features/subscription/plans.test.ts
 M apps/mobile/src/features/subscription/plans.ts
 M apps/mobile/src/features/subscription/priceDisplay.test.ts
 M apps/mobile/src/features/subscription/priceDisplay.ts
 M apps/mobile/src/features/subscription/serverContracts.test.ts
 M apps/mobile/src/features/subscription/store.test.ts
 M apps/mobile/src/features/subscription/store.ts
 M apps/mobile/src/features/subscription/storeTransactionNoticeContracts.test.ts
 M apps/mobile/src/features/today/completionsStore.test.ts
 M apps/mobile/src/features/today/completionsStore.ts
 M apps/mobile/src/features/today/useToday.ts
 M apps/mobile/src/features/trend/claimsafety.test.ts
 M apps/mobile/src/features/trend/copy.ts
 M apps/mobile/src/features/trend/store.test.ts
 M apps/mobile/src/features/trend/store.ts
 M apps/mobile/src/features/trend/trend.ts
 M apps/mobile/src/features/widgets/TodayWidget.ios.tsx
 M apps/mobile/src/features/widgets/TonightActivity.ios.tsx
 M apps/mobile/src/features/widgets/actionRegistry.ts
 M apps/mobile/src/features/widgets/contract.test.ts
 M apps/mobile/src/features/widgets/contract.ts
 M apps/mobile/src/features/widgets/lifecycleRuntime.ios.ts
 M apps/mobile/src/features/widgets/lifecycleRuntime.test.ts
 M apps/mobile/src/features/widgets/nativeLifecycle.ios.ts
 M apps/mobile/src/features/widgets/nativeLifecycleBridge.test.ts
 M apps/mobile/src/features/widgets/nativeLifecycleContract.test.ts
 M apps/mobile/src/features/widgets/nativeOutboxModel.test.ts
 M apps/mobile/src/features/widgets/ownerAuthority.ts
 M apps/mobile/src/features/widgets/widgetViews.test.ts
 M apps/mobile/src/lib/analytics/track.ts
 M apps/mobile/src/lib/appConfig.test.ts
 M apps/mobile/src/lib/applock/store.test.ts
 M apps/mobile/src/lib/applock/store.ts
 M apps/mobile/src/lib/auth/AuthProvider.tsx
 M apps/mobile/src/lib/auth/appleCredentialQuarantine.ts
 M apps/mobile/src/lib/auth/authDerivedCleanupRequired.ts
 M apps/mobile/src/lib/auth/sessionOwner.test.ts
 M apps/mobile/src/lib/auth/sessionOwner.ts
 M apps/mobile/src/lib/auth/sessionOwnerKey.ts
 M apps/mobile/src/lib/brand.test.ts
 M apps/mobile/src/lib/brand.ts
 M apps/mobile/src/lib/consent/consent.test.ts
 M apps/mobile/src/lib/consent/consent.ts
 M apps/mobile/src/lib/consent/dependentConsentContract.ts
 M apps/mobile/src/lib/consent/dependentConsentLease.test.ts
 M apps/mobile/src/lib/consent/dependentConsentLocal.test.ts
 M apps/mobile/src/lib/consent/dependentConsentLocal.ts
 M apps/mobile/src/lib/consent/dependentConsentRecoveryContract.ts
 M apps/mobile/src/lib/consent/dependentConsentRecoveryStore.test.ts
 M apps/mobile/src/lib/consent/healthDataWriteAdmission.test.ts
 M apps/mobile/src/lib/consent/healthDataWriteAdmission.ts
 M apps/mobile/src/lib/consent/healthProcessingEpoch.ts
 M apps/mobile/src/lib/consent/withdrawal.test.ts
 M apps/mobile/src/lib/consent/withdrawal.ts
 M apps/mobile/src/lib/env.ts
 M apps/mobile/src/lib/growth/attribution.test.ts
 M apps/mobile/src/lib/iap/revenuecat.ts
 M apps/mobile/src/lib/iap/revenuecatPublication.test.ts
 M apps/mobile/src/lib/iap/storeTransactionNotice.ts
 M apps/mobile/src/lib/launch/phase7.test.ts
 M apps/mobile/src/lib/launch/phase8.test.ts
 M apps/mobile/src/lib/navigation/externalUrl.test.ts
 M apps/mobile/src/lib/offline/catalogLookupQueue.test.ts
 M apps/mobile/src/lib/offline/catalogLookupQueue.ts
 M apps/mobile/src/lib/offline/completionQueue.test.ts
 M apps/mobile/src/lib/offline/completionQueue.ts
 M apps/mobile/src/lib/storage/plaintextStagingCore.test.ts
 M apps/mobile/src/lib/storage/plaintextStagingCore.ts
 M apps/mobile/src/lib/storage/privateKV.test.ts
 M apps/mobile/src/lib/storage/privateKV.ts
 M apps/mobile/src/lib/storage/privateKVContentKey.ts
 M apps/mobile/src/lib/supabase/client.ts
 M blocker.md
 M docs/00-architecture.md
 M docs/02-ingredient-intelligence.md
 M docs/03-routine-builder.md
 M docs/04-smart-shelf.md
 M docs/05-actives-scheduler.md
 M docs/06-photo-progress.md
 M docs/07-reminders-streaks-widgets.md
 M docs/08-subscriptions-paywall.md
 M docs/09-personalized-recommendations.md
 M docs/10-compass-artifact.md
 M docs/10-creator-stacks-build-spec.md
 M docs/11-community-layer.md
 M docs/12-ai-trend-analysis.md
 D docs/13-ask-onskin-assistant.md
 M docs/14-growth-to-seven-figures.md
 M docs/CODEX_IMPLEMENTATION_PROMPT.md
 M docs/DECISIONS.md
 M docs/HUMAN_SIMULATED_E2E_TESTING.md
 M docs/MASTER_PLAN.md
 M docs/MAXIMUM_OPTIMIZATION_CODEX_IMPLEMENTATION_PROMPT.md
 M docs/MAXIMUM_REACT_NATIVE_OPTIMIZATION_PLAN.md
 M docs/USER_FLOW_TREE.md
 M docs/brand-decision-memo.md
 M docs/e2e-bug-reports/2026-07-07-ask-active-frequency-misroute.md
 M docs/e2e-bug-reports/2026-07-07-ask-consent-deferred-cta.md
 M docs/e2e-bug-reports/2026-07-07-ask-disclosure-footer-clipped.md
 M docs/e2e-bug-reports/2026-07-07-ask-disclosure-footer-compact-clearance.md
 M docs/e2e-bug-reports/2026-07-07-ask-first-prompt-compact-composer-overlap.md
 M docs/e2e-bug-reports/2026-07-07-commerce-missing-stack-recovery.md
 M docs/e2e-bug-reports/2026-07-07-onboarding-quiz-consent-bypass.md
 M docs/e2e-bug-reports/2026-07-07-shelf-manual-category-picker-sheet.md
 M docs/e2e-bug-reports/2026-07-07-shelf-no-match-search-fallback.md
 M docs/e2e-bug-reports/2026-07-07-start-today-cycle-anchor.md
 M docs/e2e-bug-reports/2026-07-07-subscription-reverse-trial-status-pill.md
 M docs/e2e-bug-reports/2026-07-08-ask-consent-native-alert.md
 M docs/e2e-bug-reports/2026-07-08-ask-short-phone-composer-overlap.md
 M docs/e2e-bug-reports/2026-07-08-commerce-paid-link-inline-recovery.md
 M docs/e2e-bug-reports/2026-07-08-commerce-stack-paid-links-before-consent.md
 M docs/e2e-bug-reports/2026-07-08-shelf-replenish-similar-inline-recovery.md
 M docs/e2e-bug-reports/2026-07-08-toggle-switch-web-inert.md
 M docs/e2e-bug-reports/2026-07-10-private-envelope-corruption-app-lock-recovery.md
 M docs/e2e-bug-reports/2026-07-10-progress-encrypted-storage-false-empty-state.md
 M docs/e2e-bug-reports/2026-07-26-core03-metro-temp-collision.md
 M docs/generated/source-packet-audit.json
 M docs/generated/source-packet-audit.md
 M docs/hugeToDo/ACCOUNTS_AND_VENDOR_DECISION_PACKET.md
 M docs/hugeToDo/APPLE_AND_LEGAL_PRIMARY_RESEARCH.md
 M docs/hugeToDo/BRAND-01-naming-brief.md
 M docs/hugeToDo/BRAND-02-scored-longlist.md
 M docs/hugeToDo/BRAND-LEGACY-COMPATIBILITY-CHECKPOINT-2026-07-14.md
 M docs/hugeToDo/CAT-07-SHELF-FRESHNESS-SOURCE-CHECKPOINT-2026-07-19.md
 M docs/hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md
 M docs/hugeToDo/CORE-03-ROUTINE-GUIDANCE-SOURCE-CHECKPOINT-2026-07-26.md
 M docs/hugeToDo/CORE-04-PERSISTENCE-SOURCE-CHECKPOINT-2026-07-26.md
 M docs/hugeToDo/CORE-06-RECOMMENDATION-ADMISSION-SOURCE-CHECKPOINT-2026-07-26.md
 M docs/hugeToDo/CORE-07-SHARE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md
 M docs/hugeToDo/DB-01-11-GAP-MATRIX-2026-07-13.md
 M docs/hugeToDo/DB-05-LOCAL-RESET-2026-07-14.md
 M docs/hugeToDo/DURABLE_ACCOUNT_DELETION_RESEARCH_2026-07-13.md
 M docs/hugeToDo/FOUNDER_ENROLLMENT_AND_EXTERNAL_GATES_PACKET.md
 M docs/hugeToDo/HEALTH-CONSENT-WITHDRAWAL-PROCESSOR-RETENTION-MATRIX-2026-07-15.md
 M docs/hugeToDo/IOS-02-WIDGET-LIFECYCLE-SOURCE-CHECKPOINT-2026-07-16.md
 M docs/hugeToDo/IOS-10-EXPORT-COMPLIANCE-GATE.md
 M docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md
 M docs/hugeToDo/PAY-01-pricing-and-unit-economics-recommendation-2026-07-13.md
 M docs/hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md
 M docs/hugeToDo/README.md
 M docs/hugeToDo/US_WAVE1_PRIVACY_AND_CONSUMER_HEALTH_LAW_GATE.md
 M docs/hugeToDo/execution-status.json
 M docs/hugeToDo/feature-inventory.json
 M docs/legal-readiness.md
 M docs/phase-10/surveys.md
 M docs/phase-10/tester-brief.md
 M docs/phase-2-production-infrastructure-runbook.md
 M docs/phase-2-readiness-checklist.md
 M docs/phase-3/app-store-medical-legal-gap-audit-2026-07-26.md
 M docs/phase-3/clinical-conflict-rule-evidence-audit-2026-07-26.md
 M docs/phase-3/clinical-review-log.md
 M docs/phase-3/data-inventory.md
 M docs/phase-3/generated/review-operator-queue.json
 M docs/phase-3/generated/review-operator-queue.md
 M docs/phase-3/generated/review-packet-manifest.json
 M docs/phase-3/generated/review-packet.md
 M docs/phase-3/generated/review-worklist.json
 M docs/phase-3/generated/review-worklist.md
 M docs/phase-3/google-play-health-declaration-notes.md
 M docs/phase-3/ip-fto-review-log.md
 M docs/phase-3/launch-claims-vocabulary.md
 M docs/phase-3/legal-regulatory-review-log.md
 M docs/phase-3/quiz-fto-summary.md
 M docs/phase-3/regulatory-positioning-memo.md
 M docs/phase-4/beta-shelf-corpus.template.json
 M docs/phase-4/catalog-cat02-membership-proof.template.json
 M docs/phase-4/catalog-coverage-quality-targets.template.json
 M docs/phase-4/catalog-curation-database-readback.template.json
 M docs/phase-4/catalog-curation-review.template.json
 M docs/phase-4/catalog-import-promotion-runbook.md
 M docs/phase-4/catalog-source-memo-cosing.md
 M docs/phase-4/catalog-source-memo-open-beauty-facts.md
 M docs/phase-4/catalog-source-release-runbook.md
 M docs/phase-4/generated/source-worklist.json
 M docs/phase-4/generated/source-worklist.md
 M docs/phase-4/odbl-compliance-memo.md
 M docs/phase-5/camera-lifecycle-evidence-runbook.md
 M docs/phase-5/device-qa-checklist.md
 M docs/phase-5/generated/device-qa-packet.json
 M docs/phase-5/generated/device-qa-packet.md
 M docs/phase-5/native-build-runbook.md
 M docs/phase-5/phase-5-exit-review.md
 M docs/phase-6/payments-runbook.md
 M docs/phase-7/core-loop-qa-checklist.md
 M docs/phase-8/creator-brief.md
 M docs/phase-8/public-site/index.html
 M docs/phase-8/public-site/support.html
 M docs/phase-8/public-site/waitlist.html
 M docs/phase-8/store-metadata-source-of-truth.md
 M docs/phase-8/support-review-response-playbook.md
 M docs/phase-9/account-deletion-operations-runbook.md
 M docs/phase-9/data-inventory.md
 M docs/phase-9/generated/dependency-inventory.json
 M docs/phase-9/generated/dependency-inventory.md
 M docs/phase-9/generated/live-consent-withdrawal.json
 M docs/phase-9/generated/release-engineering-qa-packet.json
 M docs/phase-9/generated/release-engineering-qa-packet.md
 M docs/phase-9/generated/store-build-inspection.json
 M docs/phase-9/release-candidates/_template/evidence-chain.json
 M docs/rebrand-and-core-loop-migration-checklist.md
 M docs/seven-figure-readiness.md
 M package-lock.json
 M package.json
 M packages/types/package.json
 M packages/types/src/index.ts
 M scripts/brand-audit-lib.mjs
 M scripts/brand-audit.test.mjs
 M scripts/cat05/native-label-ocr-source-contract.test.mjs
 M scripts/core04/persistence-source-contract.test.mjs
 M scripts/core05/adherence-source-contract.test.mjs
 M scripts/core06/recommendation-admission-source-contract.test.mjs
 M scripts/docs/device-support-policy-audit.test.mjs
 M scripts/docs/readiness-status-audit.test.mjs
 M scripts/e2e/cat04-catalog-recovery-audit.mjs
 M scripts/e2e/cat04-catalog-recovery-audit.test.mjs
 M scripts/e2e/cat07-png-contract.mjs
 M scripts/e2e/cat07-shelf-freshness-audit.mjs
 M scripts/e2e/catalog-operator-console-fixture-server.mjs
 M scripts/e2e/catalog-search-wrong-match.mjs
 M scripts/e2e/human-e2e-manifest-contract.test.mjs
 M scripts/e2e/human-e2e-manifest.mjs
 M scripts/e2e/onboarding-first-session.mjs
 M scripts/e2e/public-site-support.mjs
 M scripts/e2e/tabbar-geometry.mjs
 M scripts/e2e/text-pressure-route-audit.mjs
 M scripts/launch/governed-evidence-chain.mjs
 M scripts/launch/governed-evidence-chain.test.mjs
 M scripts/optimization/export-stats-smoke.mjs
 M scripts/optimization/generate-fixtures-smoke.mjs
 M scripts/optimization/generate-fixtures.mjs
 M scripts/phase10-11/public-contact-smoke.mjs
 M scripts/phase2/check-env-smoke.mjs
 M scripts/phase2/check-env.mjs
 M scripts/phase2/deploy-supabase-staging.mjs
 M scripts/phase2/local-supabase-reset.mjs
 M scripts/phase3/review-signoff-template-smoke.mjs
 M scripts/phase4/beta-coverage-committed-check.test.mjs
 M scripts/phase4/beta-coverage-report-smoke.mjs
 M scripts/phase4/catalog-curation-contract.mjs
 M scripts/phase4/catalog-curation-contract.test.mjs
 M scripts/phase4/catalog-promotion-contract.mjs
 M scripts/phase4/catalog-promotion-contract.test.mjs
 M scripts/phase4/check-source-env-smoke.mjs
 M scripts/phase4/source-policy.test.mjs
 M scripts/phase5/build-device-qa-packet.mjs
 M scripts/phase5/camera-lifecycle-evidence-contract.mjs
 M scripts/phase5/camera-lifecycle-evidence-smoke.mjs
 M scripts/phase5/check-native-config.mjs
 M scripts/phase5/device-qa-packet-smoke.mjs
 M scripts/phase5/expo-widgets-56.0.23/AppIntent.swift
 M scripts/phase5/expo-widgets-56.0.23/EntryView.swift
 M scripts/phase5/expo-widgets-56.0.23/LiveActivity.swift
 M scripts/phase5/expo-widgets-56.0.23/LiveActivityFactory.swift
 D scripts/phase5/expo-widgets-56.0.23/RoutineKindWidgetLifecycleStore.swift
 M scripts/phase5/expo-widgets-56.0.23/Utils.swift
 M scripts/phase5/expo-widgets-56.0.23/WidgetLiveActivity.swift
 M scripts/phase5/expo-widgets-56.0.23/WidgetObject.swift
 M scripts/phase5/expo-widgets-56.0.23/WidgetsModule.swift
 M scripts/phase5/expo-widgets-57.0.8/AppIntent.swift
 M scripts/phase5/expo-widgets-57.0.8/EntryView.swift
 M scripts/phase5/expo-widgets-57.0.8/LiveActivity.swift
 M scripts/phase5/expo-widgets-57.0.8/LiveActivityFactory.swift
 D scripts/phase5/expo-widgets-57.0.8/RoutineKindWidgetLifecycleStore.swift
 M scripts/phase5/expo-widgets-57.0.8/Utils.swift
 M scripts/phase5/expo-widgets-57.0.8/WidgetLiveActivity.swift
 M scripts/phase5/expo-widgets-57.0.8/WidgetObject.swift
 M scripts/phase5/expo-widgets-57.0.8/WidgetsModule.swift
 M scripts/phase5/expo-widgets-lifecycle-source.test.mjs
 M scripts/phase5/ios-extension-contract.mjs
 M scripts/phase5/ios-extension-contract.test.mjs
 M scripts/phase5/native-ocr-evidence-smoke.mjs
 M scripts/phase5/patch-expo-widgets-lifecycle.mjs
 M scripts/phase5/patch-expo-widgets-lifecycle.test.mjs
 M scripts/phase5/performance-evidence-smoke.mjs
 M scripts/phase5/widget-lifecycle-evidence-smoke.mjs
 M scripts/phase5/widget-privacy-manifest.test.mjs
 M scripts/phase6/check-payments-env-smoke.mjs
 M scripts/phase6/payments-git-provenance.test.mjs
 M scripts/phase6/payments-revenuecat-access-evidence.test.mjs
 M scripts/phase6/payments-trusted-entitlements-evidence.test.mjs
 M scripts/phase7/check-core-loop-smoke.mjs
 M scripts/phase8/check-growth-store-smoke.mjs
 M scripts/phase9/build-evidence-chain-ledger.test.mjs
 M scripts/phase9/build-release-qa-packet.mjs
 M scripts/phase9/consent-withdrawal-evidence.mjs
 M scripts/phase9/consent-withdrawal-smoke.mjs
 M scripts/phase9/data-rights-smoke.mjs
 M scripts/phase9/edge-function-manifest-smoke.mjs
 M scripts/phase9/git-status-exclusion.test.mjs
 M scripts/phase9/health-consent-work-lane-smoke.mjs
 M scripts/phase9/ios-archive-privacy-evidence.test.mjs
 M scripts/phase9/ios-privacy-source-audit.mjs
 M scripts/phase9/ios-privacy-source-audit.test.mjs
 M scripts/phase9/live-consent-withdrawal.mjs
 M scripts/phase9/live-revenuecat-webhook.mjs
 M scripts/phase9/live-supabase-adversarial.mjs
 M scripts/phase9/patch-react-native-view-shot-privacy.mjs
 M scripts/phase9/patch-react-native-view-shot-privacy.test.mjs
 M scripts/phase9/release-candidate-git-contract.test.mjs
 M scripts/phase9/release-contact-smoke.mjs
 M scripts/phase9/release-qa-integrity.test.mjs
 M scripts/phase9/release-smoke.mjs
 M scripts/phase9/revenuecat-deletion-barrier-postgres-rehearsal.sql
 M scripts/phase9/revenuecat-identity-tombstones-postgres-rehearsal.sql
 M scripts/phase9/rls-adversarial.mjs
 M scripts/phase9/skin-profile-0064-upgrade-postgres-rehearsal.sql
 M scripts/phase9/upstream-packet-contract.test.mjs
 M supabase/README.md
 M supabase/config.toml
 M supabase/functions/_shared/appleLifecycleSecrets.ts
 M supabase/functions/_shared/appleVault.test.ts
 M supabase/functions/_shared/appleVault.ts
 M supabase/functions/account-deletion/appleDeletionNetwork.test.ts
 M supabase/functions/account-deletion/durableDeletionCore.test.ts
 M supabase/functions/account-deletion/durableDeletionDatabaseGateway.test.ts
 M supabase/functions/account-deletion/durableDeletionRuntime.test.ts
 M supabase/functions/account-deletion/providerDeletion.ts
 M supabase/functions/apple-account-events/core.test.ts
 M supabase/functions/apple-account-events/httpHandler.test.ts
 M supabase/functions/apple-account-events/verifier.test.ts
 M supabase/functions/apple-auth-lifecycle/core.test.ts
 M supabase/functions/apple-auth-lifecycle/database.test.ts
 M supabase/functions/apple-auth-worker/core.test.ts
 M supabase/functions/consent-withdrawal/dependentCleanupRuntime.ts
 M supabase/functions/consent-withdrawal/granularWithdrawalCore.test.ts
 M supabase/functions/consent-withdrawal/granularWithdrawalCore.ts
 M supabase/functions/data-export/index.ts
 M supabase/functions/health-consent-worker/dependentWorkerCore.test.ts
 M supabase/functions/health-consent-worker/dependentWorkerCore.ts
 M supabase/functions/revenuecat-webhook/webhookCore.test.ts
 M supabase/functions/subscription-reconciliation/reconciliationCore.test.ts
 M supabase/migrations/20260613000022_commerce.sql
 M supabase/migrations/20260613000023_community.sql
 D supabase/migrations/20260614000025_ask_onskin.sql
 M supabase/migrations/20260614000026_phase4_catalog.sql
 M supabase/migrations/20260705000032_phase9_consent_withdrawal.sql
 M supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql
 M supabase/migrations/20260715000055_apple_auth_lifecycle.sql
 M supabase/migrations/20260718000059_catalog_scan_minimization.sql
 M supabase/migrations/20260722000063_catalog_operator_authority.sql
 M supabase/migrations/20260726000064_skin_profile_quiz_provenance.sql
 M supabase/migrations/20260726000070_health_consent_draft_successor_staging.sql
 M supabase/tests/database/apple_auth_lifecycle.test.sql
 M supabase/tests/database/health_consent_draft_successor_staging.test.sql
 M supabase/tests/database/health_consent_lifecycle.test.sql
 M supabase/tests/database/skin_profile_quiz_provenance.test.sql
 M supabase/tests/upgrade/health_consent_draft_successor_0070_upgrade.test.sql
?? apps/mobile/plugins/withLayerwellWidgetPrivacyManifest.js
?? docs/13-ask-layerwell-assistant.md
?? scripts/phase5/expo-widgets-56.0.23/LayerwellWidgetLifecycleStore.swift
?? scripts/phase5/expo-widgets-57.0.8/LayerwellWidgetLifecycleStore.swift
?? supabase/migrations/20260614000025_ask_layerwell.sql
?? tmp/imagegen/layerwell-icon-source.png
?? tmp/imagegen/layerwell-mark-magenta.png
?? tmp/imagegen/layerwell-mark.png
```

## Governed Evidence Chain

- Status: blocked
- Source S: BLOCKED
- Evidence E: BLOCKED
- Current R/F HEAD: fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f
- Selected RC: BLOCKED
- Ledger SHA-256: BLOCKED
- Ledger entries: 0
- Downstream generated commits: 0

## Verdict

Local beta coverage clear: no

This aggregate beta report cannot authorize CAT-03; CAT-03 separately requires the signed catalog-curation contract and privacy-minimized holdout report.

## Evidence

- Real beta data claimed: BLOCKED
- Catalog/beta dashboard evidence present: BLOCKED
- Analytics dashboard evidence present: BLOCKED
- Support dashboard evidence present: BLOCKED
- Exact source export digest present: BLOCKED
- Named signoff present: BLOCKED

## Metrics

| Metric | Value | Threshold | Status |
| --- | ---: | --- | --- |
| Completed beta users | n/a | 50-100 real target users | blocked |
| Users with 3+ products | n/a | all completed users | blocked |
| Average products per completed user | n/a | >= 3.00 | blocked |
| Barcode match rate | n/a | exercised and trended by category | blocked |
| Search success rate | n/a | no major category dead zone | blocked |
| OCR parse rate | n/a | low-confidence routed to review | blocked |
| Manual fallback completion | n/a | fallback saves exercised | blocked |
| Wrong-match report rate | n/a | <= 2% | blocked |
| Parser unknown-token rate | n/a | <= 15% | blocked |
| Below-usable products used in recs | n/a | 0 | blocked |
| Open P0/P1 support tickets | 0 | 0 | ok |

## Blockers

- Missing beta coverage input artifact. Set PHASE4_BETA_COVERAGE_INPUT or copy docs/phase-4/beta-coverage-input.template.json to docs/phase-4/beta-coverage-input.json and replace it with real beta exports.
- Governed evidence chain: governed beta evidence requires one lowercase source commit S
- Governed evidence chain: governed beta evidence requires one immutable selected RC

## Warnings

- Beta coverage report generated with a dirty Git worktree; do not use it as final beta evidence.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/beta-coverage-input.json | missing |  |  |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .gitignore | present | 1644 | 066737865fcf01e54f00ead1cd32e4cc46e3b8571ffc0bbf685113da5059469a |
| package.json | present | 44354 | af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e |
| docs/hugeToDo/launch-contract.json | present | 7174 | ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb |
| scripts/launch/contract.mjs | present | 15776 | 7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b |
| .env.example | present | 29662 | d9825f22149f8d15e491d4f1d97fbc8311ce739564a36e1f0ed0ecc64464e091 |
| scripts/phase4/build-source-worklist.mjs | present | 46184 | 28a02f5eadc7ea2fa54cc9995455a26e2a6a83db2821097ebe69549e7b11b640 |
| scripts/phase4/beta-coverage-report.mjs | present | 41079 | 7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 11135 | 5a0b2c40953c5a3ce641320d3df1b555872da27732d4c6b6da7bd2aba8234d7f |
| scripts/phase4/beta-coverage-packet-contract.mjs | present | 996 | 38ed4065cb51607fac1f82f8e371dd3ef487256602f5535312da0dbed9cc37a0 |
| scripts/phase4/beta-coverage-packet-contract.test.mjs | present | 867 | a4631af37fdc9bec17c89b0bc736fd3c7da871902aa4592b8cbb88e43196bfa1 |
| scripts/phase4/beta-coverage-committed-check.mjs | present | 10745 | 401a677c2d90ca7af566debf7bb7925ecbb9f6094732dd90ed0bc24d76704c00 |
| scripts/phase4/beta-coverage-committed-check.test.mjs | present | 9365 | f86658f38009adcfa1cd65a092684441a4f57f76c90814e44d2e3eed1767b7c6 |
| scripts/phase4/source-policy.mjs | present | 89435 | 75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634 |
| scripts/phase4/source-policy.test.mjs | present | 39730 | dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118 |
| scripts/phase4/catalog-curation-contract.mjs | present | 229778 | d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 114869 | 6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/catalog-qa-report.mjs | present | 27119 | c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09 |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 17375 | 70b44647b94c8e2dfded0b7afefbc0b91be3c4de1f8123950e66e412e88c7f2d |
| supabase/functions/catalog-report/index.ts | present | 10890 | 00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd |
| supabase/functions/catalog-report/privacy.ts | present | 6403 | e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec |
| supabase/functions/catalog-report/privacy.test.ts | present | 10228 | 31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d |
| supabase/functions/deno.lock | present | 2465 | b5f517baf0e4dc911925ec80d45b534367a3ed1e8c982cd89998da7e614d93b7 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| scripts/phase9/release-qa-integrity.mjs | present | 56470 | ff2f7724d4cc0bdd4058f76acb8c31ea3b4d2e80a1e1dba531066a1750b727db |
| scripts/phase9/release-qa-integrity.test.mjs | present | 35031 | dc21754b7660bf356633471ad8479a26626d7dad046b7876c2c39902c2831dec |
| scripts/launch/governed-evidence-chain.mjs | present | 64289 | e0ca8221da0ed5561fb68ae32c1eec28fc0291dd94518ddaeabb5e191c58ca1a |
| scripts/launch/governed-evidence-chain.test.mjs | present | 35870 | 93dc7808c2e81f47fa1e5fb317c60050932955a236d135467ae2bcdfb1e7fddd |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 18185 | 40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b |
| docs/phase-3/data-inventory.md | present | 60091 | b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c |
| docs/store-privacy-inventory.md | present | 41453 | daa7d558c44e3cb246623258a475d78577a6df43d27ec2c17d7022e37e8aea37 |
| docs/phase-4/beta-coverage-input.template.json | present | 2315 | 4def562c508626e3ad3c2e289d8cd454fe223ba560c85862e6dc78d53613a172 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24378 | eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5 |
| docs/phase-4/beta-coverage-report.md | present | 8829 | ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9406 | bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a |
| docs/phase-4/catalog-curation-review.template.json | present | 22645 | 90f7348843f623d30b142d27a59a3d93c33978f9d163c06eea0b78ca2bc8283a |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9252 | e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8237 | d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e |
| docs/phase-4/catalog-curation-release-runbook.md | present | 45248 | ddd36a968b4ef6f994fd4a9e5847a9ad4c2626a7f5d7057f4a1a92d1610d831e |
| docs/phase-4/generated/source-worklist.json | present | 157290 | 095b05b66bbfd6ca4facc1964ba9c555cf3606678bc949324346663049cf1686 |
| docs/phase-4/generated/source-worklist.md | present | 77098 | 4b81addec333f9191e2ab89ef8f932bc44f7632791c67b3129d98f724e366be3 |
| docs/phase-4/observability-dashboard.md | present | 5335 | ffc77c9c33712b2a7b81bf92103e9bc4e71237a60ed40cd96b3aaad7298f0949 |
| docs/phase-4/phase-4-exit-review.md | present | 13732 | f816d01e8ec61062144ed5fe8e85805e58147e775efb86d87a3107971bec92ed |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/migrations/20260718000059_catalog_scan_minimization.sql | present | 33319 | 46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 202040 | 2792fc6c16e7ce655d60a6edb229cf24bb0b61ec662b161ec8b55ac39eddb376 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 36707 | 1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36165 | 24fe6b485009f9733568b3e101c5278380d620e9a75894898a114a9f1670d6f3 |
| docs/phase-4/generated/catalog-qa-report.json | present | 24992 | 9120a517672bb55d7f9b0c5285e98f3d5515e245110c485a1c7ff128d08e6a01 |
| docs/phase-4/generated/catalog-qa-report.md | present | 12339 | 0669601a2cc956426bef64cafaa465ddba750a08a672eb6eec74889076c80ce7 |
| docs/phase-10/beta-event-schema.md | present | 15983 | b8d378bed2de90910be0932c60f6d526adfe55c4c1fc2ec21641ab04aba84e85 |
| docs/phase-10/catalog-beta-report.md | present | 1680 | 28729b9ed344c13414cb6426f0c5360ac21034641b5cd94298d8dbb391165d28 |
| docs/phase-10/support-beta-report.md | present | 2149 | f25c3841a8bc5649dbd1f38632c756898da46a5d7f4d59ff7c328726dc9d26ac |
| docs/phase-10/retention-activation-report.md | present | 2343 | e7c5ebd8d49c5bc527e4ea926743a2ede4eb33522e6fda28ec1deae00953f8ab |
