# Phase 8 Launch Dry Run Checklist

Run this before enabling any Phase 8 public flag in production.

## Identity

- [ ] Brand/legal clearance recorded.
- [ ] Final domain DNS controlled.
- [ ] Support email monitored.
- [ ] Policy URLs live.
- [ ] App Store Connect record created.
- [ ] Play Console record created.

## App Links

- [ ] iOS Universal Links verified on physical device.
- [ ] Android App Links verified on physical device.
- [ ] Desktop fallback works.
- [ ] Invalid share ID shows generic landing page.
- [ ] No Firebase Dynamic Links dependency or redirect.

## Share Card

- [ ] Only reviewed non-safety two-product conflicts can be shared.
- [ ] Card exports at 1080x1920.
- [ ] Card includes brand, CTA, disclaimer, and first-party link label.
- [ ] No product names, profile details, pregnancy status, photos, or rule IDs in the URL.
- [ ] Events fire in sequence: export started, link created, export succeeded/failed, share sheet opened.

## Store Submission

- [ ] Store metadata validates in code.
- [ ] Screenshots are real device captures.
- [ ] No post-launch or disabled surfaces in screenshots.
- [ ] Privacy labels and Data safety match implementation.
- [ ] Subscription review packet complete.
- [ ] Account deletion and data export evidence attached.

## Review Prompt

- [ ] Prompt is disabled by default.
- [ ] Prompt only fires after a value moment.
- [ ] No "five stars" or sentiment gate.
- [ ] Cooldown and annual cap verified.

## Creator And Paid Measurement

- [ ] Creator brief approved.
- [ ] Disclosure text required.
- [ ] No medical/outcome claims.
- [ ] Apple Ads keyword lab uses blocked-keyword list.
- [ ] Paid measurement is not used as a scale engine.

## Analytics And Support

- [ ] Acquisition dashboard live.
- [ ] Sensitive key scan passes.
- [ ] Support response workflow active.
- [ ] Review-response templates approved.
- [ ] Refund/cancel feedback monitored.

## Signoff

- [ ] `npm run phase8:verify` passes.
- [ ] `npm run phase8:check-growth-store:strict` passes.
- [ ] `npm run phase8:qa-packet:strict` passes.
- [ ] Founder signs `PHASE8_SIGNED_OFF_BY`.
