import {
  getPrivateItem,
  multiRemovePrivateItems,
  updatePrivateItem,
} from '@/lib/storage/privateKV';
import { getPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';

// Local-first Ask state (docs/13 §7/§15, the D-029 pattern). Two pieces of state, both
// offline-safe: (1) the ask_layerwell consent flag. DEFAULT-OFF, the v1 source of truth
// with a guarded ledger mirror in consent.ts; (2) a per-period counter of GROUNDED
// (cloud) turns used, to enforce the hard trial cap (gate.ts). The deterministic,
// on-device advisor needs neither. It is always free and stores nothing. No question
// or answer text is ever written here (no transcript, docs/13 §10).

const CONSENT_KEY = 'layerwell.ask.consent.v1'; // default-OFF
const TURNS_KEY = 'layerwell.ask.groundedTurns.v1'; // { period: 'YYYY-MM', count: number }
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;
const TURNS_SCHEMA_VERSION = 1 as const;

export const ASK_TURN_RECORD_INVALID = 'ASK_TURN_RECORD_INVALID';
export const ASK_TURN_RECORD_UNSUPPORTED_VERSION = 'ASK_TURN_RECORD_UNSUPPORTED_VERSION';

export async function getAskConsentLocal(): Promise<boolean> {
  return runCurrentHealthDataOperation(async (lease) => {
    const enabled = await getPrivateBoolean(CONSENT_KEY);
    lease.assertCurrent();
    return enabled;
  });
}

export async function setAskConsentLocal(enabled: boolean): Promise<void> {
  await runCurrentHealthDataOperation(async (lease) => {
    lease.assertCurrent();
    await setPrivateBoolean(CONSENT_KEY, enabled);
    lease.assertCurrent();
  });
}

type TurnRecord = { period: string; count: number };
type TurnRecordEnvelope = TurnRecord & { version: typeof TURNS_SCHEMA_VERSION };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizePeriod(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return PERIOD.test(text) ? text : null;
}

function normalizeTurnRecord(value: unknown): TurnRecord | null {
  if (!isRecord(value)) return null;
  const source = value;
  const period = normalizePeriod(source.period);
  if (!period) return null;
  const count = source.count;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  return { period, count: Math.min(count, ASK_TRIAL_GROUNDED_CAP) };
}

function decodeTurns(raw: string | null): TurnRecord | null {
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(ASK_TURN_RECORD_INVALID);
  }
  if (!isRecord(parsed)) throw new Error(ASK_TURN_RECORD_INVALID);
  if (hasOwn(parsed, 'version')) {
    if (parsed.version !== TURNS_SCHEMA_VERSION) {
      if (
        typeof parsed.version === 'number' &&
        Number.isSafeInteger(parsed.version) &&
        parsed.version > TURNS_SCHEMA_VERSION
      ) {
        throw new Error(ASK_TURN_RECORD_UNSUPPORTED_VERSION);
      }
      throw new Error(ASK_TURN_RECORD_INVALID);
    }
  }
  const normalized = normalizeTurnRecord(parsed);
  if (!normalized) throw new Error(ASK_TURN_RECORD_INVALID);
  return normalized;
}

function encodeTurns(record: TurnRecord): string {
  return JSON.stringify({ version: TURNS_SCHEMA_VERSION, ...record } satisfies TurnRecordEnvelope);
}

/** Grounded (cloud) turns used in `period` (a 'YYYY-MM' string); resets per period. */
export async function getGroundedTurns(period: string): Promise<number> {
  return runCurrentHealthDataOperation(async (lease) => {
    try {
      const currentPeriod = normalizePeriod(period);
      if (!currentPeriod) return 0;
      lease.assertCurrent();
      const raw = await getPrivateItem(TURNS_KEY);
      lease.assertCurrent();
      const rec = decodeTurns(raw);
      lease.assertCurrent();
      return rec && rec.period === currentPeriod ? rec.count : 0;
    } catch {
      // Preserve the fail-soft cost counter, but never turn a withdrawal,
      // owner switch, or same-epoch re-grant into a publishable fallback.
      lease.assertCurrent();
      return 0;
    }
  });
}

/** Increment the grounded-turn counter for `period` (resets when the period rolls over). */
export async function recordGroundedTurn(period: string): Promise<void> {
  await runCurrentHealthDataOperation(async (lease) => {
    try {
      const currentPeriod = normalizePeriod(period);
      if (!currentPeriod) return;
      lease.assertCurrent();
      await updatePrivateItem(TURNS_KEY, (current) => {
        lease.assertCurrent();
        const rec = decodeTurns(current);
        const count = rec && rec.period === currentPeriod ? rec.count + 1 : 1;
        lease.assertCurrent();
        return encodeTurns({
          period: currentPeriod,
          count: Math.min(count, ASK_TRIAL_GROUNDED_CAP),
        });
      });
      lease.assertCurrent();
    } catch {
      // The counter remains best-effort for ordinary storage failures. Health
      // authority invalidation must still escape rather than be swallowed.
      lease.assertCurrent();
    }
  });
}

/** Test/seed reset, and the deletion-on-revocation hook (no content is stored here). */
export async function clearAskStore(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, TURNS_KEY]);
}
