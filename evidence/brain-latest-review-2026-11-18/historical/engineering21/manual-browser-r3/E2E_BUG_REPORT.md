# E2E Bug Report: Manual save status and barcode selection semantics

Severity: Medium
Surface: Expo web
Environment: Windows, isolated Edge headless profile, actual local Expo web, 375 x 667, synthetic adult owner and explicitly granted health consent
Feature: Engineering21 durable manual intake
Date: 2026-11-17
Tester: Codex local browser evidence driver

## Reproduction Steps

1. Complete the actual synthetic Welcome, adult date and health-consent screens; open Shelf and Add a product.
2. Enter the synthetic name and brand with surrounding whitespace, barcode `96385074`, select EAN-8, and enter multiline ingredients.
3. Activate Save intake draft on this device with Enter.
4. Observe the status before making any later edit.
5. Edit the name without saving, reload, open Saved intake drafts and Resume saved intake draft.
6. Inspect the original values and the EAN-8 radio state.

## Expected Result

- Immediately after verified save, the status identifies the current form as the saved revision. Later unsaved edits receive a separate status.
- The selected EAN-8 radio exposes its checked state to accessibility consumers.

## Actual Result

- Success copy says the draft was saved, while the same screen immediately says `Unsaved changes since draft revision 1` before the next edit.
- Raw name, brand, barcode and ingredient text restore exactly. EAN-8 is visually selected, but both barcode role=radio elements have no `aria-checked` attribute. The driver refuses to treat visual color alone as accessible selection evidence.

## Evidence

- Saved screen: `375x667-manual-saved.png` and `375x667-manual-saved.json`.
- Resume screen: `FAILURE.png` and `FAILURE.json`.
- Interaction trace: `steps.json`.
- Terminal receipt/log: `../manual-browser-r3.json` and `../manual-browser-r3.log`.

## Frequency

Once in the first executed app-surface pass. The flow stopped at the first selected-state assertion.

## Scope

- Routes: `/shelf/manual`, `/shelf/intake-drafts`.
- Isolated synthetic owner only; no genuine provider or external service.
- No real user data or destructive action.

## Suspected Cause

- Saved-state comparison serializes raw form objects whose property insertion order differs after strict decoding; equivalent factual form values may compare unequal.
- The existing web radio mapping does not publish `accessibilityState.checked` as `aria-checked` for this rendered element.

## Minimal Fix Recommendation

Compare the raw form's defined fields independently of object insertion order, and publish the radio's checked state explicitly through the supported web accessibility prop. Preserve raw input bytes and all existing authority guards.

## Verification Flow After Fix

1. Rerun the same synthetic manual save and reload/resume flow at 375 x 667.
2. Require saved status immediately after Save, an unsaved status only after a later edit, and accessible selected EAN-8 after resume.
3. Continue the original opening/PAO/add/discard/refusal journey at 375 x 667, 390 x 844 and 430 x 932.

## Post-Fix Evidence

Pending a new separately named run. This failed evidence remains retained.

## Remaining Risk

The flow after resume and the two larger layouts are not yet browser-verified. Native/VoiceOver/device qualification remains excluded.
