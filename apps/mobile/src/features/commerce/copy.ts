import type { CuratorKind } from '@onskin/types';

/**
 * Centralised commerce copy (docs/10 §8, the Slice-11/20/21/22/23 guard pattern).
 * The FTC research is decisive and this wording is LEGALLY LOAD-BEARING:
 *  - "paid link" is the FTC-adequate disclosure; "affiliate link" and
 *    "commissionable link" are NOT adequate (the person placing the link is getting
 *    paid and consumers may not understand those terms). A "buy now" button is not a
 *    disclosure either.
 *  - the disclosure must be CLEAR & CONSPICUOUS / "unavoidable" — visible at the same
 *    time as the link, never collapsed behind a "more"/expand tap (16 CFR 255.0).
 *  - it must state OnSkin's independence ("never affects what we recommend").
 * `claimsafety.test.ts` scans this module on every edit and asserts the wording.
 * Keep all persuasive/disclosure copy HERE, not inline in screens.
 */

export const COMMERCE_COPY = {
  // Surface 01 — the quiet "where to buy" affordance (beneath the rationale).
  whereToBuy: {
    eyebrow: 'WHERE TO BUY',
    lockedEyebrow: 'WHERE TO BUY',
    lockedBody: 'Turn on where-to-buy links to see partner retailers — a separate, private choice.',
    lockedCta: 'Allow where-to-buy',
    partnerLabel: (price: string | null) => `at a partner retailer${price ? ` · ${price}` : ''}`,
    paidChip: 'Paid link', // FTC-adequate wording — NEVER "affiliate link"/"commissionable link"
    // The disclosure sits DIRECTLY under the links, always visible (FTC "unavoidable").
    // Split so the independence clause renders bold-inked (design §3); `disclosure`
    // keeps the full sentence for the claim-safety guard.
    disclosure: 'Paid link — OnSkin may earn a commission. It never affects what we recommend.',
    disclosureLead: 'Paid link — OnSkin may earn a commission.',
    disclosureEmphasis: 'It never affects what we recommend.',
    howThisWorks: 'How this works',
    alreadyOwn: 'Already own one? Add it to your shelf instead',
    // The honest empty state until the catalog/partner approval lands (B-CATALOG-SEED / B-SHOPMY).
    emptyState: 'We’ll show where to buy once our product catalogue is live — it never changes what we recommend.',
    // The inert tap explainer until the rail is approved (B-SHOPMY).
    stubTitle: 'Where to buy',
    stubBody:
      'Partner links go live with our product catalogue and an approved affiliate partner. They’ll carry only an anonymous token — never anything about your skin — and they never change what we recommend.',
  },
  // Surface 02 — the shoppable Stack.
  stack: {
    chipFor: (kind: CuratorKind): string =>
      kind === 'derm' ? 'DERMATOLOGIST-REVIEWED' : kind === 'creator' ? 'EXPERT-REVIEWED' : "EDITOR’S ROUTINE",
    subtitle: 'Curated on merit and evidence — not by who pays.',
    paidChip: 'Paid link',
    // Footer disclosure on a stack — states the order was set on merit, not commission.
    disclosure: 'Paid links — OnSkin may earn a commission. We picked these on merit; the commission never changed the list.',
    orderedNote: 'In order — the routine sequence, not the payout.',
  },
  // Surface 03 — the transparency page (the highest-leverage trust artifact).
  transparency: {
    eyebrow: 'HOW WE STAY HONEST',
    title: 'How recommendations and money stay separate.',
    principles: [
      {
        title: 'We rank by fit and evidence.',
        body: 'Commission, partnerships and affiliate data never enter the ranking — by architecture, not promise.',
      },
      {
        title: 'Links come after, never before.',
        body: 'We decide what’s best for you first; only then do we attach a “where to buy” link.',
      },
      {
        title: 'We disclose every paid link.',
        body: 'Right next to the link, in plain words — never hidden in a footer.',
      },
      {
        title: 'Sometimes we earn nothing.',
        body: 'If the best place to buy has no programme, we link there anyway — and tell you so.',
      },
    ],
    footer: 'We never send anything about your skin to a retailer.',
  },
  // Surface 04 — the MHMDA consent gate.
  consent: {
    title: 'Before we show where to buy',
    body: 'Opening a “where to buy” link shares a single anonymous click token with our affiliate partner — so a purchase can be credited. That’s it.',
    allow: 'An opaque token tied to no skin data',
    never: 'Never your profile, concerns or photos',
    // MHMDA-strict default (D-061): decline => no paid links shown at all (not "links
    // still work with zero tracking", which the mock implied) — the safer reading.
    note: 'a separate, revocable choice (MHMDA / GDPR) · decline and we simply won’t show paid links',
    cta: 'Allow where-to-buy links',
    decline: 'Not now',
  },
  // The You-tab entry + the consent-version string for the ledger.
  settingsRow: 'Where to buy & transparency',
  consentVersion: 'commerce-consent-2026-06-13-placeholder', // BLOCKED: B-PRIVACY-COPY
} as const;
