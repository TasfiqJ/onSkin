export const SENSITIVE_IMAGE_REQUEST_CANCELLED = 'SENSITIVE_IMAGE_REQUEST_CANCELLED';
export const SENSITIVE_IMAGE_OWNER_GENERATION_CHANGED = 'SENSITIVE_IMAGE_OWNER_GENERATION_CHANGED';

export type SensitiveImageRequestPriority = 'interactive' | 'visible' | 'adjacent';

export type SensitiveImageRequest<TResult = string> = Readonly<{
  promise: Promise<TResult>;
  cancel: () => void;
  promote: () => void;
}>;

type Subscriber<TResult> = {
  active: boolean;
  priority: SensitiveImageRequestPriority;
  resolve: (value: TResult) => void;
  reject: (reason: Error) => void;
};

type QueueEntry<TResult> = {
  key: string;
  uri: string;
  ownerGeneration: number;
  sequence: number;
  priority: SensitiveImageRequestPriority;
  state: 'queued' | 'running';
  subscribers: Set<Subscriber<TResult>>;
};

export type SensitiveImageCoordinatorSnapshot = Readonly<{
  active: number;
  queued: number;
  running: number;
  subscribers: number;
}>;

type SensitiveImageCoordinatorOptions = Readonly<{
  maxConcurrent: number;
  getOwnerGeneration: () => number;
}>;

const PRIORITY_RANK: Record<SensitiveImageRequestPriority, number> = {
  interactive: 0,
  visible: 1,
  adjacent: 2,
};

function cancellationError(): Error {
  return new Error(SENSITIVE_IMAGE_REQUEST_CANCELLED);
}

export function isSensitiveImageRequestCancelled(error: unknown): boolean {
  return error instanceof Error && error.message === SENSITIVE_IMAGE_REQUEST_CANCELLED;
}

/**
 * Owner-generation-bound decrypt queue. It deduplicates only in-flight work and
 * deliberately retains no resolved data URI: the current photo-v1 path has no
 * trustworthy decoded-byte estimate, so a non-zero LRU would not be bounded in
 * the unit the renderer actually consumes. The generic result keeps scheduling
 * independent from the current v1 data-URI adapter; an approved v2 adapter can
 * instead coordinate ref-counted native image handles.
 */
export class SensitiveImageDecryptCoordinator<TResult> {
  private readonly entries = new Map<string, QueueEntry<TResult>>();
  private readonly load: (uri: string) => Promise<TResult>;
  private readonly maxConcurrent: number;
  private readonly getOwnerGeneration: () => number;
  private active = 0;
  private sequence = 0;

  constructor(
    load: (uri: string) => Promise<TResult>,
    { maxConcurrent, getOwnerGeneration }: SensitiveImageCoordinatorOptions,
  ) {
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1 || maxConcurrent > 2) {
      throw new Error('SENSITIVE_IMAGE_CONCURRENCY_INVALID');
    }
    this.load = load;
    this.maxConcurrent = maxConcurrent;
    this.getOwnerGeneration = getOwnerGeneration;
  }

  request(
    requestKey: string,
    uri: string,
    priority: SensitiveImageRequestPriority = 'interactive',
    expectedOwnerGeneration?: number,
  ): SensitiveImageRequest<TResult> {
    const ownerGeneration = this.getOwnerGeneration();
    if (expectedOwnerGeneration !== undefined && expectedOwnerGeneration !== ownerGeneration) {
      throw new Error(SENSITIVE_IMAGE_OWNER_GENERATION_CHANGED);
    }
    const key = `${ownerGeneration}\u0000${requestKey}`;
    let entry = this.entries.get(key);
    if (entry && entry.uri !== uri) {
      // A prop/migration update may replace the encrypted authority after the
      // final consumer detached from an unabortable native read. The old run
      // remains counted but cannot publish; replace only that orphaned entry.
      if (entry.subscribers.size > 0) throw new Error('SENSITIVE_IMAGE_IDENTITY_CONFLICT');
      entry = undefined;
    }
    if (!entry) {
      entry = {
        key,
        uri,
        ownerGeneration,
        sequence: this.sequence++,
        priority,
        state: 'queued',
        subscribers: new Set(),
      };
      this.entries.set(key, entry);
    }

    let resolvePromise!: (value: TResult) => void;
    let rejectPromise!: (reason: Error) => void;
    const promise = new Promise<TResult>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    const subscriber: Subscriber<TResult> = {
      active: true,
      priority,
      resolve: resolvePromise,
      reject: rejectPromise,
    };
    entry.subscribers.add(subscriber);
    this.recomputePriority(entry);
    this.drain();

    return Object.freeze({
      promise,
      cancel: () => this.cancel(entry!, subscriber),
      promote: () => this.promote(entry!, subscriber),
    });
  }

  /** Reject every consumer and detach every queued/running result immediately. */
  purge(): void {
    for (const entry of this.entries.values()) {
      for (const subscriber of entry.subscribers) {
        this.rejectSubscriber(subscriber, cancellationError());
      }
      entry.subscribers.clear();
    }
    this.entries.clear();
  }

  snapshot(): SensitiveImageCoordinatorSnapshot {
    let queued = 0;
    let running = 0;
    let subscribers = 0;
    for (const entry of this.entries.values()) {
      if (entry.state === 'queued') queued += 1;
      else running += 1;
      subscribers += entry.subscribers.size;
    }
    return { active: this.active, queued, running, subscribers };
  }

  private cancel(entry: QueueEntry<TResult>, subscriber: Subscriber<TResult>): void {
    if (!subscriber.active) return;
    entry.subscribers.delete(subscriber);
    this.rejectSubscriber(subscriber, cancellationError());
    if (entry.state === 'queued' && entry.subscribers.size === 0) {
      if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
      return;
    }
    this.recomputePriority(entry);
  }

  private promote(entry: QueueEntry<TResult>, subscriber: Subscriber<TResult>): void {
    if (!subscriber.active || subscriber.priority === 'interactive') return;
    subscriber.priority = 'interactive';
    this.recomputePriority(entry);
    this.drain();
  }

  private rejectSubscriber(subscriber: Subscriber<TResult>, error: Error): void {
    if (!subscriber.active) return;
    subscriber.active = false;
    subscriber.reject(error);
  }

  private recomputePriority(entry: QueueEntry<TResult>): void {
    let priority: SensitiveImageRequestPriority = 'adjacent';
    for (const subscriber of entry.subscribers) {
      if (PRIORITY_RANK[subscriber.priority] < PRIORITY_RANK[priority]) {
        priority = subscriber.priority;
      }
      if (priority === 'interactive') break;
    }
    entry.priority = priority;
  }

  private nextQueuedEntry(): QueueEntry<TResult> | null {
    let next: QueueEntry<TResult> | null = null;
    for (const entry of this.entries.values()) {
      if (entry.state !== 'queued' || entry.subscribers.size === 0) continue;
      if (
        next === null ||
        PRIORITY_RANK[entry.priority] < PRIORITY_RANK[next.priority] ||
        (entry.priority === next.priority && entry.sequence < next.sequence)
      ) {
        next = entry;
      }
    }
    return next;
  }

  private drain(): void {
    while (this.active < this.maxConcurrent) {
      const entry = this.nextQueuedEntry();
      if (!entry) return;
      entry.state = 'running';
      this.active += 1;
      void this.run(entry);
    }
  }

  private async run(entry: QueueEntry<TResult>): Promise<void> {
    try {
      const value = await this.load(entry.uri);
      let ownerCurrent = false;
      try {
        ownerCurrent = this.getOwnerGeneration() === entry.ownerGeneration;
      } catch {
        ownerCurrent = false;
      }
      if (!ownerCurrent) {
        this.rejectEntry(entry, cancellationError());
        return;
      }
      this.resolveEntry(entry, value);
    } catch (error) {
      this.rejectEntry(entry, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.active -= 1;
      this.drain();
    }
  }

  private resolveEntry(entry: QueueEntry<TResult>, value: TResult): void {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    for (const subscriber of entry.subscribers) {
      if (!subscriber.active) continue;
      subscriber.active = false;
      subscriber.resolve(value);
    }
    entry.subscribers.clear();
  }

  private rejectEntry(entry: QueueEntry<TResult>, error: Error): void {
    if (this.entries.get(entry.key) === entry) this.entries.delete(entry.key);
    for (const subscriber of entry.subscribers) this.rejectSubscriber(subscriber, error);
    entry.subscribers.clear();
  }
}
