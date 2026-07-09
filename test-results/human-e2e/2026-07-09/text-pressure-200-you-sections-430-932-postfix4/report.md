# Text-Pressure Route Audit

Generated: 2026-07-09T18:22:15.929Z
Viewport: 430 x 932
Text pressure scale: 2
Status: pass
Failed routes: 0 / 7

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- None.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
