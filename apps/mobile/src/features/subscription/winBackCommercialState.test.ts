import { describe, expect, it } from 'vitest';

import {
  IOS_WIN_BACK_COMMERCIAL_STATE,
  resolveIosWinBackEnabled,
} from './winBackCommercialState';

describe('iOS win-back commercial state', () => {
  it('keeps the reviewed launch source authority at no offer', () => {
    expect(IOS_WIN_BACK_COMMERCIAL_STATE).toBe('no_offer');
    expect(resolveIosWinBackEnabled(true)).toBe(false);
  });

  it('requires both the explicit public flag and source authority', () => {
    expect(resolveIosWinBackEnabled(false, 'no_offer')).toBe(false);
    expect(resolveIosWinBackEnabled(true, 'no_offer')).toBe(false);
    expect(resolveIosWinBackEnabled(false, 'native_offer_enabled')).toBe(false);
    expect(resolveIosWinBackEnabled(true, 'native_offer_enabled')).toBe(true);
  });
});
