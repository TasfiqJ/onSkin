# Text-Pressure Route Audit

Generated: 2026-07-09T22:25:20.588Z
Viewport: 393 x 852
Text pressure scale: 2
Status: fail
Failed routes: 1 / 49

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /community: 2 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
