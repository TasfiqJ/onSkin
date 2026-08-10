# Catalog QA Report

Generated: 2026-08-10T01:37:26.506Z

Source: open_beauty_facts

Transform status: fixture

Git SHA: fa0aa21c1fa2020a3e2a9624daf4051f4564dd8f

Build-source Git SHA: not verified

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
 M docs/phase-4/odbl-compliance-memo.md
 M docs/phase-5/camera-lifecycle-evidence-runbook.md
 M docs/phase-5/device-qa-checklist.md
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

Records: 2

Rejected records: 1

Blockers: none

Warnings: Catalog QA report generated with a dirty Git worktree; do not use it as final catalog-source evidence.

Local QA clear: no

Launch clear: no

Launch clear reason: No. Source-transform QA is only one gate; launch still requires final source identity/legal evidence, curated record review, beta coverage, signed binary/device evidence, deployment, and named signoff.

## Input Artifact

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| docs/phase-4/generated/obf-fixture-import.json | present | 4077 | 12927fe64f0ad7d7c6eb59587374cc9c100ca90f9f3fe233a9e213db450f2e0d |

## Source Hashes

| Path | Status | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| .gitignore | present | 1644 | 066737865fcf01e54f00ead1cd32e4cc46e3b8571ffc0bbf685113da5059469a |
| .github/workflows/quality.yml | present | 11261 | d3466b03129824af69bdfac9e5958001705b59bd052cefcfd3ad5699dccf0d99 |
| package.json | present | 44354 | af6cec1697c363daf266bcd4032a184aa9a994a51cc6a8c0991da4c67b0d8c8e |
| package-lock.json | present | 607493 | c7d3880abf0211eadd0644ee2531fbba507d8661ed379c8cead68095c7bd1318 |
| apps/mobile/app.config.js | present | 19140 | 81851010e4eb58d23f8e61ca270d979776390f3607d4a6afdf6106936756eb5c |
| apps/mobile/app.base.json | present | 4105 | 66fc0841d96e53d8d5eb4a789fe3afd87b4425882b250e1ccc56218390322fc6 |
| apps/mobile/eas.json | present | 1636 | c66faf6c37639471d73e0c168622534210d4f074cce1265d05e443e8b4a9bb04 |
| apps/mobile/package.json | present | 2895 | ec8cadff66f59066df4e91e59ac04dc035568bf2fdaabadb7f2f07542531d248 |
| apps/mobile/phase3-review-evidence.js | present | 28497 | e6dbe67277b536a4cf3e6ba5eb3e3682d2caffe455c624088890e862b2796c93 |
| docs/hugeToDo/launch-contract.json | present | 7174 | ef6a34e9e8de58380296f08473211f4915ab81817cde4ee5394f6210f08ca3bb |
| scripts/launch/contract.mjs | present | 15776 | 7bec15c6d8aa7a5f744e094fa74c84969b6b09eeb23d97e94e05498315d5708b |
| scripts/phase4/catalog-qa-report.mjs | present | 27119 | c01d9bc01c8db0951d8113cf74e53bea1e67e4d9145406e85098cfbdd032bf09 |
| scripts/phase4/build-source-worklist.mjs | present | 46184 | 28a02f5eadc7ea2fa54cc9995455a26e2a6a83db2821097ebe69549e7b11b640 |
| scripts/phase4/beta-coverage-report.mjs | present | 41079 | 7bb1ba8b05f90f7fe3c80a23cc30dfc790d7999cb0e37db421cb71e3bdfec7a1 |
| scripts/phase4/beta-coverage-report-smoke.mjs | present | 11135 | 5a0b2c40953c5a3ce641320d3df1b555872da27732d4c6b6da7bd2aba8234d7f |
| scripts/phase4/catalog-curation-contract.mjs | present | 229778 | d5b6565b893b8815eb29ffc5b50665684c86541b0f7580d2a0f80c2db8b56221 |
| scripts/phase4/catalog-curation-contract.test.mjs | present | 114869 | 6f0bb1578661a3951bf4b4b370c003debe0f3d2505439077c91119e7d1d28c3c |
| scripts/phase4/build-catalog-curation-envelope.mjs | present | 4096 | d31aa8d2bea0d2640ac4b343bf91261446aafc3155a9e7ce74e4f9406c760bd5 |
| scripts/phase4/catalog-coverage-quality-report.mjs | present | 5480 | f5fc81ea9f2d31fcec3185fed837634506c89197f7f51777f0c174fa1ab17216 |
| scripts/phase4/catalog-coverage-quality-report.test.mjs | present | 6586 | 616881a177d87b435f75ec39dfbe01eb2bc8dd4d91ff25b50da6c6a776dbb204 |
| scripts/phase4/import-obf-snapshot.mjs | present | 13213 | f9ed4016fb912e0d406e18d85654d3995ba3a6395a64de4516c50018e2d3f64d |
| scripts/phase4/import-cosing-dictionary.mjs | present | 13351 | 470016b20d8e5ecb4be94fb83d891c051cb10f42d702d60cde284466579da47a |
| scripts/phase4/import-fixture-smoke.mjs | present | 22473 | b1999dcd1f340a3c5f792d0293834819d74390e7956c980484cc83df5055a0eb |
| scripts/phase4/check-source-env.mjs | present | 2989 | ad8eaa253c3dd97fd6ea09a1cdbf11fb1aec96212a90a610e690a74981989a1a |
| scripts/phase4/check-source-env-smoke.mjs | present | 3923 | 7f885f3b96e55ee46767b4559a20d108a742f36f5dde42993fe5e8a822f69edf |
| scripts/phase4/catalog-qa-report-smoke.mjs | present | 17375 | 70b44647b94c8e2dfded0b7afefbc0b91be3c4de1f8123950e66e412e88c7f2d |
| scripts/phase4/catalog-promotion-contract.mjs | present | 126852 | 3cae46f65c8f8d5eeff4a66f41d3caa4a945f75c91ffb047ce48a4875319f6c6 |
| scripts/phase4/catalog-promotion-contract.test.mjs | present | 70690 | 0416507f84fe584ca8d68d25b4daaf0775f0dad2aef3063e5fa30ca1346d12d5 |
| scripts/phase4/build-catalog-stage-envelope.mjs | present | 619 | cc36fcee8961ab7239ccc606342253acf9cf7c1d2c5daf6910b56da93eefb2f6 |
| scripts/phase4/complete-catalog-database-receipts.mjs | present | 705 | f73f48b6ee641e7ae05bfeb0de2e4b2ced73492f838bbc94470a03f2f3db41df |
| scripts/phase4/catalog-source-policy-audit.mjs | present | 8633 | f477b1bcaa8b6b7997cded65b63c21e7dbfc23a3c75d169720961f5eb3b6879c |
| scripts/phase4/source-policy.mjs | present | 89435 | 75242c44fe3ff9e46472647fbcfb9d59070a1306fb4638ae106117a30c9cc634 |
| scripts/phase4/source-policy.test.mjs | present | 39730 | dedc9ebdb80bb022e9f0ad4769c369a4641fbfc03993a4d892ff7f3406659118 |
| scripts/phase2/local-supabase-contract.mjs | present | 53244 | f104824ecde526d55740a72515422b78faec7243afe8b58219c984fd1f6b4c21 |
| scripts/phase2/local-supabase-reset.mjs | present | 31421 | ab82044b8ed913f17efb1593a4968e6c7599a8b6016160f9c000b3b87ae18432 |
| scripts/phase9/lib.mjs | present | 22873 | 2432468891aa67b138785021580caadcc27ab5d1c7aca8c5015e1ddc531d021c |
| scripts/phase9/rls-adversarial-smoke.mjs | present | 12932 | 3674c5483fb6517b718ddcda2da5841923289ec47bf71206d369535136721d40 |
| scripts/phase9/supabase-function-acl.test.mjs | present | 3485 | 15bb9b38166c18e0682735d6854c91609b0a91f07dc4889a33d750cda886a3fc |
| scripts/phase9/supabase-policy-lint.mjs | present | 18126 | 6da0337e9605b44b1f2020f326626e7250644c9eafc3e285166819039211bef6 |
| supabase/migrations/20260614000026_phase4_catalog.sql | present | 35096 | c7f7dccd5fee51d855048dfcf8892fa1fceaed94dd7c4193fa2005327d4eef4d |
| supabase/migrations/20260717000056_catalog_serving_eligibility_gate.sql | present | 34119 | 0d4543effd4eb5c6d5e036b96d777b217bf853fb0c9587575429a28f14d7793c |
| supabase/migrations/20260717000057_catalog_import_lifecycle.sql | present | 144722 | 926ba3a453bbe46e8ba97167049f5dda1fb22a59248dee1b9a216d4cc30b7ce7 |
| supabase/migrations/20260717000058_catalog_launch_curation.sql | present | 295282 | f2d53caad23347103e29b0f5660eefdbdd22bfdc05cc2cb47445ece4192919a6 |
| supabase/migrations/20260718000059_catalog_scan_minimization.sql | present | 33319 | 46c3128d68dccb17b50e28363c478ec7de032a180faf3a5298b0620bfe6e81ec |
| supabase/migrations/20260718000060_cat07_truthful_freshness.sql | present | 24465 | 8bc2c35bfff443a3c3bf7ab76e52ed17e7d6b961a8b35bdde17701de5c7f574a |
| supabase/migrations/20260722000061_catalog_import_benzoyl_review_override.sql | present | 28316 | 4048342265ef103e6915411494911a98485528707c7413555725ba4ff427c1e9 |
| supabase/migrations/20260722000062_catalog_curation_statement_guard.sql | present | 53193 | f7bba7300939fd1f95247c464c49cc01544684637ff25d66076f137475ef9ef1 |
| scripts/phase9/catalog-import-0061-upgrade-postgres-rehearsal.sql | present | 28021 | b1d3464bc9b20a6bc432082b8b01832b980ea231338427fa1e187c238dcd7919 |
| scripts/phase9/catalog-curation-0062-upgrade-postgres-rehearsal.sql | present | 22993 | 64102fcd36e69ff58ab957c94866e215f2f72900758bc98926a46057230e45e9 |
| supabase/tests/database/schema_contract.test.sql | present | 36211 | e8fb6e8cc5e395bd5456ffe09009196495be43875821ebec89e31d3bb833e351 |
| supabase/tests/database/catalog_import_lifecycle.test.sql | present | 109814 | d543af34e2559d938a12ba4741181f170e3c04fa678c93c411f911118ef2a899 |
| supabase/tests/database/catalog_launch_curation.test.sql | present | 202040 | 2792fc6c16e7ce655d60a6edb229cf24bb0b61ec662b161ec8b55ac39eddb376 |
| supabase/tests/database/catalog_serving_gate.test.sql | present | 36707 | 1e9e54227161be38e27e2263aab27ec16aeb2ef4ead2316f0dc9daafd12879d9 |
| supabase/tests/database/cat07_truthful_freshness.test.sql | present | 36165 | 24fe6b485009f9733568b3e101c5278380d620e9a75894898a114a9f1670d6f3 |
| supabase/functions/catalog-lookup/index.ts | present | 11843 | 23e76d1ba0fd1e199be94986fb0e066e7e4cc6b64d04c642bdd1fb849c97b220 |
| supabase/functions/catalog-lookup/catalogContract.ts | present | 80 | 9707c48c48465b279c2112d84a8a1459867c395490d3c184aaa4e6c2fbc7f81a |
| supabase/functions/catalog-lookup/catalogContract.test.ts | present | 14681 | 96ab5dd088984ce67115b993e84436205ebb1bfabee25ea2d60558e7eea85f46 |
| supabase/functions/catalog-search/index.ts | present | 10142 | b7187fee6fe8981d42219de31d1358d11db16bb8f40be530c4d2f838e5400494 |
| supabase/functions/catalog-search/catalogContract.ts | present | 1343 | 62cc1e0d2e62d37187922e4ed1766b12d8ca8aa48cdebf3e3271ea6ae7ce417e |
| supabase/functions/catalog-search/catalogContract.test.ts | present | 3041 | dd91fb0c009da68074d795d7819149d9bb970e47c2fba6bbdfc7a08f7f53922d |
| supabase/functions/catalog-report/index.ts | present | 10890 | 00c15af1cac9a9cda6514d5c441b4c0b2420959a24727d697f7dce9ab8c4acbd |
| supabase/functions/catalog-report/privacy.ts | present | 6403 | e81dfbdafe784f79503fc4ad03487040f6e2725fe63f5000df77d944c3e28eec |
| supabase/functions/catalog-report/privacy.test.ts | present | 10228 | 31411acef464f8e0dda16605ee3f0af769163f67ea920ae5c1f6156ee4508f1d |
| supabase/functions/deno.lock | present | 2465 | b5f517baf0e4dc911925ec80d45b534367a3ed1e8c982cd89998da7e614d93b7 |
| docs/FOR_TAS_TO_DO.md | present | 11239 | 11b6df522e34a3b1a3ad8e130cf07345a8e91059efee6f4399d27360026c2825 |
| docs/phase-3/consent-matrix.md | present | 18185 | 40c6e5537e138b7c8206baef6fca6be6cafb819813d13771793d8a5ca2fd716b |
| docs/phase-3/data-inventory.md | present | 60091 | b5e153f31311d3fa7af2dd16f553f05624b09e27da5d2ed10e44a5018a14aa5c |
| docs/store-privacy-inventory.md | present | 41453 | daa7d558c44e3cb246623258a475d78577a6df43d27ec2c17d7022e37e8aea37 |
| docs/phase-4/beta-coverage-report.md | present | 8829 | ec85aa2775e5c9075bf3d72137cca06e955720aa80c3b807137ab6a7671f6c05 |
| docs/phase-4/beta-shelf-corpus.template.json | present | 24378 | eab0f3ab1ac78f53307b69976163c9edd07350a7fdc5dd52c05cb7c3b40106d5 |
| docs/phase-4/catalog-coverage-quality-targets.template.json | present | 9406 | bd6a316f1d520cee3d5ef347d82bff445cbf810b0ca5c8a551b0c13a083dca7a |
| docs/phase-4/catalog-curation-review.template.json | present | 22645 | 90f7348843f623d30b142d27a59a3d93c33978f9d163c06eea0b78ca2bc8283a |
| docs/phase-4/catalog-cat02-membership-proof.template.json | present | 9252 | e4bf0f76e0ca82047ffe90700a768ddd12d79d0199da1522369f51a48a67e9d7 |
| docs/phase-4/catalog-curation-database-readback.template.json | present | 8237 | d2a01a45d7af0d2cf428a144d589a916b1d2089ab1fa809502a0bcb694ac317e |
| docs/phase-4/catalog-curation-release-runbook.md | present | 45248 | ddd36a968b4ef6f994fd4a9e5847a9ad4c2626a7f5d7057f4a1a92d1610d831e |
| docs/phase-4/catalog-release-scope.json | present | 341 | 2d02ca4376b1e92ce37901ac67fd0b6dcb05c3a3f8525c881a6925bc68ffb0df |
| docs/phase-4/catalog-release-build-evidence.json | present | 481 | c0b7b51ad2e3e2fd864d25d2ae46b451d6cae1a1e1768d983c168c192dab4254 |
| docs/phase-4/catalog-source-memo-cosing.md | present | 6702 | 409a010aaded56dce8e2053ce0356563516dde14e0494ee5b5697fa514cffbc3 |
| docs/phase-4/catalog-source-memo-open-beauty-facts.md | present | 11067 | 9292f4afe465be4e442ea87b88ff0830ac91d2e00554c0c85b04accd0044f869 |
| docs/phase-4/catalog-import-promotion-runbook.md | present | 21318 | b1ad369694bc97948ec3d670ce3724196d7481d9d23993bb7bdcb64ecf32092b |
| docs/phase-4/catalog-source-policy.json | present | 7249 | 55c5ae5c64f52cd8a7d9e2ed94a6e878d9deeb42e8c6c16edc721e08bf8781a4 |
| docs/phase-4/catalog-source-trust-registry.json | present | 235 | 13a7f7ca9ac84b31351d1f343bd7e67117fec9b46fa66d60f6c3bdd98e70e824 |
| docs/phase-4/obf-source-approval.template.json | present | 8479 | 9ffa7441d5d9efbf3662aef4509cf9c5cf21b66e296ce07838acaf9fe25ede15 |
| docs/phase-4/cosing-source-approval.template.json | present | 8088 | 05ccfb90c2f7a3eed49571b1fc7d4b87fde28186d644d6cb53671456b7ba5fd3 |
| docs/phase-4/odbl-compliance-memo.md | present | 5347 | fb3d57b6b93b22aa87dc34434cdbf6cafec134458d5704ea70bcb8cff03ce755 |
| docs/phase-4/phase-4-exit-review.md | present | 13732 | f816d01e8ec61062144ed5fe8e85805e58147e775efb86d87a3107971bec92ed |
