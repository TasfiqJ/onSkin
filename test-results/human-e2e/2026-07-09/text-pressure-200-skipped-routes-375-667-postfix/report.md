# Text-Pressure Route Audit

Generated: 2026-07-09T13:05:36.075Z
Viewport: 375 x 667
Text pressure scale: 2
Status: fail
Failed routes: 1 / 21

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /shelf/missing-shelf-e2e: 2 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
