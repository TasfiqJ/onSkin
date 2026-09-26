import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MOBILE_SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function productionSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      return entry.name === '__mocks__' || entry.name === 'generated'
        ? []
        : productionSourceFiles(path);
    }
    if (!entry.isFile() || (!entry.name.endsWith('.ts') && !entry.name.endsWith('.tsx'))) {
      return [];
    }
    return /\.(?:test|spec)\.tsx?$/u.test(entry.name) || entry.name.endsWith('.d.ts') ? [] : [path];
  });
}

describe('remote notification boundary', () => {
  it('keeps APNs and Expo Push token collection literally absent while the reviewed contract is local-only', () => {
    const productionSource = productionSourceFiles(MOBILE_SRC_DIR)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(productionSource).not.toMatch(
      /getExpoPushTokenAsync|getDevicePushTokenAsync|addPushTokenListener|pushTokenManager/u,
    );
  });
});
