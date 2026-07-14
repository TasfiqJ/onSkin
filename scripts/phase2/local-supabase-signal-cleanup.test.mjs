import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';

import { installSignalCleanup } from './local-supabase-signal-cleanup.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

test('SIGINT waits for one cleanup before exiting 130', async () => {
  const signalSource = new EventEmitter();
  const cleanupGate = deferred();
  const exits = [];
  let cleanupCalls = 0;
  const controller = installSignalCleanup({
    cleanup: () => {
      cleanupCalls += 1;
      return cleanupGate.promise;
    },
    signalSource,
    exit: (code) => exits.push(code),
    log: () => {},
  });

  signalSource.emit('SIGINT');
  signalSource.emit('SIGTERM');
  await Promise.resolve();
  assert.equal(cleanupCalls, 1);
  assert.deepEqual(exits, []);

  cleanupGate.resolve();
  await controller.pending;
  assert.deepEqual(exits, [130]);
  assert.equal(signalSource.listenerCount('SIGINT'), 0);
  assert.equal(signalSource.listenerCount('SIGTERM'), 0);
});

test('SIGTERM exits 143 even when cleanup reports an error', async () => {
  const signalSource = new EventEmitter();
  const exits = [];
  const messages = [];
  const controller = installSignalCleanup({
    cleanup: async () => {
      throw new Error('sensitive failure detail');
    },
    signalSource,
    exit: (code) => exits.push(code),
    log: (message) => messages.push(message),
  });

  signalSource.emit('SIGTERM');
  await Promise.resolve();
  await controller.pending;
  assert.deepEqual(exits, [143]);
  assert.equal(
    messages.some((message) => message.includes('sensitive failure detail')),
    false,
  );
});
