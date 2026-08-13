# Ask History Prepend-Anchor Run

This folder contains sanitized evidence from the 2026-07-18 human-simulated Expo-web run on branch `optimization`, implementation `401f506f1e4f4931cca41c3cb6b2cc0cf38bf259`.

The app was cold-started with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100` and driven through the Codex in-app Browser at a requested 390 x 844 phone viewport. The deterministic fixture contains mixed-height sanitized questions and no user, account, product, health, or credential content.

After one accepted turn produced 202 logical messages, all 12 older-page boundaries reached exact visible start indexes `170, 154, 138, 122, 106, 90, 74, 58, 42, 26, 10, 0`. Every prior anchor remained unique and settled. Its top delta ranged from 20.388 px to 21.632 px across the whole traversal, a 1.244 px range. The largest error between an exact commanded anchor offset and observed scroll position was 0.428 px. No page blanked.

At the oldest boundary, turn 1 was visible at scroll top zero. The route held all 202 active presentation items while the web recycler mounted about 16 message rows near the viewport. Typing a 51-character sanitized draft caused zero history commits, row renders, or logical-message changes. Keyboard Return published exactly one user/assistant pair, cleared the draft, reset the presentation to the latest 16 messages, and settled within 0.583 px of the latest edge.

`oldest-turn.png` and `post-keyboard-latest.png` are the visual checkpoints. `metrics.json` is the content-free raw observation. Development-mode web evidence does not verify native `maintainVisibleContentPosition`, production Hermes frame or memory behavior, VoiceOver, Dynamic Type, or a signed supported-iOS device.
