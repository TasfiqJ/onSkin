# Human-Simulated E2E Run Report

## Summary

- Date: 2026-07-21
- Codex task: CAT-07 Shelf freshness source/provenance web pass
- Source Git SHA: db6c5df99a6f08b49a98f856c259d04af2b1c466
- App surface: Expo web via in-app browser
- Build/start command: npm --workspace apps/mobile run web
- Browser/device/simulator/OS: Codex in-app browser, viewport 390 x 844
- Feature tested: manual Shelf intake, explicit opened-state PAO, package-date precedence, replacement explicit opening state
- Overall verdict: Pass with limits

## Tool Inventory

- Expo web: available at http://localhost:8081
- iOS Simulator / physical iPhone: not used in this pass
- Browser: Codex in-app browser
- Console logs: browser-warn-error-log.json

## Flows Executed

| Flow | Branch | Result | Evidence | Notes |
| ---- | ------ | ------ | -------- | ----- |
| Shelf empty state | Direct /shelf after local consent | Pass | 01-shelf-empty-390x844.png | Empty Shelf exposed scan/manual actions. |
| Manual add | Required fields and PAO guidance | Pass | 02-manual-add-empty-390x844.png | Copy says PAO only when printed beside open-jar symbol. |
| Opened state | Save disabled until explicit opened/unopened choice | Pass | 03-opened-state-required-390x844.png | Sheet states PAO clock starts only after user choice. |
| Label PAO | 12M label PAO | Pass | 04-pao-label-options-390x844.png, 05-shelf-label-pao-card-390x844.png | Shelf card showed opened Jul and 12 mo PAO with Jul 2027. |
| Package date precedence | Enter 2026-12-31 package date | Pass | 06-detail-label-pao-package-date-unknown-390x844.png, 07-package-date-editor-empty-390x844.png, 08-detail-package-date-saved-390x844.png, 09-shelf-package-date-card-390x844.png | Detail/card changed to recorded package date Dec 2026. |
| Replacement | Choose new unit unopened | Pass | 10-replacement-explicit-opening-choices-390x844.png, 11-replacement-unopened-date-unknown-390x844.png | Replacement required explicit opening state; new active unit was unopened and Date unknown; old unit archived. |

## Bugs Found

None in this web-compatible CAT-07 path.

## Tests Added or Updated

- apps/mobile/src/features/shelf/freshness.test.ts
- apps/mobile/src/features/shelf/store.test.ts
- apps/mobile/src/features/shelf/expiry.test.ts
- apps/mobile/src/features/shelf/labels.test.ts
- apps/mobile/src/features/shelf/shelfRoutes.test.ts
- apps/mobile/src/features/catalog/client.test.ts
- apps/mobile/src/features/recommendations/replenishment.test.ts
- supabase/tests/database/cat07_truthful_freshness.test.sql

## Commands Run

- node scripts/phase2/local-supabase-contract.mjs: PASS
- npm --workspace apps/mobile test -- CAT07 focused files: PASS
- npm --workspace apps/mobile run test: 304 files / 3607 tests PASS
- npm --workspace apps/mobile run typecheck: PASS
- npm --workspace apps/mobile run lint: PASS outside sandbox after initial sandbox EPERM

## Remaining Risk

- Expo web evidence does not prove native iOS storage, notifications, camera, App Store review, legal compliance, or Apple acceptance.
- psql is not installed in this shell, so the CAT-07 PostgreSQL rehearsal was statically contract-checked locally and remains executable proof for CI/PostgreSQL.
- CAT-04/CAT-05/CAT-06 native evidence remains stale or incomplete per the hugeToDo status docs.
