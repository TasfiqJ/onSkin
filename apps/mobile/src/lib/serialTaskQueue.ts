export type SerialTaskQueue = {
  run: <T>(task: () => T | Promise<T>) => Promise<T>;
  settle: () => Promise<void>;
};

/** FIFO async task queue. A rejected task never skips or poisons later work. */
export function createSerialTaskQueue(): SerialTaskQueue {
  let tail = Promise.resolve();

  return {
    run<T>(task: () => T | Promise<T>): Promise<T> {
      const result = tail.then(task);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
    settle: () => tail,
  };
}
