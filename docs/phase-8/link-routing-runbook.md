# Phase 8 Link Routing Runbook

The final domain must be first-party. Do not use Firebase Dynamic Links.

## Current CORE-07A Behavior

| Scenario                                                                 | Required result                                                                                 |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Share/public-link flags and final domain appear valid                    | Publication still refuses; configuration is not authority                                       |
| Private conflict is admitted                                             | No share follows; private guidance admission is not a publication receipt                       |
| Any `/s/:shareId`, including a syntactically valid-looking ID            | Same neutral unavailable state; no record, review, expiry, revocation, or existence implication |
| Mobile share route                                                       | Returns before capture, file, URL, network, native-share, or analytics work                     |
| Static web fallback                                                      | Neutral unavailable copy only; no landing/store-click/share-ID beacon or record-derived request |
| Raw conflict, Shelf, product, profile, health, reviewer, or receipt data | Rejected before renderer; the renderer boundary accepts only a constructed sanitized projection |

There is no current share receipt issuer or public token service. The machine
launch contract fixes both admissions to false. Do not dry-run per-record links
or treat a 200 response, path syntax, flag, domain, screenshot, or analytics
event as acceptance evidence.

## Future Required Behavior

This section is a gated design target. It becomes executable only after an
accepted successor contract provides positive share and public-link authority,
exact-source `REV-02` through `REV-06` decisions, and `REV-07` detached
signoffs.

| Scenario                                               | Future expected result                                                       |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| iOS app installed, tap exact admitted link             | Opens only the receipt/token-bound destination through Universal Links       |
| iOS app not installed                                  | Opens a non-indexing reviewed fallback with the exact permitted store CTA    |
| Android app installed, tap exact admitted link         | Opens only if Android returns to release scope and App Links are re-approved |
| Android app not installed                              | Uses the reviewed Android fallback only if Android returns to release scope  |
| Desktop browser                                        | Uses the reviewed privacy-minimized fallback                                 |
| Malformed, unknown, expired, revoked, or deleted token | Same neutral unavailable response with no existence oracle                   |

## Future iOS Universal Links

`apps/mobile/app.config.js` may add `applinks:DOMAIN` to
`ios.associatedDomains` when the final domain is real. That configuration does
not admit a share or token.

The final domain must serve `/.well-known/apple-app-site-association` with:

- No file extension
- `application/json` content type
- Team ID from Apple Developer
- Final bundle identifier
- Paths covering `/s/*`

Template: `docs/phase-8/public-site/.well-known/apple-app-site-association.template.json`.

## Future Android App Links

Android is outside the current release contract. If it returns to release
scope, `apps/mobile/app.config.js` may add an auto-verified HTTPS intent filter
after the same independent token authority and Android-specific review pass.

The final domain must serve `/.well-known/assetlinks.json` with:

- `application/json` content type
- Final Android package name
- SHA-256 signing certificate fingerprints for release builds
- Relation `delegate_permission/common.handle_all_urls`

Template: `docs/phase-8/public-site/.well-known/assetlinks.template.json`.

## Current Payload

None. Mobile code must not create a share URL, attribution payload, public
token, capture, temporary file, network call, analytics event, or native share
request while admission is closed.

The prior allowlist below is historical/future campaign infrastructure; none of
its keys is currently admitted on a conflict-share path:

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
- `share_id` (explicitly forbidden while public-link admission is closed)

Blocked query data:

- Product names or IDs
- Ingredient names
- Rule IDs
- Skin profile, goals, concerns, pregnancy status
- Photos, file paths, OCR text, notes
- Email, phone, address, user ID, free text
- Share receipt, reviewer, citation, provenance, or internal rule fields

## Future Exact-Payload Confirmation

Immediately before any native share sheet opens, the user must see and
affirmatively confirm the exact image, text, link, sender/destination behavior,
and redisclosure warning. Confirmation must bind the same immutable projection
bytes and token used by the share attempt. A generic `Share` tap before
capture, a stale preview, a confirmation after the native sheet opens, or
consent bundled with health-data collection does not pass.

## Future Dry Run

Do not run this as current acceptance. After a positive successor is reviewed:

1. Build a production iOS app with the exact signed source, final bundle ID,
   associated domain, admitted receipt issuer, and token service.
2. Install on a physical iPhone and confirm the exact payload before sharing.
3. Exercise Messages/Safari installed and uninstalled behavior with admitted,
   malformed, unknown, expired, revoked, and deleted tokens.
4. Verify recipient, crawler, cache, indexing, abuse/rate, incident, withdrawal,
   and deletion behavior against the reviewed lifecycle.
5. Prove no raw/private field, share ID, destination, or payload enters
   analytics, observability, logs, URLs, or unapproved processors.
6. Exercise cancel, offline, interruption, account change, capture/file/link/
   native-share failures, temporary-file cleanup, VoiceOver, Dynamic Type, and
   1080 x 1920 output.
7. If Android later re-enters scope, perform its separately reviewed App Link
   and signed-device matrix.
8. Record governed exact-build evidence in the Phase 8 packet.
