# Phase 8 Source Of Truth

Phase 8 is blocked from public launch until this file is filled with final, signed-off values. The code is wired to stay inert when these values are placeholders.

## Public Identity

| Field | Required final value | Current status |
| --- | --- | --- |
| Brand name | Counsel-cleared production name | BLOCKED: pending brand/legal clearance |
| Final domain | Production domain with DNS control | BLOCKED: `EXPO_PUBLIC_FINAL_BRAND_DOMAIN` empty |
| App scheme | Counsel-cleared scheme | BLOCKED: inherited from `app.base.json` until brand lock |
| iOS bundle ID | App Store Connect app record | BLOCKED: app record needed |
| Android package | Play Console app record | BLOCKED: app record needed |
| Support email | Public monitored support address | BLOCKED: `EXPO_PUBLIC_SUPPORT_EMAIL` empty |
| Marketing URL | Production landing page | BLOCKED: `EXPO_PUBLIC_MARKETING_URL` empty |
| App Store URL | App Store product URL | BLOCKED: `EXPO_PUBLIC_APP_STORE_URL` empty |
| Play Store URL | Play product URL | BLOCKED: `EXPO_PUBLIC_PLAY_STORE_URL` empty |

## Seven-Figure Readiness Check

At $49.99/year, $1,000,000 gross ARR needs about 20,004 annual subscribers. Net of a 15% store fee, the target is about 23,535 annual subscribers. Net of a 30% fee, it is about 28,577 annual subscribers.

Phase 8 does not assume paid acquisition can solve that. The growth loop must be organic, attributable, compliant, and attached to a real value moment: a shareable reviewed shelf conflict that sends prospects to a first-party landing page.

## Launch Gates

All flags default off in `.env.example`.

| Gate | Evidence |
| --- | --- |
| `EXPO_PUBLIC_PHASE8_PUBLIC_LINKS_ENABLED=true` | Final domain, Universal Links, Android App Links, public fallback, and store URLs work on device |
| `EXPO_PUBLIC_PHASE8_REVIEW_PROMPT_ENABLED=true` | StoreReview policy tested; App Store and Play review flows verified |
| `EXPO_PUBLIC_PHASE8_CREATOR_LINKS_ENABLED=true` | FTC creator brief approved; no reward/referral program |
| `EXPO_PUBLIC_PHASE8_PAID_MEASUREMENT_ENABLED=true` | Apple Ads keyword lab only; no cold paid scale campaign |

Strict release evidence is represented by `PHASE8_*` environment variables and checked by `npm run phase8:check-growth-store:strict`.

## Public Routes Required On Final Domain

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
- Reviewed product-order conflicts
- Progress photo comparison without scores
- Privacy controls, export, deletion
- Clearly disclosed paid links only when enabled

Blocked public framing:

- Diagnosis, treatment, cure, prevention, or disease detection
- AI skin score, skin age, hazard score, percentage improvement
- Before/after galleries
- Fake testimonials or review gating
- Referral rewards before the Shelf Conflict Card proves value
- Store screenshots of unbuilt, post-launch, or simulated features
