# Mobile Export Incremental Writer Checkpoint

Date: 2026-07-21 (America/Toronto)

Branch: `optimization`

Plan scope: OPT-013 and section 10.6 of
`docs/MAXIMUM_REACT_NATIVE_OPTIMIZATION_PLAN.md`.

## Result

The mobile export path no longer creates a second artifact-sized pretty-JSON
string before writing its one-time plaintext staging file. It retains the
already-required parsed export bundle, serializes that bundle with exact
two-space JSON formatting into at most 64 KiB UTF-16 fragments, encodes at most
192 KiB of UTF-8 per native write, and yields between chunks so an account
generation boundary can stop later writes.

One Expo SDK 56 `FileHandle` now owns the file lifecycle:

1. create a new app-owned journaled path with `overwrite: false`;
2. open once with `FileMode.WriteOnly`;
3. write bounded byte chunks in order;
4. close once before publishing journal state;
5. only then advance `reserved` to `plaintext_written` and probe sharing.

Create, open, write, close, serialization, journal-marker, account-generation,
and sharing failures all remain inside the existing unconditional staging
cleanup. A process exit during assembly leaves the journal entry `reserved`;
startup scavenging deletes that partial file and the dedicated directory before
the app admits private routes.

## Exactness And Privacy Invariants

- Representative server/local bundles, nested containers, empty containers,
  quotes, backslashes, control characters, composed Unicode, emoji pairs, lone
  surrogates, non-finite numbers, and object/array omission rules match
  `JSON.stringify(value, null, 2)` byte for byte.
- The production input domain is JSON-safe parsed data and plain local-export
  records. Circular, non-plain, bigint, or otherwise unsupported values fail
  with one stable content-free code.
- No chunk can contain the complete large stress artifact, and each UTF-8 chunk
  stays at or below the declared 192 KiB ceiling.
- Native error details, the staging URI, and export content are never included
  in surfaced file-operation errors.
- Account-generation invalidation outranks a concurrent close failure and stops
  scheduling later chunks after the injected yield.
- The raw filesystem inventory now freezes the new writer as the exact gateway
  owner and requires its account-generation lease checks.

## Verification

- Focused mobile matrix: 6 files / 101 tests pass.
- Mobile and repository type-check: pass.
- Mobile and repository lint: pass with zero warnings.
- Repository tests in the preserved dirty worktree: 2 files failed / 350
  passed; 4 tests failed / 4,180 passed. The four failures are the pre-existing
  notification/Shelf failures in user-owned dirty files; the export and
  filesystem-inventory suites pass.
- Independent adversarial agent review: no actionable findings across JSON
  parity, memory bounds, Expo SDK 56 APIs, error precedence, journal lifecycle,
  and cleanup/relaunch behavior.
- Human-simulated Expo-web pass: the 390 x 844 You privacy route preserves the
  complete export disclosure, unique 56 px action, sanitized `role="alert"`
  failure, zero dialogs, zero browser warn/error logs, zero writer-code leakage,
  and zero horizontal overflow. Evidence:
  `test-results/human-e2e/2026-07-21/mobile-export-incremental-writer-current/`.
- The non-mutating human-E2E manifest check still reports the repository-wide
  generated manifest as stale against hundreds of later committed source and
  evidence files. Its already-dirty generated outputs were preserved and were
  not regenerated or staged as part of this slice.

## Claim Boundary

This closes the decision-free mobile artifact-sized string duplication while
preserving the current export schema and server policy. It does not claim
exports above the existing 8 MiB server response boundary are complete, and it
does not substitute mocks or Expo web for a supported-iPhone FileHandle, native
share sheet, peak-heap, filesystem-residue, account-switch, or force-kill run.
Those remain native/hosted release evidence.
