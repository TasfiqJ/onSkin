#!/usr/bin/env node
import { readFileSync } from 'node:fs';

const wrapper = readFileSync('scripts/phase2/deploy-supabase-staging.ps1', 'utf8');
const cliHelper = readFileSync('scripts/phase2/read-edge-app-environment.ts', 'utf8');
const edgeHelper = readFileSync('supabase/functions/_shared/env.ts', 'utf8');
const subscriptionGrants = readFileSync('supabase/functions/subscription-grants/index.ts', 'utf8');
const manifest = JSON.parse(readFileSync('supabase/functions/manifest.json', 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  cliHelper.includes("from '../../supabase/functions/_shared/env.ts'") &&
    cliHelper.includes('readEdgeAppEnvironment()'),
  'The deployment CLI must use the same environment resolver as Edge Functions.',
);
assert(
  wrapper.includes('read-edge-app-environment.ts') &&
    wrapper.includes('--allow-env=APP_ENV,EXPO_PUBLIC_APP_ENV'),
  'The staging wrapper must invoke the shared resolver with only the app-env permissions.',
);
assert(
  wrapper.indexOf('$appEnv = Read-AppEnvironment') < wrapper.indexOf('supabase link'),
  'Environment validation must run before the first Supabase CLI command.',
);
assert(
  wrapper.includes("$ProjectRef -notmatch '^[a-z0-9]{20}$'") &&
    wrapper.includes('SUPABASE_PROJECT_REF_INVALID') &&
    wrapper.includes('SUPABASE_CLI_UNAVAILABLE'),
  'The staging wrapper must validate the project ref and CLI before mutation.',
);
assert(
  wrapper.includes('if ($appEnv -ne "staging")') &&
    wrapper.includes('STAGING_DEPLOY_REQUIRES_APP_ENV_STAGING'),
  'The staging wrapper must reject every valid non-staging environment.',
);
assert(
  !wrapper.includes('PHASE2_ALLOW_PRODUCTION_DEPLOY'),
  'The staging wrapper must not retain a production override.',
);
assert(
  wrapper.includes('supabase secrets set "APP_ENV=$appEnv" "EXPO_PUBLIC_APP_ENV=$appEnv"') &&
    wrapper.indexOf('supabase secrets set') < wrapper.indexOf('supabase functions deploy'),
  'The wrapper must synchronize the validated environment before deploying functions.',
);
for (const failureCode of [
  'SUPABASE_LINK_FAILED',
  'APP_ENV_REMOTE_CONFIGURATION_FAILED',
  'SUPABASE_DB_PUSH_FAILED',
  'SUPABASE_FUNCTION_DEPLOY_FAILED',
  'SUPABASE_TYPE_GENERATION_FAILED',
  'SUPABASE_TYPE_GENERATION_INVALID',
]) {
  assert(
    wrapper.includes(failureCode),
    `The staging wrapper must fail closed with ${failureCode}.`,
  );
}
assert(
  wrapper.includes('$typesPath.pending-$PID') &&
    wrapper.includes('[System.IO.File]::WriteAllText(') &&
    wrapper.includes('Move-Item -LiteralPath $typesTempPath') &&
    !/>\s*packages\/types\/src\/database\.types\.ts/.test(wrapper),
  'Generated database types must be validated in an adjacent temporary file before atomic replacement.',
);
assert(
  edgeHelper.includes("read('APP_ENV')") &&
    edgeHelper.includes("read('EXPO_PUBLIC_APP_ENV')") &&
    edgeHelper.includes('APP_ENV_NOT_CONFIGURED') &&
    edgeHelper.includes('APP_ENV_CONFLICT'),
  'The Edge resolver must require APP_ENV and reject contradictory public configuration.',
);
assert(
  subscriptionGrants.includes("import { readEdgeAppEnvironment } from '../_shared/env.ts'") &&
    subscriptionGrants.includes('const appEnvironment = readEdgeAppEnvironment();') &&
    !subscriptionGrants.includes("Deno.env.get('APP_ENV') ??"),
  'subscription-grants must use the shared fail-closed environment resolver.',
);

for (const [name, definition] of Object.entries(manifest.functions)) {
  const appEnvGroups = definition.requiredEnvironment.filter(
    (group) => Array.isArray(group) && group.length === 1 && group[0] === 'APP_ENV',
  );
  assert(appEnvGroups.length === 1, `${name} must require exactly one APP_ENV group.`);
  assert(
    definition.optionalEnvironment.includes('EXPO_PUBLIC_APP_ENV'),
    `${name} must declare the optional public consistency value.`,
  );
}

console.log('PASS Phase 2 staging deploy environment contract');
