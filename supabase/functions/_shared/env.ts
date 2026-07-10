const APP_ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export type EdgeAppEnvironment = (typeof APP_ENVIRONMENTS)[number];

function isEdgeAppEnvironment(value: string): value is EdgeAppEnvironment {
  return APP_ENVIRONMENTS.includes(value as EdgeAppEnvironment);
}

export function readEdgeAppEnvironment(): EdgeAppEnvironment {
  const raw = Deno.env.get('APP_ENV') ?? Deno.env.get('EXPO_PUBLIC_APP_ENV') ?? '';
  const candidate = raw.trim().toLowerCase();
  return isEdgeAppEnvironment(candidate) ? candidate : 'production';
}

export function booleanEnv(
  name: string,
  {
    defaultValue = false,
    invalidValue = false,
  }: { defaultValue?: boolean; invalidValue?: boolean } = {},
): boolean {
  const raw = Deno.env.get(name);
  const candidate = raw?.trim().toLowerCase();
  if (!candidate) return defaultValue;
  if (candidate === 'true') return true;
  if (candidate === 'false') return false;
  return invalidValue;
}
