import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';

function brandSlug(): string {
  return BRAND.appName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'routinekind';
}

export function resolveCardPublicDomain(domain: string = env.finalBrandDomain): string {
  return normalizePublicDomain(domain) ?? `${brandSlug()}.example`;
}

const publicDomain = resolveCardPublicDomain();

// Copy + brand constants for the shareable Shelf Conflict Card. Claim-safe:
// cosmetic framing only, never a drug claim, fear hook, or urgency hook.
export const CARD_COPY = {
  brand: BRAND.appName,
  handle: publicDomain,
  eyebrow: 'SHELF CHECK',
  cta: 'Check your own shelf, free',
  footnote: 'General cosmetic information, not medical advice.',
} as const;

export const CARD_SHARE_URL = `https://${publicDomain}`;
export const CARD_DEEP_LINK = `${process.env.EXPO_PUBLIC_APP_SCHEME?.trim() || process.env.APP_SCHEME?.trim() || brandSlug()}://`;
