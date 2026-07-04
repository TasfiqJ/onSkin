# Phase 2 Status

Date: 2026-07-04

## Done In Repo

- EAS app variants and build profiles are scaffolded.
- Native infrastructure SDKs are installed for RevenueCat, PostHog, Sentry, and
  custom dev builds.
- RevenueCat purchase/restore code is wired behind real keys and native platform
  support, while preserving the local dev stub only when RevenueCat is absent.
- PostHog capture/identify is wired with sanitized JSON-safe properties.
- Sentry initializes at app startup with privacy-conservative defaults.
- Supabase Edge Functions prefer publishable/secret key env names.
- Phase 2 env audit, Supabase RLS smoke test, and Supabase staging deploy scripts
  are added.
- Store/privacy inventory and production infrastructure runbook are documented.

## Not Done Because It Requires External Accounts

- Supabase staging/production projects are not created or linked.
- Edge Functions are not deployed to a live project.
- RLS smoke tests have not run against a live Supabase project.
- Apple/Google app records, OAuth clients, and store metadata are not created.
- RevenueCat project, products, offerings, sandbox testers, and webhook endpoint
  are not configured.
- PostHog and Sentry projects are not configured under a final brand.
- Turnstile is not configured.
- Final legal/support/account deletion/data export URLs are not live.
- EAS builds have not been run with real credentials.

## Current Go/No-Go

No-go for public launch. The repo now has the Phase 2 scaffolding needed to make
real infrastructure setup disciplined, but launch readiness still depends on
brand clearance, external accounts, production secrets, device QA, legal review,
clinical review, catalog data, and closed beta demand proof.
