# Phase 9 Data Inventory

This inventory is the source for export, deletion, App Store privacy labels, Google Play Data safety, support escalation, and incident response. It must be rechecked for every release candidate.

## Exported From Supabase

The `data-export` Edge Function exports the caller-scoped tables listed in `CALLER_RLS_EXPORT_TABLES` and the service-role filtered exports listed in `SERVICE_ROLE_FILTERED_EXPORTS`.

Caller-scoped coverage includes account profile, skin profile, shelf, routines, completions, conflicts, active ramp, scans, cycles, reminders, consent ledger, photos, entitlements, reverse trials, recommendations, catalog corrections/lookups, commerce click events, community participation, photo trend metadata, Ask metadata, and Ask safety audit rows.

Service-role filtered coverage includes subscription webhook events, OBF contribution queue rows tied to the user, and order attribution rows matched by the user's opaque commerce click tokens.

## Local-Only Exclusions

Local-only progress photos, shelf thumbnails, OS share-cache files, SecureStore keys, and device-local onboarding state are not present in Supabase. Export copy must explain that these files are only on the device unless the user opted into cloud backup.

## Third Parties

- Supabase: Auth, database, storage, Edge Functions.
- RevenueCat: subscription/customer data; deleted by `account-deletion`.
- PostHog: analytics person keyed by app user ID; deleted by `account-deletion` when enabled.
- Sentry: crash diagnostics; payload scrubber removes route params, URLs, product context, barcodes, OCR text, notes, photo paths, receipts, and free text before capture.
- Apple/Google: account and store billing records; the app deletion flow must explain subscription cancellation remains in store account management.

## Review Requirement

If a launch feature writes a new user-owned or user-linked table, add it to `data-export`, `account-deletion` cascade/scrub coverage, the privacy labels/Data safety source, and the RLS adversarial matrix before enabling it.
