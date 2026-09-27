import {
  EDGE_APP_ENVIRONMENT_ERROR,
  readEdgeAppEnvironment,
} from '../../supabase/functions/_shared/env.ts';

const stableErrors = new Set<string>(Object.values(EDGE_APP_ENVIRONMENT_ERROR));

try {
  console.log(readEdgeAppEnvironment());
} catch (error) {
  const code =
    error instanceof Error && stableErrors.has(error.message)
      ? error.message
      : 'APP_ENV_VALIDATION_FAILED';
  console.log(code);
  Deno.exit(1);
}
