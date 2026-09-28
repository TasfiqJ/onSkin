import type { CuratorKind } from '@layerwell/types';

import { BRAND } from '@/lib/brand';

/**
 * Unapproved future-commerce copy draft retained only for negative claim-safety
 * regression tests. COM-01A forbids every production consumer of this module.
 * Nothing here is legal approval or a settled description of a provider/data
 * flow. Any successor must replace or re-review the exact copy against its
 * actual architecture, disclosures, Apple classification, and applicable law.
 */

export const COMMERCE_COPY = {
  // Surface 01. The quiet "where to buy" affordance (beneath the rationale).
  whereToBuy: {
    eyebrow: 'WHERE TO BUY',
    lockedEyebrow: 'WHERE TO BUY',
    lockedBody: 'Turn on where-to-buy links to see partner retailers. A separate, private choice.',
    lockedCta: 'Allow where-to-buy',
    partnerLabel: (price: string | null) => `at a partner retailer${price ? ` · ${price}` : ''}`,
    paidChip: 'Paid link',
    // The disclosure sits DIRECTLY under the links, always visible (FTC "unavoidable").
    // Split so the independence clause renders bold-inked (design §3); `disclosure`
    // keeps the full sentence for the claim-safety guard.
    disclosure: `Paid link. ${BRAND.appName} may earn a commission. It never affects what we recommend.`,
    disclosureLead: `Paid link. ${BRAND.appName} may earn a commission.`,
    disclosureEmphasis: 'It never affects what we recommend.',
    howThisWorks: 'How this works',
    alreadyOwn: 'Already own one? Add it to your shelf instead',
    // The honest empty state until the catalog/partner approval lands (B-CATALOG-SEED / B-SHOPMY).
    emptyState:
      'We’ll show where to buy once our product catalogue is live. It never changes what we recommend.',
    // The inert tap explainer until the rail is approved (B-SHOPMY).
    stubTitle: 'Where to buy',
    stubBody:
      'Commerce is not available. Any future partner, data flow and disclosure require separate review.',
  },
  // Surface 02. The shoppable Stack.
  stack: {
    chipFor: (kind: CuratorKind): string =>
      kind === 'derm'
        ? 'DERMATOLOGIST-REVIEWED'
        : kind === 'creator'
          ? 'EXPERT-REVIEWED'
          : 'EDITOR’S ROUTINE',
    subtitle: 'Curated on merit and evidence, not by who pays.',
    paidChip: 'Paid link',
    lockedChip: 'Consent needed',
    // Footer disclosure on a stack. States the order was set on merit, not commission.
    disclosure: `Paid links. ${BRAND.appName} may earn a commission. We picked these on merit; the commission never changed the list.`,
    lockedDisclosure:
      'Where-to-buy links stay locked until you make the separate data-sharing choice. The routine order stays based on merit.',
    orderedNote: 'In order. The routine sequence, not the payout.',
  },
  // Surface 03. The transparency page (the highest-leverage trust artifact).
  transparency: {
    eyebrow: 'HOW WE STAY HONEST',
    title: 'How recommendations and money stay separate.',
    principles: [
      {
        title: 'We rank by fit and evidence.',
        body: 'Commission, partnerships and affiliate data never enter the ranking. By architecture, not promise.',
      },
      {
        title: 'Links come after, never before.',
        body: 'We decide what’s best for you first; only then do we attach a “where to buy” link.',
      },
      {
        title: 'We disclose every paid link.',
        body: 'Right next to the link, in plain words, never hidden in a footer.',
      },
      {
        title: 'Sometimes we earn nothing.',
        body: 'If the best place to buy has no programme, we link there anyway, and tell you so.',
      },
    ],
    footer: 'Draft only. No retailer data-sharing statement is approved in this build.',
  },
  // Surface 04. The MHMDA consent gate.
  consent: {
    title: 'Before we show where to buy',
    body: 'Commerce is closed. Any future data sharing requires a separately reviewed purpose, scope, disclosure and consent flow.',
    allow: 'Unavailable while commerce admission is closed',
    never: 'No current commerce data flow',
    // MHMDA-strict default (D-061): decline => no paid links shown at all (not "links
    // still work with zero tracking", which the mock implied). The safer reading.
    note: 'a separate, revocable choice (MHMDA / GDPR) · decline and we simply won’t show paid links',
    cta: 'Allow where-to-buy links',
    decline: 'Not now',
  },
  // The You-tab entry + the consent-version string for the ledger.
  settingsRow: 'Where to buy & transparency',
  consentVersion: 'commerce-consent-2026-06-13-placeholder', // BLOCKED: B-PRIVACY-COPY
} as const;
