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

function ownersOf(symbol: string, files: readonly string[]): string[] {
  return files
    .filter((path) => readFileSync(path, 'utf8').includes(symbol))
    .map(normalized)
    .sort();
}

describe('production native-notification mutation inventory', () => {
  const files = productionSources();

  it.each([
    'cancelAllScheduledNotificationsAsync',
    'cancelScheduledNotificationAsync',
    'dismissAllNotificationsAsync',
    'dismissNotificationAsync',
    'scheduleNotificationAsync',
  ])('keeps %s behind the native mutation coordinator', (symbol) => {
    expect(ownersOf(symbol, files)).toEqual(['features/notifications/nativeMutation.ts']);
  });

  it('allows retained-response clearing only in cleanup and the bounded response host', () => {
    expect(ownersOf('clearLastNotificationResponseAsync', files)).toEqual([
      'features/notifications/NotificationResponseHost.tsx',
      'features/notifications/nativeMutation.ts',
    ]);
  });

  it('allows badge clearing only in bootstrap and account-isolation cleanup', () => {
    expect(ownersOf('setBadgeCountAsync', files)).toEqual([
      'features/notifications/nativeMutation.ts',
      'features/notifications/startup.ts',
    ]);
  });
});
