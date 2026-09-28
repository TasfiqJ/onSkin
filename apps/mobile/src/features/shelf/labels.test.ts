import { describe, expect, it } from 'vitest';

import { expirySourceLabel, paoSourceLabel } from './labels';

describe('Shelf freshness provenance labels', () => {
  it('distinguishes reviewed PAO sources, category estimates, and genuine unknowns', () => {
    expect(paoSourceLabel('label')).toBe('from label');
    expect(paoSourceLabel('catalog')).toBe('from catalog');
    expect(paoSourceLabel('category_default')).toBe('legacy category estimate');
    expect(paoSourceLabel('unknown')).toBe('PAO unknown');
  });

  it('distinguishes printed/computed dates, category estimates, and genuine unknowns', () => {
    expect(expirySourceLabel('printed')).toBe('recorded package date');
    expect(expirySourceLabel('pao_computed')).toBe('opened date + PAO');
    expect(expirySourceLabel('estimated')).toBe('legacy category estimate');
    expect(expirySourceLabel('unknown')).toBe('Date unknown');
  });
});
