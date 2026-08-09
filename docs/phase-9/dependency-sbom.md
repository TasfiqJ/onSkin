# Phase 9 Dependency And SBOM Review

`npm run phase9:dependency-sbom` writes generated dependency inventory artifacts to `docs/phase-9/generated/`. The JSON and Markdown record whether `npm audit` was not run, used only the local offline cache, or queried the registry. Offline-cache results remain warning-bearing even when they report zero advisories.

The separate `npm run phase9:ios-privacy-source-audit:check` gate binds the
reviewed Apple baseline, repository SDK mapping, lockfile, and installed native
npm package source. Its current result is `archive_required`: 72 native
packages, 23/23 source-valid privacy manifests, 23 source bindings requiring
archive verification, 228 podspecs, 16 XCFramework candidates, ten exact Apple
SDK-list intersections, zero errors, and 24 warnings. The generated evidence is
`docs/phase-9/generated/ios-privacy-source-audit.{json,md}`.

That source audit is not the release SBOM or binary inspection. Ruby podspec
tokens are not evaluated CocoaPods output, candidate framework names are not
resolved SDK identities, and source manifests do not prove bundle inclusion or
signatures. First-party and generated prebuild sources have separate validators;
CocoaPods/SPM resolution and the exact production archive remain release gates.
The RC evidence-index validator can bind their files, EAS provenance, and
named approval metadata to one candidate, but it does not machine-interpret opaque
report contents.

Strict release signoff requires:

- lockfile present and generated from the release SHA
- no unapproved high or critical vulnerabilities
- exact production `.xcarchive.zip` or IPA, EAS build/source/log,
  build identity/hash, and resolved native lock retained
- merged privacy report, per-bundle manifests, required-reason APIs, resolved
  SDK identities/signatures, entitlements/signing, symbols, binary metadata,
  and processing warnings reviewed for iOS submission
- Android dependency/release checks are N/A under the current iOS-only launch
  contract and must be restored before Android re-enters scope
- Sentry source maps/symbolication plan recorded
- generated inventory attached to the RC packet

Set `PHASE9_DEPENDENCY_AUDIT_PASS=true` only after a registry-backed audit has completed and the release owner has reviewed the generated inventory, uploaded scanner evidence, and vulnerability results for the exact RC commit. The generator rejects a warning-free signoff when the audit was skipped, incomplete, or offline-only.
The flag is review metadata only. It cannot replace the source audit, exact
archive evidence, observed runtime reconciliation, or named professional and
device signoffs.

The framework-level remediation sequence for any remaining Expo or React Native
advisories is defined in
[framework-security-migration-runbook.md](framework-security-migration-runbook.md).
It is intentionally separate from routine compatible dependency maintenance:
the runbook requires an incremental SDK migration, re-review of native patches,
and new archive and physical-device evidence.
