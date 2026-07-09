# Text-Pressure Route Audit

Generated: 2026-07-09T23:07:15.190Z
Viewport: 430 x 700
Text pressure scale: 2
Status: fail
Failed routes: 1 / 49

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /recommendations/preferences: 6 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
