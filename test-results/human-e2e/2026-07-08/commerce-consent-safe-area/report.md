# Commerce Consent Safe-Area Verification

Date: 2026-07-08
Surface: Expo web via Codex in-app Browser
Viewport: 320 x 568 target, observed as 320 x 571
Route: `/commerce/consent`
Flags: `EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=true`

## Result

Pass with native-device risk for the compact web verification.

The enabled commerce consent route loaded as a bottom-sheet dialog with `aria-modal="true"`, a 44 px top dismiss reserve, zero horizontal overflow, and no mojibake in visible text. The Dismiss control rendered at 48 x 48, the primary Allow action at 264 x 54, and the secondary Not now action at 264 x 48.

## Evidence

- `01-commerce-consent-320x568-state.json`
- Focused commerce route contract test
- Mobile typecheck
- Mobile lint

## Screenshot Limitation

The in-app Browser returned `Unable to capture screenshot`; the evidence for this run is the bounded UI geometry snapshot plus the terminal transcript.

## Remaining QA

- iOS Simulator or physical iPhone with gesture home indicator.
- Android gesture navigation.
- Dynamic Type / font scaling inside the consent body and footer.
- VoiceOver and TalkBack traversal of the named dialog, Dismiss, Allow, and Not now controls.
