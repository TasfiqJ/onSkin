import { updatePrivateItem } from '@/lib/storage/privateKV';

import { loadEntitlement } from './store';

/**
 * The reverse-trial / paid expiry -> re-offer / graceful-downgrade trigger.
 * A route is returned only after an atomic durable reservation for the exact
 * expiry succeeds, so concurrent mounts cannot present the prompt twice.
 */
const PROMPT_KEY = 'layerwell.subscription.promptedExpiry';
const SCHEMA_VERSION = 1 as const;

export const SUBSCRIPTION_PROMPT_INVALID = 'SUBSCRIPTION_PROMPT_INVALID';
export const SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION = 'SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION';

type PromptedExpiryEnvelope = {
  version: typeof SCHEMA_VERSION;
  expiresAt: string;
};

export type LifecycleRoute = '/paywall/reoffer' | '/paywall/downgrade';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validISO(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) return null;
  return Number.isFinite(Date.parse(value)) ? value : null;
}

function decodePromptedExpiry(raw: string | null): string | null {
  if (raw === null) return null;

  // Pre-envelope values were stored as the ISO string itself.
  if (!raw.startsWith('{')) {
    const legacy = validISO(raw);
    if (!legacy) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
    return legacy;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  if (
    typeof parsed.version === 'number' &&
    Number.isSafeInteger(parsed.version) &&
    parsed.version > SCHEMA_VERSION
  ) {
    throw new Error(SUBSCRIPTION_PROMPT_UNSUPPORTED_VERSION);
  }
  if (
    parsed.version !== SCHEMA_VERSION ||
    Object.keys(parsed).length !== 2 ||
    !Object.prototype.hasOwnProperty.call(parsed, 'expiresAt')
  ) {
    throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  }
  const expiresAt = validISO(parsed.expiresAt);
  if (!expiresAt) throw new Error(SUBSCRIPTION_PROMPT_INVALID);
  return expiresAt;
}

function encodePromptedExpiry(expiresAt: string): string {
  return JSON.stringify({
    version: SCHEMA_VERSION,
    expiresAt,
  } satisfies PromptedExpiryEnvelope);
}

/** Returns a route only when this caller atomically reserves the lapsed expiry. */
export async function pendingLifecycleRoute(nowISO: string): Promise<LifecycleRoute | null> {
  const now = Date.parse(nowISO);
  if (!Number.isFinite(now)) return null;

  const entitlement = await loadEntitlement();
  if (!entitlement?.tier || !entitlement.expiresAt) return null;
  const expiry = Date.parse(entitlement.expiresAt);
  if (!Number.isFinite(expiry)) return null;
  const lapsed = !entitlement.isActive || expiry <= now;
  if (!lapsed) return null;

  let reserved = false;
  try {
    await updatePrivateItem(PROMPT_KEY, (raw) => {
      const promptedExpiry = decodePromptedExpiry(raw);
      if (promptedExpiry === entitlement.expiresAt) return raw;
      reserved = true;
      return encodePromptedExpiry(entitlement.expiresAt!);
    });
  } catch {
    return null;
  }
  if (!reserved) return null;
  return entitlement.periodType === 'reverse_trial' ? '/paywall/reoffer' : '/paywall/downgrade';
}
