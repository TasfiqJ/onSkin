import { afterEach, describe, expect, it, vi } from 'vitest';

import { devWarn, redactedErrorForLog } from './safeLog';

afterEach(() => {
  delete (globalThis as { __DEV__?: boolean }).__DEV__;
  vi.restoreAllMocks();
});

describe('safe dev logging', () => {
  it('redacts exception message, stack, and attached fields', () => {
    const error = new Error('token=secret https://example.com/photo.jpg /data/user/0/cache/file');
    Object.assign(error, {
      user_id: '123',
      signedUrl: 'https://example.com/signed?token=secret',
    });

    const redacted = redactedErrorForLog(error);
    expect(redacted).toEqual({ kind: 'error', name: 'Error' });
    expect(JSON.stringify(redacted)).not.toMatch(/token|https|photo|user_id|signedUrl|cache/i);
  });

  it('logs only redacted error metadata in dev', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = true;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    devWarn('[analytics] capture failed', new TypeError('jwt=secret@example.com'));

    expect(warn).toHaveBeenCalledWith('[analytics] capture failed', { kind: 'error', name: 'TypeError' });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(/jwt|secret@example\.com/i);
  });

  it('does not log outside dev mode', () => {
    (globalThis as { __DEV__?: boolean }).__DEV__ = false;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    devWarn('[sentry] skipped', new Error('raw provider detail'));

    expect(warn).not.toHaveBeenCalled();
  });
});
