// Copy + brand constants for the shareable "Shelf Conflict Card" (docs/14 §3, the
// word-of-mouth growth artifact). Claim-safe: cosmetic framing only, never a drug
// claim, never fear, never hype. The conflict pair, the calm resolution, and the
// evidence chip are rendered from the engine's presentation helpers (already
// guard-scanned, docs/02 §7); the strings below are the only NEW copy on the card.
export const CARD_COPY = {
  brand: 'OnSkin',
  // Watermark / handle baked into the image so a screenshot still credits OnSkin.
  handle: 'onskin.app',
  eyebrow: 'SHELF CHECK',
  // The calm CTA on the card. No urgency, no FOMO (docs/14 forbids dark patterns).
  cta: 'Check your own shelf, free',
  footnote: 'General cosmetic information, not medical advice.',
} as const;

// The link shared alongside the artifact. The live universal / App-Store smart link
// (with a web fallback for users who don't have OnSkin yet) is a launch item that
// needs the marketing domain + store listing (B-GROWTH-LINK); the `onskin://` scheme
// opens the funnel for users who already have the app installed.
export const CARD_SHARE_URL = 'https://onskin.app';
export const CARD_DEEP_LINK = 'onskin://';
