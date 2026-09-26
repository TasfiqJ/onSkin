# IOS-11 Release Containment Source Checkpoint

Date: 2026-09-26  
Status: source-ready; live acceptance remains open

## Finding

The repository already had a sound store-only policy: Expo updates are disabled,
automatic update checks are `NEVER`, no update URL or EAS channel exists, and
`expo-updates` is not a direct mobile dependency. The runtime fingerprint is an
artifact and compatibility identity only. It is not an OTA authorization.

The previous deterministic incident exercise did **not** satisfy IOS-11. It
selected the right recovery class, but it did not bind an exact release
candidate, signed build, full supported-binary inventory, server-containment
readback, or a distinct store-hotfix binary. Its result therefore remains local
decision-model evidence, not a completed release drill.

## Added Fail-Closed Contract

`scripts/phase9/ios11-release-containment-contract.mjs` now has two deliberately
separate modes:

1. `--source-check` confirms the version-controlled no-OTA contract and always
   reports `ios11Complete: false` because source inspection cannot prove a live
   recovery drill.
2. `--evidence <path> --expected-source-sha <S>` validates a completed, recent
   evidence record against the explicit immutable build-source commit in the
   governed RC chain. The template is
   `docs/phase-9/ios11-release-containment-evidence.template.json`.

The strict evidence contract requires:

- one exact affected source SHA, EAS build UUID, artifact SHA-256, app version,
  native build number, and 40-character lowercase runtime fingerprint produced
  by the pinned Expo SDK 57 fingerprint toolchain;
- a staging release halt with independent readback proving build selection,
  submission, marketing, and expansion were all blocked;
- a pre-reviewed, fail-closed server mechanism with activation and independent
  readback timestamps after the halt;
- a complete, sorted, duplicate-free supported-build inventory whose exact rows
  match its declared minimum and maximum, including at least an affected binary
  plus a distinct hotfix binary;
- exact affected-flow coverage on every supported binary while containment is
  active;
- a higher-numbered, different-source store hotfix tested both with containment
  on and off, with `otaPublished=false`;
- content-free receipt hashes, evidence no older than 30 days, and three
  distinct named review roles.

Unknown fields, placeholders, stale timestamps, partial flow coverage,
duplicate build numbers, unsupported containment classes, inverted build
ranges, identity mismatches, OTA publication, and unreviewed or non-independent
results fail closed.

## Acceptance Boundary

IOS-11 is not complete from this checkpoint. Completion still requires a real
staging exercise using signed binaries and reviewed hosted controls. The three
names are consistency metadata; the validator cannot authenticate people or
prove that an external receipt is truthful. Artifact and receipt hashes bind
reviewed bytes but do not replace direct inspection of those bytes.

No production service was changed, no update was published, no App Store build
was submitted, and no hosted or professional approval is claimed.

## Verification

Run:

```text
node scripts/phase9/ios11-release-containment-contract.mjs --source-check
node --test scripts/phase9/ios11-release-containment-contract.test.mjs
```

When a real retained drill packet exists on the exact clean source revision:

```text
node scripts/phase9/ios11-release-containment-contract.mjs --evidence <retained-json-path> --expected-source-sha <S>
```

The focused adversarial suite covers a valid full drill; enabled OTA
publication; incomplete halt; partial supported-binary flow coverage; hotfix
identity mismatch; stale evidence; same-source hotfix; and non-independent
review roles.
