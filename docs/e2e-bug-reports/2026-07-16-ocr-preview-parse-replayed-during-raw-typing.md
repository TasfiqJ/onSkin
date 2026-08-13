# E2E Bug Report: OCR preview parse replayed during raw typing

Severity: Medium
Surface: Expo web
Environment: Expo development build on `localhost:8277`, requested 390 x 844 viewport, forced label-capture failure fixture
Feature: Shelf OCR review input isolation (OPT-115)
Date: 2026-07-16
Tester: Codex in-app browser

## Reproduction Steps

1. Enter `/shelf/ocr` review through the forced label-capture failure and load a 3,852-character synthetic draft.
2. Wait for the preview to settle, record the numeric development diagnostics, then append the 128-character suffix before the 200 ms debounce expires.
3. Read the diagnostics immediately, before the preview timer publishes.

## Expected Result

Raw typing should update only the editor. Preview parse and preview render counters should remain unchanged until the debounce expires.

## Actual Result

The preview did not render, but `previewParses` increased by one during the raw-only editor update. The parser lived in an editor-owned `useMemo`, which re-executed in the observed development render even though the debounced text value was unchanged. The counters prove the extra execution, but they do not identify React's internal scheduling or replay cause.

## Evidence

- UI snapshot: content-free pre-fix counter delta in `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/metrics.json`
- Post-fix visual context only: `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/02-long-draft-preview-390x844.png`
- Terminal transcript: focused typecheck, lint, and test results in the OPT-115 checkpoint

## Frequency

- Always in the measured pre-fix development reproduction

## Scope

- Affected route/screen: `/shelf/ocr`
- Affected account or fixture: synthetic local OCR draft; no account dependency
- External service involved: none
- Destructive action involved: none

## Suspected Cause

The expensive parser calculation was owned by `OcrReviewEditor`. `useMemo` is a cache optimization, not an isolation boundary, so the calculation could be re-executed during an editor render before debounced state changed. The exact internal React cause was not instrumented.

## Minimal Fix Recommendation

Move `parseIngredientText(previewText)` into the memoized `OcrParsedPreview` leaf and pass only debounced preview text to that leaf. Raw editor commits then do not render or execute the preview component.

## Verification Flow After Fix

1. Reload the same Expo-web surface and re-enter the forced capture-failure review.
2. Load the same 3,852-character prefix, then enter the 128-character suffix through 128 individual key actions.
3. Verify zero route, capture-panel, preview-parse, and preview-render deltas immediately; wait 300 ms and verify one preview parse/render.
4. Append the final marker and submit while pending to verify exact-current parsing still works.

## Post-Fix Evidence

- Screenshot: `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/02-long-draft-preview-390x844.png`
- UI snapshot: post-fix before/immediate/settled counters in `test-results/human-e2e/2026-07-16/ocr-input-isolation-current/metrics.json`
- Result: 128 draft changes and editor commits; zero route/capture/preview deltas during typing; one preview parse/render after 300 ms

## Remaining Risk

- Untested branches: production Hermes, native keyboard/IME, screen readers, real camera/OCR, physical-device frame and energy behavior
- Missing fixtures: native long-label capture and OCR-recognition stress fixture
- Follow-up needed: capture native profiler and accessibility evidence before OPT-115 can be verified
