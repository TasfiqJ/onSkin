import { getPrivateItem, multiRemovePrivateItems, setPrivateItem } from '@/lib/storage/privateKV';

// Local-first Ask state (docs/13 §7/§15, the D-029 pattern). Two pieces of state, both
// offline-safe: (1) the ask_onskin consent flag. DEFAULT-OFF, the v1 source of truth
// with a guarded ledger mirror in consent.ts; (2) a per-period counter of GROUNDED
// (cloud) turns used, to enforce the hard trial cap (gate.ts). The deterministic,
// on-device advisor needs neither. It is always free and stores nothing. No question
// or answer text is ever written here (no transcript, docs/13 §10).

const CONSENT_KEY = 'onskin.ask.consent.v1'; // default-OFF
const TURNS_KEY = 'onskin.ask.groundedTurns.v1'; // { period: 'YYYY-MM', count: number }

export async function getAskConsentLocal(): Promise<boolean> {
  try {
    return (await getPrivateItem(CONSENT_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function setAskConsentLocal(enabled: boolean): Promise<void> {
  await setPrivateItem(CONSENT_KEY, enabled ? 'true' : 'false');
}

type TurnRecord = { period: string; count: number };

function parseTurns(raw: string | null): TurnRecord | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<TurnRecord>;
    if (typeof v.period === 'string' && typeof v.count === 'number') return { period: v.period, count: v.count };
  } catch {
    /* corrupt. Treat as empty */
  }
  return null;
}

/** Grounded (cloud) turns used in `period` (a 'YYYY-MM' string); resets per period. */
export async function getGroundedTurns(period: string): Promise<number> {
  try {
    const rec = parseTurns(await getPrivateItem(TURNS_KEY));
    return rec && rec.period === period ? rec.count : 0;
  } catch {
    return 0;
  }
}

/** Increment the grounded-turn counter for `period` (resets when the period rolls over). */
export async function recordGroundedTurn(period: string): Promise<void> {
  try {
    const rec = parseTurns(await getPrivateItem(TURNS_KEY));
    const count = rec && rec.period === period ? rec.count + 1 : 1;
    await setPrivateItem(TURNS_KEY, JSON.stringify({ period, count } satisfies TurnRecord));
  } catch {
    /* best-effort. The cap is a cost guardrail, not a hard wall */
  }
}

/** Test/seed reset, and the deletion-on-revocation hook (no content is stored here). */
export async function clearAskStore(): Promise<void> {
  await multiRemovePrivateItems([CONSENT_KEY, TURNS_KEY]);
}
