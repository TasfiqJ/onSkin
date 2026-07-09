# Support Floor Layout Constant Follow-up E2E

Generated at: 2026-07-09T08:31:09.812Z

Surface: Codex in-app browser, Expo web localhost:8255

## Result

PASS

## Cases

- privacy-floor-320x480: PASS; route=/settings/privacy; viewport=320 x 480; href=http://localhost:8255/you?section=privacy; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\privacy-floor-320x480.png
- privacy-modern-390x844: PASS; route=/settings/privacy; viewport=390 x 844; href=http://localhost:8255/you?section=privacy; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\privacy-modern-390x844.png
- notifications-floor-320x480: PASS; route=/settings/notifications; viewport=320 x 480; href=http://localhost:8255/settings/notifications; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\notifications-floor-320x480.png
- notifications-modern-390x844: PASS; route=/settings/notifications; viewport=390 x 844; href=http://localhost:8255/settings/notifications; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\notifications-modern-390x844.png
- manual-floor-320x480: PASS; route=/shelf/manual; viewport=320 x 480; href=http://localhost:8255/shelf/manual; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\manual-floor-320x480.png
- manual-split-stress-320x400 (non-blocking stress): PASS; route=/shelf/manual; viewport=320 x 400; href=http://localhost:8255/shelf/manual; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\manual-split-stress-320x400.png
- preferences-modern-390x844: PASS; route=/recommendations/preferences; viewport=390 x 844; href=http://localhost:8255/recommendations/preferences; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\preferences-modern-390x844.png
- preferences-floor-320x480: PASS; route=/recommendations/preferences; viewport=320 x 480; href=http://localhost:8255/recommendations/preferences; overflow=0; clipped=0; sub44=0; blocked=0; current-origin warn/error logs=0; dialog=none; screenshot=C:\Users\jasim\Desktop\onSkin\test-results\human-e2e\2026-07-09\support-floor-layout-constant-followup-current\preferences-floor-320x480.png

## Acceptance

- /settings/privacy resolves to /you?section=privacy; visible privacy controls are complete and policy/data rows remain below the first viewport.
- /settings/notifications keeps visible notification controls complete and hit-testable after the promotional section spacer increase.
- /shelf/manual keeps first-viewport manual-entry controls complete at the 320 x 480 support floor and at a 320 x 400 non-blocking split-short stress viewport; Ingredients stays below the first viewport.
- /recommendations/preferences keeps visible value, budget, and texture chips complete after the modern texture-group spacer.
- All cases report zero horizontal overflow, clipped controls, sub-44 visible controls, blocked hit centers, JavaScript dialogs, and current-origin browser warnings/errors.

## Open Native QA

Native iOS/Android safe-area and Dynamic Type verification remain device QA because this pass used Expo web-compatible browser evidence. The 320 x 400 manual case is a resilience stress check below the launch support floor.
