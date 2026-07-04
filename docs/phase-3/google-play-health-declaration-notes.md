# Google Play Health Declaration Notes

Status: draft, not ready for submission  
Last updated: 2026-07-04

These notes are for Play Console declarations and reviewer notes after legal/privacy review.

## App Functionality Summary

OnSkin helps users organize a skincare routine, maintain a product shelf, compare their own progress photos, and understand conservative routine-order conflicts. It is not a medical, diagnostic, treatment, or disease-detection app.

## Health Content Boundary

- No diagnosis or condition detection.
- No treatment/cure/prevention claims.
- No skin health score, hazard score, skin age, or percentage improvement.
- No emergency, triage, or clinical advice workflow.
- Medical questions are refused or escalated to a clinician outside the app.

## Data Safety Notes

Potential collected data categories:

- Account info.
- App activity.
- User-provided skincare profile/routine data.
- User product shelf data.
- Subscription entitlement.
- Crash diagnostics.
- Product analytics events.

Potential sensitive/health data:

- Skin goals/preferences.
- Product shelf and routine data.
- Photos, only if cloud backup is separately enabled.

Potential sharing:

- Service providers: Supabase, RevenueCat, PostHog, Sentry, Apple/Google billing/auth.
- Affiliate partner: only after separate commerce consent, and only anonymous click token, not skin data.
- Cloud AI vendor: deferred, off by default, no public launch until contract/legal review.

## Required Before Submission

- Final data inventory reviewed by counsel.
- Data Safety form matches real runtime behavior.
- Consumer health policy URL is live if applicable.
- Account deletion URL is live.
- Health-content declaration reviewed.
- Screenshots and descriptions checked against `launch-claims-vocabulary.md`.
