# Text-Pressure Route Audit

Generated: 2026-07-09T18:18:17.059Z
Viewport: 430 x 932
Text pressure scale: 2
Status: fail
Failed routes: 6 / 7

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /you: 4 issue(s)
- /you?section=privacy: 4 issue(s)
- /you?section=security: 4 issue(s)
- /you?section=commerce: 4 issue(s)
- /you?section=support: 4 issue(s)
- /you?section=accountDeletion: 4 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
