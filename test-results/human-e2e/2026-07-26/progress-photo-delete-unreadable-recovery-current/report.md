# Progress Photo-Deletion Unreadable Recovery

Date: 2026-07-26 (America/Toronto)

Surface: actual Expo web `/progress`

Fixture: `EXPO_PUBLIC_E2E_PHOTO_DELETE_SYNC_STATUS=unavailable_once`

## Result

Pass for the local typed-reader fault-injection boundary.

The development-web fixture calls the real current-owner outbox status reader, replaces only its first result with typed `unavailable`, and delegates every later read unchanged. Activating `Check again` uses the production single-flight callback and React Query `refetch()` path. The fixture does not mutate the outbox and is unavailable outside development web.

Two independent servers exercised:

- empty Progress at 360 x 640;
- populated Progress at 390 x 844.

Both initial states exposed exactly one alert titled `Deletion status unavailable` and one accessible `Check again` action. The action was 56 px high, fully visible, and center-hit-testable. Rapid double activation cleared the notice through the real refetch. Progress stayed usable, the empty surface stayed empty, and the populated surface retained its exact three-photo fixture.

The populated surface was then reloaded. A new fixture instance showed exactly one initial alert despite the prior query cache, and one `Check again` activation cleared it again. This is the current browser proof for cache/remount determinism.

## Geometry And Content

Every sampled state had:

- zero horizontal overflow;
- zero partial visible controls;
- zero visible controls below 44 x 44;
- zero failed center hit tests;
- zero JavaScript dialogs;
- zero page errors;
- zero UUID, encrypted filename, local path, outbox code, photo error code, or raw-error matches.

The empty primary capture action remained fully visible above the floating tab bar before and after recovery. The populated header, compare/timeline controls, date controls, comparison slider, and tab bar remained present after recovery.

## Accessibility

Before recovery, each surface exposed:

- one `alert`;
- the exact `Deletion status unavailable` title;
- the non-destructive body `No photo was restored or changed`;
- one button named `Check again`.

After recovery, the alert and `Check again` button were absent. The underlying Progress actions and tablist remained named.

## Logs

No page error or dialog occurred. The only warnings were the expected local placeholder Supabase URL/key warnings and Expo web notification-listener warning. No unexpected browser warning/error was observed.

## Behavior Proof Outside The Browser

The focused 8-file / 154-test matrix proves:

- the first fixture read calls the real reader and only replaces its returned presentation;
- the second read exposes the real idle result;
- concurrent reads consume the injected fault once;
- real `QueryClient` cache, refetch, and per-instance remount behavior;
- static saved/syncing/attention fixtures cannot read or retry the real outbox;
- duplicate retry activations join one promise;
- unreadable outbox state recovers without changing persisted bytes;
- null/blank owner status returns idle without hashing or reading private storage;
- signed-out and authenticated legacy/non-UUID deletion remain local-only without a photo-delete outbox row.

## Evidence Boundary

This is a dev-web typed status-reader fault injection. It proves the actual component query/refetch/presentation path and real local outbox reader behavior, not a native protected-storage failure, authenticated server deletion, reconnect replay, or signed-device lifecycle.

## Artifacts

- `empty-before-check-360x640.png`
- `empty-after-check-360x640.png`
- `populated-before-check-390x844.png`
- `populated-after-check-390x844.png`
- `metrics.json`
- `accessibility-snapshots.txt`
- `browser-log.json`
- `command-transcript.txt`
