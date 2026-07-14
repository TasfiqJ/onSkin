# Phase 2 Production Infrastructure Runbook

Date: 2026-07-13

Phase 2 is now scaffolded in code, but it is not externally complete. Do not
create irreversible production accounts under `OnSkin` until
`docs/brand-decision-memo.md` records counsel/founder clearance.

## Implemented Locally

- `apps/mobile/app.config.js`: dev/staging/prod app variants with env-overridable
  name, slug, scheme, iOS bundle ID, and Android package.
- `apps/mobile/eas.json`: EAS development, staging, and production build profiles.
- `react-native-purchases`, `posthog-react-native`, `@sentry/react-native`,
  `expo-dev-client`, `expo-application`, and `expo-localization` installed.
- RevenueCat runtime wiring in `apps/mobile/src/lib/iap/revenuecat.ts`, bound to
  the Supabase user ID and guarded so local dev can still navigate the paywall.
- PostHog runtime wiring in `apps/mobile/src/lib/analytics/track.ts`, with
  JSON-safe event properties and no session replay.
- Sentry startup wiring in `apps/mobile/src/lib/observability/sentry.ts`, with no
  default PII, screenshots, view hierarchy, or failed-request capture.
- Supabase Edge Functions now prefer Supabase publishable/secret key names with
  legacy key fallback.
- `scripts/phase2/check-env.mjs`: validates the Phase 2 env contract and blocks
  accidental public secret naming.
- `scripts/phase2/supabase-rls-smoke.mjs`: two-user plus anonymous RLS smoke
  test for profiles, skin profiles, shelf, routines, consents, and entitlements.
- `scripts/phase2/deploy-supabase-staging.ps1`: staging deploy wrapper for
  migrations, Edge Functions, and type generation.
- `supabase/ops/account-deletion-work-lane.sql`: credential-free, fail-closed
  Cron/Vault provisioning for the durable account-deletion worker.
- `docs/phase-9/account-deletion-operations-runbook.md`: exact deletion
  environment, cutover, monitoring, rotation, containment, and live-gate
  contract.

## Required Sequence

1. Resolve brand and domain.
2. Fill `.env` from `.env.example` with staging values.
3. Run `npm run phase2:check-env:strict`.
4. Create Supabase staging and set Edge Function secrets. Durable deletion
   requires independent payload/receipt/worker/tombstone keys and a RevenueCat
   **V2** key; a RevenueCat V1/legacy key cannot satisfy that contract.
5. For the migrations 0048-0051 cutover, follow the dedicated account-deletion
   runbook: predeploy the new fail-closed deletion function, then apply the four
   migrations in order and immediately deploy every manifest function from the
   same revision. Do not use the wrapper alone for this first cutover because it
   pushes migrations before functions.
6. Run `.\scripts\phase2\deploy-supabase-staging.ps1` for later coherent
   manifest deployments and type generation.
7. Provision the named Vault entries and canonical Cron job only after the
   deletion function's boot and negative-auth probes pass.
8. Run `npm run phase2:rls-smoke` plus the Phase 9 account-deletion live matrix.
9. Configure Apple, Google, RevenueCat, PostHog, Sentry, Turnstile, and policy
   URLs under the cleared identity.
10. Build custom dev clients and staging builds through EAS.
11. Run the purchase/auth/deletion/device QA matrix before production.

## Commands

```bash
npm run phase2:check-env
npm run phase2:check-env:strict
npm run phase2:rls-smoke
```

PowerShell staging deploy:

```powershell
.\scripts\phase2\deploy-supabase-staging.ps1
```

The initial durable-deletion cutover is the documented exception to invoking
this wrapper directly. Read
`docs/phase-9/account-deletion-operations-runbook.md` first.

Expo config checks:

```powershell
cd apps/mobile
$env:APP_VARIANT="staging"; npx expo config --type public; Remove-Item Env:\APP_VARIANT
```

EAS builds:

```bash
cd apps/mobile
eas build --profile development --platform ios
eas build --profile staging --platform android
eas build --profile production --platform all
```

## RevenueCat Contract

- Product IDs are read from
  `EXPO_PUBLIC_REVENUECAT_ANNUAL_PRODUCT_ID`,
  and `EXPO_PUBLIC_REVENUECAT_MONTHLY_PRODUCT_ID`. The committed defaults are
  local placeholders only; replace them with final App Store/RevenueCat IDs
  after brand clearance. The no-card reverse trial is an app-granted Supabase
  entitlement with `product_id=null`, `offering_id=null`, and `package_id=null`;
  it is not a Store product and must not be configured as one.
- Entitlement defaults to `pro`; override with
  `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` only if the dashboard uses another ID.
- `appUserID` is the Supabase user ID, including the anonymous user ID.
- A configured native build never returns the local `stub` purchase result.

## Supabase Verification

The RLS smoke test creates two disposable users, signs in with the publishable
key, verifies owner-only read/write behavior, verifies anonymous private reads
are blocked, and deletes the users through the admin API.

It refuses production unless `PHASE2_ALLOW_PRODUCTION_SMOKE=1` is set. The
expected target is staging.

## Still Blocked Externally

- Brand/legal clearance.
- Real staging and production Supabase projects.
- Apple Developer and Google Play Console apps.
- RevenueCat products, offerings, sandbox testers, and webhooks.
- PostHog/Sentry projects and deletion/source-map verification.
- Hosted Cron/Vault worker proof, provider interruption/reconciliation, and
  account-deletion concurrency/fault-injection evidence.
- Turnstile site and secret configuration.
- Final privacy, terms, support, data export, and account deletion URLs.
- Physical-device QA for auth, purchases, notifications, camera, share card, and
  release builds.

## Official References Checked

- Expo app config, dynamic config, variants, EAS profiles, and env variables.
- RevenueCat Expo installation and React Native purchases APIs.
- Sentry React Native/Expo setup and source-map support.
- PostHog React Native/Expo setup.
