# Mobile Export Incremental Writer Human-Simulated E2E

Date: 2026-07-21 (America/Toronto)

Surface: Expo web development build, Codex in-app browser

Route: `http://localhost:8310/you?section=privacy`

Branch: `optimization`

## Scope

This run rechecks the user-facing data-export branch after replacing the mobile
one-shot `JSON.stringify` and legacy string write with bounded incremental JSON
assembly through one native file handle. Expo web cannot exercise the native
file handle or OS share sheet, but it can prove that the compatible route keeps
its scope disclosure, fail-closed feedback, and supported-phone layout.

## Fixture

- Development-only local state was enabled with `EXPO_PUBLIC_E2E_LOCAL_RESET=1`.
- Supabase used the repository's local placeholder configuration, so no live
  Edge Function or external account data was involved.
- Start command: `npx expo start --web --port 8310` with `CI=1`.
- Requested viewport: 390 x 844; observed CSS viewport: 390 x 845.

## Flow And Result

1. Direct-opened `/you?section=privacy` and confirmed the signed-in You route.
2. Verified the complete account/current-device scope disclosure and separate
   encrypted-photo-file exclusion.
3. Activated the unique 56 px `Export my data` control once.
4. Verified the route remained on the You privacy section and rendered the
   route-owned `role="alert"` result `Export failed` with the sanitized retry
   message.
5. Verified no JavaScript dialog opened, no mobile-writer error code appeared,
   browser warn/error logs were empty, and horizontal overflow remained 0 px.

Verdict: Pass for the Expo-web-compatible failure and disclosure branch.

## Automated Coverage Added Or Updated

- Exact byte parity with `JSON.stringify(value, null, 2)` across nested records,
  escaping, Unicode, lone surrogates, array/object omission rules, and large
  multi-chunk fixtures.
- Fixed UTF-8 chunk ceilings, event-loop yields, account-generation
  invalidation, sink failure, circular/non-plain/bigint rejection, and
  content-free errors.
- Expo File create/open/write/close lifecycle, one-handle ordering, close
  failure, and account-error precedence.
- Export orchestration ordering, delayed writer publication, cleanup after
  write or journal-marker failure, server fail-closed behavior, and device-only
  schema preservation.
- Relaunch scavenging of a partially written file whose journal remains
  `reserved`.

Focused verification: 6 files / 101 tests pass; mobile type-check and
zero-warning lint pass.

## Evidence

- `390x844-export-failure.png`
- `metrics.json`
- `browser-logs.json`

## Claim Boundary

This run proves the compatible development web route and user-visible
fail-closed behavior only. The modern Expo `FileHandle` path, native cache
residue, OS share sheet, account switch during native writes, peak heap, and
physical supported-iPhone behavior remain native release evidence.
