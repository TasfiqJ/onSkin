import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';

const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function productionUrlReady(value: string): boolean {
  const safeUrl = safeExternalHttpsUrl(value);
  if (!safeUrl) return false;
  const hostname = new URL(safeUrl).hostname.toLowerCase();
  return PUBLIC_PRODUCTION_HOSTNAME.test(hostname) && !hostname.includes('example.com');
}

function supportEmailReady(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

const finalDomain = normalizePublicDomain(env.finalBrandDomain);

export const phase8PublicIdentity = {
  brandName: BRAND.appName,
  finalDomain,
  marketingUrlReady: productionUrlReady(env.marketingUrl),
  appStoreUrlReady: productionUrlReady(env.appStoreUrl),
  playStoreUrlReady: productionUrlReady(env.playStoreUrl),
  supportEmailReady: supportEmailReady(env.supportEmail),
} as const;

export const phase8Flags = {
  publicLinks:
    env.phase8PublicLinksEnabled && Boolean(finalDomain) && phase8PublicIdentity.marketingUrlReady,
  reviewPrompt:
    env.phase8ReviewPromptEnabled &&
    (phase8PublicIdentity.appStoreUrlReady || phase8PublicIdentity.playStoreUrlReady),
  creatorLinks:
    env.phase8CreatorLinksEnabled && Boolean(finalDomain) && phase8PublicIdentity.supportEmailReady,
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
