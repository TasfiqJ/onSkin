# Text-Pressure Route Audit

Generated: 2026-07-09T19:01:57.660Z
Viewport: 390 x 844
Text pressure scale: 2
Status: fail
Failed routes: 1 / 1

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /settings/beta-feedback: 2 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
