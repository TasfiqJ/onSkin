# Tas To Do Audit

Generated: 2026-07-08T21:43:28.489Z
Status: pass
Strict mode: yes

This generated audit checks that `docs/FOR_TAS_TO_DO.md` covers the
Tas-owned strict launch evidence gates and records the exact evidence keys
extracted from phase scripts and `.env.example`. Local generated-packet
outputs and source-contract markers are listed separately and excluded
from evidence warnings.
Strict mode fails when a phase gate is no longer covered by the founder
handoff doc; exact key omissions are warnings because the generated
inventory itself is the canonical machine-readable key list.

## Summary

- Gate groups: 10
- Covered gate groups: 10
- Extracted keys: 233
- Local generated-only keys excluded: 10
- Keys named verbatim in FOR_TAS_TO_DO.md: 56
- Keys only in generated inventory: 177
- Blockers: 0
- Warnings: 8

## Gate Coverage

| Gate    | FOR_TAS coverage | Package script evidence                                    | Keys | Keys only in generated inventory |
| ------- | ---------------- | ---------------------------------------------------------- | ---- | -------------------------------- |
| phase2  | yes              | phase2:check-env:strict, phase2:rls-smoke                  | 53   | 40                               |
| phase3  | yes              | phase3:audit-copy:strict                                   | 0    | 0                                |
| phase4  | yes              | phase4:check-source-env:strict                             | 11   | 5                                |
| phase5  | yes              | phase5:check-native-config:strict, phase5:qa-packet:strict | 20   | 0                                |
| phase6  | yes              | phase6:check-payments-env:strict, phase6:qa-packet:strict  | 18   | 14                               |
| phase7  | yes              | phase7:check-core-loop:strict, phase7:qa-packet:strict     | 29   | 16                               |
| phase8  | yes              | phase8:check-growth-store:strict, phase8:qa-packet:strict  | 19   | 19                               |
| phase9  | yes              | phase9:verify, phase9:release-smoke:strict                 | 53   | 53                               |
| phase10 | yes              | phase10:verify, phase10:beta-readiness:strict              | 15   | 15                               |
| phase11 | yes              | phase11:verify, phase11:launch-readiness:strict            | 15   | 15                               |

## Extracted Evidence Keys

### Phase 2 environment and RLS

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                   | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------------- | ------------------------- |
| APP_VARIANT                                     | yes                       |
| APPLE_SIWA_CLIENT_ID                            | no                        |
| APPLE_SIWA_KEY_ID                               | no                        |
| APPLE_SIWA_PRIVATE_KEY                          | no                        |
| APPLE_SIWA_SERVICE_ID                           | no                        |
| APPLE_TEAM_ID                                   | no                        |
| BRAND_LEGAL_CLEARANCE                           | yes                       |
| EXPO_PUBLIC_ACCOUNT_DELETION_URL                | yes                       |
| EXPO_PUBLIC_APP_DISPLAY_NAME                    | no                        |
| EXPO_PUBLIC_APP_ENV                             | no                        |
| EXPO_PUBLIC_APP_SCHEME                          | no                        |
| EXPO_PUBLIC_APP_STORE_URL                       | yes                       |
| EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL         | yes                       |
| EXPO_PUBLIC_DATA_EXPORT_URL                     | yes                       |
| EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID                | no                        |
| EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME               | no                        |
| EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID                | no                        |
| EXPO_PUBLIC_POSTHOG_HOST                        | no                        |
| EXPO_PUBLIC_POSTHOG_KEY                         | no                        |
| EXPO_PUBLIC_PRIVACY_URL                         | yes                       |
| EXPO_PUBLIC_REVENUECAT_ANDROID_KEY              | no                        |
| EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID        | yes                       |
| EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID           | no                        |
| EXPO_PUBLIC_REVENUECAT_IOS_KEY                  | no                        |
| EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID       | yes                       |
| EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID | yes                       |
| EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY           | no                        |
| EXPO_PUBLIC_SENTRY_DSN                          | no                        |
| EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY            | no                        |
| EXPO_PUBLIC_SUPABASE_URL                        | no                        |
| EXPO_PUBLIC_SUPPORT_EMAIL                       | yes                       |
| EXPO_PUBLIC_SUPPORT_URL                         | yes                       |
| EXPO_PUBLIC_TERMS_URL                           | yes                       |
| EXPO_PUBLIC_TURNSTILE_SITE_KEY                  | no                        |
| PHASE2_ALLOW_PRODUCTION_SMOKE                   | no                        |
| POSTHOG_API_HOST                                | no                        |
| POSTHOG_DELETION_APPROVED_ALTERNATE             | no                        |
| POSTHOG_PERSONAL_API_KEY                        | no                        |
| POSTHOG_PROJECT_ID                              | no                        |
| REVENUECAT_SECRET_API_KEY                       | no                        |
| REVENUECAT_WEBHOOK_AUTH                         | no                        |
| REVENUECAT_WEBHOOK_MAX_BYTES                    | no                        |
| REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS  | no                        |
| REVENUECAT_WEBHOOK_SIGNING_SECRET               | no                        |
| SENTRY_AUTH_TOKEN                               | no                        |
| SENTRY_ORG                                      | no                        |
| SENTRY_PROJECT                                  | no                        |
| SUPABASE_ANON_KEY                               | no                        |
| SUPABASE_PROJECT_REF                            | no                        |
| SUPABASE_PUBLISHABLE_KEY                        | no                        |
| SUPABASE_SECRET_KEY                             | no                        |
| SUPABASE_SERVICE_ROLE_KEY                       | no                        |
| SUPABASE_URL                                    | no                        |

Local generated-only keys excluded from evidence warnings: none.

### Phase 3 legal and reviewer signoff

Covered by `docs/FOR_TAS_TO_DO.md`: yes

- No machine-detected external evidence keys in this group.

Local generated-only keys excluded from evidence warnings: PHASE3_REVIEW_PACKET_OUT_DIR

### Phase 4 catalog source posture

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                     | Named in FOR_TAS_TO_DO.md |
| --------------------------------- | ------------------------- |
| CATALOG_APP_NAME                  | yes                       |
| CATALOG_APP_VERSION               | yes                       |
| CATALOG_ATTRIBUTION_URL           | yes                       |
| CATALOG_CONTACT_EMAIL             | yes                       |
| CATALOG_RATE_LIMIT_MAX            | no                        |
| CATALOG_RATE_LIMIT_WINDOW_SECONDS | no                        |
| OBF_API_ENABLED                   | no                        |
| OBF_CONTRIBUTION_ENABLED          | no                        |
| OBF_USER_AGENT                    | yes                       |
| PHASE4_BETA_COVERAGE_INPUT        | yes                       |
| PHASE4_BETA_COVERAGE_REPORT       | no                        |

Local generated-only keys excluded from evidence warnings: none.

### Phase 5 native build and device QA

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                          | Named in FOR_TAS_TO_DO.md |
| -------------------------------------- | ------------------------- |
| PHASE5_ACCESSIBILITY_QA_PASS           | yes                       |
| PHASE5_ANDROID_BUILD_ID                | yes                       |
| PHASE5_ANDROID_DEVICE                  | yes                       |
| PHASE5_BARCODE_QA_PASS                 | yes                       |
| PHASE5_CAMERA_PERMISSION_QA_PASS       | yes                       |
| PHASE5_DEVICE_QA_PASS                  | yes                       |
| PHASE5_ENCRYPTED_PHOTO_STORAGE_QA_PASS | yes                       |
| PHASE5_INSTALL_QA_PASS                 | yes                       |
| PHASE5_IOS_BUILD_ID                    | yes                       |
| PHASE5_IOS_DEVICE                      | yes                       |
| PHASE5_LABEL_CAPTURE_QA_PASS           | yes                       |
| PHASE5_NATIVE_OCR_QA_PASS              | yes                       |
| PHASE5_NOTIFICATION_QA_PASS            | yes                       |
| PHASE5_PROGRESS_PHOTO_QA_PASS          | yes                       |
| PHASE5_QA_SIGNOFF                      | yes                       |
| PHASE5_REVENUECAT_NATIVE_QA_PASS       | yes                       |
| PHASE5_SENTRY_NATIVE_QA_PASS           | yes                       |
| PHASE5_SHARE_SHEET_QA_PASS             | yes                       |
| PHASE5_SIGNED_OFF_BY                   | yes                       |
| PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE5_QA_PACKET_OUT_DIR

### Phase 6 payments and RevenueCat

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                   | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------------- | ------------------------- |
| EXPO_PUBLIC_REVENUECAT_ANDROID_KEY              | no                        |
| EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID        | yes                       |
| EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID           | no                        |
| EXPO_PUBLIC_REVENUECAT_IOS_KEY                  | no                        |
| EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID       | yes                       |
| EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID | yes                       |
| EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY           | no                        |
| PHASE6_ANDROID_LICENSE_TEST_PASS                | no                        |
| PHASE6_FINANCE_SIGNOFF                          | no                        |
| PHASE6_IOS_SANDBOX_RESTORE_PASS                 | no                        |
| PHASE6_RC_OFFERING_REVIEWED                     | no                        |
| PHASE6_SIGNED_OFF_BY                            | yes                       |
| PHASE6_WEBHOOK_HMAC_TEST_PASS                   | no                        |
| REVENUECAT_SECRET_API_KEY                       | no                        |
| REVENUECAT_WEBHOOK_AUTH                         | no                        |
| REVENUECAT_WEBHOOK_MAX_BYTES                    | no                        |
| REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS  | no                        |
| REVENUECAT_WEBHOOK_SIGNING_SECRET               | no                        |

Local generated-only keys excluded from evidence warnings: PHASE6_PACKET_OUT_DIR

### Phase 7 core loop launch gates

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                          | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------------------ | ------------------------- |
| EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED                   | no                        |
| EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED                    | no                        |
| EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED           | no                        |
| EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED | no                        |
| EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED   | no                        |
| EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED                  | no                        |
| EXPO_PUBLIC_PHASE7_TREND_ENABLED                       | no                        |
| EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED                     | no                        |
| PHASE7_ANALYTICS_QA_PASS                               | yes                       |
| PHASE7_BETA_DASHBOARD_READY                            | no                        |
| PHASE7_BRAND_READY                                     | no                        |
| PHASE7_CATALOG_BETA_IMPORT_PASS                        | no                        |
| PHASE7_CLINICAL_REVIEW_PASS                            | no                        |
| PHASE7_DEFERRED_SURFACES_QA_PASS                       | yes                       |
| PHASE7_DEVICE_QA_PASS                                  | no                        |
| PHASE7_ONBOARDING_CONSENT_QA_PASS                      | yes                       |
| PHASE7_PAYMENTS_LIFECYCLE_QA_PASS                      | yes                       |
| PHASE7_PHOTOS_PRIVACY_QA_PASS                          | yes                       |
| PHASE7_PRIVACY_CONTROLS_QA_PASS                        | yes                       |
| PHASE7_PRIVACY_EXPORT_DELETE_PASS                      | no                        |
| PHASE7_REMINDERS_QA_PASS                               | yes                       |
| PHASE7_REVENUECAT_QA_PASS                              | no                        |
| PHASE7_REVIEWED_GUIDANCE_QA_PASS                       | yes                       |
| PHASE7_ROUTINE_BUILDER_QA_PASS                         | yes                       |
| PHASE7_SHARE_CARD_QA_PASS                              | yes                       |
| PHASE7_SHELF_INTAKE_QA_PASS                            | yes                       |
| PHASE7_SIGNED_OFF_BY                                   | yes                       |
| PHASE7_SUPABASE_RLS_PASS                               | no                        |
| PHASE7_TODAY_CHECKOFF_QA_PASS                          | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE7_PACKET_OUT_DIR

### Phase 8 growth and store readiness

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                               | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------- | ------------------------- |
| ANDROID_CERT_SHA256_FINGERPRINTS            | no                        |
| APPLE_TEAM_ID                               | no                        |
| EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED    | no                        |
| EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED | no                        |
| EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED     | no                        |
| EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED    | no                        |
| PHASE8_ANDROID_APP_LINKS_PASS               | no                        |
| PHASE8_APP_STORE_PACKET_PASS                | no                        |
| PHASE8_ATTRIBUTION_PRIVACY_PASS             | no                        |
| PHASE8_BRAND_SOURCE_OF_TRUTH_PASS           | no                        |
| PHASE8_CREATOR_COMPLIANCE_PASS              | no                        |
| PHASE8_DOMAIN_DNS_PASS                      | no                        |
| PHASE8_DRY_RUN_PASS                         | no                        |
| PHASE8_IOS_UNIVERSAL_LINKS_PASS             | no                        |
| PHASE8_LAUNCH_DASHBOARD_READY               | no                        |
| PHASE8_PLAY_STORE_PACKET_PASS               | no                        |
| PHASE8_SHARE_CARD_DEVICE_QA_PASS            | no                        |
| PHASE8_SIGNED_OFF_BY                        | no                        |
| PHASE8_SUPPORT_RESPONSE_PASS                | no                        |

Local generated-only keys excluded from evidence warnings: PHASE8_PACKET_OUT_DIR, PHASE8_STORE_METADATA_PACKET

### Phase 9 release engineering

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                     | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------------- | ------------------------- |
| PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT   | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL   | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS          | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH            | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL    | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS         | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK   | no                        |
| PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL | no                        |
| PHASE9_ANDROID_16KB_PASS                          | no                        |
| PHASE9_ANDROID_ARTIFACT                           | no                        |
| PHASE9_ANDROID_CLOSED_TEST_PASS                   | no                        |
| PHASE9_ANDROID_TARGET_API_PASS                    | no                        |
| PHASE9_APP_STORE_PACKET_PASS                      | no                        |
| PHASE9_BETA_EVIDENCE_PASS                         | no                        |
| PHASE9_CATALOG_RATE_LIMIT_PASS                    | no                        |
| PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX               | no                        |
| PHASE9_CONSENT_WITHDRAWAL_PASS                    | no                        |
| PHASE9_DATA_EXPORT_DELETE_PASS                    | no                        |
| PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX           | no                        |
| PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK        | no                        |
| PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS | no                        |
| PHASE9_DEPENDENCY_AUDIT_PASS                      | no                        |
| PHASE9_DEVICE_QA_PASS                             | no                        |
| PHASE9_EDGE_AUTH_PASS                             | no                        |
| PHASE9_FINAL_IDENTITY_PASS                        | no                        |
| PHASE9_INCIDENT_RESPONSE_PASS                     | no                        |
| PHASE9_IOS_ARTIFACT                               | no                        |
| PHASE9_IOS_PRIVACY_REPORT_PASS                    | no                        |
| PHASE9_IOS_TESTFLIGHT_PASS                        | no                        |
| PHASE9_LIVE_SUPABASE_PASS                         | no                        |
| PHASE9_OBSERVABILITY_PAYLOAD_PASS                 | no                        |
| PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED       | no                        |
| PHASE9_ORDER_REPORT_POLL_PASS                     | no                        |
| PHASE9_PLAY_PACKET_PASS                           | no                        |
| PHASE9_PUBLIC_FORMS_PASS                          | no                        |
| PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX          | no                        |
| PHASE9_REVENUECAT_NATIVE_QA_PASS                  | no                        |
| PHASE9_REVENUECAT_WEBHOOK_PASS                    | no                        |
| PHASE9_RLS_PRODUCTION_PASS                        | no                        |
| PHASE9_RLS_STAGING_PASS                           | no                        |
| PHASE9_ROLLBACK_DRILL_PASS                        | no                        |
| PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT                | no                        |
| PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL                | no                        |
| PHASE9_RUN_LIVE_DATA_RIGHTS                       | no                        |
| PHASE9_RUN_LIVE_EDGE_AUTH                         | no                        |
| PHASE9_RUN_LIVE_ORDER_REPORT_POLL                 | no                        |
| PHASE9_RUN_LIVE_PUBLIC_FORMS                      | no                        |
| PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK                | no                        |
| PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL              | no                        |
| PHASE9_RUN_LIVE_SUPABASE_CHECK                    | no                        |
| PHASE9_RUN_NPM_AUDIT                              | no                        |
| PHASE9_SIGNED_OFF_BY                              | no                        |
| PHASE9_TURNSTILE_VALID_TOKEN                      | no                        |

Local generated-only keys excluded from evidence warnings: PHASE9_PACKET_OUT_DIR, PHASE9_RELEASE_CANDIDATE_DIR

### Phase 10 closed beta

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                             | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------- | ------------------------- |
| PHASE10_BETA_IDENTITY_PASS                | no                        |
| PHASE10_BETA_TERMS_PASS                   | no                        |
| PHASE10_CATALOG_BETA_PASS                 | no                        |
| PHASE10_DASHBOARDS_PASS                   | no                        |
| PHASE10_PAYMENT_QA_PASS                   | no                        |
| PHASE10_PHASE9_BETA_CANDIDATE_PASS        | no                        |
| PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED | no                        |
| PHASE10_PLAY_CLOSED_TEST_READY            | no                        |
| PHASE10_PRIVACY_PAYLOAD_PASS              | no                        |
| PHASE10_PUBLIC_LAUNCH_DECISION            | no                        |
| PHASE10_RECRUITING_PASS                   | no                        |
| PHASE10_RETENTION_REPORT_PASS             | no                        |
| PHASE10_SIGNED_OFF_BY                     | no                        |
| PHASE10_SUPPORT_DESK_PASS                 | no                        |
| PHASE10_TESTFLIGHT_READY                  | no                        |

Local generated-only keys excluded from evidence warnings: PHASE10_PACKET_OUT_DIR

### Phase 11 public launch

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                   | Named in FOR_TAS_TO_DO.md |
| ------------------------------- | ------------------------- |
| PHASE11_ASO_REVIEW_PASS         | no                        |
| PHASE11_CREATOR_DISCLOSURE_PASS | no                        |
| PHASE11_INCIDENT_ROLLBACK_PASS  | no                        |
| PHASE11_MONITORING_PASS         | no                        |
| PHASE11_PHASE10_EXIT_PASS       | no                        |
| PHASE11_PHASE9_RC_SIGNOFF_PASS  | no                        |
| PHASE11_PRODUCTION_ENV_PASS     | no                        |
| PHASE11_REVENUE_RECON_PASS      | no                        |
| PHASE11_REVENUECAT_PROD_PASS    | no                        |
| PHASE11_RING0_PASS              | no                        |
| PHASE11_RING1_72H_REPORT_PASS   | no                        |
| PHASE11_SIGNED_OFF_BY           | no                        |
| PHASE11_STORE_APPROVAL_PASS     | no                        |
| PHASE11_SUPPORT_READY           | no                        |
| PHASE11_WEEK1_DECISION_PASS     | no                        |

Local generated-only keys excluded from evidence warnings: PHASE11_PACKET_OUT_DIR

## Blockers

- None.

## Warnings

- Phase 2 environment and RLS has 40 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 4 catalog source posture has 5 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 6 payments and RevenueCat has 14 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 7 core loop launch gates has 16 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 8 growth and store readiness has 19 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 9 release engineering has 53 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 10 closed beta has 15 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
- Phase 11 public launch has 15 extracted key(s) not named verbatim in docs/FOR_TAS_TO_DO.md; see generated audit inventory.
