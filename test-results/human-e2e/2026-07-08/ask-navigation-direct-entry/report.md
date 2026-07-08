# Ask Navigation Direct-Entry E2E Report

Date: 2026-07-08
Surface: Expo web
Viewport: 320 x 568
Route: `/ask` and `/ask/consent`

## Result

Pass.

System Chrome drove the Ask direct-entry navigation branch against Expo web. `/ask` rendered the deterministic Ask RoutineKind advisor, survived reload, and the direct-entry Back control recovered to `/today`. `/ask/consent` rendered the cloud Ask deferred beta surface while cloud Ask was disabled, and `Back to Ask` recovered to `/ask`.

All captured states had zero horizontal overflow. Visible Ask Back, composer, and Send controls were 48 px tall; the deferred `Back to Ask` CTA was 272 x 56 px.

## Evidence

- `01-ask-direct-320x568.png`
- `01-ask-direct-320x568.json`
- `02-ask-reloaded-320x568.png`
- `02-ask-reloaded-320x568.json`
- `03-ask-back-to-today-320x568.png`
- `03-ask-back-to-today-320x568.json`
- `04-ask-consent-deferred-320x568.png`
- `04-ask-consent-deferred-320x568.json`
- `05-ask-consent-back-to-ask-320x568.png`
- `05-ask-consent-back-to-ask-320x568.json`
- `browser-logs.json`
- `summary.json`

## Commands

```bash
npm --workspace apps/mobile run web -- --port 19143 --host localhost
NODE_PATH="%LOCALAPPDATA%\\npm-cache\\_npx\\420ff84f11983ee5\\node_modules" E2E_BASE_URL=http://localhost:19143 npm exec --yes --package=@playwright/test -- playwright test scripts/tmp-e2e/ask-navigation.spec.js --reporter=list --output=web-build/playwright-output-ask-navigation
```

## Logs

No browser `error` or `pageerror` events were recorded. Expected development warnings appeared for placeholder Supabase values and Expo notification web support.

## Remaining Risk

This web pass does not replace native iOS/Android keyboard, screen-reader, or OS back-swipe testing.
