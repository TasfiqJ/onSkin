import { beforeEach, describe, expect, it } from 'vitest';

import {
  markStartupPhase,
  readOperationTimingSamples,
  readStartupPhaseSamples,
  resetOperationTimingForTests,
  startOperationTiming,
  withOperationTiming,
} from './operationTiming';

describe('content-free operation timing', () => {
  beforeEach(() => resetOperationTimingForTests());

  it('records only fixed operation labels, rounded durations, and outcomes', () => {
    const readings = [10, 22.345];
    const finish = startOperationTiming('private_kv_read', () => readings.shift() ?? 0);
    finish('ok');
    finish('error');

    expect(readOperationTimingSamples()).toEqual([
      { name: 'private_kv_read', durationMs: 12.35, outcome: 'ok' },
    ]);
  });

  it('bounds retained samples so diagnostics cannot grow without limit', () => {
    for (let index = 0; index < 240; index += 1) {
      const finish = startOperationTiming('private_kv_write', () => index);
      finish('ok');
    }

    expect(readOperationTimingSamples()).toHaveLength(200);
  });

  it('records each startup phase once and preserves phase order', () => {
    markStartupPhase('navigation_ready', () => 30);
    markStartupPhase('javascript_started', () => 2);
    markStartupPhase('navigation_ready', () => 90);

    expect(readStartupPhaseSamples()).toEqual([
      { phase: 'javascript_started', elapsedMs: 2 },
      { phase: 'navigation_ready', elapsedMs: 30 },
    ]);
  });

  it('records success and failure without retaining thrown values', async () => {
    await expect(withOperationTiming('private_kv_batch_read', async () => 'ok')).resolves.toBe(
      'ok',
    );
    await expect(
      withOperationTiming('private_kv_batch_read', async () => {
        throw new Error('private payload must not be retained');
      }),
    ).rejects.toThrow('private payload must not be retained');

    expect(readOperationTimingSamples().map(({ outcome }) => outcome)).toEqual(['ok', 'error']);
    expect(JSON.stringify(readOperationTimingSamples())).not.toContain('private payload');
  });
});
