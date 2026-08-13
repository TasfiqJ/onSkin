# Selected accessible UI snapshots

## Persistent hub after Retry

```text
alert
  Private data
  Guidance unavailable
  We couldn't safely read the private data this guidance needs.
  The private data is still unavailable. Layerwell did not reset or remove it.
button "Retry loading private data"
button "Back to You"
```

No recommendation card, `For you` heading, or `you're set` state was present.

## Persistent Preferences after Retry

```text
alert
  Private choices
  Recommendation choices unavailable
  Preferences, dismissed suggestions, and personalized guidance are paused.
  Your saved recommendation choices are still unavailable.
button "Retry loading recommendation choices"
button "Back to For you"
```

No preference chip was present.

## Loading

```text
button "Back"
Preferences
generic "Loading recommendation preferences"
  Loading recommendation preferences…
```

## One-shot preference recovery

```json
{
  "Vegan": "true",
  "Premium": "true",
  "Gel": "true",
  "Fragrance-free": "false",
  "Mid-range": "false"
}
```

## One-shot dismissed-state recovery

```text
heading "For you"
button "A mineral SPF 30+..."
button "A gentle cleanser..."
```

Exact visible count for `A ceramide moisturiser`: `0`.

## Cross-consumer persistent failure

- Stale detail rendered `Guidance unavailable` before stale-copy/actions.
- Ask rendered the full private-guidance recovery and persistent retry-failed copy.
- Today rendered its real routine/empty state without a recommendation teaser or SPF prompt.

## Future schema

Snapshot scan result: `{ "rawCodeLeak": false }` for `REC_*`, `unsupported_version`, and future-schema phrases.

## Today dismissal failure after 4.8 seconds

```text
alert
  Suggestion not dismissed
  We couldn't save “Not now.” Nothing was removed.
  button "Retry loading recommendation choices after dismissal failure"
button "See why"
button "Not now"
```

Counts after 4.8 seconds: `{ "alertCount": 1, "notNowCount": 1 }`.

After `Reload suggestion`: `{ "alertCount": 0, "notNowCount": 1 }`.

After the second, committed `Not now`: `{ "notNowCount": 0 }`.

## Committed detail dismissal with delayed strict reread

Fixture: `EXPO_PUBLIC_E2E_RECOMMENDATION_READ_DELAY_MS=3000` at the effective 390 x 845 mobile viewport.

```json
{
  "hubSeenMs": 43,
  "addStillVisibleAfterHub": false,
  "backCompletedMs": 3094,
  "finalUrlAfterAdditional3600ms": "http://localhost:8265/today",
  "remainingRecommendationCount": 1
}
```

The final Today snapshot retained the cleanser routine and changed `2 things we'd gently suggest` to `1 thing we'd gently suggest`. No delayed continuation returned to or popped the For You route.
