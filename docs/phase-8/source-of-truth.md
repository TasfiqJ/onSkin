# Phase 8 Source Of Truth

Phase 8 is blocked from public launch until this file is filled with final, signed-off values. The code is wired to stay inert when these values are placeholders.

## CORE-07A Publication Boundary

Conflict sharing and `/s/:shareId` are literal zero-admission surfaces. The
machine launch contract records no share receipt issuer, no public token
service, no share/public-link admission, no raw/private projection fields, and
no share analytics. Phase 7/8 flags and a final domain are incident/config
inputs only; they cannot grant publication authority.

Current denial occurs before capture, temporary-file creation, link
construction, network work, native sharing, record-implying public copy, or
analytics. The card renderer accepts only a deliberately constructed sanitized
projection, not a private conflict, Shelf, product, or profile object. Every
identifier is neutrally unavailable because syntax is not proof of a record.

Future activation requires an immutable issuer-authenticated exact-content
receipt, an explicitly allowlisted projection, confirmation of the exact
image/text/link/destination before native export, and a separately reviewed
public-token retention/revocation/deletion/abuse lifecycle. Exact-source
`REV-02` through `REV-06` decisions and `REV-07` detached signoffs remain
mandatory.

## Public Identity

| Field           | Required final value               | Current status                                           |
| --------------- | ---------------------------------- | -------------------------------------------------------- |
| Brand name      | Counsel-cleared production name    | BLOCKED: pending brand/legal clearance                   |
| Final domain    | Production domain with DNS control | BLOCKED: `EXPO_PUBLIC_FINAL_BRAND_DOMAIN` empty          |
| App scheme      | Counsel-cleared scheme             | BLOCKED: inherited from `app.base.json` until brand lock |
| iOS bundle ID   | App Store Connect app record       | BLOCKED: app record needed                               |
| Android package | Play Console app record            | BLOCKED: app record needed                               |
| Support email   | Public monitored support address   | BLOCKED: `EXPO_PUBLIC_SUPPORT_EMAIL` empty               |
| Marketing URL   | Production landing page            | BLOCKED: `EXPO_PUBLIC_MARKETING_URL` empty               |
| App Store URL   | App Store product URL              | BLOCKED: `EXPO_PUBLIC_APP_STORE_URL` empty               |
| Play Store URL  | Play product URL                   | BLOCKED: `EXPO_PUBLIC_PLAY_STORE_URL` empty              |

## Seven-Figure Readiness Check

At $49.99/year, $1,000,000 gross ARR needs about 20,004 annual subscribers. Net of a 15% store fee, the target is about 23,535 annual subscribers. Net of a 30% fee, it is about 28,577 annual subscribers.

Phase 8 does not assume paid acquisition can solve that. A future organic share
loop may be evaluated only after positive share and public-link admission. The
current build cannot count a renderer, flag, opaque-looking path, or projected
conversion as growth evidence, and no seven-figure outcome is guaranteed.

## Launch Gates

All flags default off in `.env.example`.

| Gate                                               | Evidence                                                                                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED=true`     | Insufficient alone: positive token authority, exact reviews, final domain, Universal Links, fallback, lifecycle, and store URLs all pass |
| `EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED=true`    | StoreReview policy tested; App Store and Play review flows verified                                                                      |
| `EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED=true`    | FTC creator brief approved; no reward/referral program                                                                                   |
| `EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED=true` | Apple Ads keyword lab only; no cold paid scale campaign                                                                                  |

Strict release evidence is represented by `PHASE8_*` environment variables and checked by `npm run phase8:check-growth-store:strict`.

The generated Phase 8 growth/store QA packet must hash the public-site fallback
pages, Universal/App Links templates, store metadata source of truth, support
playbook, readiness checker, smoke coverage, packet builder, `.env.example`,
the human-simulated E2E rules/tree/manifest, and the upstream Phase 5 native
device, Phase 6 payments, and Phase 7 core-loop generated QA packets. Its
Markdown must show whether it was generated from a clean or dirty Git worktree
so reviewers can reject stale or mixed-worktree store evidence.

## Public Routes Required On Final Domain

This is future infrastructure inventory, not a list of currently admitted
record routes. Until CORE-07A is superseded, `/s/:shareId` must show only a
neutral static unavailable page, reveal no existence bit, and emit no
record/share analytics.

- `/`
- `/s/:shareId`
- `/support`
- `/privacy`
- `/terms`
- `/account-deletion`
- `/data-export`
- `/consumer-health-privacy`
- `/.well-known/apple-app-site-association`
- `/.well-known/assetlinks.json`

## Public Claim Boundary

Allowed public framing:

- Routine organization
- Shelf organization
- Progress photo comparison without scores
- Privacy controls, export, deletion
- Clearly disclosed paid links only when enabled

Blocked public framing:

- Diagnosis, treatment, cure, prevention, or disease detection
- AI skin score, skin age, hazard score, percentage improvement
- Before/after galleries
- Any conflict/share claim without an exact positive publication receipt
- Any public route that implies a per-user or reviewed share record exists
- Share, destination, store-click, or `share_id` analytics while admission is closed
- Fake testimonials or review gating
- Referral rewards before the Shelf Conflict Card proves value
- Store screenshots of unbuilt, post-launch, or simulated features
