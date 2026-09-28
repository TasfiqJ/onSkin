# Legacy Manual Blocker Index

Date: 2026-07-16

This file is retained for old links and is superseded by `BLOCKERS.md`,
`LAUNCH_READINESS.md`, and `docs/hugeToDo/execution-status.json`. The current
release contract is iOS-only. Local engineering continues autonomously; only
evidence that genuinely requires accounts, live services, physical devices, or
named professional judgment remains external. Do not set Phase 9/10/11 pass
flags until the exact tracked release-candidate evidence exists.

## Required Founder/Operator Actions

1. Final identity and legal clearance
   - Select only from the counsel-reviewed candidate sequence (`Layerwell`, then `Ritunera`, then `Ritualoom`) after written trademark clearance, domain acquisition, and App Store name reservation. The legacy `Layerwell` identity is excluded because a public skincare scanner already uses it.
   - Record final app name, domain, support email, privacy URL, terms URL, account deletion URL, data export URL, and App Store URL. Play Store is N/A under the iOS-only contract.
   - Obtain named legal/privacy/clinical signoff for claims, policies, health-adjacent copy, exact iOS App Privacy answers, and App Store metadata.

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
   - Run native StoreKit sandbox/TestFlight purchase, restore, cancel, refund, renewal, billing issue, grace/expiry, upgrade/downgrade, and entitlement reconciliation QA. Play Billing is N/A for this launch contract.
   - Archive dashboard screenshots/artifacts for webhook delivery and entitlement state.

4. Native device and binary QA
   - Build the real iOS production artifact from committed source.
   - Verify the hash-bound iOS privacy evidence index, app-switcher privacy shield, lock-screen notification privacy, local export/share cleanup, EXIF stripping, auth linking/account switching, and backup/restore behavior on supported physical iPhones. Android gates are N/A until the launch contract changes.

5. Security workflow and dependency evidence
   - Run GitHub Security workflow for the exact RC commit.
   - Download and review `code-security-evidence-*`, `secret-scanner-evidence-*`, and `static-scanner-evidence-*`.
   - Review current dependency advisory/SBOM output and either fix or record explicit risk acceptance for remaining upstream Expo/tooling advisories.

6. Store and beta readiness
   - Complete App Store privacy nutrition labels from the final data inventory. Google Play Data Safety is N/A for the current contract.
   - Complete TestFlight evidence. Play closed testing is N/A for the current contract.
   - Run closed beta, collect activation/retention/support/payment evidence, and record a go/no-go public launch decision with named owner signoff.

## Stop Condition

Codex continues all safe local engineering, research, validation, documentation,
and provenance work without waiting. It must not fabricate dashboards,
credentials, device artifacts, store-account actions, or named signoffs; those
specific gates close only when their real evidence exists.
