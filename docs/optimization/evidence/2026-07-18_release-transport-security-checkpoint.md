# Release Transport Security Checkpoint — 2026-07-18

## Scope

This checkpoint removes release-config ambiguity discovered while auditing native data protection. Expo SDK 56 introspection starts from a synthetic plist with `NSAllowsArbitraryLoads=true`, so development and staging introspection both appeared permissive before the app-owned override. The actual SDK 56 CNG template already defaults arbitrary internet loads to `false` but retains `NSAllowsLocalNetworking=true`. Android's release template leaves cleartext unset (the modern platform default is false), while its debug overlays explicitly enable cleartext for Metro. None of those dependency-template observations substitute for signed-artifact proof.

The implementation adds a final app-owned Expo config plugin that:

- leaves development transport settings unchanged so Metro and dev-client localhost traffic continue to work;
- sets staging and production iOS ATS values `NSAllowsArbitraryLoads`, `NSAllowsArbitraryLoadsForMedia`, `NSAllowsArbitraryLoadsInWebContent`, and `NSAllowsLocalNetworking` to `false`;
- removes release ATS exception domains while preserving unrelated restrictive ATS keys such as pinned domains;
- sets staging and production Android `android:usesCleartextTraffic` to `false`;
- rejects an unreviewed Android network-security resource instead of allowing its contents to bypass the owned release policy;
- fails closed when the app variant is missing or unsupported.

## Local proof

- `node --check apps/mobile/plugins/withReleaseTransportSecurity.js`
- `npm --workspace apps/mobile test -- src/lib/releaseTransportSecurityPlugin.test.ts src/lib/nativeDataProtectionIntrospection.test.ts src/lib/nativeDataProtectionPlugin.test.ts`
  - 3 test files and 11 tests passed.
- `npm --workspace apps/mobile run typecheck`
- `npm --workspace apps/mobile run lint`
- Complete Expo introspection proves development retains the generated localhost exception while staging has no ATS exception domains and all arbitrary-load flags are false.
- Complete Expo introspection proves staging sets `android:usesCleartextTraffic=false` and has no `android:networkSecurityConfig` override.
- Direct inspection of the installed Expo SDK 56 CNG templates confirms the iOS release starting point is arbitrary-loads false/local-networking true, the Android main manifest has no cleartext override, and only Android debug/debug-optimized overlays explicitly enable cleartext.

## Evidence boundary

Local config and introspection do not prove the contents of signed store artifacts. Release verification still requires extracting the signed IPA `Info.plist`, inspecting the signed Android merged manifest/resources if Android returns to launch scope, and exercising intended HTTPS endpoints from a release build. Development localhost behavior is intentionally not a release exception.
