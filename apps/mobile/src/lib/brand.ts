const WORKING_APP_NAME = 'Layerwell';

function normalizeName(value: string | undefined, fallback: string): string {
  const candidate = value?.trim().replace(/\s+/g, ' ');
  return candidate && candidate.length > 0 ? candidate : fallback;
}

export type BrandCacheFileKind = 'export' | 'share';

export type BrandIdentity = {
  appName: string;
  proName: string;
  askName: string;
  appLockPrompt: string;
  catalogCuratedSource: string;
  catalogParserSource: string;
};

export function buildBrandIdentity(appNameInput?: string): BrandIdentity {
  const appName = normalizeName(appNameInput, WORKING_APP_NAME);
  return {
    appName,
    proName: `${appName} Pro`,
    askName: `Ask ${appName}`,
    appLockPrompt: `Unlock ${appName}`,
    catalogCuratedSource: `${appName} curated`,
    catalogParserSource: `${appName} parser`,
  };
}

export function brandFileSlug(appNameInput?: string): string {
  const appName = normalizeName(appNameInput ?? BRAND.appName, WORKING_APP_NAME);
  const slug = appName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug.length > 0 ? slug : WORKING_APP_NAME.toLowerCase();
}

export function brandCachePrefix(kind: BrandCacheFileKind, appNameInput?: string): string {
  return `${brandFileSlug(appNameInput)}-${kind}-`;
}

export const BRAND = buildBrandIdentity(
  process.env.EXPO_PUBLIC_APP_DISPLAY_NAME ?? process.env.APP_DISPLAY_NAME,
);
