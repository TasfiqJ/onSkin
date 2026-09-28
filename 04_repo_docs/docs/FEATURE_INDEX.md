# Feature Index

|   # | Feature                                 | iOS Launch | Complexity | Dependencies                    | Current readiness                 | Source Doc                                                                                                                                               |
| --: | --------------------------------------- | ---------- | ---------- | ------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Rebrand and identity migration          | Required   | Medium     | founder/counsel                 | launch-blocked                    | TBD                                                                                                                                                      |
|   2 | Onboarding, age gate, consent           | Required   | Medium     | legal/privacy copy              | implemented / needs final review  | TBD                                                                                                                                                      |
|   3 | Shelf intake: manual/search/barcode/OCR | Required   | High       | catalog, camera, local store    | source candidate / launch-blocked | [CAT-04](hugeToDo/CAT-04-SEARCH-BARCODE-RECOVERY-SOURCE-CHECKPOINT-2026-07-18.md) / [CAT-05](hugeToDo/CAT-05-NATIVE-OCR-SOURCE-CHECKPOINT-2026-07-18.md) |
|   4 | Product catalog import and quality      | Required   | High       | OBF/CosIng/source review        | source candidate / launch-blocked | TBD                                                                                                                                                      |
|   5 | Reviewed conflict engine                | Required   | High       | clinical/cosmetic review        | launch-blocked                    | TBD                                                                                                                                                      |
|   6 | Routine builder                         | Required   | High       | shelf, profile, rules           | implemented / launch-blocked      | TBD                                                                                                                                                      |
|   7 | Today check-off and adherence           | Required   | Medium     | routine plan, local store       | implemented                       | TBD                                                                                                                                                      |
|   8 | Skin cycling and ramp scheduler         | Required   | High       | rules/review                    | implemented / launch-blocked      | TBD                                                                                                                                                      |
|   9 | Private photo progress                  | Required   | High       | camera, encryption, consent     | needs-device-verification         | TBD                                                                                                                                                      |
|  10 | Reminders                               | Required   | Medium     | notification permissions        | needs-device-verification         | TBD                                                                                                                                                      |
|  11 | RevenueCat paywall and entitlements     | Required   | High       | final brand/store records       | stubbed                           | TBD                                                                                                                                                      |
|  12 | Reverse trial                           | Required   | Medium     | entitlements, analytics         | implemented / live-blocked        | TBD                                                                                                                                                      |
|  13 | Recommendations                         | Required   | High       | catalog, review, Pro gates      | launch-blocked                    | TBD                                                                                                                                                      |
|  14 | Ask advisor                             | Required   | High       | provider, corpus, guardrails    | local implemented / cloud blocked | TBD                                                                                                                                                      |
|  15 | Shareable conflict card                 | Required   | Medium     | final brand, links, share sheet | implemented / launch-blocked      | TBD                                                                                                                                                      |
|  16 | Commerce/replenishment                  | Required   | High       | reviewed rail/authority, privacy/legal, FTC, partner | literal zero admission source checkpoint / launch-blocked | [COM-01A](hugeToDo/COM-01-COMMERCE-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md)                                                              |
|  17 | Community/Skin Notes                    | Required   | High       | moderation, legal, experts      | stubbed / launch-blocked          | TBD                                                                                                                                                      |
|  18 | Trend insights                          | Required   | High       | engine, fairness/legal review   | zero-admission source checkpoint / launch-blocked | [PHOTO-05A](hugeToDo/PHOTO-05-TREND-ADMISSION-SOURCE-CHECKPOINT-2026-07-29.md)                                                                 |
|  19 | Widgets/live activities                 | Required   | High       | signed archive + device QA      | source candidate / launch-blocked | TBD                                                                                                                                                      |
|  20 | Admin/operator review tooling           | Required   | Medium     | backend, reviewer workflow      | source candidate / launch-blocked | TBD                                                                                                                                                      |

## Inclusion Rules

- Every listed feature is required for the iOS launch.
- A route, flag, preview, fixture, simulation, or inert native target is not a
  completed feature.
- A feature can enter TestFlight only with honest beta limitations and its
  applicable safety/privacy prerequisites.
- A feature can ship publicly only when its launch gate is closed with evidence.

## COM-01A Commerce Admission Rule

COM-01A is a **literal zero admission** source checkpoint only. Commerce
authority, rail and publication authority, reviewed catalog/Stacks, positive
consent grant, provider poll, reads/writes for clicks, orders, or attribution,
external purchase navigation, and commerce analytics are unconditionally false
or inert. Refusal, withdrawal, cleanup, and deletion may remain. COM-01 through
COM-07 are incomplete and launch-blocked; older positive commerce text describes
future requirements, not a runnable preview.

A successor requires executed provider terms; exact first/third-party data
flows; App Privacy and ATT decisions; commission-independent ranking;
adjacent affiliate/native-ad disclosure; claims and FTC Health Breach
Notification Rule review; Washington and Nevada consumer-health review;
applicable California review; live reconciliation; and exact native evidence.
[Apple §5.1.2(vi)](https://developer.apple.com/app-store/review/guidelines/)
means photo/camera-derived marketing, advertising, or use-based mining cannot be
cured merely by consent or an opaque token, while §2.5.18 separately constrains
health-data-based targeted/behavioral display advertising. See also the
[FTC affiliate guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking),
[FTC HBNR guidance](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0),
[Washington law](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373&full=true),
[Nevada law](https://www.leg.state.nv.us/nrs/nrs-603a.html), and
[applicable California definitions](https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.140.).
Neither this source checkpoint nor later review guarantees App Store acceptance,
legal compliance, safety, demand, or revenue.

## Complexity Key

- Low: limited UI/data change, minimal safety/privacy risk.
- Medium: multi-screen or persistent state.
- High: native, backend, payment, clinical, legal, privacy, or catalog dependency.
