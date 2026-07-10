# E2E Bug Report: Account export omitted device-authoritative data

Severity: Critical
Surface: Mixed
Environment: Expo mobile export action and Expo web Settings surface
Feature: Settings data export
Date: 2026-07-10
Tester: Codex

## Reproduction Steps

1. Complete onboarding, add or edit a shelf item, configure a cycle/ramp, and check off a routine step while local-first stores are authoritative.
2. Open You and tap `Export my data`.
3. Inspect the export assembly path and resulting JSON scope.

## Expected Result

The export includes both owner-scoped server data and user-owned records that exist only or more recently on the current device. Device media paths, image bytes, thumbnails, ciphertext, keys, credentials, and transient cache material are excluded explicitly.

## Actual Result

The action shared only the `data-export` Edge Function response. Best-effort or deferred mirrors meant the JSON could omit the device-authoritative profile, shelf edits, cycle/ramp choices, completion history, preferences, and Progress notes. With no configured backend, even a local-only user could not export any data.

## Evidence

- Logs: focused source inventory showed local V1 authority in `skinProfileStore.ts`, `shelf/store.ts`, `cycleStore.ts`, `rampStore.ts`, and `completionsStore.ts` while `actions.ts` serialized only the Edge Function payload.
- UI snapshot: pre-fix Settings copy named only the Progress image exclusion and did not disclose the missing local-first scope.

## Frequency

- Always for records not successfully mirrored to Supabase.

## Scope

- Affected route/screen: You tab, `YOUR DATA` card.
- Affected account or fixture: local-first guest, offline user, or any account with failed/deferred mirror writes.
- External service involved: Supabase `data-export` when configured.
- Destructive action involved: No.

## Suspected Cause

The export contract treated Supabase as the only data authority even though V1 deliberately makes several encrypted on-device stores authoritative.

## Minimal Fix Recommendation

Wrap the required owner-scoped server export with a versioned, exhaustive local-device snapshot. Bind collector coverage to the private-data key registry, sanitize path/media/credential fields, include decrypted photo notes without image files, support an explicitly marked device-only bundle when no backend is configured, and fail closed on configured server errors.

## Verification Flow After Fix

1. Run registry-coverage, representative data, redaction, configured-server failure, share failure, and cache-cleanup tests.
2. Inspect the complete Settings disclosure at supported compact and modern phone viewports.
3. Tap export in the backend-free Expo web harness and verify route-owned share-unavailable recovery, no dialog, no overflow, no completion analytics, and no data-export request.
4. Tas must inspect a seeded staging/native artifact and physical cache cleanup before Phase 9 signoff.

## Post-Fix Evidence

- Tests: `apps/mobile/src/features/settings/localDeviceExport.test.ts` and `apps/mobile/src/features/settings/actions.test.ts`.
- Static gate: `npm run phase9:data-rights-smoke`.
- Human-simulated UI evidence: `test-results/human-e2e/2026-07-10/data-export-combined-device-current/` passes the complete supported-phone Settings disclosure and backend-free recovery flow at 360 x 640 and 390 x 844.

## Remaining Risk

- Untested branches: live owner-scoped staging bundle and native iOS/Android share sheets.
- Missing fixtures: real Supabase staging account with deliberately divergent server/local records.
- Follow-up needed: Tas staging artifact inspection and physical cache cleanup evidence in `docs/FOR_TAS_TO_DO.md`.
