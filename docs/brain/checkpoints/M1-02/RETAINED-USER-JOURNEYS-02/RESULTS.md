# Results and reproduced failures

## Committed Shelf state versus an older initial read

`invalidateQueries` can join an already running, data-less initial fetch. A
successful local mutation could therefore await that old snapshot and publish
the pre-write products. Four deterministic tests reproduced missing added
products, pre-edit/pre-archive content, and removed content reappearing in the
query result. The underlying durable store remained correct.

The existing mutation hook now cancels earlier Shelf reads before invalidating
and re-reading committed state. An authority assertion after cancellation stops
an ended owner/consent operation from invalidating successor data. All eight
existing mutation methods use that same refresh path. No storage format, owner
primitive, replay identity or server contract changes.

Tests use the real React Query observer/cache and the actual mutation hook,
with deterministic storage ports and a delayed initial snapshot. Additional
negative tests cover ended authority during cancellation and a failed fresh
read followed by recovery of the durable product. Existing real encrypted
Shelf integration covers corruption, duplicate operation IDs, cold reload,
late account-switch/withdrawal writes and rollback.

Evidence distinction: forcing a data-less initial read in the browser correctly
closed the existing route boundary, so the wrapper could not tap Save. That
failed attempt is retained. The successful browser runs delay a background
read with retained data, then save offline and verify the product. They prove
ordinary visible behavior and recovery; the initial-read race reproduction
belongs to the deterministic hook tests.

## Quiz navigation

Next used a functional increment without an action guard. Calling an answered
question's handler twice advanced from question 1 to question 3. An old queued
handler could skip its unanswered successor; repeating actions near the end
could render an out-of-range question. The final action could navigate twice.

The route now synchronously claims each transition, advances to that exact
index once, rejects unanswered/stale handlers, and uses the existing strict
answer validator. Back resets the navigation position. Four real-route
component tests failed before the repair and pass afterward, including Back,
re-answering and exactly one final navigation. Scoring, quiz content, adult and
health-consent gates are unchanged.

Actual browser keyboard Enter advances the first answered question and a
repeated Enter cannot advance the unanswered next question at both sizes.
Normal visible option/button input completes all 12 questions. The queued
same-render race is component evidence, not native input proof.

## Quick opening-date action

The unopened product's `Record opening date` button directly called the
mutation, bypassing the same screen's guarded `saveMutation` path. A failed
write escaped as a rejected promise with no recovery feedback; two pending
taps made two writes. Both cases failed in the real-route component tests.

The button now reuses `setOpened(0)`, which already supplies single-flight
submission and accessible failure/retry feedback. It does not introduce a
new save mechanism. Both tests pass. At 375x667 and 390x844 the actual browser
injects a failed private write, reads the alert, verifies the unopened state,
restores storage and successfully retries. Screenshots were visually inspected.

## Preserved behavior and limits

- Accepted weekly-count, photo post-commit recovery and permission-classifier
  sources remain byte-identical. The wider test run includes their regressions.
- The new iteration modifies seven authorized source/test/document paths;
  `protected-objects.json` proves 16 protected/grandfathered objects unchanged.
- Browser runs use synthetic owners, products, age input and local controlled
  faults only. No real patient/user data, live account or provider is used.
- Browser warnings remain in the logs (placeholder configuration, unavailable
  web native APIs and deliberate fault injection). Passing harness checks do
  not mean an absence of warnings. No unexpected uncaught browser error is
  accepted by the successful runs.
- Native/OS permission and storage, signed iOS, process death, physical-device
  accessibility, paid positive views, hosted replay, real-account provider
  linking and live day rollover are NOT_RUN. Clock/DST/expired-consent cases
  in the retained suite are source simulations, not device proof.
- No new protected-path blocker was required for these repairs. Historic exact
  OWASP custody, 61 refused paths, 26 SQL obligations, 189 failed targets and
  368 historical events remain open. Original expiry 2026-10-21T00:00:00Z is
  unchanged and expired. DB06/DB08/R2B, clinical/J05, native/release and all
  paid-provider gates remain closed. No self-acceptance or merge readiness.
