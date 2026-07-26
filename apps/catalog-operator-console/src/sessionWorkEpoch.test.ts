import { describe, expect, it } from 'vitest';

import { SessionWorkEpoch } from './sessionWorkEpoch';

describe('SessionWorkEpoch', () => {
  it('invalidates every captured operation when the session ends', () => {
    const epochs = new SessionWorkEpoch();
    const active = epochs.begin();

    expect(epochs.isCurrent(active)).toBe(true);
    epochs.invalidate();
    expect(epochs.isCurrent(active)).toBe(false);
  });

  it('keeps late work from an old session out of a replacement session', () => {
    const epochs = new SessionWorkEpoch();
    const firstSession = epochs.begin();
    epochs.invalidate();
    const replacementSession = epochs.begin();

    expect(epochs.isCurrent(firstSession)).toBe(false);
    expect(epochs.isCurrent(replacementSession)).toBe(true);
    expect(epochs.capture()).toBe(replacementSession);
  });
});
