# Manual Blockers

Date: 2026-07-06

Current status: local security hardening checkpoints have been committed and pushed on `codex/security-hardening-checkpoint`. The remaining blockers require founder/operator access, live credentials, dashboards, physical devices, store accounts, or named legal/clinical review. Do not set Phase 9/10/11 pass flags until the evidence below exists for the exact release-candidate commit and native builds.

## Required Founder/Operator Actions

1. Final identity and legal clearance
   - Decide whether the app can launch as OnSkin or must rebrand.
   - Record final app name, domain, support email, privacy URL, terms URL, account deletion URL, data export URL, App Store URL, and Play Store URL.
   - Obtain named legal/privacy/clinical signoff for claims, policies, health-adjacent copy, store metadata, and data-safety labels.

2. Supabase staging and production evidence
   - Deploy the latest migrations and Edge Functions to staging.
   - Run and archive strict live evidence:
     - `phase9:live-supabase-adversarial:strict`
     - `phase9:live-edge-auth:strict`
     - `phase9:live-data-rights:strict`
     - `phase9:live-consent-withdrawal:strict`
     - `phase9:live-public-forms:strict`
     - `phase9:live-catalog-rate-limit:strict`
     - `phase9:live-order-report-poll:strict`
     - `phase9:live-revenuecat-webhook:strict`
   - Repeat production RLS/storage checks only with explicit production approval.

3. Payments and RevenueCat
   - Configure real RevenueCat projects, products, offerings, entitlements, webhook auth/HMAC, and subscriber deletion credentials.
   - Run native StoreKit and Play Billing sandbox/closed-test purchase, restore, cancel, refund, renewal, billing issue, grace/expiry, upgrade/downgrade, and entitlement reconciliation QA.
   - Archive dashboard screenshots/artifacts for webhook delivery and entitlement state.

4. Native device and binary QA
   - Build real iOS and Android artifacts.
   - Verify Android `allowBackup=false`, target API, 16 KB page-size support, iOS privacy manifest/report, app-switcher privacy shield, lock-screen notification privacy, local export/share cleanup, EXIF stripping, auth linking/account switching, and backup/restore behavior on real devices.

5. Security workflow and dependency evidence
   - Run GitHub Security workflow for the exact RC commit.
   - Download and review `code-security-evidence-*`, `secret-scanner-evidence-*`, and `static-scanner-evidence-*`.
   - Review current dependency advisory/SBOM output and either fix or record explicit risk acceptance for remaining upstream Expo/tooling advisories.

6. Store and beta readiness
   - Complete App Store privacy nutrition labels and Google Play Data Safety from the final data inventory.
   - Complete TestFlight and Play closed testing evidence.
   - Run closed beta, collect activation/retention/support/payment evidence, and record a go/no-go public launch decision with named owner signoff.

## Stop Condition

Codex should resume only after the required dashboards, live credentials, device artifacts, store accounts, or named signoffs are available, or if the next request is a clearly scoped local code change.
