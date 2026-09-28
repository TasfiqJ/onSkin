import { BRAND } from '@/lib/brand';
import { env } from '@/lib/env';
import { normalizePublicDomain } from '@/lib/growth/attribution';
import { safeExternalHttpsUrl } from '@/lib/navigation/externalUrl';

const PUBLIC_PRODUCTION_HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;
const RESERVED_PRODUCTION_HOSTNAME =
  /(?:^localhost$|\.localhost$|\.local$|\.test$|\.invalid$|\.example$)/;

export function productionUrlReady(value: string): boolean {
  const safeUrl = safeExternalHttpsUrl(value);
  if (!safeUrl) return false;
  const hostname = new URL(safeUrl).hostname.toLowerCase();
  return (
    PUBLIC_PRODUCTION_HOSTNAME.test(hostname) &&
    !RESERVED_PRODUCTION_HOSTNAME.test(hostname) &&
    !hostname.includes('example.com')
  );
}

export function productionStoreUrlReady(value: string, store: 'app_store' | 'play_store'): boolean {
  if (!productionUrlReady(value)) return false;
  const safeUrl = safeExternalHttpsUrl(value);
  if (!safeUrl) return false;
  const url = new URL(safeUrl);
  const hostname = url.hostname.toLowerCase();
  if (store === 'app_store') {
    return (
      hostname === 'apps.apple.com' &&
      /^\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id\d+\/?$/i.test(url.pathname)
    );
  }
  return (
    hostname === 'play.google.com' &&
    url.pathname === '/store/apps/details' &&
    /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)+$/.test(url.searchParams.get('id') ?? '')
  );
}

export function supportEmailReady(value: string): boolean {
  const trimmed = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return false;
  const domain = trimmed.split('@').pop()?.toLowerCase() ?? '';
  return (
    PUBLIC_PRODUCTION_HOSTNAME.test(domain) &&
    !RESERVED_PRODUCTION_HOSTNAME.test(domain) &&
    !domain.includes('example.com')
  );
}

const finalDomain = normalizePublicDomain(env.finalBrandDomain);

export const phase8PublicIdentity = {
  brandName: BRAND.appName,
  finalDomain,
  marketingUrlReady: productionUrlReady(env.marketingUrl),
  appStoreUrlReady: productionStoreUrlReady(env.appStoreUrl, 'app_store'),
  playStoreUrlReady: productionStoreUrlReady(env.playStoreUrl, 'play_store'),
  supportEmailReady: supportEmailReady(env.supportEmail),
} as const;

export const phase8Flags = {
  publicLinks: false,
  reviewPrompt: false,
  creatorLinks: false,
  paidMeasurement: false,
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
