# Phase 8 Apple Ads Keyword Lab

Status: measurement-only. Do not use cold paid acquisition as the scale engine.

## Goal

Use a small Apple Search Ads keyword lab to learn intent language, not to force growth. Phase 8 must prove organic conversion and share-loop quality first.

## Budget Rule

- Start with a capped test budget only after store listings are approved.
- Stop if trial-start or paid-conversion economics do not support annual subscription payback.
- Do not expand spend until activation, retention, and paid conversion are measured from real organic traffic.

## Allowed Keyword Themes

- skincare routine app
- skincare tracker
- skincare shelf
- skincare reminders
- product routine tracker
- progress photo skincare

## Blocked Keyword Themes

- acne treatment
- eczema treatment
- rosacea cure
- dermatologist diagnosis
- AI skin analysis
- skin score
- skin age

## Measurement Events

Content-free events only:

- `landing_viewed`
- `store_click`
- `install`
- `onboarding_started`
- `first_product_added`
- `first_reviewed_insight_viewed`
- `trial_started`
- `paid_started`

## Decision Criteria

The lab can continue only if:

- Store listing conversion is healthy relative to organic benchmarks.
- Activation from install to first product is not the bottleneck.
- Trial and paid conversion are measurable without sensitive attribution.
- Support volume and review sentiment do not indicate misleading positioning.

## Stop Conditions

- Any ad or keyword implies medical treatment, diagnosis, or AI scoring.
- CAC payback depends on optimistic retention not yet proven.
- Paid traffic masks weak onboarding or weak shelf-conflict value.
- App review/support issues appear after traffic starts.
