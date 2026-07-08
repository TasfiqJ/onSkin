# Today SPF Gap Prompt

Date: 2026-07-08
Surface: Codex in-app browser, Expo web
Viewport: 320 x 568
Route: `http://localhost:8195/today?routine=AM`

## Setup

Used the real manual shelf flow on a clean local origin to add:

- `Gentle cleanser`
- `Barrier moisturizer`

No SPF product was added. The app used the local neutral profile fallback.

## Assertions

- `/today?routine=AM` renders a real AM routine with cleanser and moisturizer.
- The compact SPF prompt shows full readable `No SPF this morning`.
- `See why` is 176 x 56 px and `Not now` is 86 x 48 px.
- Horizontal overflow is zero on the initial prompt, detail route, dismissed state, and reload state.
- `See why` opens `/recommendations/gap:mineral_spf` and shows the mineral SPF rationale.
- `Not now` dismisses the prompt.
- Reloading Today keeps the SPF prompt dismissed.
- Current-port warn/error browser logs are empty.

## Evidence

- `01-today-spf-prompt-initial.png`
- `01-today-spf-prompt-initial.json`
- `02-after-see-why-detail.png`
- `02-after-see-why-detail.json`
- `03-today-before-dismiss.png`
- `04-today-after-dismiss.png`
- `04-today-after-dismiss.json`
- `05-today-after-dismiss-reload.png`
- `05-today-after-dismiss-reload.json`
- `summary.json`
- `browser-warn-error-logs.json`

## Remaining Risk

Native iOS/Android Dynamic Type and screen-reader verification remain device QA.
