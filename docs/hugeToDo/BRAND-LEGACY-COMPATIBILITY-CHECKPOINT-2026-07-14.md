# Legacy Brand Compatibility Checkpoint

- Date: 2026-07-14 (America/Toronto)
- Scope: strict brand-audit classification only
- Base commit: `775dfebbb1410dfbb5e5964d065217d02d994e37`
- Isolated branch: `codex/brand-legacy-compat`
- Status: local audit checkpoint verified; final brand remains launch-blocked

## Decision and evidence boundary

Retain all 22 lowercase legacy literals identified by the clean BASE-02 audit
byte-for-byte. They are not public identity values and no source evidence
supports a safe standalone rename. They are now classified through the exact
review manifest at `scripts/brand-legacy-compatibility.json`.

This checkpoint is technical migration hygiene only. It is **not** trademark
or legal clearance, a domain or social-handle finding, an App Store name
reservation, approval of `Layerwell`, or final production identity evidence.
No live Supabase schema or persisted row was inspected. Hosted migration state
remains a DB-06 reconciliation gate, so deployed-or-persisted compatibility is
conservatively preserved rather than assumed absent.

The dated
[`BASE-02-CLEAN-BASELINE-2026-07-14.md`](./BASE-02-CLEAN-BASELINE-2026-07-14.md)
report remains unchanged and historically correct: strict audit was red at its
recorded commit because these references had not yet received an explicit
reviewed classification. This checkpoint resolves only that reported
classification gap; it does not rewrite the baseline or close its other
failures.

## Reviewed classification

| BASE-02 findings | Count | Subtype                         | Disposition and compatibility reason                                                                                                                                                     |
| ---------------- | ----: | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1-8              |     8 | Cryptographic domain separation | Retain. These bytes participate in stored SHA-256/HMAC bindings, AES-GCM additional authenticated data, resumable RevenueCat executor state, or key-versioned identity-tombstone lookup. |
| 9-15             |     7 | Historical migration contract   | Retain. These migration bytes define advisory-lock namespaces or stored digest contracts. Hosted application state is unverified; any change belongs in a reviewed forward migration.    |
| 18               |     1 | Live compatibility harness      | Retain. The harness derives the same status-capability digest used by production source for live cleanup and assertions; changing it alone would make the harness incorrect.             |
| 16-17 and 19-22  |     6 | PostgreSQL rehearsal fixture    | Retain. These disposable CI fixtures deliberately mirror migration lock/digest behavior; cosmetic renaming would reduce contract fidelity without reducing public identity risk.         |

No finding is classified as public identity risk. No production finding is
classified as safely migratable in isolation. Finding 21 is local to a
rehearsal, but renaming it only to suppress an audit hit would provide no public
brand benefit and would make the fixture classification less explicit.

## Compatibility evidence

- `durableDeletionCore.test.ts` asserts that the capability and idempotency
  domains remain byte-for-byte aligned with migration 0048 and verifies fixed
  digest vectors. The corresponding migration stores and compares those
  digests.
- `durableDeletionCrypto.ts` places the retained purpose inside AES-GCM
  additional authenticated data. Changing it would make existing encrypted
  deletion payloads fail authentication during decryption.
- `durableDeletionRuntimeCore.ts` uses the retained HMAC domains for subject
  receipts and intake-owner rate-limit identity. A rename would break receipt
  lookup continuity or create a second rate-limit bucket namespace.
- `revenueCatV2DeletionExecutor.ts` persists the credential and observation
  claim bindings in versioned executor state. Resume validation compares the
  persisted credential binding with the current binding, while claim binding
  prevents an absence observation from crossing worker claims.
- `revenueCatIdentityTombstone.ts` includes the retained domain in keyed HMAC
  input. Migration 0051 stores key-versioned HMAC lookups and documents a
  provisional 825-day engineering ceiling plus required old-key overlap. A
  one-sided rename could stop matching retained tombstones.
- Migrations 0048, 0051, and 0052 use retained bytes for advisory locks and
  persisted capability/claim digests. Migration source has local replay history,
  but the repository explicitly lacks hosted checksum/history proof; no
  mechanical historical edit can update an already-applied schema.
- `.github/workflows/quality.yml` executes the four affected PostgreSQL
  rehearsal files on PostgreSQL 15 and 17. The rehearsal literals are test
  contracts, not launch identity.

## Fail-closed audit contract

Every reviewed entry must provide exactly these fields:

- normalized repository-relative `path`;
- exact single-line `literal` containing exactly one legacy identity match;
- positive integer `expectedCount`;
- approved `subtype`;
- specific `rationale` containing no legacy identity match.

The audit rejects a missing or malformed manifest, unknown fields, path
traversal, duplicate path/literal entries, missing files, stale literals, count
drift, ambiguous literals, invalid rationales, and compatibility entries aimed
at public assets. Classification is range-bound to the exact literal, so a new
legacy value on the same line remains `review-needed`. The manifest data file
is excluded from ordinary identity scanning only after its schema and every
entry are independently validated.

Strict mode continues to fail on any `public-launch-risk` or unclassified
`review-needed` finding. It reports reviewed matches separately as
`legacy-compatibility` and always prints the non-clearance notice.

## Verification

| Command                      | Exit | Result                                                                                                                                    |
| ---------------------------- | ---: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run brand:audit:test`   |    0 | 8 focused tests passed: exact match, new same-line hit, drift, stale entry, duplicate, count mismatch, public asset, and missing manifest |
| `npm run brand:audit:strict` |    0 | 0 public launch-risk; 0 review-needed; 22 legacy-compatibility                                                                            |

The focused suite proves that reviewed exact input passes and exercises the
highest-risk drift and bypass cases listed above. The validator also checks the
remaining schema, path, literal, subtype, and rationale constraints on every
strict run. The strict command runs the focused suite before scanning the
repository.

Current-state addendum (2026-07-15): strict audit now reports 23 exact
`legacy-compatibility` references. The additional reference is the entitlement
authority PostgreSQL rehearsal's byte-compatible use of migration 0048's
deployed account-write advisory-lock domain. It is classified as one exact
`test-fixture` entry in the same fail-closed manifest. The dated 22-reference
verification table above remains the historical result of this checkpoint;
the current 23-reference result does not change the non-clearance boundary.

## Future migration rule

If counsel or final identity architecture later requires removing these
internal bytes, treat it as a separate data/cryptography migration. At minimum:

1. Reconcile hosted migration history and retained-row/envelope lifetimes.
2. Introduce a new explicit version; do not reinterpret version 1 bytes.
3. Design dual-read and, where necessary, dual-write behavior.
4. Backfill or re-encrypt persisted state with measured residue checks.
5. Preserve old advisory-lock coordination through the mixed-version window.
6. Define expiry, rollback, canary, provider interruption, and key-overlap
   procedures.
7. Remove an old domain only after live evidence proves no compatible state can
   remain.

No such migration is authorized or justified by this audit-only checkpoint.

## Remaining brand and launch gates

- `Layerwell` remains a working engineering candidate, not a cleared mark.
- Written trademark-counsel output and the founder's exact final-name decision
  remain required.
- Domain, store name, public handles, bundle ID, scheme, policy/support URLs,
  and vendor project identities remain unreserved or otherwise unverified.
- Production config must continue to require
  `BRAND_LEGAL_CLEARANCE=cleared` and explicit final identity values.
- Physical-iPhone, live-service, professional-review, production, beta,
  operational, App Store, and release-authorization gates remain open.
