import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';

function productionUrl(value: string): boolean {
  return value.trim().length > 0 && !/example\.com/i.test(value);
}

function supportEmailReady(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const finalDomain = normalizePublicDomain(env.finalBrandDomain);

export const phase8PublicIdentity = {
  brandName: 'OnSkin',
  finalDomain,
  marketingUrlReady: productionUrl(env.marketingUrl),
  appStoreUrlReady: productionUrl(env.appStoreUrl),
  playStoreUrlReady: productionUrl(env.playStoreUrl),
  supportEmailReady: supportEmailReady(env.supportEmail),
} as const;

export const phase8Flags = {
  publicLinks:
    env.phase8PublicLinksEnabled &&
    Boolean(finalDomain) &&
    phase8PublicIdentity.marketingUrlReady,
  reviewPrompt:
    env.phase8ReviewPromptEnabled &&
    (phase8PublicIdentity.appStoreUrlReady || phase8PublicIdentity.playStoreUrlReady),
  creatorLinks:
    env.phase8CreatorLinksEnabled &&
    Boolean(finalDomain) &&
    phase8PublicIdentity.supportEmailReady,
  paidMeasurement:
    env.phase8PaidMeasurementEnabled &&
    Boolean(finalDomain) &&
    phase8PublicIdentity.appStoreUrlReady &&
    phase8PublicIdentity.playStoreUrlReady,
} as const;

export const phase8RequiredPublicRoutes = [
  '/',
  '/s/:shareId',
  '/support',
  '/privacy',
  '/terms',
  '/account-deletion',
  '/data-export',
  '/consumer-health-privacy',
] as const;
