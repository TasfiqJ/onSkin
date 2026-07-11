# Tas To Do Audit

Generated: 2026-07-11T16:53:07.147Z
Status: pass
Strict mode: yes

This generated audit checks that `docs/FOR_TAS_TO_DO.md` covers the
Tas-owned strict launch evidence gates, current device support floors,
and records the exact evidence keys extracted from phase scripts and
`.env.example`. Local generated-packet
outputs and source-contract markers are listed separately and excluded
from evidence warnings.
Strict mode fails when a phase gate is no longer covered by the founder
handoff doc; exact key omissions are warnings because the generated
inventory itself is the canonical machine-readable key list.

## Summary

- Gate groups: 10
- Covered gate groups: 10
- Extracted keys: 239
- Local generated-only keys excluded: 15
- Keys named verbatim in FOR_TAS_TO_DO.md: 239
- Keys only in generated inventory: 0
- Blockers: 0
- Warnings: 0

## Handoff Freshness

- FOR_TAS date: 2026-07-10
- Expected evidence date: 2026-07-10
- Device support policy: `docs/DEVICE_SUPPORT_POLICY.md`
- Required FOR_TAS support-floor details: `docs/DEVICE_SUPPORT_POLICY.md`, `iOS 17.0+`, `Android 10 / API 29+`, `360 x 640`, `API 36`
- Required policy support-floor details: `iOS 17.0+`, `Android 10 / API 29+`, `360 x 640`, `API 36`

## Gate Coverage

| Gate    | FOR_TAS coverage | Package script evidence                                    | Keys | Keys only in generated inventory |
| ------- | ---------------- | ---------------------------------------------------------- | ---- | -------------------------------- |
| phase2  | yes              | phase2:check-env:strict, phase2:rls-smoke                  | 53   | 0                                |
| phase3  | yes              | phase3:audit-copy:strict                                   | 3    | 0                                |
| phase4  | yes              | phase4:check-source-env:strict                             | 11   | 0                                |
| phase5  | yes              | phase5:check-native-config:strict, phase5:qa-packet:strict | 21   | 0                                |
| phase6  | yes              | phase6:check-payments-env:strict, phase6:qa-packet:strict  | 18   | 0                                |
| phase7  | yes              | phase7:check-core-loop:strict, phase7:qa-packet:strict     | 29   | 0                                |
| phase8  | yes              | phase8:check-growth-store:strict, phase8:qa-packet:strict  | 19   | 0                                |
| phase9  | yes              | phase9:verify, phase9:release-smoke:strict                 | 53   | 0                                |
| phase10 | yes              | phase10:verify, phase10:beta-readiness:strict              | 17   | 0                                |
| phase11 | yes              | phase11:verify, phase11:launch-readiness:strict            | 15   | 0                                |

## Extracted Evidence Keys

### Phase 2 environment and RLS

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                   | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------------- | ------------------------- |
| APP_VARIANT                                     | yes                       |
| APPLE_SIWA_CLIENT_ID                            | yes                       |
| APPLE_SIWA_KEY_ID                               | yes                       |
| APPLE_SIWA_PRIVATE_KEY                          | yes                       |
| APPLE_SIWA_SERVICE_ID                           | yes                       |
| APPLE_TEAM_ID                                   | yes                       |
| BRAND_LEGAL_CLEARANCE                           | yes                       |
| EXPO_PUBLIC_ACCOUNT_DELETION_URL                | yes                       |
| EXPO_PUBLIC_APP_DISPLAY_NAME                    | yes                       |
| EXPO_PUBLIC_APP_ENV                             | yes                       |
| EXPO_PUBLIC_APP_SCHEME                          | yes                       |
| EXPO_PUBLIC_APP_STORE_URL                       | yes                       |
| EXPO_PUBLIC_CONSUMER_HEALTH_PRIVACY_URL         | yes                       |
| EXPO_PUBLIC_DATA_EXPORT_URL                     | yes                       |
| EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID                | yes                       |
| EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME               | yes                       |
| EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID                | yes                       |
| EXPO_PUBLIC_POSTHOG_HOST                        | yes                       |
| EXPO_PUBLIC_POSTHOG_KEY                         | yes                       |
| EXPO_PUBLIC_PRIVACY_URL                         | yes                       |
| EXPO_PUBLIC_REVENUECAT_ANDROID_KEY              | yes                       |
| EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID        | yes                       |
| EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID           | yes                       |
| EXPO_PUBLIC_REVENUECAT_IOS_KEY                  | yes                       |
| EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID       | yes                       |
| EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID | yes                       |
| EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY           | yes                       |
| EXPO_PUBLIC_SENTRY_DSN                          | yes                       |
| EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY            | yes                       |
| EXPO_PUBLIC_SUPABASE_URL                        | yes                       |
| EXPO_PUBLIC_SUPPORT_EMAIL                       | yes                       |
| EXPO_PUBLIC_SUPPORT_URL                         | yes                       |
| EXPO_PUBLIC_TERMS_URL                           | yes                       |
| EXPO_PUBLIC_TURNSTILE_SITE_KEY                  | yes                       |
| PHASE2_ALLOW_PRODUCTION_SMOKE                   | yes                       |
| POSTHOG_API_HOST                                | yes                       |
| POSTHOG_DELETION_APPROVED_ALTERNATE             | yes                       |
| POSTHOG_PERSONAL_API_KEY                        | yes                       |
| POSTHOG_PROJECT_ID                              | yes                       |
| REVENUECAT_SECRET_API_KEY                       | yes                       |
| REVENUECAT_WEBHOOK_AUTH                         | yes                       |
| REVENUECAT_WEBHOOK_MAX_BYTES                    | yes                       |
| REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS  | yes                       |
| REVENUECAT_WEBHOOK_SIGNING_SECRET               | yes                       |
| SENTRY_AUTH_TOKEN                               | yes                       |
| SENTRY_ORG                                      | yes                       |
| SENTRY_PROJECT                                  | yes                       |
| SUPABASE_ANON_KEY                               | yes                       |
| SUPABASE_PROJECT_REF                            | yes                       |
| SUPABASE_PUBLISHABLE_KEY                        | yes                       |
| SUPABASE_SECRET_KEY                             | yes                       |
| SUPABASE_SERVICE_ROLE_KEY                       | yes                       |
| SUPABASE_URL                                    | yes                       |

Local generated-only keys excluded from evidence warnings: none.

### Phase 3 legal and reviewer signoff

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                     | Named in FOR_TAS_TO_DO.md |
| --------------------------------- | ------------------------- |
| PHASE3_RELEASE_CLEARANCE          | yes                       |
| PHASE3_REVIEW_OPERATOR_QUEUE_JSON | yes                       |
| PHASE3_REVIEW_OPERATOR_QUEUE_MD   | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE3_REVIEW_PACKET_OUT_DIR, PHASE3_REVIEW_WORKLIST_JSON, PHASE3_REVIEW_WORKLIST_MD

### Phase 4 catalog source posture

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                     | Named in FOR_TAS_TO_DO.md |
| --------------------------------- | ------------------------- |
| CATALOG_APP_NAME                  | yes                       |
| CATALOG_APP_VERSION               | yes                       |
| CATALOG_ATTRIBUTION_URL           | yes                       |
| CATALOG_CONTACT_EMAIL             | yes                       |
| CATALOG_RATE_LIMIT_MAX            | yes                       |
| CATALOG_RATE_LIMIT_WINDOW_SECONDS | yes                       |
| OBF_API_ENABLED                   | yes                       |
| OBF_CONTRIBUTION_ENABLED          | yes                       |
| OBF_USER_AGENT                    | yes                       |
| PHASE4_BETA_COVERAGE_INPUT        | yes                       |
| PHASE4_BETA_COVERAGE_REPORT       | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE4_SOURCE_WORKLIST_JSON, PHASE4_SOURCE_WORKLIST_MD

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
| PHASE5_PERFORMANCE_EVIDENCE_PATH       | yes                       |
| PHASE5_PROGRESS_PHOTO_QA_PASS          | yes                       |
| PHASE5_QA_SIGNOFF                      | yes                       |
| PHASE5_REVENUECAT_NATIVE_QA_PASS       | yes                       |
| PHASE5_SENTRY_NATIVE_QA_PASS           | yes                       |
| PHASE5_SHARE_SHEET_QA_PASS             | yes                       |
| PHASE5_SIGNED_OFF_BY                   | yes                       |
| PHASE5_SUPABASE_CATALOG_NATIVE_QA_PASS | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE5_PERFORMANCE_TEMPLATE_PATH, PHASE5_QA_PACKET_OUT_DIR

### Phase 6 payments and RevenueCat

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                   | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------------- | ------------------------- |
| EXPO_PUBLIC_REVENUECAT_ANDROID_KEY              | yes                       |
| EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID        | yes                       |
| EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID           | yes                       |
| EXPO_PUBLIC_REVENUECAT_IOS_KEY                  | yes                       |
| EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID       | yes                       |
| EXPO_PUBLIC_REVENUECAT_REVERSE_TRIAL_PRODUCT_ID | yes                       |
| EXPO_PUBLIC_REVENUECAT_TEST_STORE_KEY           | yes                       |
| PHASE6_ANDROID_LICENSE_TEST_PASS                | yes                       |
| PHASE6_FINANCE_SIGNOFF                          | yes                       |
| PHASE6_IOS_SANDBOX_RESTORE_PASS                 | yes                       |
| PHASE6_RC_OFFERING_REVIEWED                     | yes                       |
| PHASE6_SIGNED_OFF_BY                            | yes                       |
| PHASE6_WEBHOOK_HMAC_TEST_PASS                   | yes                       |
| REVENUECAT_SECRET_API_KEY                       | yes                       |
| REVENUECAT_WEBHOOK_AUTH                         | yes                       |
| REVENUECAT_WEBHOOK_MAX_BYTES                    | yes                       |
| REVENUECAT_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS  | yes                       |
| REVENUECAT_WEBHOOK_SIGNING_SECRET               | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE6_PACKET_OUT_DIR

### Phase 7 core loop launch gates

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                          | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------------------ | ------------------------- |
| EXPO_PUBLIC_PHASE7_CLOUD_ASK_ENABLED                   | yes                       |
| EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED                    | yes                       |
| EXPO_PUBLIC_PHASE7_COMMUNITY_POSTING_ENABLED           | yes                       |
| EXPO_PUBLIC_PHASE7_GOAL_ACTIVE_RECOMMENDATIONS_ENABLED | yes                       |
| EXPO_PUBLIC_PHASE7_REVIEWED_CONFLICT_SHARING_ENABLED   | yes                       |
| EXPO_PUBLIC_PHASE7_SHARE_CARD_ENABLED                  | yes                       |
| EXPO_PUBLIC_PHASE7_TREND_ENABLED                       | yes                       |
| EXPO_PUBLIC_PHASE7_WIDGETS_ENABLED                     | yes                       |
| PHASE7_ANALYTICS_QA_PASS                               | yes                       |
| PHASE7_BETA_DASHBOARD_READY                            | yes                       |
| PHASE7_BRAND_READY                                     | yes                       |
| PHASE7_CATALOG_BETA_IMPORT_PASS                        | yes                       |
| PHASE7_CLINICAL_REVIEW_PASS                            | yes                       |
| PHASE7_DEFERRED_SURFACES_QA_PASS                       | yes                       |
| PHASE7_DEVICE_QA_PASS                                  | yes                       |
| PHASE7_ONBOARDING_CONSENT_QA_PASS                      | yes                       |
| PHASE7_PAYMENTS_LIFECYCLE_QA_PASS                      | yes                       |
| PHASE7_PHOTOS_PRIVACY_QA_PASS                          | yes                       |
| PHASE7_PRIVACY_CONTROLS_QA_PASS                        | yes                       |
| PHASE7_PRIVACY_EXPORT_DELETE_PASS                      | yes                       |
| PHASE7_REMINDERS_QA_PASS                               | yes                       |
| PHASE7_REVENUECAT_QA_PASS                              | yes                       |
| PHASE7_REVIEWED_GUIDANCE_QA_PASS                       | yes                       |
| PHASE7_ROUTINE_BUILDER_QA_PASS                         | yes                       |
| PHASE7_SHARE_CARD_QA_PASS                              | yes                       |
| PHASE7_SHELF_INTAKE_QA_PASS                            | yes                       |
| PHASE7_SIGNED_OFF_BY                                   | yes                       |
| PHASE7_SUPABASE_RLS_PASS                               | yes                       |
| PHASE7_TODAY_CHECKOFF_QA_PASS                          | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE7_PACKET_OUT_DIR

### Phase 8 growth and store readiness

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                               | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------- | ------------------------- |
| ANDROID_CERT_SHA256_FINGERPRINTS            | yes                       |
| APPLE_TEAM_ID                               | yes                       |
| EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED    | yes                       |
| EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED | yes                       |
| EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED     | yes                       |
| EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED    | yes                       |
| PHASE8_ANDROID_APP_LINKS_PASS               | yes                       |
| PHASE8_APP_STORE_PACKET_PASS                | yes                       |
| PHASE8_ATTRIBUTION_PRIVACY_PASS             | yes                       |
| PHASE8_BRAND_SOURCE_OF_TRUTH_PASS           | yes                       |
| PHASE8_CREATOR_COMPLIANCE_PASS              | yes                       |
| PHASE8_DOMAIN_DNS_PASS                      | yes                       |
| PHASE8_DRY_RUN_PASS                         | yes                       |
| PHASE8_IOS_UNIVERSAL_LINKS_PASS             | yes                       |
| PHASE8_LAUNCH_DASHBOARD_READY               | yes                       |
| PHASE8_PLAY_STORE_PACKET_PASS               | yes                       |
| PHASE8_SHARE_CARD_DEVICE_QA_PASS            | yes                       |
| PHASE8_SIGNED_OFF_BY                        | yes                       |
| PHASE8_SUPPORT_RESPONSE_PASS                | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE8_PACKET_OUT_DIR, PHASE8_STORE_METADATA_PACKET

### Phase 9 release engineering

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                                     | Named in FOR_TAS_TO_DO.md |
| ------------------------------------------------- | ------------------------- |
| PHASE9_ALLOW_PRODUCTION_LIVE_CATALOG_RATE_LIMIT   | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_CONSENT_WITHDRAWAL   | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_DATA_RIGHTS          | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_EDGE_AUTH            | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_ORDER_REPORT_POLL    | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_PUBLIC_FORMS         | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_REVENUECAT_WEBHOOK   | yes                       |
| PHASE9_ALLOW_PRODUCTION_LIVE_SUPABASE_ADVERSARIAL | yes                       |
| PHASE9_ANDROID_16KB_PASS                          | yes                       |
| PHASE9_ANDROID_ARTIFACT                           | yes                       |
| PHASE9_ANDROID_CLOSED_TEST_PASS                   | yes                       |
| PHASE9_ANDROID_TARGET_API_PASS                    | yes                       |
| PHASE9_APP_STORE_PACKET_PASS                      | yes                       |
| PHASE9_BETA_EVIDENCE_PASS                         | yes                       |
| PHASE9_CATALOG_RATE_LIMIT_PASS                    | yes                       |
| PHASE9_CATALOG_RATE_LIMIT_PROBE_MAX               | yes                       |
| PHASE9_CONSENT_WITHDRAWAL_PASS                    | yes                       |
| PHASE9_DATA_EXPORT_DELETE_PASS                    | yes                       |
| PHASE9_DATA_EXPORT_RATE_LIMIT_PROBE_MAX           | yes                       |
| PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_CHECK        | yes                       |
| PHASE9_DATA_EXPORT_SIGNED_URL_EXPIRY_WAIT_SECONDS | yes                       |
| PHASE9_DEPENDENCY_AUDIT_PASS                      | yes                       |
| PHASE9_DEVICE_QA_PASS                             | yes                       |
| PHASE9_EDGE_AUTH_PASS                             | yes                       |
| PHASE9_FINAL_IDENTITY_PASS                        | yes                       |
| PHASE9_INCIDENT_RESPONSE_PASS                     | yes                       |
| PHASE9_IOS_ARTIFACT                               | yes                       |
| PHASE9_IOS_PRIVACY_REPORT_PASS                    | yes                       |
| PHASE9_IOS_TESTFLIGHT_PASS                        | yes                       |
| PHASE9_LIVE_SUPABASE_PASS                         | yes                       |
| PHASE9_OBSERVABILITY_PAYLOAD_PASS                 | yes                       |
| PHASE9_ORDER_REPORT_POLL_ACTIVATED_EXPECTED       | yes                       |
| PHASE9_ORDER_REPORT_POLL_PASS                     | yes                       |
| PHASE9_PLAY_PACKET_PASS                           | yes                       |
| PHASE9_PUBLIC_FORMS_PASS                          | yes                       |
| PHASE9_PUBLIC_FORMS_RATE_LIMIT_PROBE_MAX          | yes                       |
| PHASE9_REVENUECAT_NATIVE_QA_PASS                  | yes                       |
| PHASE9_REVENUECAT_WEBHOOK_PASS                    | yes                       |
| PHASE9_RLS_PRODUCTION_PASS                        | yes                       |
| PHASE9_RLS_STAGING_PASS                           | yes                       |
| PHASE9_ROLLBACK_DRILL_PASS                        | yes                       |
| PHASE9_RUN_LIVE_CATALOG_RATE_LIMIT                | yes                       |
| PHASE9_RUN_LIVE_CONSENT_WITHDRAWAL                | yes                       |
| PHASE9_RUN_LIVE_DATA_RIGHTS                       | yes                       |
| PHASE9_RUN_LIVE_EDGE_AUTH                         | yes                       |
| PHASE9_RUN_LIVE_ORDER_REPORT_POLL                 | yes                       |
| PHASE9_RUN_LIVE_PUBLIC_FORMS                      | yes                       |
| PHASE9_RUN_LIVE_REVENUECAT_WEBHOOK                | yes                       |
| PHASE9_RUN_LIVE_SUPABASE_ADVERSARIAL              | yes                       |
| PHASE9_RUN_LIVE_SUPABASE_CHECK                    | yes                       |
| PHASE9_RUN_NPM_AUDIT                              | yes                       |
| PHASE9_SIGNED_OFF_BY                              | yes                       |
| PHASE9_TURNSTILE_VALID_TOKEN                      | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE9_PACKET_OUT_DIR, PHASE9_RELEASE_CANDIDATE_DIR

### Phase 10 closed beta

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                             | Named in FOR_TAS_TO_DO.md |
| ----------------------------------------- | ------------------------- |
| PHASE10_BETA_IDENTITY_PASS                | yes                       |
| PHASE10_BETA_TERMS_PASS                   | yes                       |
| PHASE10_CATALOG_BETA_PASS                 | yes                       |
| PHASE10_DASHBOARDS_PASS                   | yes                       |
| PHASE10_PAYMENT_QA_PASS                   | yes                       |
| PHASE10_PHASE9_BETA_CANDIDATE_PASS        | yes                       |
| PHASE10_PLAY_12_TESTERS_14_DAYS_SCHEDULED | yes                       |
| PHASE10_PLAY_CLOSED_TEST_READY            | yes                       |
| PHASE10_PRIVACY_PAYLOAD_PASS              | yes                       |
| PHASE10_PUBLIC_LAUNCH_DECISION            | yes                       |
| PHASE10_RECRUITING_PASS                   | yes                       |
| PHASE10_RETENTION_REPORT_PASS             | yes                       |
| PHASE10_SIGNED_OFF_BY                     | yes                       |
| PHASE10_SUPPORT_DESK_PASS                 | yes                       |
| PHASE10_SUPPORT_HANDOFF_JSON              | yes                       |
| PHASE10_SUPPORT_HANDOFF_MD                | yes                       |
| PHASE10_TESTFLIGHT_READY                  | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE10_PACKET_OUT_DIR

### Phase 11 public launch

Covered by `docs/FOR_TAS_TO_DO.md`: yes

| Extracted key                   | Named in FOR_TAS_TO_DO.md |
| ------------------------------- | ------------------------- |
| PHASE11_ASO_REVIEW_PASS         | yes                       |
| PHASE11_CREATOR_DISCLOSURE_PASS | yes                       |
| PHASE11_INCIDENT_ROLLBACK_PASS  | yes                       |
| PHASE11_MONITORING_PASS         | yes                       |
| PHASE11_PHASE10_EXIT_PASS       | yes                       |
| PHASE11_PHASE9_RC_SIGNOFF_PASS  | yes                       |
| PHASE11_PRODUCTION_ENV_PASS     | yes                       |
| PHASE11_REVENUE_RECON_PASS      | yes                       |
| PHASE11_REVENUECAT_PROD_PASS    | yes                       |
| PHASE11_RING0_PASS              | yes                       |
| PHASE11_RING1_72H_REPORT_PASS   | yes                       |
| PHASE11_SIGNED_OFF_BY           | yes                       |
| PHASE11_STORE_APPROVAL_PASS     | yes                       |
| PHASE11_SUPPORT_READY           | yes                       |
| PHASE11_WEEK1_DECISION_PASS     | yes                       |

Local generated-only keys excluded from evidence warnings: PHASE11_PACKET_OUT_DIR

## Blockers

- None.

## Warnings

- None.
