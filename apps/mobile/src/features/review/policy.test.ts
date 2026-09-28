import { describe, expect, it } from 'vitest';

import { canRequestReviewPrompt, recordReviewAttempt, type ReviewPromptState } from './policy';

const now = new Date('2026-07-04T12:00:00.000Z');
const appVersion = '1.4.0';
const emptyState: ReviewPromptState = { attemptedAt: [], lastVersionPrompted: null };

describe('Phase 8 review prompt policy', () => {
  it('does nothing while the launch gate is disabled', () => {
    expect(
      canRequestReviewPrompt({
        enabled: false,
        moment: 'seven_checkoff_days',
        appVersion,
        state: emptyState,
        now,
      }),
    ).toEqual({ ok: false, reason: 'disabled' });
  });

  it('allows a satisfaction-timed value moment', () => {
    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'first_reviewed_conflict',
        appVersion,
        state: emptyState,
        now,
      }),
    ).toEqual({ ok: true });
  });

  it('does not prompt after privacy or payment moments', () => {
    for (const moment of ['data_export_success', 'paid_conversion_success'] as const) {
      expect(
        canRequestReviewPrompt({
          enabled: true,
          moment,
          appVersion,
          state: emptyState,
          now,
        }),
      ).toEqual({ ok: false, reason: 'not_value_moment' });
    }
  });

  it('enforces a 30-day cooldown', () => {
    const state: ReviewPromptState = {
      attemptedAt: ['2026-06-20T12:00:00.000Z'],
      lastVersionPrompted: '1.3.0',
    };

    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'seven_checkoff_days',
        appVersion,
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
      lastVersionPrompted: '1.3.0',
    };

    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'first_reviewed_conflict',
        appVersion,
        state,
        now,
      }),
    ).toEqual({ ok: false, reason: 'annual_cap' });
  });

  it('fails closed without an exact installed app version', () => {
    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'seven_checkoff_days',
        appVersion: null,
        state: emptyState,
        now,
      }),
    ).toEqual({ ok: false, reason: 'version_unavailable' });
  });

  it('never asks twice for the same installed app version', () => {
    expect(
      canRequestReviewPrompt({
        enabled: true,
        moment: 'seven_checkoff_days',
        appVersion,
        state: { attemptedAt: ['2026-05-01T12:00:00.000Z'], lastVersionPrompted: appVersion },
        now,
      }),
    ).toEqual({ ok: false, reason: 'already_prompted_for_version' });
  });

  it('records attempts while trimming stale annual-window history', () => {
    expect(
      recordReviewAttempt(
        {
          attemptedAt: ['2024-01-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'],
          lastVersionPrompted: '1.3.0',
        },
        appVersion,
        now,
      ),
    ).toEqual({
      attemptedAt: ['2026-06-01T00:00:00.000Z', '2026-07-04T12:00:00.000Z'],
      lastVersionPrompted: appVersion,
    });
  });
});
