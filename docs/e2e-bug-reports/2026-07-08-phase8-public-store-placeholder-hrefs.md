# E2E Bug Report: Phase 8 public pages exposed placeholder store hrefs

Date: 2026-07-08
Severity: High
Surface: Static public web pages

## Environment

- Static server: `python -m http.server 8332 --bind 127.0.0.1 --directory docs/phase-8/public-site`
- Browser: Codex in-app browser
- Viewport: 390 x 700

## Reproduction

1. Open `docs/phase-8/public-site/index.html` before final store URLs are substituted.
2. Inspect the App Store and Google Play links.
3. Repeat on `docs/phase-8/public-site/share.html`.

## Expected

Phase 8 source-of-truth says placeholder launch values keep public surfaces inert. Store buttons should not expose raw `__APP_STORE_URL__` or `__PLAY_STORE_URL__` as clickable destinations before final store URLs exist. Users should have a clear waitlist path.

## Actual

The App Store and Google Play anchors used raw placeholder tokens as `href` values. On a public static site, that makes the buttons look live while sending users to broken placeholder URLs.

## Fix

Move unresolved store tokens into `data-store-url`, keep the source `href` pointed at `/waitlist.html`, label the buttons as store waitlist actions while placeholders are present, and promote only validated `https://apps.apple.com/...` or `https://play.google.com/...` URLs at runtime. The Phase 8 readiness checker now rejects raw placeholder store hrefs.

## Evidence

- Browser evidence: `test-results/human-e2e/2026-07-08/phase8-public-store-link-fallback/`
- Source-level final substitution check: `test-results/human-e2e/2026-07-08/phase8-public-store-link-fallback/final-store-link-source-check.json`

## Remaining Risk

Final App Store and Play Store URLs, Universal Links/App Links, and store-console identity still require Phase 8 external evidence before public launch.
