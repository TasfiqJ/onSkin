# Phase 8 Exit Review

Status: not launch-ready.

## Implemented

- Phase 8 env gates and source-of-truth fields.
- Expo config for Universal Links and Android App Links once a final domain is set.
- Privacy-safe growth attribution sanitizer and URL builder.
- CORE-07A separately closes share publication and public-link admission; no
  flag, domain, `reviewedBy` value, owned pair, or valid-looking ID grants
  authority.
- The conflict-card renderer accepts only a constructed sanitized projection,
  not a raw private conflict object.
- Share routes return before capture, temporary file, link, network, native
  share, or analytics work. Public routes and static HTML make no per-record
  claim and emit no share/destination beacon.
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
- Generated QA packets also hash the human-simulated E2E rules/tree/manifest
  and the generated Phase 5 native-device, Phase 6 payments, and Phase 7
  core-loop packets, so public-growth signoff cannot drift from prerequisite
  device, billing, and core-loop evidence.

## Still Blocked

- Final brand/domain/app IDs are not recorded.
- Store URLs are not configured.
- No immutable exact-content share receipt issuer exists; share admission is
  literal false.
- No reviewed public token, retention, revocation, deletion, indexing, cache,
  abuse, or incident service exists; public-link admission is literal false.
- No exact-payload confirmation boundary exists because there is no positive
  export path.
- Exact-source `REV-02` regulatory, `REV-03` privacy/security, `REV-04`
  dermatology, `REV-05` cosmetic chemistry, `REV-06` IP/content-rights, and
  `REV-07` detached signoffs are missing.
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
It must also remain blocked while either machine-readable CORE-07A admission is
false; external evidence variables cannot override that source authority.
