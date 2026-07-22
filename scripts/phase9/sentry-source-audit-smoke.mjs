#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const auditModuleUrl = new URL('./sentry-source-audit.mjs', import.meta.url).href;
const wrapper = `
import * as Sentry from '@sentry/react-native';
declare const env: { appEnvironment: string; sentryDsn: string };
declare const Platform: { OS: string };
declare function sanitizeObservabilityContext(value: unknown): object;
declare function sanitizeCapturedException(value: unknown): Error;
declare function sanitizeSentryEvent(value: unknown): unknown;
declare function devWarn(message: string, error: unknown): void;
type Options = Parameters<typeof Sentry.init>[0];
void (null as unknown as Options);
Sentry.init({
  dsn: env.sentryDsn,
  environment: env.appEnvironment,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  enableNative: Platform.OS !== 'web',
  enableCaptureFailedRequests: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: sanitizeSentryEvent,
});
Sentry.setTag('app_environment', env.appEnvironment);
Sentry.setUser(null);
const id = 'u_safe';
Sentry.setUser({ id });
Sentry.setUser(null);
export function captureException(error: unknown, context?: unknown) {
  if (!error) { devWarn('skipped', error); return; }
  const safeContext = sanitizeObservabilityContext(context);
  const safeError = sanitizeCapturedException(error);
  Sentry.captureException(
    safeError,
    Object.keys(safeContext).length ? { extra: safeContext } : undefined,
  );
}
const fake = "Sentry['setExtra']('raw', 'person@example.com')";
void fake;
`;

function write(root, path, source) {
  const target = join(root, path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, source);
}

function run(files) {
  const root = mkdtempSync(join(tmpdir(), 'onskin-sentry-audit-'));
  try {
    write(root, 'apps/mobile/src/lib/observability/sentry.ts', wrapper);
    for (const [path, source] of Object.entries(files)) write(root, path, source);
    const evaluation = `
      const { auditSentrySource } = await import(${JSON.stringify(auditModuleUrl)});
      const result = auditSentrySource();
      process.stdout.write(JSON.stringify({ ...result, methods: [...result.methods] }));
    `;
    const child = spawnSync(process.execPath, ['--input-type=module', '--eval', evaluation], {
      cwd: root,
      encoding: 'utf8',
    });
    if (child.status !== 0) throw new Error(child.stderr || child.stdout || 'fixture failed');
    return JSON.parse(child.stdout);
  } finally {
    const resolvedRoot = resolve(root).toLowerCase();
    const resolvedTmp = `${resolve(tmpdir()).toLowerCase()}${sep}`;
    if (!resolvedRoot.startsWith(resolvedTmp)) throw new Error(`Unsafe fixture root: ${root}`);
    rmSync(root, { recursive: true, force: true });
  }
}

function expectFailure(name, files, pattern) {
  const result = run(files);
  if (!result.errors.some((error) => pattern.test(error))) {
    throw new Error(`${name} did not fail: ${JSON.stringify(result)}`);
  }
}

const positive = run({
  'apps/mobile/src/types.ts': `
    import type { Event } from '@sentry/react-native';
    export type { Event as SentryEvent } from '@sentry/react-native';
    export type E = Event;
  `,
});
if (positive.errors.length) throw new Error(`positive fixture failed: ${JSON.stringify(positive)}`);
expectFailure(
  'computed method',
  {
    'apps/mobile/src/lib/observability/sentry.ts': `${wrapper}\nSentry['setExtra']('raw', 'value');`,
  },
  /computed Sentry method access/,
);
expectFailure(
  'namespace alias',
  {
    'apps/mobile/src/lib/observability/sentry.ts': `${wrapper}\nconst vendor = Sentry; void vendor;`,
  },
  /namespace binding escaped/,
);
expectFailure(
  'namespace destructure',
  {
    'apps/mobile/src/lib/observability/sentry.ts': `${wrapper}\nconst { setExtra } = Sentry; void setExtra;`,
  },
  /namespace binding escaped/,
);
expectFailure(
  'direct acquisition',
  { 'apps/mobile/src/feature.ts': `import * as SDK from '@sentry/react-native'; void SDK;` },
  /outside the fixed wrapper/,
);
expectFailure(
  'computed acquisition',
  { 'apps/mobile/src/feature.ts': `const sdk = '@sentry/' + 'react-native'; void import(sdk);` },
  /literal modules/,
);
expectFailure(
  'runtime re-export',
  { 'apps/mobile/src/feature.ts': `export { setExtra } from '@sentry/react-native';` },
  /must not re-export the Sentry SDK at runtime/,
);
expectFailure(
  'runtime star re-export',
  { 'apps/mobile/src/feature.ts': `export * from '@sentry/react-native';` },
  /must not re-export the Sentry SDK at runtime/,
);
expectFailure(
  'capture attachments',
  {
    'apps/mobile/src/lib/observability/sentry.ts': wrapper.replace(
      `Object.keys(safeContext).length ? { extra: safeContext } : undefined,`,
      `{ attachments: [{ filename: 'private', data: privateBytes }] },`,
    ),
  },
  /fixed safe context hint/,
);

expectFailure(
  'capture extra plus attachments',
  {
    'apps/mobile/src/lib/observability/sentry.ts': wrapper.replace(
      `{ extra: safeContext } : undefined,`,
      `{ extra: safeContext, attachments: [] } : undefined,`,
    ),
  },
  /fixed safe context hint/,
);
expectFailure(
  'capture trailing argument',
  {
    'apps/mobile/src/lib/observability/sentry.ts': wrapper.replace(
      `Object.keys(safeContext).length ? { extra: safeContext } : undefined,\n  );`,
      `Object.keys(safeContext).length ? { extra: safeContext } : undefined,\n    rawThirdArgument,\n  );`,
    ),
  },
  /fixed safe context hint/,
);
expectFailure(
  'import equals acquisition',
  { 'apps/mobile/src/feature.ts': `import SDK = require('@sentry/react-native'); void SDK;` },
  /import-equals/,
);
expectFailure(
  'relative node_modules acquisition',
  {
    'apps/mobile/src/deep/feature.ts': `import SDK from '../../../../node_modules/@sentry/react-native'; void SDK;`,
  },
  /outside the fixed wrapper/,
);
expectFailure(
  'init spread override',
  {
    'apps/mobile/src/lib/observability/sentry.ts': wrapper.replace(
      `  dsn: env.sentryDsn,`,
      `  ...unsafeOptions,\n  dsn: env.sentryDsn,`,
    ),
  },
  /must not contain spreads/,
);
expectFailure(
  'raw safe error decoy',
  {
    'apps/mobile/src/lib/observability/sentry.ts': wrapper.replace(
      `const safeError = sanitizeCapturedException(error);`,
      `const safeError = error as Error;`,
    ),
  },
  /initialize const safeError with sanitizeCapturedException/,
);

console.log('Sentry source audit smoke passed 1 positive and 14 negative fixtures.');
