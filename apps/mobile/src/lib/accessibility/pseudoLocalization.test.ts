import { describe, expect, it } from 'vitest';

import {
  pseudoLocalizeExpanded,
  resolvePseudoLocalizationMode,
} from './pseudoLocalization';

describe('pseudo localization', () => {
  it('enables the exact development fixture only', () => {
    expect(resolvePseudoLocalizationMode('expanded', true)).toBe('expanded');
    expect(resolvePseudoLocalizationMode('expanded', false)).toBe('off');
    expect(resolvePseudoLocalizationMode('EXPANDED', true)).toBe('off');
    expect(resolvePseudoLocalizationMode(undefined, true)).toBe('off');
  });

  it('accents and expands prose while preserving punctuation and outer whitespace', () => {
    const source = '  Build a routine, gently.  ';
    const result = pseudoLocalizeExpanded(source);

    expect(result.startsWith('  ⟦')).toBe(true);
    expect(result.endsWith('⟧  ')).toBe(true);
    expect(result).toContain('ŕøóüúŧïíñéë,');
    expect(result.length).toBeGreaterThanOrEqual(source.length * 1.25);
  });

  it('leaves non-language tokens unchanged and is idempotent', () => {
    expect(pseudoLocalizeExpanded('123 / 45%')).toBe('123 / 45%');
    const result = pseudoLocalizeExpanded('Skin');
    expect(pseudoLocalizeExpanded(result)).toBe(result);
  });

  it('preserves line breaks used by composed copy', () => {
    const result = pseudoLocalizeExpanded('Morning\nEvening');

    expect(result).toContain('\n');
    expect(result.startsWith('⟦')).toBe(true);
    expect(result.endsWith('⟧')).toBe(true);
  });
});
