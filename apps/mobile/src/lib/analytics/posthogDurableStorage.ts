import type { PostHogCustomStorage } from 'posthog-react-native';

import {
  analyticsSchemaForEvent,
  isAllowedAnalyticsEventName,
  isAllowedAnalyticsPayloadShape,
  isAllowedAnalyticsPropKey,
  isAllowedAnalyticsPropValue,
} from '@/lib/analytics/eventRegistry';

export interface PostHogStorageBackend {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
}

export const ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED =
  'ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED';
export const POSTHOG_EVENTS_STORAGE_KEY = '.posthog-rn.json';
export const POSTHOG_LOGS_STORAGE_KEY = '.posthog-rn-logs.json';
export const POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT = 256;
export const POSTHOG_PERSISTED_QUEUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const POSTHOG_PERSISTED_STORAGE_MAX_BYTES = 1024 * 1024;

const POSTHOG_STORAGE_VERSION = 'v1';
const POSTHOG_FUTURE_CLOCK_SKEW_MS = 5 * 60 * 1_000;
const PROHIBITED_POSTHOG_EVENT_STORAGE_KEYS = [
  'bootstrap_feature_flag_details',
  'bootstrap_feature_flag_payloads',
  'bootstrap_feature_flags',
  'feature_flag_details',
  'feature_flag_payloads',
  'feature_flags',
  'flags_endpoint_was_hit',
  'group_properties',
  'override_feature_flags',
  'person_properties',
  'props',
  'remote_config',
  'session_replay',
  'session_replay_event_trigger_activated_session',
  'survey_last_seen_date',
  'surveys',
  'surveys_seen',
] as const;

type SanitizedPostHogStorage = Readonly<{ value: string; changed: boolean }>;
export type SanitizedPostHogEventQueue = Readonly<{
  queue: readonly unknown[];
  changed: boolean;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function utf8Bytes(value: string): number {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && index + 1 < value.length) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else bytes += 3;
    } else bytes += 3;
    if (bytes > POSTHOG_PERSISTED_STORAGE_MAX_BYTES) return bytes;
  }
  return bytes;
}

function emptyPostHogStorage(queueKey: 'logs_queue' | 'queue'): string {
  return JSON.stringify({
    version: POSTHOG_STORAGE_VERSION,
    content: { [queueKey]: [], ...(queueKey === 'queue' ? { opted_out: true } : {}) },
  });
}

function isSafePostHogIdentifier(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (/^u_[0-9a-f]{32}$/.test(value) ||
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        value,
      ))
  );
}

function isSafePostHogMetadataProperty(key: string, value: unknown): boolean {
  switch (key) {
    case '$anon_distinct_id':
    case '$session_id':
      return isSafePostHogIdentifier(value);
    case '$app_build':
      return typeof value === 'string' && /^(?:dev|\d{1,18}(?:\.\d{1,18}){0,2})$/.test(value);
    case '$app_version':
      return (
        typeof value === 'string' &&
        /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][A-Za-z0-9.-]{1,32})?$/.test(value)
      );
    case '$device_type':
      return value === 'Mobile' || value === 'Desktop' || value === 'Tablet' || value === 'Unknown';
    case '$geoip_disable':
      return value === true;
    case '$is_emulator':
    case '$is_identified':
    case '$process_person_profile':
      return typeof value === 'boolean';
    case '$lib':
      return value === 'posthog-react-native';
    case '$lib_version':
      return typeof value === 'string' && /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(value);
    case '$os_name':
      return value === 'Android' || value === 'iOS' || value === 'macOS' || value === 'Web';
    case '$os_version':
      return typeof value === 'string' && /^\d{1,4}(?:\.\d{1,4}){0,3}$/.test(value);
    case '$screen_height':
    case '$screen_width':
      return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000;
    default:
      return false;
  }
}

function validPersistedMessageProperties(event: string, value: unknown): boolean {
  if (
    !isRecord(value) ||
    (event !== '$identify' && !isAllowedAnalyticsEventName(event))
  ) {
    return false;
  }

  const appProperties: Record<string, string | number | boolean | null> = {};
  let hasAnonymousIdentity = false;
  try {
    for (const [key, candidate] of Object.entries(value)) {
      if (key.startsWith('$')) {
        if (!isSafePostHogMetadataProperty(key, candidate)) return false;
        if (key === '$anon_distinct_id') hasAnonymousIdentity = true;
        continue;
      }
      if (event === '$identify' || !isAllowedAnalyticsPropKey(key)) return false;
      const schema = analyticsSchemaForEvent(event);
      const rule = schema[key];
      if (!rule || !isAllowedAnalyticsPropValue(rule, candidate)) return false;
      appProperties[key] = candidate as string | number | boolean | null;
    }
  } catch {
    return false;
  }

  if (event === '$identify') return hasAnonymousIdentity && Object.keys(appProperties).length === 0;
  return isAllowedAnalyticsPayloadShape(event, appProperties);
}

const SAFE_POSTHOG_APP_PROPERTY_KEYS = [
  '$app_build',
  '$app_version',
  '$device_type',
  '$is_emulator',
  '$os_name',
  '$os_version',
] as const;

export function sanitizePostHogAppProperties(
  value: unknown,
): Record<string, string | boolean> {
  if (!isRecord(value)) return {};
  const sanitized: Record<string, string | boolean> = {};
  for (const key of SAFE_POSTHOG_APP_PROPERTY_KEYS) {
    const candidate = value[key];
    if (isSafePostHogMetadataProperty(key, candidate)) {
      sanitized[key] = candidate as string | boolean;
    }
  }
  return sanitized;
}

function validEventQueueRow(value: unknown, nowMs: number): boolean {
  try {
    if (!isRecord(value) || Object.keys(value).length !== 1 || !isRecord(value.message)) {
      return false;
    }
    const message = value.message;
    if (
      Object.keys(message).length !== 5 ||
      typeof message.event !== 'string' ||
      (!isAllowedAnalyticsEventName(message.event) && message.event !== '$identify') ||
      !isSafePostHogIdentifier(message.distinct_id) ||
      !isSafePostHogIdentifier(message.uuid) ||
      typeof message.timestamp !== 'string' ||
      !validPersistedMessageProperties(message.event, message.properties)
    ) {
      return false;
    }
    const timestamp = Date.parse(message.timestamp);
    return (
      Number.isFinite(timestamp) &&
      timestamp >= nowMs - POSTHOG_PERSISTED_QUEUE_MAX_AGE_MS &&
      timestamp <= nowMs + POSTHOG_FUTURE_CLOCK_SKEW_MS
    );
  } catch {
    return false;
  }
}

export function sanitizePostHogEventQueue(
  value: unknown,
  nowMs: number,
): SanitizedPostHogEventQueue {
  if (!Array.isArray(value) || !Number.isFinite(nowMs)) return { queue: [], changed: true };
  try {
    const queue = value
      .filter((candidate) => validEventQueueRow(candidate, nowMs))
      .slice(-POSTHOG_PERSISTED_EVENT_QUEUE_LIMIT);
    return { queue, changed: queue.length !== value.length };
  } catch {
    return { queue: [], changed: true };
  }
}

/**
 * Applies the local telemetry retention contract before the SDK can preload or
 * persist a queue. Unknown/corrupt/future storage fails closed to an empty
 * queue, logs are prohibited, and valid events retain FIFO order while old or
 * excess rows are removed.
 */
export function sanitizePersistedPostHogStorage(
  key: string,
  value: string,
  nowMs: number,
): SanitizedPostHogStorage {
  if (key !== POSTHOG_EVENTS_STORAGE_KEY && key !== POSTHOG_LOGS_STORAGE_KEY) {
    return { value, changed: false };
  }
  const queueKey = key === POSTHOG_EVENTS_STORAGE_KEY ? 'queue' : 'logs_queue';
  const empty = emptyPostHogStorage(queueKey);
  if (!Number.isFinite(nowMs) || utf8Bytes(value) > POSTHOG_PERSISTED_STORAGE_MAX_BYTES) {
    return { value: empty, changed: value !== empty };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return { value: empty, changed: value !== empty };
  }
  if (
    !isRecord(parsed) ||
    parsed.version !== POSTHOG_STORAGE_VERSION ||
    !isRecord(parsed.content)
  ) {
    return { value: empty, changed: value !== empty };
  }

  const content = { ...parsed.content };
  const crossFileQueueKey = queueKey === 'queue' ? 'logs_queue' : 'queue';
  delete content[crossFileQueueKey];
  if (queueKey === 'queue') {
    for (const prohibitedKey of PROHIBITED_POSTHOG_EVENT_STORAGE_KEYS) {
      delete content[prohibitedKey];
    }
  }
  const retained =
    queueKey === 'logs_queue'
      ? []
      : sanitizePostHogEventQueue(parsed.content[queueKey], nowMs).queue;
  const sanitized = JSON.stringify({
    ...parsed,
    content: { ...content, [queueKey]: retained },
  });
  return { value: sanitized, changed: sanitized !== value };
}

async function loadPlatformStorageBackend(): Promise<PostHogStorageBackend> {
  const { Platform } = await import('react-native');

  // This mirrors the public storage choices used by posthog-react-native: the
  // Expo document directory on native mobile and AsyncStorage elsewhere. Using
  // the same key and backend lets the adapter drain queues written before this
  // deletion barrier was introduced.
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    const { File, Paths } = await import('expo-file-system');
    return {
      async getItem(key) {
        try {
          return await new File(Paths.document, key).text();
        } catch {
          return null;
        }
      },
      async setItem(key, value) {
        await new File(Paths.document, key).write(value);
      },
    };
  }

  const { default: AsyncStorage } = await import('@react-native-async-storage/async-storage');
  return AsyncStorage;
}

let platformStorageBackendPromise: Promise<PostHogStorageBackend> | null = null;

function getPlatformStorageBackend(): Promise<PostHogStorageBackend> {
  platformStorageBackendPromise ??= loadPlatformStorageBackend();
  return platformStorageBackendPromise;
}

const platformStorageBackend: PostHogStorageBackend = {
  async getItem(key) {
    return (await getPlatformStorageBackend()).getItem(key);
  },
  async setItem(key, value) {
    await (await getPlatformStorageBackend()).setItem(key, value);
  },
};

/**
 * A supported PostHog custom-storage adapter with two deletion guarantees:
 *
 * 1. Once deletion starts, even a storage read already in flight resolves as
 *    absent, so an async SDK preload cannot put owner-A queues back in memory.
 * 2. Writes are serialized and can be durably drained. Once sealed, late SDK
 *    callbacks cannot recreate telemetry after the deletion barrier resolves.
 */
export class DeletionAwarePostHogStorage implements PostHogCustomStorage {
  private deletionFrozen = false;
  private sealed = false;
  private writeTail: Promise<void> = Promise.resolve();
  private criticalWriteFailure: unknown;
  private readonly observedKeys = new Set<string>();
  private readonly criticalExpectedWrites = new Map<string, string>();

  constructor(
    private readonly backend: PostHogStorageBackend = platformStorageBackend,
    private readonly now: () => number = Date.now,
  ) {}

  getItem(key: string): string | null | Promise<string | null> {
    this.observedKeys.add(key);
    if (this.deletionFrozen) return null;
    const read = this.writeTail.catch(() => undefined).then(async () => {
      const value = await this.backend.getItem(key);
      if (this.deletionFrozen || value === null) return null;
      const sanitized = sanitizePersistedPostHogStorage(key, value, this.now());
      if (sanitized.changed) await this.backend.setItem(key, sanitized.value);
      return this.deletionFrozen ? null : sanitized.value;
    });
    this.writeTail = read.then(
      () => undefined,
      () => undefined,
    );
    return read;
  }

  setItem(key: string, value: string): void | Promise<void> {
    if (this.sealed) return;

    const sanitized = sanitizePersistedPostHogStorage(key, value, this.now()).value;
    const criticalWrite = this.deletionFrozen;
    if (criticalWrite) this.criticalExpectedWrites.set(key, sanitized);
    const write = this.writeTail
      .catch(() => undefined)
      .then(() => this.backend.setItem(key, sanitized));
    this.writeTail = Promise.resolve(write);

    if (criticalWrite) {
      void this.writeTail.catch((error: unknown) => {
        this.criticalWriteFailure ??= error;
      });
    }

    return this.writeTail;
  }

  beginDeletionFreeze(): void {
    this.deletionFrozen = true;
    this.sealed = false;
    this.criticalWriteFailure = undefined;
    this.criticalExpectedWrites.clear();
  }

  seal(): void {
    this.sealed = true;
  }

  isSealed(): boolean {
    return this.sealed;
  }

  async drain(): Promise<void> {
    await this.writeTail.catch(() => undefined);
    if (this.criticalWriteFailure !== undefined) throw this.criticalWriteFailure;
    if (this.criticalExpectedWrites.size === 0) {
      throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
    }
    for (const key of this.observedKeys) {
      if (!this.criticalExpectedWrites.has(key)) {
        throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
      }
    }
    for (const [key, expected] of this.criticalExpectedWrites) {
      if ((await this.backend.getItem(key)) !== expected) {
        throw new Error(ACCOUNT_DELETION_ANALYTICS_STORAGE_UNVERIFIED);
      }
    }
  }
}

export function createDeletionAwarePostHogStorage(): DeletionAwarePostHogStorage {
  return new DeletionAwarePostHogStorage();
}
