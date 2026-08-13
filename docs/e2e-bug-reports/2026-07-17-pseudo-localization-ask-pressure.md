# E2E Bug Report: Ask long copy enters fixed chrome

Severity: Medium

Surface: Expo web

Environment: Headless Chrome, Expo development server, 375 x 667 and 390 x
844 supported-phone viewports, expanded pseudo-locale, 100% and 120% text
pressure

Feature: Ask home

Date: 2026-07-17

Tester: Codex

## Reproduction Steps

1. Start Expo web with `EXPO_PUBLIC_E2E_PSEUDO_LOCALE=expanded`.
2. Open `/ask` at 390 x 844, then at 375 x 667 with 120% text pressure.
3. Inspect the one-line title and each visible suggestion's hit-test center.

## Expected Result

The Ask title and every visible suggestion remain readable, complete, and
center-hit-testable without entering the fixed composer.

## Actual Result

The first run found the expanded full Ask title overflowing its one-line phone
header by 20 px. At the compact 375 x 667 / 120% combination, a lower suggestion
continued beneath the fixed composer and its center resolved to the composer's
send icon.

## Evidence

- Initial UI snapshot: machine-readable route audit reported one Ask text
  overflow and one blocked suggestion center during development.
- Post-fix screenshots and route snapshots:
  `test-results/human-e2e/2026-07-16/pseudo-localization-120-375x667-current/ask.png`
  and
  `test-results/human-e2e/2026-07-16/pseudo-localization-120-390x844-current/ask.png`.
- Terminal transcript: final route audits report zero failures.

## Frequency

Always under the named viewport/copy-pressure combinations.

## Scope

- Affected route/screen: `/ask`
- Affected account or fixture: placeholder local account; expanded pseudo-locale
- External service involved: None
- Destructive action involved: No

## Suspected Cause

The phone header kept the full product title in a one-line box, and the empty
Ask state selected its suggestion count only from viewport height. Neither
decision accounted for substantially expanded strings. The audit also measured
window visibility without intersecting nested scroll/clipping ancestors.

## Minimal Fix Recommendation

Use the compact visible Ask title through the supported phone-width band while
retaining the full accessibility label. Detect long prompt pressure from the
presented strings and platform font scale, then show only a complete high-value
suggestion above the composer. Intersect controls with every clipping ancestor
before geometry and center-hit testing.

## Verification Flow After Fix

1. Re-run the same eight-route matrix at 375 x 667 and 390 x 844.
2. Keep the expanded pseudo-locale and 120% text pressure enabled.
3. Inspect the Ask screenshots and verify the JSON route snapshots contain zero
   overflow, undersized-target, partial-clip, or blocked-center issues.

## Post-Fix Evidence

- Both final matrices pass 8/8 routes with zero issues and zero disallowed logs.
- The compact screenshot shows `Ask` completely in the header and one complete
  suggestion above the composer.
- Focused Ask route, pseudo-localization policy, and source-inventory tests pass.

## Remaining Risk

- Native iOS Dynamic Type, VoiceOver focus/announcement order, keyboard
  interaction, and real translated copy still require supported-device QA.
- Bidirectional layout is not exercised by the expanded Latin fixture.
