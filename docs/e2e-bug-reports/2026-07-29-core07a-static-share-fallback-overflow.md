# E2E Bug Report: Static share fallback adds an empty vertical scroll range

Severity: Low
Surface: Expo web
Environment: Codex in-app browser, local static server, 390 x 844 viewport
Feature: CORE-07A static public-link fallback
Date: 2026-07-29
Tester: Codex

## Reproduction Steps

1. Serve `docs/phase-8/public-site/share.html` without modifying its markup.
2. Open a valid-looking `/s/:id` path at 390 x 844.
3. Inspect the viewport and document geometry.

## Expected Result

The short unavailable state fits the viewport without an empty scroll range.

## Actual Result

The page showed a vertical scrollbar even though all content fit. The scrollbar
exposed about 48 px of empty overflow.

## Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-29/core07a-zero-share-current/static-public-fallback-valid-looking-id-390x844.png`
- UI snapshot: heading and paragraph only; zero anchors, buttons, forms,
  iframes, or scripts.
- Terminal transcript: local static server on `127.0.0.1:19007`.

## Frequency

- Always

## Scope

- Affected route/screen: static `docs/phase-8/public-site/share.html`
- Affected account or fixture: none
- External service involved: none
- Destructive action involved: none

## Suspected Cause

`main` used `min-height: 100vh` with 24 px top and bottom padding under the
default content-box sizing, making its outer height 48 px taller than the
viewport.

## Minimal Fix Recommendation

Apply `box-sizing: border-box` to `main` so its padding is included in the
100-viewport-height box.

## Verification Flow After Fix

1. Reload the same valid-looking static path at 390 x 844.
2. Confirm the heading and paragraph remain visible.
3. Confirm document height equals viewport height and the page still contains
   zero anchors, buttons, forms, iframes, or scripts.
4. Open a malformed path and confirm the DOM snapshot is identical.

## Post-Fix Evidence

- Screenshot:
  `test-results/human-e2e/2026-07-29/core07a-zero-share-current/static-public-fallback-postfix-390x844.png`
- UI snapshot and geometry are recorded in the run report in the same evidence
  folder.

## Remaining Risk

- Native Universal Link and hosted CDN behavior remain future positive-path
  evidence because public-link admission is intentionally closed.
