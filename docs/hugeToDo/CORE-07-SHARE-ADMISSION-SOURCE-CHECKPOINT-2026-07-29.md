# CORE-07A Share Admission Source Checkpoint

Date: 2026-07-29

Status: `in_progress` source checkpoint; literal zero share and public-link
admission

## Outcome

CORE-07A closes every conflict-card export and public-record path. It does not
complete CORE-07, enable a growth loop, publish a share card, or create a
public-link service.

The current release contract records:

- `sharePublicationAdmitted=false`;
- `publicLinksAdmitted=false`;
- `shareReceiptIssuerAvailable=false`;
- `publicTokenServiceAvailable=false`;
- `rawPrivateFieldsAllowed=false`;
- `analyticsAllowed=false`;
- a sanitized projection allowlist and exact-payload confirmation are mandatory
  for any future successor.

These values are validated as exact machine-readable launch constraints.
Environment flags, a final domain, legacy `reviewedBy` text, an owned-product
match, a QA switch, or a syntactically valid `/s/:shareId` cannot override
them.

## Current Source Boundary

The source candidate separates three authorities that were previously
conflated:

1. Conflict guidance admission decides whether an exact clinical conflict may
   be shown privately. It does not authorize publication.
2. Share admission requires a separate immutable exact-content receipt. No
   issuer exists and the production receipt registry is empty, so every request
   refuses.
3. Public-link admission requires a separately reviewed token service and
   lifecycle. No service exists, so every identifier, including a
   valid-looking identifier, resolves to one neutral unavailable state.

The share renderer boundary accepts only a deliberately constructed sanitized
projection, not a private `DetectedConflict`, shelf object, profile, or product
record. While admission is zero, no projection reaches export. The denied path
returns before card capture, temporary-file creation, link construction,
network work, native share-sheet invocation, or share/destination analytics.
The public app route and static web fallback neither claim that a record exists
nor send a record-derived beacon.

No raw or private field is an implicit member of the future allowlist.
The current renderer projection has exactly these keys:
`schemaVersion`, `brandName`, `eyebrow`, `title`, `severityLabel`,
`evidenceLabel`, `claim`, `actionLabel`, `attributionLabel`, `disclaimer`, and
`tone`. Its parser rejects missing, extra, inherited, accessor-backed, empty,
oversized, wrong-version, and wrong-enum fields before returning an immutable
copy.

Specifically excluded are account or device identifiers; Shelf identifiers;
product records, names, or IDs; profile, concern, goal, pregnancy,
breastfeeding, or safety state; photos, paths, notes, OCR, or free text;
internal rule objects or IDs; reviewer identities; receipt/provenance internals;
and attribution identifiers. Each permitted presentation field still requires
exact-content review and a positive receipt before export.

## Future Positive Admission Contract

This source checkpoint intentionally provides no positive path. A successor
may enable one exact share only after all of the following are implemented and
bound to one immutable source/build:

- an issuer-authenticated, non-caller-forgeable share receipt binds the exact
  admitted conflict corpus, rule hash, card copy, citations, market and
  jurisdiction, projection schema and bytes, content-rights scope, reviewer
  receipts, expiry, and revocation state;
- the projection is constructed from an exact field allowlist and rejects
  extra, raw, private, stale, missing, mismatched, expired, or revoked input;
- the user sees the exact image/text/link/destination behavior and explicitly
  confirms that payload immediately before any native share sheet opens;
- cancel, backgrounding, account change, consent withdrawal, stale authority,
  capture failure, file failure, link failure, and native-share failure create
  no stale publication or analytics side effect;
- public links use a separate unpredictable token authority with purpose,
  authentication decision, expiry, recipient/indexing policy, rate and abuse
  controls, incident response, retention, revocation, deletion, backup, and
  crawler/cache behavior; generic static HTML is not a token service;
- archive-identical network and analytics evidence proves that no private
  conflict, Shelf, health, profile, or share identifier leaks;
- native iPhone, VoiceOver, Dynamic Type, cancel/failure, offline, lifecycle,
  temporary-file cleanup, and 1080 x 1920 rendering evidence passes.

## Required Exact-Source Review

Future activation is bound to all six launch-contract tasks:

| Task     | Required decision                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------- |
| `REV-02` | Regulatory-claims counsel approves the exact share claims, copy, citations, market scope, and positioning.     |
| `REV-03` | Privacy/security review approves projection, destination, data flow, retention, revocation, and deletion.      |
| `REV-04` | A board-certified dermatologist approves the exact conflict meaning and user-facing clinical copy.             |
| `REV-05` | A qualified cosmetic chemist approves the exact ingredient-compatibility and application copy.                 |
| `REV-06` | IP/content-rights counsel approves exact text, citations, imagery, trademarks, licenses, and distribution use. |
| `REV-07` | Current detached signoffs bind verified credentials and every exact source hash used by the release candidate. |

No role substitutes for another. An approval in prose, a stale packet, an
embedded reviewer name, or a runtime Boolean is not a detached current-source
signoff.

## Primary-Source Research Basis

The following primary sources support the conservative boundary; they do not
decide Layerwell's applicability, supply legal advice, or constitute counsel or
Apple approval:

- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/):
  Guidelines 5.1.1 and 5.1.2 require transparent data practices, permission,
  minimization, retention/deletion disclosure, and explicit permission before
  personal-data sharing; 5.1.3 treats health data as especially sensitive.
  Guideline 1.2 adds filtering, reporting, blocking, and contact requirements
  if a future sharing surface becomes user-generated content or a social
  service.
- [FTC Health Breach Notification Rule compliance guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0):
  the FTC explains that health apps can fall outside HIPAA while still being
  subject to FTC Act and Health Breach Notification Rule duties, and that an
  unauthorized disclosure can be a breach rather than merely a hacker event.
- [Washington My Health My Data Act, RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true):
  the statute defines sharing broadly, requires purpose disclosures, and
  generally requires sharing consent separate from collection consent, with
  withdrawal and deletion rights. Qualified counsel must determine exact
  applicability and any requested-service exception.
- [California Privacy Protection Agency, CCPA effective January 1, 2026](https://cppa.ca.gov/regulations/pdf/20260101_ccpa_statute.pdf)
  and the [CPPA laws and regulations index](https://cppa.ca.gov/regulations/):
  the current statute and regulations preserve consumer notice, deletion,
  sale/sharing opt-out, and sensitive-personal-information controls. Qualified
  California counsel must determine applicability, classification, exceptions,
  and exact implementation duties.

These sources justify refusing ambiguous publication. They cannot guarantee
legal compliance, App Store acceptance, user safety, product-market fit, or
revenue.

## Verification And Evidence Status

Source-level acceptance requires:

```bash
npm run launch:contract:smoke
npm run core02:clinical-rule-source-contract:test
node --test scripts/phase7/core-loop-qa-packet-contract.test.mjs
node scripts/core07/share-admission-source-contract.mjs
node --test scripts/core07/share-admission-source-contract.test.mjs
npm run phase7:check-core-loop-smoke
npm run phase8:check-growth-store-smoke
```

The CORE-07A contract, Phase 3 review packet, Phase 7 core-loop packet, Phase 8
growth/store packet, and Phase 9 release packet bind the complete share
boundary. Phase 7, Phase 8, and Phase 9 packets must remain blocked while the
machine-readable admissions are false.

Current credential-free source results on 2026-07-29:

- launch-contract validation and smoke: pass;
- independent CORE-07A adversarial source contract: 14/14 pass;
- Phase 7 and downstream packet source-binding contract: 4/4 pass;
- Phase 7 core-loop smoke, including zero-share packet behavior: 20/20 pass;
- Phase 8 growth/store smoke, including zero-public-link behavior: 13/13 pass.

These results prove bounded source refusal only. They are not UI, native,
hosted, signed-archive, professional, legal, or App Review evidence.

Still open:

- full CORE-06 and CORE-07 prerequisites;
- a positive share receipt issuer and reviewed projection schema;
- a real public token and lifecycle service;
- exact `REV-02` through `REV-06` decisions and `REV-07` detached signoffs;
- counsel-determined U.S. and storefront scope, policies, consent, retention,
  deletion, incident, content-rights, and App Privacy answers;
- final counsel-cleared identity/domain and Universal Link infrastructure;
- hosted security, privacy, abuse, deletion, cache/crawler, and observability
  proof;
- signed-archive and physical-iPhone human-simulated evidence;
- Apple App Review outcome.

Therefore CORE-07 remains `in_progress` and launch-blocked. This checkpoint is
not legal, clinical, chemistry, privacy, security, IP, Apple, market, growth, or
revenue approval.
