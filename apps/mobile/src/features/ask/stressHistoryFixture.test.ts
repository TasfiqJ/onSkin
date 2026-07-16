import { describe, expect, it } from 'vitest';

import type { AskAnswer } from './answer';
import {
  MAX_ASK_STRESS_HISTORY_TURNS,
  buildAskStressHistory,
  parseAskStressHistoryTurns,
} from './stressHistoryFixture';

const FIXTURE_ANSWER: AskAnswer = {
  intent: 'concern_q',
  kind: 'escalate',
  badge: 'fixture answer',
  headline: null,
  claim: 'This is a sanitized performance fixture.',
  why: null,
  how: null,
  citation: null,
  severity: null,
  severityText: null,
  note: null,
  recommendationNote: false,
  claimSafeNote: true,
  cta: null,
  footnote: null,
};

describe('Ask stress history fixture', () => {
  it.each([
    [undefined, 0],
    ['', 0],
    ['0', 0],
    ['not-a-number', 0],
    ['1.5', 0],
    ['-1', 0],
  ] as const)('parses %s as %i turns', (raw, expected) => {
    expect(parseAskStressHistoryTurns(raw)).toBe(expected);
  });

  it('accepts 100 turns and clamps larger values to the exact safe maximum', () => {
    expect(parseAskStressHistoryTurns('100')).toBe(MAX_ASK_STRESS_HISTORY_TURNS);
    expect(parseAskStressHistoryTurns('101')).toBe(MAX_ASK_STRESS_HISTORY_TURNS);
    expect(parseAskStressHistoryTurns('1000000')).toBe(MAX_ASK_STRESS_HISTORY_TURNS);
  });

  it('builds exactly 200 alternating messages with unique deterministic IDs', () => {
    const first = buildAskStressHistory(MAX_ASK_STRESS_HISTORY_TURNS, FIXTURE_ANSWER);
    const second = buildAskStressHistory(MAX_ASK_STRESS_HISTORY_TURNS, FIXTURE_ANSWER);

    expect(first).toHaveLength(200);
    expect(new Set(first.map((message) => message.id)).size).toBe(200);
    expect(second).toEqual(first);

    first.forEach((message, index) => {
      expect(message.role).toBe(index % 2 === 0 ? 'user' : 'assistant');
    });
  });

  it('uses only sanitized fixture text and preserves the supplied answer object', () => {
    const messages = buildAskStressHistory(2, FIXTURE_ANSWER);

    expect(messages[0]).toEqual({
      id: 'ask-stress-user-001',
      role: 'user',
      text: 'Performance fixture turn 001.',
    });
    expect(messages[2]).toEqual({
      id: 'ask-stress-user-002',
      role: 'user',
      text: 'Performance fixture turn 002.',
    });

    for (const message of messages) {
      if (message.role === 'assistant') {
        expect(message.answer).toBe(FIXTURE_ANSWER);
        expect(message.reported).toBe(false);
      }
    }
  });
});
