# Text-Pressure Route Audit

Generated: 2026-07-09T22:00:09.409Z
Viewport: 320 x 390
Text pressure scale: 1
Status: pass
Failed routes: 0 / 49

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- None.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
