import {
  getPrivateItem,
  multiRemovePrivateItems,
  removePrivateItem,
  setPrivateItem,
} from '@/lib/storage/privateKV';
import { getPrivateBoolean, setPrivateBoolean } from '@/lib/storage/privateBoolean';

import { ASK_TRIAL_GROUNDED_CAP } from './gate';

// Local-first Ask state (docs/13 §7/§15, the D-029 pattern). Two pieces of state, both
// offline-safe: (1) the ask_onskin consent flag. DEFAULT-OFF, the v1 source of truth
// with a guarded ledger mirror in consent.ts; (2) a per-period counter of GROUNDED
// (cloud) turns used, to enforce the hard trial cap (gate.ts). The deterministic,
// on-device advisor needs neither. It is always free and stores nothing. No question
// or answer text is ever written here (no transcript, docs/13 §10).

const CONSENT_KEY = 'onskin.ask.consent.v1'; // default-OFF
const TURNS_KEY = 'onskin.ask.groundedTurns.v1'; // { period: 'YYYY-MM', count: number }
const PERIOD = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function getAskConsentLocal(): Promise<boolean> {
  return getPrivateBoolean(CONSENT_KEY);
}

export async function setAskConsentLocal(enabled: boolean): Promise<void> {
  await setPrivateBoolean(CONSENT_KEY, enabled);
}

type TurnRecord = { period: string; count: number };

function normalizePeriod(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return PERIOD.test(text) ? text : null;
}

function normalizeTurnRecord(value: unknown): TurnRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const period = normalizePeriod(source.period);
  if (!period) return null;
  const count = source.count;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) return null;
  return { period, count: Math.min(count, ASK_TRIAL_GROUNDED_CAP) };
}

async function parseTurns(raw: string | null): Promise<TurnRecord | null> {
  if (!raw) return null;
  try {
    const normalized = normalizeTurnRecord(JSON.parse(raw) as unknown);
    if (!normalized) {
      await removePrivateItem(TURNS_KEY).catch(() => undefined);
      return null;
    }
    if (JSON.stringify(normalized) !== raw) {
      await setPrivateItem(TURNS_KEY, JSON.stringify(normalized)).catch(() => undefined);
    }
    return normalized;
  } catch {
    await removePrivateItem(TURNS_KEY).catch(() => undefined);
  }
  return null;
}

/** Grounded (cloud) turns used in `period` (a 'YYYY-MM' string); resets per period. */
export async function getGroundedTurns(period: string): Promise<number> {
  try {
    const currentPeriod = normalizePeriod(period);
    if (!currentPeriod) return 0;
    const rec = await parseTurns(await getPrivateItem(TURNS_KEY));
    return rec && rec.period === currentPeriod ? rec.count : 0;
  } catch {
    return 0;
  }
}

/** Increment the grounded-turn counter for `period` (resets when the period rolls over). */
export async function recordGroundedTurn(period: string): Promise<void> {
  try {
    const currentPeriod = normalizePeriod(period);
    if (!currentPeriod) return;
    const rec = await parseTurns(await getPrivateItem(TURNS_KEY));
    const count = rec && rec.period === currentPeriod ? rec.count + 1 : 1;
    await setPrivateItem(
      TURNS_KEY,
      JSON.stringify({
        period: currentPeriod,
        count: Math.min(count, ASK_TRIAL_GROUNDED_CAP),
      } satisfies TurnRecord),
    );
  } catch {
    /* best-effort. The cap is a cost guardrail, not a hard wall */
  }
}

/** Test/seed reset, and the deletion-on-revocation hook (no content is stored here). */
export async function clearAskStore(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, TURNS_KEY]);
}
