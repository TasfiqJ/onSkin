#!/usr/bin/env node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateEdgeFunctionManifest } from './edge-function-manifest-lib.mjs';

const root = process.cwd();
const sourceManifest = JSON.parse(
  readFileSync(join(root, 'supabase', 'functions', 'manifest.json'), 'utf8'),
);

function sourceConfig(manifest) {
  return Object.entries(manifest.functions)
    .map(
      ([name, definition]) =>
        `[functions.${name}]\nverify_jwt = ${definition.verifyJwt}\nentrypoint = "./functions/${name}/index.ts"`,
    )
    .join('\n\n');
}

function createFixture() {
  const fixtureRoot = mkdtempSync(join(tmpdir(), 'routinekind-edge-manifest-'));
  const manifest = structuredClone(sourceManifest);
  mkdirSync(join(fixtureRoot, 'supabase', 'functions'), { recursive: true });
  for (const [name, definition] of Object.entries(manifest.functions)) {
    const directory = join(fixtureRoot, 'supabase', 'functions', name);
    mkdirSync(directory, { recursive: true });
    const firstEnvironment = definition.requiredEnvironment[0]?.[0] ?? 'SUPABASE_URL';
    writeFileSync(
      join(directory, 'index.ts'),
      `const configured = Deno.env.get('${firstEnvironment}');\nDeno.serve(() => new Response(configured));\n`,
    );
  }
  writeFileSync(
    join(fixtureRoot, 'supabase', 'functions', 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  writeFileSync(join(fixtureRoot, 'supabase', 'config.toml'), `${sourceConfig(manifest)}\n`);
  return { fixtureRoot, manifest };
}

function persistManifest(fixtureRoot, manifest) {
  writeFileSync(
    join(fixtureRoot, 'supabase', 'functions', 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function runFailureCase(label, mutate, expected) {
  const { fixtureRoot, manifest } = createFixture();
  try {
    mutate({ fixtureRoot, manifest });
    const errors = validateEdgeFunctionManifest({ repoRoot: fixtureRoot });
    if (!errors.some((error) => expected.test(error))) {
      throw new Error(`${label}: expected ${expected}, got ${JSON.stringify(errors)}`);
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

const repositoryErrors = validateEdgeFunctionManifest({ repoRoot: root });
if (repositoryErrors.length > 0) {
  throw new Error(`Current repository manifest is invalid: ${repositoryErrors.join(' | ')}`);
}

runFailureCase(
  'unmanaged directory',
  ({ fixtureRoot }) => {
    const directory = join(fixtureRoot, 'supabase', 'functions', 'unmanaged-function');
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, 'index.ts'), 'Deno.serve(() => new Response("ok"));\n');
  },
  /unmanaged-function is missing from the Edge Function manifest/,
);

runFailureCase(
  'manifest without source directory',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions)[0];
    rmSync(join(fixtureRoot, 'supabase', 'functions', name), { recursive: true, force: true });
  },
  /has no supabase\/functions\/.+\/index\.ts directory/,
);

runFailureCase(
  'invalid resource budget',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions)[0];
    manifest.functions[name].resourceLimits.memoryMb = 0;
    persistManifest(fixtureRoot, manifest);
  },
  /resourceLimits\.memoryMb/,
);

runFailureCase(
  'invalid auth combination',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions).find(
      (candidate) => manifest.functions[candidate].access === 'authenticated',
    );
    manifest.functions[name].verifyJwt = false;
    persistManifest(fixtureRoot, manifest);
  },
  /verifyJwt must be true for authenticated access/,
);

runFailureCase(
  'mixed boundary cannot use gateway JWT verification',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions).find(
      (candidate) => manifest.functions[candidate].access === 'mixed',
    );
    manifest.functions[name].verifyJwt = true;
    persistManifest(fixtureRoot, manifest);
  },
  /verifyJwt must be false for mixed access/,
);

runFailureCase(
  'mixed boundary must disclose public reachability',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions).find(
      (candidate) => manifest.functions[candidate].access === 'mixed',
    );
    manifest.functions[name].public = false;
    persistManifest(fixtureRoot, manifest);
  },
  /public must match public or mixed access/,
);

runFailureCase(
  'mixed boundary must describe route-scoped authentication',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions).find(
      (candidate) => manifest.functions[candidate].access === 'mixed',
    );
    manifest.functions[name].auth = '   ';
    persistManifest(fixtureRoot, manifest);
  },
  /auth must describe the caller authentication mechanism/,
);

runFailureCase(
  'source config mismatch',
  ({ fixtureRoot, manifest }) => {
    const name = Object.keys(manifest.functions).find(
      (candidate) => manifest.functions[candidate].verifyJwt,
    );
    const configPath = join(fixtureRoot, 'supabase', 'config.toml');
    const config = readFileSync(configPath, 'utf8');
    const section = `[functions.${name}]\nverify_jwt = true`;
    const replacement = `[functions.${name}]\nverify_jwt = false`;
    writeFileSync(configPath, config.replace(section, replacement));
  },
  /supabase\/config\.toml functions\..+\.verify_jwt does not match/,
);

runFailureCase(
  'undeclared environment variable',
  ({ fixtureRoot, manifest }) => {
    const [name] = Object.keys(manifest.functions);
    const entrypoint = join(fixtureRoot, ...manifest.functions[name].entrypoint.split('/'));
    writeFileSync(
      entrypoint,
      `${readFileSync(entrypoint, 'utf8')}\nDeno.env.get('UNDECLARED_SECRET');\n`,
    );
  },
  /source references UNDECLARED_SECRET/,
);

runFailureCase(
  'undeclared environment helper argument',
  ({ fixtureRoot, manifest }) => {
    const [name] = Object.keys(manifest.functions);
    const entrypoint = join(fixtureRoot, ...manifest.functions[name].entrypoint.split('/'));
    writeFileSync(
      entrypoint,
      `${readFileSync(entrypoint, 'utf8')}\nconst readEnvironment = (name) => Deno.env.get(name);\nconst requiredEnv = (reader, name) => reader(name);\nrequiredEnv(readEnvironment, 'UNDECLARED_HELPER_SECRET');\n`,
    );
  },
  /source references UNDECLARED_HELPER_SECRET/,
);

runFailureCase(
  'undeclared environment constant indirection',
  ({ fixtureRoot, manifest }) => {
    const [name] = Object.keys(manifest.functions);
    const entrypoint = join(fixtureRoot, ...manifest.functions[name].entrypoint.split('/'));
    writeFileSync(
      entrypoint,
      `${readFileSync(entrypoint, 'utf8')}\nconst INDIRECT_ENV = 'UNDECLARED_INDIRECT_SECRET';\nconst readEnvironment = (name) => Deno.env.get(name);\nreadEnvironment(INDIRECT_ENV);\n`,
    );
  },
  /source references UNDECLARED_INDIRECT_SECRET/,
);

console.log('PASS Edge Function manifest smoke');
