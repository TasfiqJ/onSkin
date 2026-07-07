# E2E Bug Report: Community deferred routes used generic Back copy

Severity: Low
Surface: Expo web direct-entry recovery
Environment: Expo web on localhost, 320 x 568 viewport
Feature: Skin Notes community deferred posting routes
Date: 2026-07-07
Tester: Codex

## Reproduction Steps

1. Open `/community/ask` directly while community posting is disabled.
2. Open `/community/people-like-you` directly while community posting is disabled.
3. Inspect each deferred surface CTA at a 320 x 568 phone viewport.
4. Tap the CTA.

## Expected Result

Each deferred posting route keeps peer posting honestly unavailable and uses a destination-specific `Back to Skin Notes` CTA that returns to `/community` on direct entry.

## Actual Result

The routes correctly deferred peer posting and returned to `/community`, but the CTA used generic `Back` copy, which was weaker than the known Skin Notes destination.

## Evidence

- Source review: `apps/mobile/src/app/community/ask.tsx`
- Source review: `apps/mobile/src/app/community/people-like-you.tsx`
- User-flow branch: `docs/USER_FLOW_TREE.md` Skin Notes Community Trust Layer / direct-entry Community exits
- App-surface evidence folder: `test-results/human-e2e/2026-07-07/community-deferred-cta/`

## Frequency

- Always for direct `/community/ask` and `/community/people-like-you` entries while `phase7Flags.communityPosting` is false.

## Scope

- Affected route/screen: `/community/ask`
- Affected route/screen: `/community/people-like-you`
- Affected account or fixture: Any user entering unavailable community posting routes
- External service involved: None
- Destructive action involved: No

## Suspected Cause

`DeferredSurface` defaults to its generic CTA label unless a route supplies `fallbackLabel`.

## Minimal Fix Recommendation

Pass `fallbackLabel="Back to Skin Notes"` from both community deferred branches while preserving `APP_COMMUNITY_ROUTE` as the safe fallback route.

## Verification Flow After Fix

1. Open `/community/ask` directly at 320 x 568.
2. Confirm the CTA reads `Back to Skin Notes`, has at least a 44 px touch target, and no horizontal overflow.
3. Tap `Back to Skin Notes` and confirm `/community` renders the Skin Notes hub.
4. Repeat the same flow for `/community/people-like-you`.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/ask-deferred-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/ask-back-to-skin-notes-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/people-like-you-deferred-320x568.png`
- Screenshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/people-like-you-back-to-skin-notes-320x568.png`
- UI snapshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/ask-deferred-state.json`
- UI snapshot: `test-results/human-e2e/2026-07-07/community-deferred-cta/people-like-you-deferred-state.json`
- Geometry: `test-results/human-e2e/2026-07-07/community-deferred-cta/ask-deferred-geometry.json`
- Geometry: `test-results/human-e2e/2026-07-07/community-deferred-cta/people-like-you-deferred-geometry.json`
- Logs: `test-results/human-e2e/2026-07-07/community-deferred-cta/browser-warn-error-logs.json`
- Focused route contract: `npm --workspace apps/mobile run test -- src/features/community/communityRoutes.test.ts`

## Remaining Risk

- Untested branches: Native iOS and Android visual rendering for the same deferred routes.
- Missing fixtures: Community posting enabled state remains intentionally gated until moderation/legal evidence exists.
- Follow-up needed: Include deferred community direct-entry recovery in the durable mobile E2E suite.
