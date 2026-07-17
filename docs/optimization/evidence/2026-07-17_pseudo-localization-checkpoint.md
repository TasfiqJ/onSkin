# Pseudo-Localization And Long-String Checkpoint

Date: 2026-07-17

Branch: `optimization`

Checkpoint parent: `2450354fcff15a6335d4e153474cd9ef3b00e67a`

Item: `OPT-206`

## Invariant

Long user-facing strings must exercise the same components and navigation as
ordinary copy without changing stored/API values. The fixture must be explicit,
development-only, deterministic, and fail closed. Visible text, prose input
placeholders, controls, and fixed chrome must remain readable and operable on
supported phone layouts.

## Baseline Finding

The app had broad 120-200% text-pressure evidence but no pseudo-locale. Most
screens used the shared `Text` primitive, while six production owners imported
React Native `Text` directly and prose `TextInput` placeholders bypassed the
shared boundary. The route audit could capture startup loaders, leave CDP
commands pending after Chrome closed, and classify DOM nodes outside a nested
scroll viewport as visible. The first live expanded-copy run also found Ask's
full title overflowing its phone header.

## Implementation

- Added an exact `expanded` pseudo-locale fixture gated by `__DEV__`. It
  bracket-wraps and accents ASCII prose, expands vowels, preserves outer
  whitespace/newlines, leaves non-language tokens unchanged, and is idempotent.
- Applied the fixture once at the shared `Text` boundary and converted every
  remaining production React Native `Text` owner to that boundary.
- Routed prose placeholders on Ask, onboarding product entry, photo notes, and
  Shelf search/manual/OCR through the string adapter. Email, verification-code,
  numeric, and date-format placeholders remain unchanged.
- Kept accessibility labels, internal enums, route values, queries, persistence,
  and API payloads outside the display-only transformation.
- Made Ask use a compact visible title at phone width while retaining the full
  accessible title. Long prompt copy or platform font scale now selects one
  complete high-value suggestion rather than allowing a lower suggestion to
  enter the fixed composer.
- Extended the route auditor with a first-class pseudo-locale input and report
  field, bounded HTTP/CDP commands, startup-gate settling, browser logs, pending
  command rejection on disconnect, and clipping-ancestor-aware geometry.
- Added policy and source-inventory tests so the development gate, production
  text boundary, prose-placeholder owners, and screenshot harness cannot drift
  silently.

## Deterministic Evidence

```text
npm.cmd --workspace apps/mobile test -- \
  src/features/ask/routeContract.test.ts \
  src/lib/accessibility/pseudoLocalization.test.ts \
  src/lib/accessibility/pseudoLocalizationInventory.test.ts
3 files / 26 tests PASS

npm.cmd --workspace apps/mobile run typecheck
PASS

npm.cmd test
323 files / 3,951 tests PASS

npm.cmd run typecheck
2 workspaces PASS

npm.cmd run lint
2 workspaces PASS, zero warnings
```

The policy tests prove exact development-only activation, deterministic
expansion, idempotence, punctuation/whitespace/newline preservation, and safe
handling of non-language tokens. The inventory suite recursively proves that no
production TSX owner bypasses the shared `Text`, that prose placeholder owners
use the display adapter, and that the browser audit records the fixture.

## Human-Simulated E2E

Actual Expo web ran the same eight critical direct-entry routes at two
launch-supported iPhone-class viewports:

- `/today`
- `/progress`
- `/routine/plan`
- `/recommendations/preferences`
- `/settings/privacy`
- `/ask`
- `/shelf/search`
- `/paywall/upsell?feature=full_routine`

Both 375 x 667 and 390 x 844 runs used `expanded` pseudo-localization plus 120%
text pressure. All 16 route/viewport cases passed with zero visible clipped or
undersized controls, zero blocked hit-test centers, zero text or horizontal
overflow, and zero disallowed browser warning/error logs. Screenshots, per-route
geometry snapshots, summaries, failure manifests, and reports are in:

- `test-results/human-e2e/2026-07-16/pseudo-localization-120-375x667-current/`
- `test-results/human-e2e/2026-07-16/pseudo-localization-120-390x844-current/`

The run found and fixed the Ask title/composer pressure issue recorded in
`docs/e2e-bug-reports/2026-07-17-pseudo-localization-ask-pressure.md`. Visual
inspection confirmed the final screenshots contain settled app content rather
than session/private-storage loaders.

## Result And Remaining Verification

`OPT-206` is implemented locally with its required screenshot matrix. It is not
release-verified because Expo web does not substitute for supported-iOS native
evidence. Remaining gates are real localized copy on supported iPhones, Dynamic
Type, VoiceOver focus/announcement order, software keyboard interaction, safe
areas, and a bidirectional-layout fixture/review.

## Rollback Trigger

Rollback or repair if the fixture can activate in production, transforms
stored/API values or accessibility identifiers, double-transforms nested text,
changes data-format placeholders, permits a raw production React Native `Text`
owner, captures startup loaders as route proof, leaves browser commands pending,
or allows long copy to clip, overflow, hide a visible target, or block its hit
center.
