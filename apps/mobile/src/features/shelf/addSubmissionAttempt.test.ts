import { describe, expect, it, vi } from 'vitest';

import { beginShelfAddSubmissionAttempt } from './addSubmissionAttempt';

describe('Shelf add mounted submission attempt', () => {
  it('freezes the token and timestamp-sensitive payload across a midnight retry', () => {
    const createInput = vi
      .fn()
      .mockReturnValueOnce({
        name: 'Night serum',
        openedAt: '2026-07-15',
        isOpened: true,
        sourceDisclosureAckAt: '2026-07-15T23:59:59.900Z',
        addedVia: 'manual' as const,
      })
      .mockReturnValueOnce({
        name: 'Night serum',
        openedAt: '2026-07-16',
        isOpened: true,
        sourceDisclosureAckAt: '2026-07-16T00:00:00.100Z',
        addedVia: 'manual' as const,
      });

    const first = beginShelfAddSubmissionAttempt(null, 'intake-operation-1', createInput);
    const retry = beginShelfAddSubmissionAttempt(first, 'intake-operation-2', createInput);

    expect(retry).toBe(first);
    expect(retry.operationId).toBe('intake-operation-1');
    expect(retry.input).toMatchObject({
      openedAt: '2026-07-15',
      sourceDisclosureAckAt: '2026-07-15T23:59:59.900Z',
    });
    expect(createInput).toHaveBeenCalledOnce();
  });
});
