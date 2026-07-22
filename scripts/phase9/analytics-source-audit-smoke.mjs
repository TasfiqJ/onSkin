#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const auditModuleUrl = new URL('./analytics-source-audit.mjs', import.meta.url).href;
const registrySource = `
export const ANALYTICS_ALLOWED_EVENTS = ['event_a', 'event_branch', 'event_empty'] as const;
export const ANALYTICS_ALLOWED_PROP_KEYS = ['context', 'count', 'source'] as const;
const enumValue = (...values: unknown[]) => ({ kind: 'enum', values });
const integer = (min = 0, max = 10_000) => ({ kind: 'integer', min, max });
export const ANALYTICS_EVENT_SCHEMAS = {
  event_a: { source: enumValue('safe') },
  event_branch: { context: enumValue('fixed'), count: integer() },
  event_empty: {},
} as const;
export const ANALYTICS_SPECIAL_PAYLOAD_SHAPES = {
  event_branch: [
    { required: ['context'] },
    { integers: { count: { min: 1, max: 10_000 } }, required: ['count'] },
  ],
} as const;
`;
const trackerSource = `
import type { PostHog } from 'posthog-react-native';
declare const posthog: PostHog | undefined;
declare function analyticsSchemaForEvent(event: string): Record<string, unknown>;
declare function isAllowedAnalyticsPropKey(key: string): boolean;
declare function isAllowedAnalyticsPropValue(rule: unknown, value: unknown): boolean;
declare function isAllowedAnalyticsPayloadShape(event: string, props: object): boolean;
void import('posthog-react-native');
export function pseudonymousUserId() { return Promise.resolve('u_safe'); }
export function sanitizeAnalyticsProps() { return undefined; }
export function sanitizeAnalyticsEventName(event: string) { return event; }
function sanitizeAnalyticsPayload(event: string, props: object = {}) {
  const schema = analyticsSchemaForEvent(event);
  if (!isAllowedAnalyticsPropKey('source')) return { accepted: false, props: undefined };
  if (!isAllowedAnalyticsPropValue(schema.source, props)) return { accepted: false, props: undefined };
  if (!isAllowedAnalyticsPayloadShape(event, props)) return { accepted: false, props: undefined };
  return { accepted: true, props };
}
export function prepareAnalyticsEvent(event: string, props?: object) {
  const safeEvent = sanitizeAnalyticsEventName(event);
  if (!safeEvent) return null;
  const payload = sanitizeAnalyticsPayload(safeEvent, props);
  return payload.accepted ? { event: safeEvent, props: payload.props } : null;
}
export function track(event: string, props?: object) {
  const prepared = prepareAnalyticsEvent(event, props);
  if (!prepared) return;
  posthog?.capture(prepared.event, prepared.props);
}
export async function identify() {}
export async function freezeAnalyticsIdentityForAccountDeletion() {}
export async function resetAnalyticsIdentity() {}
export async function flushAnalytics() {}
`;
const tsconfigSource = JSON.stringify({
  compilerOptions: {
    baseUrl: '.',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    paths: { '@/*': ['src/*'] },
    strict: true,
    target: 'ES2022',
  },
  include: ['src/**/*.ts', 'src/**/*.tsx'],
});

function write(root, path, value) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, value);
}

function runFixture(files, registry = registrySource) {
  const root = mkdtempSync(join(tmpdir(), 'onskin-analytics-audit-'));
  try {
    write(root, 'apps/mobile/tsconfig.json', tsconfigSource);
    write(root, 'apps/mobile/src/lib/analytics/eventRegistry.ts', registry);
    write(root, 'apps/mobile/src/lib/analytics/track.ts', trackerSource);
    for (const [path, source] of Object.entries(files)) write(root, path, source);
    const evaluation = `
      const { auditAnalyticsSource } = await import(${JSON.stringify(auditModuleUrl)});
      const result = auditAnalyticsSource();
      process.stdout.write(JSON.stringify({ ...result, trackedEvents: [...result.trackedEvents] }));
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', evaluation], {
      cwd: root,
      encoding: 'utf8',
    });
    if (child.status !== 0)
      throw new Error(child.stderr || child.stdout || 'fixture process failed');
    return JSON.parse(child.stdout);
  } finally {
    const resolvedRoot = resolve(root).toLowerCase();
    const resolvedTmp = `${resolve(tmpdir()).toLowerCase()}${sep}`;
    if (!resolvedRoot.startsWith(resolvedTmp)) {
      throw new Error(`Refusing to remove fixture outside temp: ${root}`);
    }
    rmSync(root, { recursive: true, force: true });
  }
}

function expectPass(name, files, expectedCalls) {
  const result = runFixture(files);
  if (result.errors.length || result.callCount !== expectedCalls) {
    throw new Error(`${name} should pass: ${JSON.stringify(result)}`);
  }
}

function expectFailure(name, files, pattern, registry, invalidEvent) {
  const result = runFixture(files, registry);
  if (!result.errors.some((error) => pattern.test(error))) {
    throw new Error(`${name} did not fail as expected: ${JSON.stringify(result)}`);
  }
  if (invalidEvent && result.trackedEvents.includes(invalidEvent)) {
    throw new Error(
      `${name} incorrectly counted invalid event coverage: ${JSON.stringify(result)}`,
    );
  }
}

const canonicalPass = `
import { track as capture } from '@/lib/analytics/track';
import { track as unrelatedTrack } from './unrelated';
const fake = "track('event_empty', { source: 'fake' })";
void fake;
unrelatedTrack();
{
  const capture = () => undefined;
  capture();
}
capture(
  'event_a',
  ({
    // braces and ); inside comments must not affect parsing.
    source: 'safe',
  } as const),
);
capture('event_empty');
`;

expectPass(
  'canonical symbol/alias/comments/shadow/type-only vendor',
  {
    'apps/mobile/src/feature.ts': canonicalPass,
    'apps/mobile/src/unrelated.ts': `export function track() {}`,
    'apps/mobile/src/ignored.test.ts': `
      import { track } from '@/lib/analytics/track';
      track(dynamicEvent, payload);
    `,
  },
  2,
);
expectFailure(
  'relative import',
  {
    'apps/mobile/src/feature.ts': `import { track } from './lib/analytics/track'; track('event_empty');`,
  },
  /must import analytics APIs through/,
);
expectFailure(
  'barrel re-export',
  { 'apps/mobile/src/barrel.ts': `export { track } from '@/lib/analytics/track';` },
  /must not re-export/,
);
expectFailure(
  'dynamic tracker import',
  { 'apps/mobile/src/feature.ts': `void import('@/lib/analytics/track');` },
  /cannot be loaded dynamically/,
);
expectFailure(
  'computed runtime import',
  {
    'apps/mobile/src/feature.ts': `const moduleName = '@/lib/analytics/track'; void import(moduleName);`,
  },
  /literal specifier/,
);
expectFailure(
  'dynamic event',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const event = 'event_a';
      track(event, { source: 'safe' });
    `,
  },
  /event must be a plain string literal/,
);
expectFailure(
  'identifier payload',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const payload = { source: 'safe' };
      track('event_a', payload);
    `,
  },
  /payload must be an inline object literal/,
);
expectFailure(
  'spread payload',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const payload = { source: 'safe' };
      track('event_a', { ...payload });
    `,
  },
  /spread, method, or accessor/,
);
expectFailure(
  'computed key',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_a', { ['source']: 'safe' });
    `,
  },
  /computed or duplicate key/,
);
expectFailure(
  'cross-event key',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_empty', { source: 'safe' });
    `,
  },
  /no-property event received a payload/,
);
expectFailure(
  'missing required key does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_a', {});
    `,
  },
  /does not match an exact branch/,
  undefined,
  'event_a',
);
expectFailure(
  'mutually exclusive branch does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_branch', { context: 'fixed', count: 1 });
    `,
  },
  /does not match an exact branch/,
  undefined,
  'event_branch',
);
expectFailure(
  'integer branch range does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_branch', { count: 0 });
    `,
  },
  /does not match an exact branch/,
  undefined,
  'event_branch',
);
expectFailure(
  'invalid enum value does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_a', { source: 'unsafe' });
    `,
  },
  /outside its exact rule/,
  undefined,
  'event_a',
);
expectFailure(
  'broad dynamic enum does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const source: string = 'unsafe';
      track('event_a', { source });
    `,
  },
  /type outside its exact runtime rule/,
  undefined,
  'event_a',
);
expectFailure(
  'required undefined does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_a', { source: undefined });
    `,
  },
  /type outside its exact runtime rule/,
  undefined,
  'event_a',
);
expectFailure(
  'suppressed analytics type error does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const source: string = 'unsafe';
      // @ts-expect-error deliberate bypass
      track('event_a', { source });
    `,
  },
  /must not rely on TypeScript diagnostic suppression/,
  undefined,
  'event_a',
);
expectFailure(
  'double assertion does not count coverage',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      track('event_a', { source: 'unsafe' as unknown as 'safe' });
    `,
  },
  /unsafe type assertion/,
  undefined,
  'event_a',
);
expectFailure(
  'tracker escape',
  {
    'apps/mobile/src/feature.ts': `
      import { track } from '@/lib/analytics/track';
      const escaped = track;
      void escaped;
    `,
  },
  /tracker binding escaped/,
);
expectFailure(
  'direct PostHog value import',
  { 'apps/mobile/src/feature.ts': `import PostHog from 'posthog-react-native'; void PostHog;` },
  /must not acquire PostHog through a value import/,
);
expectFailure(
  'extra tracker export',
  {
    'apps/mobile/src/lib/analytics/track.ts': `${trackerSource}\nexport function emit() {}`,
  },
  /exports must match the fixed API/,
);
expectFailure(
  'second raw tracker capture',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `posthog?.capture(prepared.event, prepared.props);`,
      `posthog?.capture(prepared.event, prepared.props); posthog?.capture(event, props);`,
    ),
  },
  /exactly one PostHog capture call/,
);
expectFailure(
  'raw prepared payload',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `const prepared = prepareAnalyticsEvent(event, props);`,
      `const prepared = { event, props };`,
    ),
  },
  /must prepare the event through prepareAnalyticsEvent/,
);
expectFailure(
  'missing prepared rejection guard',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `  if (!prepared) return;\n`,
      ``,
    ),
  },
  /return on rejection before capture/,
);
expectFailure(
  'mutable prepared binding',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `const prepared = prepareAnalyticsEvent(event, props);`,
      `let prepared = prepareAnalyticsEvent(event, props);`,
    ),
  },
  /prepare the event through prepareAnalyticsEvent/,
);
expectFailure(
  'prepared reassignment after guard',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `  if (!prepared) return;`,
      `  if (!prepared) return;\n  prepared = { event, props };`,
    ),
  },
  /must not be reassigned, mutated, inspected, or escaped/,
);
expectFailure(
  'capture before rejection guard',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `  if (!prepared) return;\n  posthog?.capture(prepared.event, prepared.props);`,
      `  posthog?.capture(prepared.event, prepared.props);\n  if (!prepared) return;`,
    ),
  },
  /guard must dominate/,
);
expectFailure(
  'fake capture and computed real capture',
  {
    'apps/mobile/src/lib/analytics/track.ts': trackerSource.replace(
      `posthog?.capture(prepared.event, prepared.props);`,
      `fake.capture(prepared.event, prepared.props); posthog?.[CAPTURE](event, props);`,
    ),
  },
  /computed PostHog access|exact prepared/,
);
expectFailure(
  'PostHog import equals',
  { 'apps/mobile/src/feature.ts': `import Client = require('posthog-react-native'); void Client;` },
  /import-equals/,
);
expectFailure(
  'PostHog module require',
  {
    'apps/mobile/src/feature.ts': `const Client = module.require('posthog-react-native'); void Client;`,
  },
  /runtime acquisition is owned only/,
);
expectFailure(
  'parse error',
  { 'apps/mobile/src/feature.ts': `import { track } from '@/lib/analytics/track'; track(` },
  /parse error/,
);
expectFailure(
  'registry/schema drift',
  { 'apps/mobile/src/feature.ts': canonicalPass },
  /missing its exact schema/,
  registrySource.replace(
    `['event_a', 'event_branch', 'event_empty']`,
    `['event_a', 'event_branch', 'event_empty', 'missing']`,
  ),
);
expectFailure(
  'malformed registry rule',
  {},
  /non-canonical analytics rule|unsafe type assertion/,
  registrySource.replace(`enumValue('safe')`, `undefined as any`),
);
expectFailure(
  'nested registry decoy cannot mask the real export',
  {},
  /non-canonical analytics rule|unsafe type assertion/,
  `
    function decoy() {
      const ANALYTICS_EVENT_SCHEMAS = { event_a: { source: enumValue('safe') } };
      return ANALYTICS_EVENT_SCHEMAS;
    }
    void decoy;
    ${registrySource.replace(`enumValue('safe')`, `undefined as any`)}
  `,
);

expectFailure(
  'no-property special shape',
  {},
  /No-property event must not define special payload shapes/,
  registrySource.replace(`event_branch: [`, `event_empty: [],\n  event_branch: [`),
);
expectFailure(
  'empty fixed value domain',
  {},
  /shape values must not be empty/,
  registrySource.replace(
    `{ required: ['context'] }`,
    `{ required: ['context'], values: { context: [] } }`,
  ),
);
expectFailure(
  'overlapping special branches',
  {},
  /overlapping or duplicate branches/,
  registrySource.replace(
    `{ required: ['context'] },`,
    `{ required: ['context'] },\n    { required: ['context'] },`,
  ),
);
expectFailure(
  'missing discriminator alternative',
  {},
  /omit an allowed enum alternative/,
  registrySource
    .replace(
      `event_a: { source: enumValue('safe') }`,
      `event_a: { source: enumValue('safe', 'other') }`,
    )
    .replace(
      `event_branch: [`,
      `event_a: [{ required: ['source'], values: { source: ['safe'] } }],\n  event_branch: [`,
    ),
);

console.log('Analytics source audit smoke passed 1 positive matrix and 36 negative fixtures.');
