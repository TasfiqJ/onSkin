import type { AskAnswer } from './answer';

export const MAX_ASK_STRESS_HISTORY_TURNS = 100;

export type AskStressHistoryMessage =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; answer: AskAnswer; reported: boolean };

/**
 * Parses the development-only Ask history fixture size. Callers remain responsible
 * for checking `__DEV__` before exposing the fixture to the route.
 */
export function parseAskStressHistoryTurns(raw: string | undefined): number {
  if (raw === undefined) return 0;

  const turns = Number(raw);
  if (!Number.isFinite(turns) || !Number.isInteger(turns) || turns <= 0) return 0;

  return Math.min(turns, MAX_ASK_STRESS_HISTORY_TURNS);
}

/** Builds sanitized, deterministic user/assistant pairs for Ask list profiling. */
export function buildAskStressHistory(turns: number, answer: AskAnswer): AskStressHistoryMessage[] {
  const safeTurns =
    Number.isFinite(turns) && Number.isInteger(turns) && turns > 0
      ? Math.min(turns, MAX_ASK_STRESS_HISTORY_TURNS)
      : 0;
  const messages: AskStressHistoryMessage[] = [];

  for (let turn = 1; turn <= safeTurns; turn += 1) {
    const stableTurn = String(turn).padStart(3, '0');
    messages.push(
      {
        id: `ask-stress-user-${stableTurn}`,
        role: 'user',
        text: `Performance fixture turn ${stableTurn}.`,
      },
      {
        id: `ask-stress-assistant-${stableTurn}`,
        role: 'assistant',
        answer,
        reported: false,
      },
    );
  }

  return messages;
}
