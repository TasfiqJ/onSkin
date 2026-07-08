# Shelf Replenish Scarcity Copy

## Summary

- Date: 2026-07-08
- Severity: Important
- Area: Shelf replenish prompt
- Status: Fixed locally and verified on Expo web

## Reproduction

1. Add a product whose PAO boundary is reached.
2. Open the Shelf replacement prompt.
3. Read the replenish headline/body.

## Expected

The prompt explains the real freshness trigger: PAO or printed expiry. It must stay calm, claim-safe, and avoid invented scarcity unless the user explicitly marked a product finished or low.

## Actual

The replenish prompt used `nearly finished`, `running low`, and `don't run out` framing for all active products, including PAO/expiry-triggered replacements.

## Fix

- Replaced scarcity copy with freshness copy based on `item.badge.kind`.
- Added safety-critical sunscreen/eye-area framing without alarmist claims.
- Added a source contract that rejects `nearly finished`, `running low`, and `don't run out` in `shelf/replenish.tsx`.

## Verification

- Focused `shelfRoutes.test.ts` passes.
- Codex in-app browser Expo web at 320 x 568 created a `0 days left` boundary product, opened the replenish prompt, and verified PAO/printed-date copy with no scarcity language.
- Evidence: `test-results/human-e2e/2026-07-08/shelf-opened-replenish-boundary-current/`.

## Remaining Risk

Native iOS/Android must still verify bottom-sheet scrolling, safe-area behavior, Dynamic Type, VoiceOver/TalkBack traversal, and persisted state after restart.
