import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  contentHash38, createFormulaVersion38, FORMULA38_INVALID,
  safeText38, validateFormulaVersion38, validateObservation38,
  type FormulaObservation38,
} from './formulaVersion38';

const observed: FormulaObservation38 = {
  confirmation: 'confirm_label', labelText: 'Aqua, Glycerin\n油, 🌿', market: 'Canada',
  variant: 'Unscented', observedOn: '2026-10-30',
};
const at = '2026-11-01T12:00:00.000Z';

describe('formula observation38 provenance and deterministic hashes', () => {
  it.each(['', 'abc', 'Aqua, Glycerin\n油, 🌿', 'a'.repeat(10000)])('matches independent Node SHA-256 of canonical JSON: %s', (text) => {
    expect(contentHash38(text)).toBe(createHash('sha256').update(JSON.stringify(text), 'utf8').digest('hex'));
  });

  it('sorts canonical object keys and matches an independently specified vector', () => {
    expect(contentHash38({ z: ['oil', null], a: '水' })).toBe(createHash('sha256').update('{"a":"水","z":["oil",null]}').digest('hex'));
    expect(contentHash38({ z: 2, a: 1 })).toBe(contentHash38({ a: 1, z: 2 }));
  });

  it('keeps as-printed bytes, accepts ordinary Unicode and never parses ingredients', () => {
    const version = createFormulaVersion38(observed, 'owner-a', 'bottle-a', null, at);
    expect(version.labelText).toBe(observed.labelText);
    expect(version.labelStatus).toBe('user_confirmed_label');
    expect(version.sourceRights).toBe('owner_private_observation');
    expect(version.actor).toBe('owner');
    expect(version.id).toBe(`formula38:${version.contentHash}`);
    expect(Object.keys(version)).not.toEqual(expect.arrayContaining(['concentration', 'score', 'efficacy', 'safety']));
    expect(createFormulaVersion38(observed, 'owner-a', 'bottle-a', null, at)).toEqual(version);
    expect(() => validateFormulaVersion38(version)).not.toThrow();
    expect(Object.isFrozen(version)).toBe(true);
  });

  it('retains a deliberately unknown label without inventing a date or formula', () => {
    const unknown = createFormulaVersion38({ confirmation: 'retain_unknown', labelText: null, market: null, variant: null, observedOn: null }, 'owner-a', 'bottle-a', null, at);
    expect(unknown).toMatchObject({ labelStatus: 'unknown', labelText: null, observedOn: null, basis: 'unavailable' });
  });

  it.each([
    { confirmation: undefined }, { confirmation: 'parser_confirmed' }, { labelText: '' },
    { labelText: 'a'.repeat(8001) }, { labelText: '\u0000Aqua' }, { labelText: '\u202eAqua' },
    { labelText: 'Aqua\u200b' }, { labelText: '\ud800' }, { labelText: 'Aqua\u0085' },
    { market: 'Canada\nUS' }, { market: ' Canada' }, { market: 'a'.repeat(81) },
    { variant: 'x'.repeat(161) }, { observedOn: '2026-02-30' }, { observedOn: null },
    { confirmation: 'retain_unknown', labelText: 'Aqua' },
  ])('refuses unsafe/malformed observation %j', (patch) => {
    expect(() => validateObservation38({ ...observed, ...patch } as FormulaObservation38)).toThrow(FORMULA38_INVALID);
  });

  it('refuses a future observation and tampered/foreign content, even with hash-shaped IDs', () => {
    expect(() => validateObservation38(observed, '2026-10-29')).toThrow(FORMULA38_INVALID);
    const version = createFormulaVersion38(observed, 'owner-a', 'bottle-a', null, at);
    for (const patch of [{ labelText: 'Oil' }, { market: 'US' }, { ownerUserId: 'owner-b' }, { contentHash: '0'.repeat(64) }, { labelStatus: 'scientifically_verified' }, { sourceRights: 'catalog_reviewed' }, { efficacy: true }]) {
      expect(() => validateFormulaVersion38({ ...version, ...patch } as typeof version)).toThrow(FORMULA38_INVALID);
    }
  });

  it('makes identities different across bottles, owners, observations and prior versions', () => {
    const original = createFormulaVersion38(observed, 'owner-a', 'bottle-a', null, at);
    const others = [
      createFormulaVersion38(observed, 'owner-b', 'bottle-a', null, at),
      createFormulaVersion38(observed, 'owner-a', 'bottle-b', null, at),
      createFormulaVersion38({ ...observed, variant: 'Fragranced' }, 'owner-a', 'bottle-a', null, at),
      createFormulaVersion38(observed, 'owner-a', 'bottle-a', original.id, at),
    ];
    expect(new Set([original.id, ...others.map((version) => version.id)]).size).toBe(5);
    expect(safeText38('🌿', 2)).toBe(true);
  });
});
