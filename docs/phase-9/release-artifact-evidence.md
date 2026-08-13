# Exact-Release Artifact Evidence

Phase 9 release claims must bind one clean Git commit and one iOS EAS build to the measured binary, Phase 5 performance results, native symbols, Hermes source map, Sentry upload, and a real symbolication recovery exercise. Boolean pass flags are not sufficient.

## Required files

Keep the signed binary, dSYM archive, Hermes source map, and the five content-free JSON attachments in restricted release storage. Do not commit those raw files. Set these paths in the release shell:

```text
PHASE5_PERFORMANCE_EVIDENCE_PATH
PHASE9_IOS_ARTIFACT
PHASE9_IOS_DSYM_ARCHIVE
PHASE9_IOS_HERMES_SOURCE_MAP
PHASE9_IOS_BINARY_UUID_EVIDENCE
PHASE9_IOS_DSYM_UUID_EVIDENCE
PHASE9_IOS_HERMES_DEBUG_ID_EVIDENCE
PHASE9_SENTRY_IOS_UPLOAD_RECEIPT
PHASE9_SENTRY_IOS_RECOVERY_RECEIPT
```

Copy `release-artifacts.json` from the RC template into the immutable release-candidate folder. Record only SHA-256 digests, UUIDs/debug IDs, EAS build ID, app identity/version/build/runtime, Sentry release/dist, receipt identifiers, and canonical timestamps. Use `bundleIdentifier@appVersion+buildNumber` for the Sentry release and the build number for dist. The RC manifest must use `appVersion / buildNumber` in `App version/build`, name `release-artifacts.json` in `Artifact contract`, and match every identity field. Never record tokens, DSNs, URLs, absolute paths, usernames, email addresses, raw stack traces, exception text, request data, or private event payloads.

The artifact contract also records the 10-character Apple signing-team identifier, and the RC manifest must match it exactly.

## Identity attachments

The binary, dSYM, and Hermes identity attachments use these exact content-free shapes:

```json
{"schemaVersion":1,"kind":"ios_binary_uuids","uuids":["00000000-0000-4000-8000-000000000000"]}
{"schemaVersion":1,"kind":"ios_dsym_uuids","uuids":["00000000-0000-4000-8000-000000000000"]}
{"schemaVersion":1,"kind":"ios_hermes_debug_id","uuid":"00000000-0000-4000-8000-000000000000"}
```

On the macOS release host, set the artifact and three identity-evidence paths, then run:

```bash
node scripts/phase9/ios-artifact-inspection.mjs
```

The script detects Mach-O/fat magic across every shipped archive file and requires `xcrun dwarfdump` to return a parseable UUID for each one. It accepts symbols only from canonical `.dSYM/Contents/Resources/DWARF/` files whose Mach-O load commands contain non-empty `__debug_info` and `__debug_abbrev` sections. The dSYM inventory must cover the complete shipped Mach-O UUID inventory. It reads app identity/version/build from the root signed `Info.plist`, runtime identity from the root `Expo.plist`, and the Hermes debug ID directly from the exact external source map before writing the minimized attachments. Named, inline, structurally recognizable regular/indexed, and gzip/zlib/Brotli source maps are forbidden in the shipped IPA. `phase9:release-smoke` repeats the extraction from the supplied artifacts and rejects self-authored attachments or RC identity that disagree. Hash each raw artifact and each minimized JSON attachment with SHA-256 after capture.

The macOS inspector first verifies the full nested signature graph, then applies an explicit code requirement for the Apple generic trust anchor, Apple WWDR issuer, iOS Distribution certificate OID, signing-team certificate OU, and exact bundle identifier. It evaluates each embedded provisioning-profile CMS signature with the object-signer trust policy. The root app and every `.appex` must have current App Store distribution material: no provisioned-device or enterprise-all-device list, debugger attachment disabled, exact team/application identity, every signed entitlement covered by the profile, and one common signing team.

## Sentry receipts

The upload receipt uses the exact fields below. `receiptId` is a stable content-free identifier from the upload job or its minimized release record.

```json
{
  "schemaVersion": 1,
  "kind": "sentry_artifact_upload",
  "platform": "ios",
  "gitSha": "0000000000000000000000000000000000000000",
  "buildId": "00000000-0000-4000-8000-000000000000",
  "release": "com.routinekind.app@1.0.0+1",
  "dist": "1",
  "binaryUuids": ["00000000-0000-4000-8000-000000000000"],
  "dsymUuids": ["00000000-0000-4000-8000-000000000000"],
  "hermesDebugId": "00000000-0000-4000-8000-000000000000",
  "receiptId": "upload-receipt-0000000000000000",
  "recordedAt": "2026-07-18T12:00:00.000Z",
  "status": "uploaded"
}
```

The recovery receipt has the same release identity fields, with `kind: "sentry_symbolication_recovery"`, separate 32-hex-character `javascriptEventId` and `nativeEventId` fields, and `status: "symbolicated"` in place of `receiptId`. Record it only after controlled JavaScript and native test events from the exact build should resolve to the expected Hermes source and native symbols. The recovery timestamp must be after upload, neither receipt may be future-dated, and both must be within 30 days of verification.

The receipt is not accepted on syntax alone. During a claimed release, the gate uses `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and the approved `SENTRY_API_URL` to retrieve both events, query source-map debug status, and query the uploaded debug-file inventory for every shipped Mach-O UUID. It keeps provider payloads in memory and records no event content. The gate requires matching release/dist, recent events, an original non-bundle JavaScript source frame tied to the exact Hermes debug ID, and no symbol errors. Native proof uses only provider top-level debug metadata: the instruction and provider symbol address must fall in the exact app image, image-plus-offset fallbacks are rejected, and every exact UUID must have a Sentry `macho` DIF with the `debug` feature. See Sentry's official [event retrieval](https://docs.sentry.io/api/events/retrieve-an-event-for-a-project/), [source-map debug](https://docs.sentry.io/api/events/get-debug-information-related-to-source-maps-for-a-given-event/), and [debug-file inventory](https://docs.sentry.io/api/projects/list-a-projects-debug-information-files/) APIs.

## Gate behavior

Run the pure local fixture contract directly:

```bash
node scripts/phase9/release-artifact-contract-smoke.mjs
node scripts/phase9/ios-artifact-inspection-smoke.mjs
node scripts/phase9/sentry-recovery-verification-smoke.mjs
```

`npm run phase9:release-smoke` runs that contract without requiring signed artifacts. Once any `PHASE9_*_PASS=true` value or `PHASE9_SIGNED_OFF_BY` is present, the smoke gate additionally requires every file above and rejects:

- dirty or different Git revisions;
- a Phase 5 evidence file from a different iOS EAS build;
- missing or different SHA-256 digests;
- RC manifest/build/runtime mismatches;
- binary/dSYM UUID or Hermes debug-ID mismatches, including attachments not reproduced from the raw artifacts;
- unsupported, stale, future, fake, or cross-release receipts;
- Sentry events, source maps, or dSYMs that cannot be independently verified through the provider API;
- sensitive or diagnostic payload content; and
- Android marked not applicable after Android is reactivated in the launch contract.

Android is not release-required under the active iPhone-only launch contract. If Android becomes required, the validator intentionally fails until a versioned branch is added for the APK/AAB, R8 mapping, native symbols, Hermes debug ID, Sentry upload, and deobfuscation recovery receipt.

This contract does not fabricate the final §19 launch-readiness reference. Once the real signed packet exists, `LAUNCH_READINESS.md` must point to that immutable RC folder and its exact performance-evidence digest; until then that launch-level link remains externally blocked.
