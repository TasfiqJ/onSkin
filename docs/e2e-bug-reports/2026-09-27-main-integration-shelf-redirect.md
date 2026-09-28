# E2E Bug Report: deferred Shelf entry redirect loop

Severity: High
Surface: Expo web, SDK 57, synthetic anonymous owner
Feature: lean V1 Shelf route admission
Date: 2026-09-27
Tester: Codex

## Reproduction Steps

1. Begin a synthetic session and complete age eligibility and health consent.
2. Navigate directly to `/shelf/scan` or `/shelf/search`.

## Expected Result

Manual entry opens without mounting the deferred catalog feature.

## Actual Result

The conditional parent layout removed and recreated its navigator while redirecting, causing a maximum-update-depth error.

## Evidence

`test-results/human-e2e/2026-09-27/main-integration/navigation-final/expo-web.log` and `summary.json` retain the failing run locally.

## Fix

Keep the Shelf navigator mounted. Use its screen layout to replace deferred child screens with the manual-entry redirect. Preserve current reduced-motion options and catalog-recovery route identity.

## Verification Flow After Fix

Rerun all four tab interactions across six viewport sizes, hover/scroll behavior, deferred screens and both manual-entry redirects. Repeat with reduced motion. Final evidence belongs in `main-integration/navigation-passed` and `navigation-reduced`.

## Remaining Risk

Expo web verifies routing and geometry; native touch, VoiceOver and OS behavior need physical-iPhone evidence.
