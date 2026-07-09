# Settings Privacy Policy Support Spacing E2E

Generated at: 2026-07-09T08:19:49.641Z

Route: /settings/privacy
Expected resolved route: /you?section=privacy
Surface: Codex in-app browser, Expo web localhost:8255

## Result

PASS

## Cases

- floor-320x480 (320 x 480): PASS; href=http://localhost:8255/you?section=privacy; overflow=0; clipped=0; sub44=0; blocked=0; visible policy rows=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\settings-privacy-policy-support-spacing-current\floor-320x480-settings-privacy.png
- modern-390x844 (390 x 844): PASS; href=http://localhost:8255/you?section=privacy; overflow=0; clipped=0; sub44=0; blocked=0; visible policy rows=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\settings-privacy-policy-support-spacing-current\modern-390x844-settings-privacy.png

## Acceptance

- Privacy direct entry resolves to /you?section=privacy.
- Visible privacy controls remain complete, hit-testable, and at least 44 px on the supported 320 x 480 floor and a modern 390 x 844 phone viewport.
- The policy block remains present in page content but is fully below the first viewport, keeping policy rows out of the floating tab-bar hit zone.
- No horizontal overflow, JavaScript dialogs, or current-origin browser warnings/errors were observed.

## Open Native QA

Native iOS/Android safe-area and Dynamic Type verification remain device QA because this pass used Expo web-compatible browser evidence.
