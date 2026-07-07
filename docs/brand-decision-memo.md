# Brand Decision Memo

Date: 2026-07-04

Status: provisional founder/product decision, pending trademark counsel.

## Decision

Do not launch this app as `OnSkin` unless trademark counsel gives strong written
clearance. The default Phase 2 path is to prepare a rebrand before creating
production Apple, Google, Supabase, RevenueCat, Sentry, PostHog, domain, and
policy infrastructure.

Working candidate for clearance: `RoutineKind`

Candidate identifiers, if cleared:

| Asset                   | Candidate                                         |
| ----------------------- | ------------------------------------------------- |
| App display name        | `RoutineKind`                                     |
| App subtitle            | `Skincare shelf and routine tracker`              |
| Domain target           | `routinekind.app` first, `routinekind.com` second |
| URL scheme              | `routinekind`                                     |
| iOS bundle ID           | `com.routinekind.app`                             |
| Android package         | `com.routinekind.app`                             |
| Supabase project prefix | `routinekind`                                     |
| RevenueCat project      | `RoutineKind`                                     |
| PostHog/Sentry project  | `RoutineKind`                                     |

This candidate is not legally cleared. It is the current engineering default so
development/staging work can proceed without entrenching the conflicted
`OnSkin` identity. Production builds still require explicit final identity env
values plus `BRAND_LEGAL_CLEARANCE=cleared`.

## Why Keeping OnSkin Is High Risk

- There is already a public skincare scanner at [onskin.com](https://onskin.com/)
  with the exact `OnSkin` brand.
- Existing App Store and Google Play listings use the same category and scanner
  language.
- The incumbent claims large user and product-database numbers, which increases
  the chance that customers, app review teams, support teams, and ad platforms
  treat the name as already occupied.
- This repo historically used `OnSkin`, `onskin`, `onskin://`,
  `com.onskin.app`, and placeholder `onskin.app` references. The native
  development/staging defaults now use RoutineKind, but Supabase redirect config,
  internal namespaces, historical docs, and reviewed placeholder blockers still
  need final clearance or deliberate migration.

## Required Counsel Output

Counsel should return one of:

| Recommendation     | What it means                                                                                 |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Keep               | Written clearance supports launching as `OnSkin`; still prepare support/search confusion plan |
| Modify             | Name can be kept only with a distinctive modifier and store/domain strategy                   |
| Acquire/coordinate | Founder should negotiate with the incumbent before launch                                     |
| Rebrand            | Do not use `OnSkin`; clear a new mark before infrastructure setup                             |

## Rebrand Migration Checklist

If `RoutineKind` or another cleared name is selected:

- Confirm or replace the current RoutineKind Expo display name, slug, URL
  scheme, iOS bundle ID, and Android package defaults after counsel/founder
  clearance.
- Update environment variable comments and project names.
- Update App Store / Play Console app records before any public listing.
- Update policy URLs: terms, privacy, consumer health data privacy policy,
  support, account deletion, and data export.
- Update share-card watermark, fallback URL, and UTM source naming.
- Update paywall, emails, support copy, consent copy, and legal policy text.
- Update analytics/crash project names and dashboards.
- Decide whether internal package names remain `@onskin/*` until a later
  mechanical rename, or whether the repository gets a full namespace rename.
- Search code for `OnSkin`, `onskin`, `com.onskin.app`, and `onskin.app`.
- Run typecheck, lint, tests, and native prebuild/build verification after rename.

## If Founder Chooses To Keep OnSkin

Do not proceed unless all are true:

- Counsel signs off in writing.
- Domain strategy is documented.
- App Store/Play metadata strategy is documented.
- Paid search and ASO confusion plan is documented.
- Support confusion plan is documented.
- Incumbent app monitoring is added to launch QA.

## Practical Recommendation

Rebrand now. A rebrand before production infrastructure is cheaper than after
App Store records, RevenueCat products, policy URLs, universal links, support
inboxes, and beta users exist.
