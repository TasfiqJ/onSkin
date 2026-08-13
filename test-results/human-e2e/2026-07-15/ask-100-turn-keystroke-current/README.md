# Ask 100-turn keystroke run

This folder contains sanitized, content-free measurements from the 2026-07-15 human-simulated Expo-web run on branch `optimization`, implementation `8bc2c14a64c8c05c28602f6220dfbf678b1faf90`.

The app was cold-started with `EXPO_PUBLIC_E2E_ASK_HISTORY_TURNS=100` and exercised through the Codex in-app Browser with a 390 x 844 viewport override. The browser reported a 390 x 845 document viewport. No question, answer, account, product, health, or private-storage content is retained here.

The deterministic fixture represented 100 completed turns / 200 logical messages. The complete logical transcript stayed in route state while the chronological `FlatList` initially received the latest 16 messages. One older-page interaction grew that presentation window to 32 without changing logical cardinality.

An exact sanitized 158-character draft produced zero Ask-history commit, row-render, message-count, active-window, or accepted-turn deltas. Near-simultaneous keyboard Enter plus visible Send produced one accepted-turn delta, two logical messages, three history commits, two row renders, and a cleared draft. Twenty-four 250 ms samples then covered six seconds: none rebounded to the top, and the maximum absolute latest-edge error was 0.136 px. Whitespace published nothing. A reported answer retained its acknowledgement after paging away and returning.

`metrics.json` is the raw bounded observation. This is development-mode web behavior evidence only. It does not prove native timing, memory, frame pacing, accessibility, analytics transport, precise prepend anchoring, or production Hermes performance.
