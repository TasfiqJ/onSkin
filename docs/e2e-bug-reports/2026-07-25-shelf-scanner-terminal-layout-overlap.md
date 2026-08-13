# Shelf scanner terminal copy overlapped scanner guidance

Date: 2026-07-25
Severity: P2
Surface: `/shelf/scan`
Status: Fixed and reverified

## Summary

Human-simulated verification of the new persistent scanner result found the terminal copy overlapping the non-compact `Line up the barcode` guidance at 390 x 844.

## Reproduction

1. Run Expo web with `EXPO_PUBLIC_E2E_SHELF_SCAN_RESULT=no_match`.
2. Open `/shelf/scan` at 390 x 844.
3. Inspect the boundary between the preview and result sheet.

Expected: preview guidance and terminal result occupy separate readable regions.

Actual: the fixed-height preview guidance remained visible while the expanded result sheet reduced the flex region, placing both text blocks in the same vertical space.

## Fix

Terminal scanner states now suppress the idle-only `Line up the barcode` guidance. This removes stale instruction while a result is authoritative and releases enough vertical space for the result sheet.

## Verification

The post-fix 375 x 667 and 390 x 844 passes show complete terminal copy, one 49.9 px-high `Scan again` control, all fallback actions, zero horizontal overflow, no stale scanner guidance, and an in-place reset. The retained browser warnings are expected missing-local-Supabase and Expo web notification warnings; no route error was emitted.

Evidence: `test-results/human-e2e/2026-07-25/shelf-scanner-terminal-session-current/`.
