# Synthetic browser report

Surface: actual Expo web through headless Chrome and the existing CDP driver.
Viewport/device classification: 375x667 and 390x844 web geometry only.
Start commands, sanitized development fixture flags, ports and exact CLI exits
are in the UI command receipts and driver summaries. Every run uses a fresh
browser profile. The maintained launcher removes credential-named environment
values and uses blocked Supabase placeholders; no live provider is accessed.

| Flow | 375x667 | 390x844 | Evidence |
| --- | --- | --- | --- |
| Direct protected route before age/consent | PASS | PASS | 01a-direct-protected-age-gate |
| Explicit consent, goals, all quiz answers | PASS | PASS | actions.jsonl and UI snapshots |
| Keyboard focus/Enter/repeat | PASS | PASS | J02-keyboard, J02-quiz-keyboard-repeat |
| Empty intake, three products, free continuation | PASS | PASS | 09-products-empty, paywall/Today snapshots |
| Shelf manual fallback, repeated offline save | PASS | PASS | M1-02-offline-double-save, durable-read JSON |
| Save while older background read waits | PASS | PASS | J02-cache-read-race, J02-saved-during-refresh |
| Quick-open write failure/alert/retry | PASS | PASS | J02-quick-open-error/recovered |
| Offline edit, archive, re-online reload | PASS | PASS | M1-03, M1-04, M1-05 snapshots |
| Remove failure/retry, corrupt envelope/recovery | PASS | PASS | M1-05b through M1-08 snapshots |
| Today checklist, duplicate/rejected writes and reload | PASS | PASS | M102-daily-loop.json and M102 step snapshots |
| Progress/You/Shelf/Today round trip | PASS | PASS | keyTabs and routeCheck in summary.json |
| Underage re-verification/direct Today/reload denial | PASS | PASS | 26/27/28 snapshots and summary routeCheck |
| Delayed A work, cleanup refusal/retry, own B consent and data | source simulations | PASS | cross-owner390/summary.json and CO-b-boundaries |

Successful main runs retain 12 PNGs each plus all UI snapshots and synthetic
click/input traces. The cross-owner run retains 10 PNGs. The errored exploratory
browser runs retain their failure screenshots and logs. The new task's evidence
manifest binds all retained bytes; no private photo is present.

Controls are located by visible/accessible labels. Successful driver geometry
checks have zero horizontal overflow on summarized route transitions. The
quick-opening error screenshot at both sizes was visually inspected; its alert
is readable, choices remain visible/reachable, and retry succeeds. Some mounted
background controls are intentionally occluded by a sheet; those snapshots are
retained with targeted actionable-control checks instead of claiming all
background targets are clickable. Cross-owner checks likewise distinguish
specific visible controls from retained offscreen/mounted content.

Important limits: reset-to-initial-read closes the existing route boundary,
which was recorded as a failed wrapper attempt. The initial-read race is
reproduced by deterministic real-query/hook tests; the browser uses a delayed
background read. Component tests reproduce queued same-render Next and final
navigation races. Browser input verifies ordinary touch/keyboard completion,
not native event timing. Native VoiceOver/Dynamic Type/OS and paid positive
surfaces remain NOT_RUN. The free fixture proves denial of paid authority and
truthful pending-review guidance; it grants no clinical or subscription proof.
