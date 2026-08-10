# Phase 3 Regulatory Positioning Memo

Status: not cleared for production launch  
Owner: founder until counsel/clinical reviewers are retained  
Last updated: 2026-08-08

## Executive Position

Layerwell should launch, if cleared, as a cosmetic wellness and routine-support app. The product must avoid disease diagnosis, disease treatment, dose instructions, skin-health scoring, condition detection, and any claim that a phone photo or language model can provide clinical judgment.

The strongest seven-figure path is trust, retention, and paid convenience: a private shelf, sequencing, reminders, progress photos, fit-based recommendations, and transparent paid links. It is not a defensible path to claim medical outcomes before substantiation. That path increases app-review, FTC, FDA, state privacy, and customer-trust risk.

## Current Regulatory Basis Checked

These sources were checked for current Phase 3 implementation decisions:

- FDA General Wellness guidance: low-risk wellness products can stay outside device regulation when they promote a healthy lifestyle and are unrelated to diagnosis, cure, mitigation, prevention, or treatment of disease.
- FTC Health Products Compliance Guidance: health-related claims need competent and reliable scientific evidence before they are made.
- Apple App Review Guidelines: apps must provide accurate metadata, functional privacy links, subscription terms, account deletion if account creation exists, and avoid misleading health claims.
- Google Play Data Safety and Health Content policies: declarations must match actual collection/sharing, and health-related functionality must not be misleading.
- Washington My Health My Data Act: consumer health data collection/sharing needs specific notices and consents.
- FTC Health Breach Notification Rule: health apps outside HIPAA can still have breach notification duties.
- FTC Endorsement Guides: paid links and endorsements need clear, unavoidable disclosures.
- EU AI Act Article 50: users must be told when they are interacting with an AI system where applicable.

## Launch Classification

Planned public V1 classification:

- Cosmetic routine and personal organization.
- User-entered shelf/routine tracking.
- Ingredient/routine sequencing support using conservative rules.
- Photo progress capture and comparison without scores, diagnosis, disease detection, cloud analysis, or cloud backup in current V1.
- Explicit, separate, revocable health-data collection consent before
  personalized quiz/profile use, validated against the exact current version
  and text hash; Ask cloud mode, commerce partner sharing, and marketing remain
  separate optional grants. Trend processing is currently unavailable and
  refuses a positive grant before mutation; explicit legacy withdrawal cleanup
  remains. Photo cloud-backup consent remains reserved and unwired unless a
  future complete implementation is reviewed.

Not launch classification:

- Medical device.
- Telehealth, diagnosis, treatment, disease prevention, prescription, triage, or clinician-matching app.
- Skin condition detector.
- AI dermatology app.
- Objective skin score, skin age, or skin health rating product.

## Allowed Launch Claims

Allowed claims must be about organization, appearance, privacy, and user control:

- Helps organize your skincare routine.
- Keeps a private shelf of products you use.
- Helps sequence products in your routine.
- Flags possible routine conflicts using conservative, evidence-graded rules.
- Helps compare your own progress photos under similar conditions.
- Progress photos stay encrypted on the device unless the user explicitly shares one.
- Paid links are disclosed and do not affect recommendations.
- Ask Layerwell answers bounded questions from the user's shelf/routine, and refuses or escalates out-of-scope questions.

## Forbidden Launch Claims

These must not appear in app copy, store metadata, ads, screenshots, push notifications, paywalls, affiliate copy, or review replies:

- Treats, cures, heals, prevents, diagnoses, detects, or manages any disease or condition.
- Acne, eczema, rosacea, psoriasis, dermatitis, melasma, hyperpigmentation, or similar condition naming as a user diagnosis.
- Dermatologist-grade, clinically proven, objective, more accurate than a dermatologist, or similar superiority wording.
- Skin score, skin age, skin health score, hazard score, percentage improvement, or grade.
- Dose or clinical regimen instructions such as mg, ml, IU, or frequency instructions for treatment.
- Guaranteed results, time-bound outcome claims, urgency, scarcity, guilt, or fear.
- AI skin analysis as a marketing hook.

## Launch Scope

Shippable after signoff:

- Auth, onboarding, shelf, routine builder, sequencing, reminders, app lock.
- Subscription and paywall with functional terms, privacy, restore, cancel, and auto-renew disclosures.
- Local progress photos, on-device by default, without scores.
- Recommendation type cards that have documented clinical/cosmetic review.
- Commerce links only after affiliate and privacy consents are cleared and paid-link disclosures are visible.

Deferred or hidden until signoff:

- Placeholder quiz copy.
- Any derm-reviewed recommendation, rule, PAO default, community note, or shoppable stack without reviewer identity/date.
- Cloud Ask Layerwell beyond deterministic shelf/routine/conflict answers.
- Automated Trend processing or claims until a real exact-build engine/result
  issuer, measurement/calibration and failure evidence, diverse-condition
  fairness, exact consent/data-lifecycle, clinical/regulatory/privacy review,
  archive-identical local-only proof, and supported-iPhone evidence are complete.
- Peer-submitted community posting.
- Affiliate/partner catalogue until contracts, disclosures, partner data flow, and taxonomy are cleared.

## Existing Code Controls

The current implementation already uses production gates for high-risk surfaces:

- `apps/mobile/src/features/intelligence/rules.ts`: only reviewed rules ship in production.
- `apps/mobile/src/features/intelligence/pao.ts`: PAO defaults are withheld in production until reviewed.
- `apps/mobile/src/features/recommendations/catalog.ts`: medical-adjacent recommendation types are gated by review.
- `apps/mobile/src/features/commerce/stacks.ts`: shoppable stacks are hidden in production until reviewed.
- `apps/mobile/src/features/community/notes.ts`: notes are hidden in production until reviewed.
- `apps/mobile/src/features/ask/answer.ts`: substantive answers are template-bounded; unsupported or medical questions refuse/escalate.
- `apps/mobile/src/features/photos/copy.ts`: the no-score/no-diagnosis posture
  remains centralized and test-scanned. Historical Trend copy is not current
  publication authority; PHOTO-05A refuses before result selection or display.

## Primary-Source Revalidation (2026-08-08)

This is a research checkpoint, not legal, clinical, chemistry, or App Review
approval. It rechecks the launch boundary against the current primary sources
and does not replace the required named-reviewer signoffs below.

- [Apple App Review Guidelines 5.1.1](https://developer.apple.com/app-store/review/guidelines/)
  requires an accessible privacy policy both in App Store Connect metadata and
  in the app; the policy must identify collected data, collection method, uses,
  third-party protections, retention/deletion, and consent withdrawal. It also
  requires in-app account deletion when the app supports account creation.
- [Apple App Review Guidelines 5.1.2](https://developer.apple.com/app-store/review/guidelines/)
  requires explicit permission before personal data is transmitted or shared,
  including disclosure of third-party AI recipients. It forbids conditioning
  core access on tracking, push, or location permissions.
- [FTC Health Products Compliance Guidance](https://search.ftc.gov/business-guidance/resources/health-products-compliance-guidance)
  says health-related marketing must be truthful, non-misleading, and supported
  before dissemination; it evaluates both express claims and the reasonable
  consumer's overall impression. The guidance specifically applies its
  principles to health-related apps.

Result: the current source-controlled posture remains the narrowest defensible
one: no diagnosis, treatment, disease detection, score, or efficacy claim; no
cloud Ask, paid-link sharing, Trend analysis, or external photo transfer before
their separate consent, vendor, exact-build, privacy, and professional-review
gates are positively cleared. This revalidation does **not** clear those gates
or predict App Review, regulator, or counsel outcomes.

## Required Signoffs

No one may mark Phase 3 complete until these are attached to the review logs:

| Signoff            | Required reviewer                                    | Scope                                                                   | Current status             |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| Legal/regulatory   | Qualified attorney                                   | Privacy, consumer health data, FDA/FTC/App Store/Google posture, claims | Not retained / not cleared |
| Dermatology        | Board-certified dermatologist or equivalent reviewer | Rules, escalations, safety caveats, recommendation taxonomy             | Not retained / not cleared |
| Cosmetic chemistry | Qualified cosmetic chemist/formulator                | Ingredient taxonomy, routine compatibility, product type caveats        | Not retained / not cleared |
| IP/FTO             | Counsel                                              | Quiz flow, scoring, similarity to SkinSort/competitors, brand/marks     | Not retained / not cleared |
| Privacy/security   | Counsel plus technical owner                         | Data inventory, processors, deletion/export, breach response            | Not cleared                |

The authoritative review-log files are
`docs/phase-3/legal-regulatory-review-log.md`,
`docs/phase-3/clinical-review-log.md`,
`docs/phase-3/cosmetic-chemistry-review-log.md`,
`docs/phase-3/privacy-security-review-log.md`, and
`docs/phase-3/ip-fto-review-log.md`.

## Seven-Figure Readiness Judgment

Phase 3 is commercially necessary. The app idea can be worth building only if customers believe it is calmer, more private, more useful, and more honest than the noisy skincare internet. That requires conservative claims, real review evidence, and visible privacy controls. Shipping placeholder quiz/legal copy or unreviewed medical-adjacent claims would damage the trust wedge that the business depends on.
