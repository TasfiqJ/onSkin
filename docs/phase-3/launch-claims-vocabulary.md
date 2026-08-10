# Launch Claims Vocabulary

Status: enforce now; legal review still required  
Last updated: 2026-07-04

This vocabulary governs app copy, store metadata, paywalls, screenshots, ads, website copy, emails, push notifications, affiliate pages, support replies, and founder sales language.

## Approved Voice

Use:

- Calm.
- Specific.
- Appearance-focused.
- Routine-focused.
- Honest about limits.
- Clear about when something is optional, separate, or off by default.
- Clear that recommendations are not influenced by commission.

Avoid:

- Clinical authority.
- Panic or shame.
- Certainty where evidence is limited.
- Hype around AI.
- Claims that imply diagnosis, treatment, or measurable clinical outcomes.

## Allowed Terms

These can be used when accurate:

- routine
- shelf
- product order
- ingredient compatibility
- possible conflict
- evidence-graded, only when the exact displayed grading method, sources,
  limitations, market scope, and release bytes are independently reviewed and
  bound to an authenticated exact-hash signoff
- fit
- appearance
- look of texture
- look of evenness
- progress photos
- comparable photos
- no score
- on-device by default
- off by default
- separate consent
- revocable
- paid link
- never affects what we recommend
- dermatologist review, only after credentials and independence are verified
  and an authenticated dated decision binds the exact reviewed bytes, hashes,
  scope, market, conditions, and limitations
- cosmetic chemist review, only after credentials and independence are
  verified and an authenticated dated decision binds the exact reviewed bytes,
  hashes, scope, market, conditions, and limitations

## Restricted Terms

These are allowed only in controlled refusal/disclosure copy, not as affirmative claims:

- AI, only for required disclosure such as "AI advisor".
- score, grade, skin age, only when refusing that feature.
- dermatologist, only for escalation or actual reviewer identity.
- safety, only when referring to conservative review process or clinician escalation.

## Forbidden Terms And Patterns

Do not use:

- treats, cures, heals, prevents, diagnoses, detects.
- disease/condition labels as user-facing diagnosis: acne, eczema, rosacea, psoriasis, dermatitis, melasma, hyperpigmentation.
- clinically proven unless counsel has approved claim-specific substantiation.
- dermatologist-grade.
- objective analysis.
- more accurate than your eyes, a dermatologist, or a clinician.
- skin score, skin health score, hazard score, skin age.
- percentage improvement or time-bound result claims.
- buy now, limited time, last chance, only X left.
- affiliate link as the disclosure label. Use "Paid link."
- commissionable link as the disclosure label.

## Approved Claim Patterns

Use patterns like:

- "Helps you keep your routine in order."
- "Flags possible routine conflicts before you layer products."
- "Shows your own photos side by side, without scores."
- "Photos stay on your phone by default."
- "A separate, revocable choice."
- "Paid link. Layerwell may earn a commission. It never affects what we recommend."
- "This is outside what Layerwell can advise on. It is worth asking a board-certified dermatologist."

## Blocked Claim Patterns

Do not use:

- "Treat acne."
- "Detects rosacea."
- "Prevents breakouts."
- "Clinically proven to improve skin in 14 days."
- "Dermatologist-grade AI."
- "Your skin score improved 23%."
- "Skin age down five years."
- "Buy before the offer disappears."
- "Affiliate link" as the only disclosure.

## Enforcement

- Unit tests scan app copy modules for high-risk claims.
- `npm run phase3:audit-copy` scans source/docs for placeholders and risk vocabulary.
- `npm run phase3:audit-copy:strict` must fail until legal/clinical blockers are cleared and placeholder production copy is replaced.
- Reviewers must use `legal-regulatory-review-log.md`,
  `clinical-review-log.md`, `cosmetic-chemistry-review-log.md`,
  `privacy-security-review-log.md`, and `ip-fto-review-log.md` before any
  reviewed content is exposed in production.
