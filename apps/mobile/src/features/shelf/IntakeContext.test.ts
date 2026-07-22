import { describe, expect, it } from 'vitest';

import {
  clearIntakeSessionIfCurrent,
  createIntakeDraft,
  isCurrentIntakeSession,
} from './intakeSession';

describe('intake session state integrity', () => {
  it('accepts only the exact scalar token for the active session', () => {
    expect(isCurrentIntakeSession('session-a', 'session-a')).toBe(true);
    expect(isCurrentIntakeSession('session-a', 'session-b')).toBe(false);
    expect(isCurrentIntakeSession('session-a', undefined)).toBe(false);
    expect(isCurrentIntakeSession('session-a', null)).toBe(false);
    expect(isCurrentIntakeSession(null, null)).toBe(false);
    expect(isCurrentIntakeSession('session-a', ['session-a'] as unknown as string)).toBe(false);
  });

  it('creates an exact independent draft instead of retaining prior provenance', () => {
    const ingredients = ['  water  ', '', 'glycerin'];
    const draft = createIntakeDraft({
      name: 'Manual cleanser',
      addedVia: 'manual',
      ingredients,
    });

    expect(draft).toMatchObject({
      name: 'Manual cleanser',
      addedVia: 'manual',
      ingredients: ['water', 'glycerin'],
      barcode: null,
      catalogProductId: null,
      catalogSourceId: null,
      catalogSource: null,
      catalogSourceName: null,
      catalogSourceRef: null,
      catalogSourceUrl: null,
      catalogSourceSnapshotDate: null,
      sourceDisclosureAckAt: null,
      catalogRecoveryToken: null,
      paoMonths: null,
      paoSource: 'unknown',
      expiryDate: null,
    });
    expect(draft.ingredients).not.toBe(ingredients);

    ingredients.push('retinol');
    expect(draft.ingredients).toEqual(['water', 'glycerin']);
    expect(createIntakeDraft({ ingredients: undefined }).ingredients).toEqual([]);
  });

  it('cannot let an old async completion clear a newer intake session', () => {
    const newer = {
      draft: createIntakeDraft({ name: 'New session product' }),
      sessionId: 'session-new',
    };

    expect(clearIntakeSessionIfCurrent(newer, 'session-old')).toBe(newer);
    expect(clearIntakeSessionIfCurrent(newer, 'session-new')).toEqual({
      draft: createIntakeDraft(),
      sessionId: null,
    });
  });
});
