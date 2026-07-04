# Phase 3 Regulatory Positioning Memo

Status: not cleared for production launch  
Owner: founder until counsel/clinical reviewers are retained  
Last updated: 2026-07-04

## Executive Position

OnSkin should launch, if cleared, as a cosmetic wellness and routine-support app. The product must avoid disease diagnosis, disease treatment, dose instructions, skin-health scoring, condition detection, and any claim that a phone photo or language model can provide clinical judgment.

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
- Photo progress capture and comparison without scores, diagnosis, disease detection, or cloud analysis by default.
- Optional, separate, revocable consents for health-data collection, photo cloud backup, Ask OnSkin cloud mode, trend analysis, commerce partner sharing, and marketing.

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
- Photos stay on device by default.
- Paid links are disclosed and do not affect recommendations.
- Ask OnSkin answers bounded questions from the user's shelf/routine, and refuses or escalates out-of-scope questions.

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
- Cloud Ask OnSkin beyond deterministic shelf/routine/conflict answers.
- Automated trend analysis public launch until fairness and legal review are complete.
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
- `apps/mobile/src/features/photos/copy.ts` and `apps/mobile/src/features/trend/copy.ts`: no-score/no-diagnosis posture is centralized and test-scanned.

## Required Signoffs

No one may mark Phase 3 complete until these are attached to the review logs:

| Signoff            | Required reviewer                                    | Scope                                                                   | Current status             |
| ------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| Legal/regulatory   | Qualified attorney                                   | Privacy, consumer health data, FDA/FTC/App Store/Google posture, claims | Not retained / not cleared |
| Dermatology        | Board-certified dermatologist or equivalent reviewer | Rules, escalations, safety caveats, recommendation taxonomy             | Not retained / not cleared |
| Cosmetic chemistry | Qualified cosmetic chemist/formulator                | Ingredient taxonomy, routine compatibility, product type caveats        | Not retained / not cleared |
| IP/FTO             | Counsel                                              | Quiz flow, scoring, similarity to SkinSort/competitors, brand/marks     | Not retained / not cleared |
| Privacy/security   | Counsel plus technical owner                         | Data inventory, processors, deletion/export, breach response            | Not cleared                |

## Seven-Figure Readiness Judgment

Phase 3 is commercially necessary. The app idea can be worth building only if customers believe it is calmer, more private, more useful, and more honest than the noisy skincare internet. That requires conservative claims, real review evidence, and visible privacy controls. Shipping placeholder quiz/legal copy or unreviewed medical-adjacent claims would damage the trust wedge that the business depends on.
