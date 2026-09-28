const SIGNAL_EXIT_CODES = Object.freeze({ SIGINT: 130, SIGTERM: 143 });

export function installSignalCleanup({
  cleanup,
  signalSource = process,
  exit = (code) => process.exit(code),
  log = (message) => process.stderr.write(`${message}\n`),
}) {
  if (typeof cleanup !== 'function') throw new TypeError('cleanup must be a function.');

  let receivedSignal;
  let pendingCleanup;
  const handlers = new Map();

  const dispose = () => {
    for (const [signal, handler] of handlers) signalSource.off(signal, handler);
  };

  const handle = (signal) => {
    if (receivedSignal) return;
    receivedSignal = signal;
    log(`[db05-local] ${signal} received; removing the isolated local stack...`);
    pendingCleanup = Promise.resolve()
      .then(cleanup)
      .catch(() => log(`[db05-local] ${signal} cleanup encountered an error.`))
      .finally(() => {
        dispose();
        exit(SIGNAL_EXIT_CODES[signal]);
      });
  };

  for (const signal of Object.keys(SIGNAL_EXIT_CODES)) {
    const handler = () => handle(signal);
    handlers.set(signal, handler);
    signalSource.on(signal, handler);
  }

  return {
    dispose,
    get pending() {
      return pendingCleanup;
    },
    get signal() {
      return receivedSignal;
    },
  };
}
