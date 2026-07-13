const APP_ENVIRONMENTS = ['development', 'staging', 'production'] as const;

export type EdgeAppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type EdgeEnvironmentReader = (name: string) => string | undefined;

export const EDGE_APP_ENVIRONMENT_ERROR = {
  missing: 'APP_ENV_NOT_CONFIGURED',
  invalid: 'APP_ENV_INVALID',
  publicInvalid: 'EXPO_PUBLIC_APP_ENV_INVALID',
  conflict: 'APP_ENV_CONFLICT',
} as const;

function isEdgeAppEnvironment(value: string): value is EdgeAppEnvironment {
  return APP_ENVIRONMENTS.includes(value as EdgeAppEnvironment);
}

function normalizedEnvironment(value: string | undefined): string | undefined {
  const candidate = value?.trim().toLowerCase();
  return candidate || undefined;
}

export function resolveEdgeAppEnvironment(
  appEnvironment: string | undefined,
  publicAppEnvironment?: string,
): EdgeAppEnvironment {
  const candidate = normalizedEnvironment(appEnvironment);
  if (!candidate) throw new Error(EDGE_APP_ENVIRONMENT_ERROR.missing);
  if (!isEdgeAppEnvironment(candidate)) throw new Error(EDGE_APP_ENVIRONMENT_ERROR.invalid);

  const publicCandidate = normalizedEnvironment(publicAppEnvironment);
  if (publicAppEnvironment !== undefined && !publicCandidate) {
    throw new Error(EDGE_APP_ENVIRONMENT_ERROR.publicInvalid);
  }
  if (publicCandidate && !isEdgeAppEnvironment(publicCandidate)) {
    throw new Error(EDGE_APP_ENVIRONMENT_ERROR.publicInvalid);
  }
  if (publicCandidate && publicCandidate !== candidate) {
    throw new Error(EDGE_APP_ENVIRONMENT_ERROR.conflict);
  }

  return candidate;
}

export function readEdgeAppEnvironment(
  read: EdgeEnvironmentReader = (name) => Deno.env.get(name),
): EdgeAppEnvironment {
  return resolveEdgeAppEnvironment(read('APP_ENV'), read('EXPO_PUBLIC_APP_ENV'));
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
