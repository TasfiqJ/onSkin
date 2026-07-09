# Text-Pressure Route Audit

Generated: 2026-07-09T16:55:42.279Z
Viewport: 412 x 640
Text pressure scale: 2
Status: fail
Failed routes: 5 / 21

This Expo web pass multiplies direct text-node font sizes and line heights after
route render, then checks visible controls for clipping, blocked hit targets,
sub-44 px visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- /onboarding/age: 3 issue(s)
- /onboarding/goals: 1 issue(s)
- /onboarding/products: 4 issue(s)
- /onboarding/paywall: 2 issue(s)
- /paywall/downgrade: 3 issue(s)

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
