# Engineering repairs and technical proposals

## FIXED_AND_PROVED

node-forge moves from 1.4.0 to the compatible upstream 1.4.2 release. Only the
root dependency and node-forge lock records change. Expo, React Native, native
package nodes and mandatory native/widget/privacy hooks remain unchanged.
The exact installed upstream security files are checked; the retained
null-prototype RSA capture safeguard is applied between exact SHA256 images.
Old PROFILES and all eight historical backport payload files remain unchanged.
Unknown source still refuses.

Before: the old RSA-only repair decodes 80 nested synthetic BIT STRING levels
despite maxDepth 2 (exit 1). After: 1.4.2 decodes one level and retains exact DER
roundtrip (exit 0). A separate upstream 1.4.2 capture regression fails the
retained suite 5/6 (exit 1); the exact capture repair passes 6/6 (exit 0).
The combined tooling/dependency regressions pass 28/28 with no skips before
the later additive npm-discovery controls. Final receipts carry actual counts.

The successor's early adversarial failures were also engineering defects:
Git environment redirection, directory payload omission, disguised compression,
Windows orphan cleanup, reader exception leakage, and malformed result/schema
acceptance. Independent before/after receipts preserve the failures and repaired
reruns. Synthetic results have their own qualification and are never real scans.

## Implemented Zod v3 bounded-collection candidate; advisory remains unresolved

Zod 3.25.76 remains affected by GHSA-mrhx-c7xc-m3w5. A bounded 2,000-member
synthetic input with max(1) still produces 2,001 issues. Expo CLI declares
^3.25.76; upstream's 4.6.6 repair does not supply a compatible v3 release.
No major override, suppression, exception or framework migration was applied.
The new exact-source patcher bounds declared oversized arrays and sets before
walking their elements. CommonJS, ESM and the published TypeScript source each
retain size issues/error maps/paths while reducing the demonstrated 2,001 issues
to one. It checks 25 immutable dispatch/helper pins plus three exact pre/postimages,
all declared nested copies and registry SRI, with staged writes and rollback.
Normal postinstall and check mode invoke it after the unchanged mandatory native
and original tooling calls.

This is NON_ADMITTING_TECHNICAL_PROPOSAL, not an advisory exception. Unbounded
collections, v4 entrypoints and active custom iterators are explicitly outside
this bounded v3 repair. Current npm/OSV version findings remain findings and need
independent review or a compatible upstream/framework-qualified successor.

## Protected native lock successor: OUT_OF_SCOPE_NOT_APPLIED

The justified package repair changes the complete lock SHA256 from
7656c2e6bf482df5a9bc94c9789816a40c5f2b5cfb30e2f10748411229c136cb to
1485297ffa6cc20367a5f2fda35bc33e12dc11ef422c813f5f28a4e339cb3b95.
The immutable native successor13 therefore refuses LOCK_SUCCESSION13_IDENTITY.
Its original fixtures also retain the historical complete-lock assertion.
Neither mapping nor protected validator/fixtures is in this campaign's grant.

The minimum unapplied proposal is a separately authorized, independently
anchored lock-successor22 record and protected consumer branch binding exact
prior/current locks, exactly the two changed records, unchanged native package
identities/source pins, upstream provenance and mandatory patch evidence.
Original successor13 and fixtures must remain immutable. Tests must refuse
unrelated lock changes, native pin drift and missing/forged/duplicate evidence,
while retaining all native/archive/device/admission blockers.

PR25 already contains a separate widget contract mismatch: protected code
expects @expo/ui ~57.0.25 and expo-widgets 57.0.26; PR25 already specifies
~57.0.26 and 57.0.27. Those source/package bytes are unchanged here. Resolving
that native qualification mismatch also needs separate authority. Unsigned
exports and working native patch hooks do not clear either native contract.
