import { env } from '@/lib/env';

function publicDomainFallback(): string {
  const domain = env.finalBrandDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
  return domain && !domain.includes('example.com') ? domain : 'onskin.app';
}

const publicDomain = publicDomainFallback();

// Copy + brand constants for the shareable Shelf Conflict Card. Claim-safe:
// cosmetic framing only, never a drug claim, fear hook, or urgency hook.
export const CARD_COPY = {
  brand: 'OnSkin',
  handle: publicDomain,
  eyebrow: 'SHELF CHECK',
  cta: 'Check your own shelf, free',
  footnote: 'General cosmetic information, not medical advice.',
} as const;

export const CARD_SHARE_URL = `https://${publicDomain}`;
export const CARD_DEEP_LINK = 'onskin://';
