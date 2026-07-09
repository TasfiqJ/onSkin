# Feature Index

|   # | Feature                                 | Priority            | MVP                          | Complexity | Dependencies                    | Status                            | Future Doc |
| --: | --------------------------------------- | ------------------- | ---------------------------- | ---------- | ------------------------------- | --------------------------------- | ---------- |
|   1 | Rebrand and identity migration          | Must-have           | Yes                          | Medium     | founder/counsel                 | Planned                           | TBD        |
|   2 | Onboarding, age gate, consent           | Must-have           | Yes                          | Medium     | legal/privacy copy              | Existing, needs final copy        | TBD        |
|   3 | Shelf intake: manual/search/barcode/OCR | Must-have           | Yes                          | High       | catalog, camera, local store    | Existing, needs device/catalog QA | TBD        |
|   4 | Product catalog import and quality      | Must-have           | Yes                          | High       | OBF/CosIng/source review        | Scaffolded                        | TBD        |
|   5 | Reviewed conflict engine                | Must-have           | Yes                          | High       | clinical/cosmetic review        | Launch-blocked                    | TBD        |
|   6 | Routine builder                         | Must-have           | Yes                          | High       | shelf, profile, rules           | Existing, needs review            | TBD        |
|   7 | Today check-off and adherence           | Must-have           | Yes                          | Medium     | routine plan, local store       | Existing                          | TBD        |
|   8 | Skin cycling and ramp scheduler         | Must-have           | Yes                          | High       | rules/review                    | Existing, needs review            | TBD        |
|   9 | Private photo progress                  | Should-have         | Yes if QA passes             | High       | camera, encryption, consent     | Existing, needs device QA         | TBD        |
|  10 | Reminders                               | Should-have         | Yes                          | Medium     | notification permissions        | Existing, needs device QA         | TBD        |
|  11 | RevenueCat paywall and entitlements     | Must-have           | Yes                          | High       | final brand/store records       | Scaffolded                        | TBD        |
|  12 | Reverse trial                           | Should-have         | Yes                          | Medium     | entitlements, analytics         | Existing/scaffolded               | TBD        |
|  13 | Recommendations                         | Should-have         | No public claim until review | High       | catalog, review, Pro gates      | Existing, gated                   | TBD        |
|  14 | Ask advisor                             | Could-have          | Local only if reviewed       | High       | reviewed corpus, guardrails     | Existing/gated                    | TBD        |
|  15 | Shareable conflict card                 | Should-have         | After reviewed rules         | Medium     | final brand, links, share sheet | Existing/gated                    | TBD        |
|  16 | Commerce/replenishment                  | Later               | No                           | High       | consent, FTC, partner           | Inert/gated                       | TBD        |
|  17 | Community/Skin Notes                    | Later               | No                           | High       | moderation, legal, experts      | Scaffolded/gated                  | TBD        |
|  18 | Trend insights                          | Later               | No                           | High       | device/fairness/legal review    | Gated                             | TBD        |
|  19 | Widgets/live activities                 | Later               | No                           | High       | native targets                  | Inert                             | TBD        |
|  20 | Admin/operator review tooling           | Must-have for scale | Partial                      | Medium     | backend, reviewer workflow      | Generated queue scaffold          | TBD        |

## Inclusion Rules

- A feature can exist in code without being marketed.
- A feature can be shown in beta only if beta copy labels its limits honestly.
- A feature can be public only when its launch gate is closed with evidence.

## Complexity Key

- Low: limited UI/data change, minimal safety/privacy risk.
- Medium: multi-screen or persistent state.
- High: native, backend, payment, clinical, legal, privacy, or catalog dependency.
