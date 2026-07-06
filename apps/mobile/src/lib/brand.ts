const WORKING_APP_NAME = 'RoutineKind';

function normalizeName(value: string | undefined, fallback: string): string {
  const candidate = value?.trim().replace(/\s+/g, ' ');
  return candidate && candidate.length > 0 ? candidate : fallback;
}

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

export const BRAND = buildBrandIdentity(
  process.env.EXPO_PUBLIC_APP_DISPLAY_NAME ?? process.env.APP_DISPLAY_NAME,
);
