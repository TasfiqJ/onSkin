import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { openExternalHttpsUrl } from './externalOpen';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

const mocks = vi.hoisted(() => ({
  alerts: [] as unknown[][],
  openBrowserAsync: vi.fn(),
  openURL: vi.fn(),
}));

vi.mock('expo-web-browser', () => ({
  openBrowserAsync: mocks.openBrowserAsync,
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => {
      mocks.alerts.push(args);
    },
  },
  Linking: {
    openURL: mocks.openURL,
  },
}));

describe('external URL opener', () => {
  beforeEach(() => {
    mocks.alerts = [];
    mocks.openBrowserAsync.mockReset();
    mocks.openURL.mockReset();
  });

  it('rejects unsafe URLs before any external handoff', async () => {
    await expect(
      openExternalHttpsUrl('http://example.com/policy', {
        invalidTitle: 'Link not configured',
        invalidMessage: 'This policy URL must be configured before launch.',
      }),
    ).resolves.toBe(false);

    expect(mocks.openBrowserAsync).not.toHaveBeenCalled();
    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.alerts[0]).toEqual([
      'Link not configured',
      'This policy URL must be configured before launch.',
    ]);
  });

  it('opens sanitized HTTPS URLs in the in-app browser by default', async () => {
    mocks.openBrowserAsync.mockResolvedValueOnce({ type: 'opened' });

    await expect(openExternalHttpsUrl(' https://example.com/privacy#token ')).resolves.toBe(true);

    expect(mocks.openBrowserAsync).toHaveBeenCalledWith('https://example.com/privacy');
    expect(mocks.openURL).not.toHaveBeenCalled();
    expect(mocks.alerts).toEqual([]);
  });

  it('alerts when the in-app browser handoff fails', async () => {
    mocks.openBrowserAsync.mockRejectedValueOnce(new Error('no browser'));

    await expect(openExternalHttpsUrl('https://example.com/privacy')).resolves.toBe(false);

    expect(mocks.alerts[0]).toEqual([
      'Link unavailable',
      'We could not open this link. Please try again.',
    ]);
  });

  it('alerts when a native Linking handoff fails', async () => {
    mocks.openURL.mockRejectedValueOnce(new Error('cannot open'));

    await expect(
      openExternalHttpsUrl('https://store.example/subscription', {
        mode: 'linking',
        failureTitle: 'Subscription link unavailable',
        failureMessage: 'We could not open subscription management.',
      }),
    ).resolves.toBe(false);

    expect(mocks.openURL).toHaveBeenCalledWith('https://store.example/subscription');
    expect(mocks.openBrowserAsync).not.toHaveBeenCalled();
    expect(mocks.alerts[0]).toEqual([
      'Subscription link unavailable',
      'We could not open subscription management.',
    ]);
  });

  it('keeps policy, billing, and retailer handoffs on the shared failure-alert helper', () => {
    for (const path of [
      'app/(tabs)/you.tsx',
      'app/settings/subscription.tsx',
      'features/subscription/ComplianceRow.tsx',
      'features/commerce/WhereToBuy.tsx',
    ]) {
      const source = readSource(path);

      expect(source, `${path} should use the shared external opener`).toContain(
        'openExternalHttpsUrl',
      );
      expect(source, `${path} should not swallow raw Linking failures`).not.toContain(
        'Linking.openURL',
      );
      expect(source, `${path} should not swallow raw WebBrowser failures`).not.toContain(
        'openBrowserAsync',
      );
    }
  });
});
