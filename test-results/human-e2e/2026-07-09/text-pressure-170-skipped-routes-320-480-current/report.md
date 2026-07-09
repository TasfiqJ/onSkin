# Text-Pressure Route Audit

Generated: 2026-07-09T12:46:44.401Z
Viewport: 320 x 480
Text pressure scale: 1.7
Status: fail
Failed routes: 3 / 21

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /onboarding/age: 3 issue(s)
- /paywall/reoffer: 1 issue(s)
- /conflict/00000000-0000-4000-8000-000000000001: 2 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
