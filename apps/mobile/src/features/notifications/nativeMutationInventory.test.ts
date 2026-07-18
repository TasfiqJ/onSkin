import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function productionSources(directory = SRC_DIR): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return productionSources(path);
    if (!/\.[cm]?[jt]sx?$/.test(name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)) {
      return [];
    }
    return [path];
  });
}

function normalized(path: string): string {
  return relative(SRC_DIR, path).replaceAll('\\', '/');
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const NATIVE_WRITE_SYMBOLS = [
  'cancelAllScheduledNotificationsAsync',
  'cancelScheduledNotificationAsync',
  'dismissAllNotificationsAsync',
  'dismissNotificationAsync',
  'scheduleNotificationAsync',
] as const;

describe('production native-notification mutation inventory', () => {
  const files = productionSources();

  it('keeps every Expo notification write behind the exact mutation coordinator', () => {
    const directWriteFiles = files
      .filter((path) => NATIVE_WRITE_SYMBOLS.some((symbol) => source(path).includes(symbol)))
      .map(normalized)
      .sort();

    expect(directWriteFiles).toEqual(['features/notifications/nativeMutation.ts']);
  });

  it('freezes ordinary and cleanup wrapper call sites at their owner-fenced boundaries', () => {
    const ordinaryCallers = files
      .filter((path) => {
        const text = source(path);
        return (
          text.includes('scheduleNativeNotificationExact(') ||
          text.includes('cancelNativeScheduledNotificationExact(')
        );
      })
      .map(normalized)
      .sort();
    const cleanupCallers = files
      .filter((path) => source(path).includes('clearNativeNotificationsForAccountIsolation('))
      .map(normalized)
      .sort();

    expect(ordinaryCallers).toEqual([
      'features/notifications/deliver.ts',
      'features/notifications/nativeMutation.ts',
    ]);
    expect(cleanupCallers).toEqual([
      'features/notifications/nativeMutation.ts',
      'features/settings/localPrivateData.ts',
    ]);

    const delivery = source(join(SRC_DIR, 'features/notifications/deliver.ts'));
    expect(delivery).toContain('runAccountGenerationOperation');
    expect(delivery).toContain('awaitAccountGenerationLease');
    expect(delivery).toContain('lease.signal');

    const accountCleanup = source(join(SRC_DIR, 'features/settings/localPrivateData.ts'));
    expect(accountCleanup).toContain("label: 'scheduled_notifications'");
    expect(accountCleanup).toContain('clearNativeNotificationsForAccountIsolation()');
    expect(accountCleanup).toContain('Promise.allSettled');
  });
});
