import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

const FUNCTION_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const ACCESS_VALUES = new Set(['authenticated', 'provider', 'scheduled', 'public']);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function normalizedRelativePath(path) {
  return path.replace(/\\/g, '/');
}

function parseBoolean(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function parseQuotedString(value) {
  const match = value.match(/^"([^"]*)"$/);
  return match?.[1];
}

export function parseSupabaseFunctionConfig(source) {
  const functions = new Map();
  let current;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+#.*$/, '').trim();
    if (!line) continue;

    const section = line.match(/^\[functions\.([a-z0-9-]+)\]$/);
    if (section) {
      current = section[1];
      if (!functions.has(current)) functions.set(current, {});
      continue;
    }
    if (/^\[.*\]$/.test(line)) {
      current = undefined;
      continue;
    }
    if (!current) continue;

    const property = line.match(/^([a-z_]+)\s*=\s*(.+)$/);
    if (!property) continue;
    const [, key, rawValue] = property;
    const value = rawValue.trim();
    const target = functions.get(current);
    if (key === 'verify_jwt') target[key] = parseBoolean(value);
    if (key === 'entrypoint') target[key] = parseQuotedString(value);
  }

  return functions;
}

function validateEnvironmentGroup(group, label, errors, declared) {
  if (!Array.isArray(group) || group.length === 0) {
    errors.push(`${label} must be a non-empty array of environment variable names.`);
    return;
  }
  for (const name of group) {
    if (typeof name !== 'string' || !ENV_NAME.test(name)) {
      errors.push(`${label} contains an invalid environment variable name.`);
      continue;
    }
    if (declared.has(name)) errors.push(`${label} redeclares ${name}.`);
    declared.add(name);
  }
}

function validateEnvironmentGroups(value, label, errors, declared) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  value.forEach((group, index) =>
    validateEnvironmentGroup(group, `${label}[${index}]`, errors, declared),
  );
}

function validateOptionalEnvironment(value, label, errors, declared) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  value.forEach((name, index) => {
    if (typeof name !== 'string' || !ENV_NAME.test(name)) {
      errors.push(`${label}[${index}] is not a valid environment variable name.`);
      return;
    }
    if (declared.has(name)) errors.push(`${label} redeclares ${name}.`);
    declared.add(name);
  });
}

function validateConditionalEnvironment(value, label, errors, declared) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  value.forEach((condition, index) => {
    const conditionLabel = `${label}[${index}]`;
    if (!isRecord(condition)) {
      errors.push(`${conditionLabel} must be an object.`);
      return;
    }
    if (typeof condition.when !== 'string' || !condition.when.trim()) {
      errors.push(`${conditionLabel}.when must explain the condition.`);
    }
    validateEnvironmentGroup(condition.anyOf, `${conditionLabel}.anyOf`, errors, declared);
  });
}

function collectSourceGraph(entrypoint, repoRoot, errors) {
  const pending = [resolve(repoRoot, entrypoint)];
  const visited = new Set();
  const sources = [];

  while (pending.length > 0) {
    const path = pending.pop();
    if (visited.has(path)) continue;
    visited.add(path);

    const pathFromRoot = normalizedRelativePath(relative(repoRoot, path));
    if (pathFromRoot === '..' || pathFromRoot.startsWith('../') || isAbsolute(pathFromRoot)) {
      errors.push(`${entrypoint} imports a source outside the repository: ${path}.`);
      continue;
    }
    if (!existsSync(path)) {
      errors.push(`${entrypoint} imports missing source ${pathFromRoot}.`);
      continue;
    }

    const source = readFileSync(path, 'utf8');
    sources.push(source);
    const imports = source.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+\.ts)['"]/g);
    for (const match of imports) pending.push(resolve(dirname(path), match[1]));
  }

  return sources;
}

function referencedEnvironment(entrypoint, repoRoot, errors) {
  const names = new Set();
  for (const source of collectSourceGraph(entrypoint, repoRoot, errors)) {
    for (const match of source.matchAll(/Deno\.env\.get\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g)) {
      names.add(match[1]);
    }
    for (const match of source.matchAll(/\b(?:intEnv|booleanEnv)\(\s*['"]([A-Z][A-Z0-9_]*)['"]/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

function discoverFunctionDirectories(repoRoot, errors) {
  const functionsPath = join(repoRoot, 'supabase', 'functions');
  if (!existsSync(functionsPath)) {
    errors.push('supabase/functions is missing.');
    return [];
  }
  return readdirSync(functionsPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .filter((entry) => existsSync(join(functionsPath, entry.name, 'index.ts')))
    .map((entry) => entry.name)
    .sort();
}

export function validateEdgeFunctionManifest({
  repoRoot = process.cwd(),
  manifestPath = 'supabase/functions/manifest.json',
  configPath = 'supabase/config.toml',
} = {}) {
  const errors = [];
  const absoluteManifestPath = resolve(repoRoot, manifestPath);
  const absoluteConfigPath = resolve(repoRoot, configPath);

  if (!existsSync(absoluteManifestPath)) return [`${manifestPath} is missing.`];
  if (!existsSync(absoluteConfigPath)) return [`${configPath} is missing.`];

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(absoluteManifestPath, 'utf8'));
  } catch (error) {
    return [`${manifestPath} is not valid JSON: ${error instanceof Error ? error.message : error}`];
  }

  if (!isRecord(manifest)) return [`${manifestPath} must contain an object.`];
  if (manifest.schemaVersion !== 1) errors.push('Edge Function manifest schemaVersion must be 1.');
  if (
    typeof manifest.resourceLimitSemantics !== 'string' ||
    !manifest.resourceLimitSemantics.trim()
  ) {
    errors.push('Edge Function manifest must explain resource-limit semantics.');
  }
  if (!isRecord(manifest.functions)) {
    errors.push('Edge Function manifest functions must be an object.');
    return errors;
  }

  const discovered = discoverFunctionDirectories(repoRoot, errors);
  const configuredNames = sorted(Object.keys(manifest.functions));
  for (const name of discovered.filter((candidate) => !configuredNames.includes(candidate))) {
    errors.push(`Function directory ${name} is missing from the Edge Function manifest.`);
  }
  for (const name of configuredNames.filter((candidate) => !discovered.includes(candidate))) {
    errors.push(`Manifest function ${name} has no supabase/functions/${name}/index.ts directory.`);
  }

  const config = parseSupabaseFunctionConfig(readFileSync(absoluteConfigPath, 'utf8'));
  for (const name of config.keys()) {
    if (!configuredNames.includes(name)) {
      errors.push(
        `supabase/config.toml declares function ${name}, which is absent from the manifest.`,
      );
    }
  }

  for (const name of configuredNames) {
    const functionLabel = `functions.${name}`;
    const definition = manifest.functions[name];
    if (!FUNCTION_NAME.test(name)) errors.push(`${functionLabel} has an invalid function name.`);
    if (!isRecord(definition)) {
      errors.push(`${functionLabel} must be an object.`);
      continue;
    }

    const expectedEntrypoint = `supabase/functions/${name}/index.ts`;
    if (definition.entrypoint !== expectedEntrypoint) {
      errors.push(`${functionLabel}.entrypoint must equal ${expectedEntrypoint}.`);
    }
    if (definition.deployByDefault !== true) {
      errors.push(`${functionLabel}.deployByDefault must be true so staging cannot omit it.`);
    }
    if (!ACCESS_VALUES.has(definition.access)) {
      errors.push(`${functionLabel}.access must be authenticated, provider, scheduled, or public.`);
    }
    if (typeof definition.auth !== 'string' || !definition.auth.trim()) {
      errors.push(`${functionLabel}.auth must describe the caller authentication mechanism.`);
    }
    if (typeof definition.verifyJwt !== 'boolean') {
      errors.push(`${functionLabel}.verifyJwt must be boolean.`);
    }
    if (typeof definition.public !== 'boolean') {
      errors.push(`${functionLabel}.public must be boolean.`);
    }
    const userJwtExpected = definition.access === 'authenticated';
    if (definition.verifyJwt !== userJwtExpected) {
      errors.push(
        `${functionLabel}.verifyJwt must be ${userJwtExpected} for ${definition.access} access.`,
      );
    }
    if (definition.public !== (definition.access === 'public')) {
      errors.push(`${functionLabel}.public must match public access.`);
    }
    if (definition.access === 'authenticated' && definition.auth !== 'supabase-user-jwt') {
      errors.push(`${functionLabel}.auth must be supabase-user-jwt for authenticated access.`);
    }

    if (!isRecord(definition.resourceLimits)) {
      errors.push(`${functionLabel}.resourceLimits must be an object.`);
    } else {
      const { timeoutSeconds, memoryMb } = definition.resourceLimits;
      if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 1 || timeoutSeconds > 400) {
        errors.push(
          `${functionLabel}.resourceLimits.timeoutSeconds must be an integer from 1 to 400.`,
        );
      }
      if (!Number.isInteger(memoryMb) || memoryMb < 64 || memoryMb > 1024) {
        errors.push(`${functionLabel}.resourceLimits.memoryMb must be an integer from 64 to 1024.`);
      }
    }

    const declared = new Set();
    validateEnvironmentGroups(
      definition.requiredEnvironment,
      `${functionLabel}.requiredEnvironment`,
      errors,
      declared,
    );
    validateEnvironmentGroups(
      definition.requiredSecrets,
      `${functionLabel}.requiredSecrets`,
      errors,
      declared,
    );
    validateOptionalEnvironment(
      definition.optionalEnvironment,
      `${functionLabel}.optionalEnvironment`,
      errors,
      declared,
    );
    validateConditionalEnvironment(
      definition.conditionalEnvironment,
      `${functionLabel}.conditionalEnvironment`,
      errors,
      declared,
    );
    validateConditionalEnvironment(
      definition.conditionalSecrets,
      `${functionLabel}.conditionalSecrets`,
      errors,
      declared,
    );

    if (definition.entrypoint === expectedEntrypoint) {
      const referenced = referencedEnvironment(expectedEntrypoint, repoRoot, errors);
      for (const environmentName of sorted(referenced)) {
        if (!declared.has(environmentName)) {
          errors.push(
            `${functionLabel} source references ${environmentName}, but the manifest does not declare it.`,
          );
        }
      }
    }

    const sourceConfig = config.get(name);
    if (!sourceConfig) {
      errors.push(`supabase/config.toml is missing [functions.${name}].`);
      continue;
    }
    if (sourceConfig.verify_jwt !== definition.verifyJwt) {
      errors.push(
        `supabase/config.toml functions.${name}.verify_jwt does not match the manifest (${definition.verifyJwt}).`,
      );
    }
    const expectedConfigEntrypoint = `./functions/${name}/index.ts`;
    if (sourceConfig.entrypoint !== expectedConfigEntrypoint) {
      errors.push(
        `supabase/config.toml functions.${name}.entrypoint must equal ${expectedConfigEntrypoint}.`,
      );
    }
  }

  return errors;
}
