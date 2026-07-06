import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SENTRY_SOURCE = fileURLToPath(new URL('./sentry.ts', import.meta.url));

describe('Sentry privacy configuration', () => {
  it('keeps automatic sensitive capture surfaces disabled', () => {
    const source = readFileSync(SENTRY_SOURCE, 'utf8');

    expect(source).toContain('sendDefaultPii: false');
    expect(source).toContain('tracesSampleRate: 0');
    expect(source).toContain('enableCaptureFailedRequests: false');
    expect(source).toContain('attachScreenshot: false');
    expect(source).toContain('attachViewHierarchy: false');
    expect(source).not.toContain('env.appEnvironment === \'production\' ? 0.05 : 0.1');
  });
});
