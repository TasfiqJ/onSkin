import { describe, expect, it, vi } from 'vitest';

import { createSerialTaskQueue } from './serialTaskQueue';

describe('serial task queue', () => {
  it('finishes identity transitions in request order', async () => {
    const queue = createSerialTaskQueue();
    const events: string[] = [];
    let releaseA!: () => void;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });

    const a = queue.run(async () => {
      events.push('a:start');
      await gateA;
      events.push('a:end');
    });
    const b = queue.run(async () => {
      events.push('b:start');
      events.push('b:end');
    });

    await vi.waitFor(() => expect(events).toEqual(['a:start']));
    releaseA();
    await Promise.all([a, b]);

    expect(events).toEqual(['a:start', 'a:end', 'b:start', 'b:end']);
  });

  it('continues after a failed task while preserving its rejection', async () => {
    const queue = createSerialTaskQueue();
    const failure = new Error('transition failed');

    const failed = queue.run(() => {
      throw failure;
    });
    const next = queue.run(() => 'owner-b');

    await expect(failed).rejects.toBe(failure);
    await expect(next).resolves.toBe('owner-b');
    await expect(queue.settle()).resolves.toBeUndefined();
  });
});
