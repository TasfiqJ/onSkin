# Phase 8 Store Metadata Source Of Truth

The canonical metadata packet lives in `apps/mobile/src/lib/legal/storeMetadata.ts` as `PHASE8_STORE_METADATA_PACKET`.

Run:

```bash
npm run phase8:check-growth-store
```

## Public Copy Rules

Store copy may describe:

- Routine and shelf organization
- Reviewed product-order conflict flags
- Progress photo comparison without scores
- Privacy controls, export, deletion
- Clearly disclosed paid links when commerce is enabled

Store copy must not describe:

- Treatment, prevention, cure, diagnosis, or disease detection
- AI skin analysis, skin score, skin age, hazard score, or percent improvement
- Dermatologist-grade or clinically proven personalization claims
- Any required surface before it is production-real, enabled, reviewed, and
  evidenced in the selected build
- External web checkout

## iOS Packet

- App name: `RoutineKind` (working candidate; final legal/store-console clearance still required)
- Subtitle: `Routine and shelf tracker`
- Promotional text: configured in code
- Keywords: configured in code
- Description: configured in code
- Screenshot captions: configured in code
- Reviewer notes: configured in code

## Google Play Packet

- Title: `RoutineKind` (working candidate; final legal/store-console clearance still required)
- Short description: configured in code
- Full description: configured in code
- Screenshot captions: configured in code
- Reviewer notes: configured in code

## Screenshot Inventory

Screenshots may show only production-real surfaces:

1. Shelf organization
2. Today AM/PM routine
3. Reviewed non-safety shelf conflict
4. Progress photos without score/age/grade
5. Privacy, export, deletion, subscription management

Do not show:

- Ask/cloud advisor unless Phase 7 cloud Ask is enabled and policy reviewed
- Trend insights unless Phase 7 trend is enabled and device/fairness QA passed
- Commerce links unless commerce consent/disclosure and paid-link QA passed
- Community posting unless moderation/legal gates passed
- Any simulated "before/after" outcome

## Reviewer Evidence To Attach

- Privacy policy URL
- Terms URL
- Consumer health privacy notice URL
- Support URL
- Account deletion URL
- Data export URL
- Subscription products and entitlement mapping
- Test credentials
- Camera permission explanation
- Account deletion and export screen recording
- Medical/cosmetic boundary note
- No-score photo progress note
