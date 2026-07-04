import { describe, expect, it } from 'vitest';

import {
  canRequestReviewPrompt,
  recordReviewAttempt,
  type ReviewPromptState,
} from './policy';

const now = new Date('2026-07-04T12:00:00.000Z');

describe('Phase 8 review prompt policy', () => {
  it('does nothing while the launch gate is disabled', () => {
    expect(
      canRequestReviewPrompt({
        enabled: false,
        moment: 'seven_checkoff_days',
        state: { attemptedAt: [] },
        now,
      }),
    ).toEqual({ ok: false, reason: 'disabled' });
  });

  it('allows a satisfaction-timed value moment', () => {
    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'data_export_success',
        state: { attemptedAt: [] },
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('enforces a 30-day cooldown', () => {
    const state: ReviewPromptState = {
      attemptedAt: ['2026-06-20T12:00:00.000Z'],
    };

    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'seven_checkoff_days',
        state,
        now,
      }),
    ).toEqual({ ok: false, reason: 'cooldown' });
  });

  it('enforces an annual cap', () => {
    const state: ReviewPromptState = {
      attemptedAt: [
        '2025-08-01T12:00:00.000Z',
        '2025-10-01T12:00:00.000Z',
        '2026-01-01T12:00:00.000Z',
      ],
    };

    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'data_export_success',
        state,
        now,
      }),
    ).toEqual({ ok: false, reason: 'annual_cap' });
  });

  it('records attempts while trimming stale annual-window history', () => {
    expect(
      recordReviewAttempt(
        {
          attemptedAt: ['2024-01-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'],
        },
        now,
      ),
    ).toEqual({
      attemptedAt: ['2026-06-01T00:00:00.000Z', '2026-07-04T12:00:00.000Z'],
    });
  });
});
