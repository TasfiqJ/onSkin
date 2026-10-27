import { describe, expect, it } from 'vitest';
import { manualCompare20, chooseManualCompare20 } from './manualCompare20';
import type { PhotoMeta } from './timeline';

const photo = (id: string, day = '2026-10-01'): PhotoMeta => ({
  id,
  takenLocalDate: day,
  series: 'front',
  localUri: null,
  timeOfDay: null,
  isReference: false,
  referencePhotoId: null,
  notes: null,
  alignmentScore: null,
  lightingScore: null,
});
const photos = [photo('a', '2026-04-01'), photo('b', '2026-05-12'), photo('c', '2026-06-24')];

describe('Campaign20 current metadata pair policy', () => {
  it.each([0, 1, 2, 3, 20])(
    'handles %i current captures without inventing a second record',
    (count) => {
      const source = Array.from({ length: count }, (_, index) => photo(String(index)));
      const result = manualCompare20(source);
      expect(result.status).toBe(count === 0 ? 'empty' : count === 1 ? 'sparse' : 'ready');
      if (result.status === 'ready') {
        expect(result.before.id).not.toBe(result.after.id);
        expect(source).toContain(result.before);
        expect(source).toContain(result.after);
      }
    },
  );
  it('rejects equal selected IDs and equal-to-default attempts in either position', () => {
    expect(manualCompare20(photos, { beforeId: 'a', afterId: 'a' }).status).toBe('missing');
    expect(manualCompare20(photos, { beforeId: 'c' }).status).toBe('missing');
    expect(manualCompare20(photos, { afterId: 'a' }).status).toBe('missing');
    expect(chooseManualCompare20(photos, {}, 'before', 'c')).toBeNull();
    expect(chooseManualCompare20(photos, {}, 'after', 'a')).toBeNull();
  });
  it('retains valid choices, uses current objects, and sorts different days chronologically', () => {
    const pick = chooseManualCompare20(photos, {}, 'before', 'b')!;
    expect(pick).toEqual({ beforeId: 'b', afterId: 'c' });
    const replacement = photos.map((item) => ({ ...item, localUri: 'synthetic-current' }));
    const result = manualCompare20(replacement, { beforeId: 'c', afterId: 'b' });
    expect(result).toEqual({
      status: 'ready',
      before: replacement[1],
      after: replacement[2],
      sameDay: false,
    });
    expect(result.status === 'ready' && result.before).not.toBe(photos[1]);
  });
  it.each(['a', 'c'])(
    'refuses missing selected record %s instead of independently falling back',
    (id) => {
      expect(
        manualCompare20(
          photos.filter((item) => item.id !== id),
          { beforeId: 'a', afterId: 'c' },
        ).status,
      ).toBe('missing');
      expect(chooseManualCompare20(photos, {}, 'before', 'deleted')).toBeNull();
    },
  );
  it('same-day positions never infer ordering from IDs or time-of-day', () => {
    const source = [photo('z'), photo('a')];
    const result = manualCompare20(source, { beforeId: 'a', afterId: 'z' });
    expect(result).toEqual({ status: 'ready', before: source[1], after: source[0], sameDay: true });
  });
  it('requires unique IDs, valid current dates, and the current front series', () => {
    expect(manualCompare20([photo('a'), photo('a')]).status).toBe('unavailable');
    expect(manualCompare20([photo('a', '2026-02-30'), photo('b')]).status).toBe('unavailable');
    expect(manualCompare20([{ ...photo('a'), series: 'left' }, photo('b')]).status).toBe('sparse');
    expect(manualCompare20(photos, { beforeId: 'previous-owner' }).status).toBe('missing');
  });
  it('never mutates input or requires image bytes to fabricate metadata', () => {
    const source = Object.freeze(photos.map((item) => Object.freeze({ ...item })));
    const result = manualCompare20(source);
    expect(result.status).toBe('ready');
    expect(source[0]!.localUri).toBeNull();
    expect(source.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  });
});
