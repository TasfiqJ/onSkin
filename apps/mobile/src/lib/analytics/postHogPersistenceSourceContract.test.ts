import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MOBILE_PACKAGE = fileURLToPath(new URL('../../../package.json', import.meta.url));
const POSTHOG_STORAGE_SOURCE = fileURLToPath(
  new URL('../../../../../node_modules/posthog-react-native/dist/storage.js', import.meta.url),
);
const POSTHOG_NATIVE_DEPS_SOURCE = fileURLToPath(
  new URL('../../../../../node_modules/posthog-react-native/dist/native-deps.js', import.meta.url),
);
const POSTHOG_CORE_SOURCE = fileURLToPath(
  new URL('../../../../../node_modules/@posthog/core/src/posthog-core.ts', import.meta.url),
);

describe('pinned PostHog local-persistence source contract', () => {
  it('pins the audited SDK and its two persistence keys/backends', () => {
    const mobilePackage = JSON.parse(readFileSync(MOBILE_PACKAGE, 'utf8')) as {
      dependencies?: Record<string, string>;
    };
    const storageSource = readFileSync(POSTHOG_STORAGE_SOURCE, 'utf8');
    const nativeDepsSource = readFileSync(POSTHOG_NATIVE_DEPS_SOURCE, 'utf8');

    expect(mobilePackage.dependencies?.['posthog-react-native']).toBe('4.54.4');
    expect(storageSource).toContain("EVENTS_STORAGE_FILE='.posthog-rn.json'");
    expect(storageSource).toContain("LOGS_STORAGE_FILE='.posthog-rn-logs.json'");
    expect(nativeDepsSource).toContain('new filesystem.File(filesystem.Paths.document,key)');
    expect(nativeDepsSource).toContain("(filesystem.documentDirectory||'')+key");
    expect(nativeDepsSource).toContain('_OptionalAsyncStorage.OptionalAsyncStorage');
  });

  it('pins the audited reset behavior that preserves both queues', () => {
    const coreSource = readFileSync(POSTHOG_CORE_SOURCE, 'utf8');

    expect(coreSource).toContain('PostHogPersistedProperty.Queue,');
    expect(coreSource).toContain('PostHogPersistedProperty.LogsQueue,');
    expect(coreSource).toContain('are always preserved regardless');
  });
});
