# Phase 8 Link Routing Runbook

The final domain must be first-party. Do not use Firebase Dynamic Links.

## Required Behavior

| Scenario                                               | Expected result                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| iOS app installed, tap `https://DOMAIN/s/SHARE_ID`     | Opens app through Universal Links                                 |
| iOS app not installed                                  | Opens `/s/SHARE_ID` landing page with App Store CTA               |
| Android app installed, tap `https://DOMAIN/s/SHARE_ID` | Opens app through Android App Links                               |
| Android app not installed                              | Opens `/s/SHARE_ID` landing page with Play CTA                    |
| Desktop browser                                        | Opens web fallback with QR/store choices                          |
| Invalid `SHARE_ID`                                     | Shows generic landing page; never reveals product/profile context |

## iOS Universal Links

`apps/mobile/app.config.js` adds `applinks:DOMAIN` to `ios.associatedDomains` when `EXPO_PUBLIC_FINAL_BRAND_DOMAIN` is real.

The final domain must serve `/.well-known/apple-app-site-association` with:

- No file extension
- `application/json` content type
- Team ID from Apple Developer
- Final bundle identifier
- Paths covering `/s/*`

Template: `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`.

## Android App Links

`apps/mobile/app.config.js` adds an auto-verified HTTPS intent filter when `EXPO_PUBLIC_FINAL_BRAND_DOMAIN` is real.

The final domain must serve `/.well-known/assetlinks.json` with:

- `application/json` content type
- Final Android package name
- SHA-256 signing certificate fingerprints for release builds
- Relation `delegate_permission/common.handle_all_urls`

Template: `docs/phase-8/public-site/.well-known/assetlinks.template.json`.

## Share Link Payload

Mobile code creates URLs through `src/lib/growth/attribution.ts` and `src/features/growth/shareLinks.ts`.

Allowed query keys:

- `source`
- `medium`
- `campaign`
- `content`
- `term`
- `creative_variant`
- `landing_variant`
- `platform`
- `app_version`
- `build_number`
- `store`
- `share_id`

Blocked query data:

- Product names or IDs
- Ingredient names
- Rule IDs
- Skin profile, goals, concerns, pregnancy status
- Photos, file paths, OCR text, notes
- Email, phone, address, user ID, free text

## Dry Run

1. Build a production iOS app with final bundle ID and associated domain.
2. Install on a physical iPhone.
3. Tap a real `https://DOMAIN/s/SHARE_ID` from Messages and Safari.
4. Uninstall the app and repeat.
5. Build a release Android app with final package and signing certificate.
6. Install on a physical Android device.
7. Run `adb shell pm get-app-links PACKAGE_NAME`.
8. Tap the link from Chrome, Messages, Gmail, and a desktop QR scan.
9. Confirm events are content-free: landing viewed, store click, install, onboarding, first product, first reviewed insight, trial, paid.
10. Record evidence in `docs/phase-8/generated/growth-store-qa-packet.md`.
