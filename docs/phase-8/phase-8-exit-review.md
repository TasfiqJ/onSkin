# Phase 8 Exit Review

Status: not launch-ready.

## Implemented

- Phase 8 env gates and source-of-truth fields.
- Expo config for Universal Links and Android App Links once a final domain is set.
- Privacy-safe growth attribution sanitizer and URL builder.
- Opaque share link generation for Shelf Conflict Card.
- Share card export fixed to 1080x1920.
- Share eligibility tightened to reviewed, non-safety, two-product conflicts.
- Global analytics sanitizer tightened for growth telemetry.
- Store review prompt policy with caps and value moments.
- Store metadata packet with validator.
- Creator brief, paid measurement lab, dashboard spec, compliance packet, dry-run checklist.
- Generated QA packets hash the Phase 8 verifier scripts and shared
  evidence-normalization helper, so public-growth evidence is tied to the local
  gates that decided its status.
- Generated QA packets also hash the Phase 8 public-site fallback pages,
  Universal/App Links templates, store metadata source of truth, support
  playbook, Apple Ads lab, dry-run checklist, and `.env.example`, so the packet
  cannot sign off a stale or partial growth/store source package.

## Still Blocked

- Final brand/domain/app IDs are not recorded.
- Store URLs are not configured.
- App-link association files need final Team ID, bundle ID, package name, and certificate fingerprints.
- Store screenshots have not been captured on physical devices.
- Privacy labels and Data safety forms need final legal review.
- Phase 7 clinical/catalog/device/payment evidence is still required before public growth.
- Support desk and review-response workflow need owner signoff.
- Launch dashboard needs production events.

## Do Not Enable Public Growth Until

All of the following pass:

```bash
npm run phase8:verify
npm run phase8:check-growth-store:strict
npm run phase8:qa-packet:strict
```

Strict mode intentionally fails until external evidence variables are true.
