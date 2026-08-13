# Text-Pressure And Pseudo-Localization Route Audit

Generated: 2026-07-17T05:06:44.982Z
Viewport: 390 x 844
Text pressure scale: 1.2
Pseudo locale: expanded
Status: pass
Failed routes: 0 / 8

This Expo web pass optionally expands and accents user-facing copy at the shared
text boundary, multiplies direct text-node font sizes and line heights after route
render, then checks visible controls for clipping, blocked hit targets, sub-44 px
visible targets, horizontal overflow, and unexpected browser logs.

## Failed Routes

- None.

## Remaining Risk

- Native iOS/Android Dynamic Type, VoiceOver, TalkBack, keyboard, and hardware safe-area behavior still require device QA.
