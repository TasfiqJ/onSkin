# Feature Index

|   # | Feature                                 | iOS Launch | Complexity | Dependencies                    | Current readiness                 | Source Doc |
| --: | --------------------------------------- | ---------- | ---------- | ------------------------------- | --------------------------------- | ---------- |
|   1 | Rebrand and identity migration          | Required   | Medium     | founder/counsel                 | launch-blocked                    | TBD        |
|   2 | Onboarding, age gate, consent           | Required   | Medium     | legal/privacy copy              | implemented / needs final review  | TBD        |
|   3 | Shelf intake: manual/search/barcode/OCR | Required   | High       | catalog, camera, local store    | needs device/catalog/OCR QA       | TBD        |
|   4 | Product catalog import and quality      | Required   | High       | OBF/CosIng/source review        | stubbed / launch-blocked          | TBD        |
|   5 | Reviewed conflict engine                | Required   | High       | clinical/cosmetic review        | launch-blocked                    | TBD        |
|   6 | Routine builder                         | Required   | High       | shelf, profile, rules           | implemented / needs review        | TBD        |
|   7 | Today check-off and adherence           | Required   | Medium     | routine plan, local store       | implemented                       | TBD        |
|   8 | Skin cycling and ramp scheduler         | Required   | High       | rules/review                    | implemented / needs review        | TBD        |
|   9 | Private photo progress                  | Required   | High       | camera, encryption, consent     | needs-device-verification         | TBD        |
|  10 | Reminders                               | Required   | Medium     | notification permissions        | needs-device-verification         | TBD        |
|  11 | RevenueCat paywall and entitlements     | Required   | High       | final brand/store records       | stubbed                           | TBD        |
|  12 | Reverse trial                           | Required   | Medium     | entitlements, analytics         | implemented / live-blocked        | TBD        |
|  13 | Recommendations                         | Required   | High       | catalog, review, Pro gates      | launch-blocked                    | TBD        |
|  14 | Ask advisor                             | Required   | High       | provider, corpus, guardrails    | local implemented / cloud blocked | TBD        |
|  15 | Shareable conflict card                 | Required   | Medium     | final brand, links, share sheet | implemented / launch-blocked      | TBD        |
|  16 | Commerce/replenishment                  | Required   | High       | consent, FTC, partner           | inert / launch-blocked            | TBD        |
|  17 | Community/Skin Notes                    | Required   | High       | moderation, legal, experts      | stubbed / launch-blocked          | TBD        |
|  18 | Trend insights                          | Required   | High       | engine, fairness/legal review   | simulated / launch-blocked        | TBD        |
|  19 | Widgets/live activities                 | Required   | High       | native targets                  | inert                             | TBD        |
|  20 | Admin/operator review tooling           | Required   | Medium     | backend, reviewer workflow      | partial                           | TBD        |

## Inclusion Rules

- Every listed feature is required for the iOS launch.
- A route, flag, preview, fixture, simulation, or inert native target is not a
  completed feature.
- A feature can enter TestFlight only with honest beta limitations and its
  applicable safety/privacy prerequisites.
- A feature can ship publicly only when its launch gate is closed with evidence.

## Complexity Key

- Low: limited UI/data change, minimal safety/privacy risk.
- Medium: multi-screen or persistent state.
- High: native, backend, payment, clinical, legal, privacy, or catalog dependency.
