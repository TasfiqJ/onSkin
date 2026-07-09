# Text-Pressure Route Audit

Generated: 2026-07-09T18:10:52.189Z
Viewport: 360 x 640
Text pressure scale: 2
Status: fail
Failed routes: 6 / 7

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /you: 1 issue(s)
- /you?section=privacy: 1 issue(s)
- /you?section=security: 4 issue(s)
- /you?section=commerce: 4 issue(s)
- /you?section=support: 4 issue(s)
- /you?section=accountDeletion: 4 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
