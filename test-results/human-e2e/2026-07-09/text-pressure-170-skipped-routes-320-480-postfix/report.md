# Text-Pressure Route Audit

Generated: 2026-07-09T12:52:48.652Z
Viewport: 320 x 480
Text pressure scale: 1.7
Status: pass
Failed routes: 0 / 21

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- None.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
