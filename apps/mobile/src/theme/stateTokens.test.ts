import { describe, expect, it } from 'vitest';

import {
  interfaceStateIsAlert,
  interfaceStateTokens,
  type InterfaceStateKind,
} from './stateTokens';

const KINDS: InterfaceStateKind[] = [
  'loading',
  'empty',
  'offline',
  'error',
  'unavailable',
  'corrupt',
  'locked',
  'destructive',
];

describe('interface state tokens', () => {
  it('names every state so meaning never depends on color alone', () => {
    const labels = KINDS.map((kind) => interfaceStateTokens(kind).label);
    expect(labels.every((label) => label.trim().length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(KINDS.length);
  });

  it('keeps the recovery-sensitive states visually distinct on paper', () => {
    const signatures = ['offline', 'error', 'unavailable', 'corrupt', 'locked', 'destructive'].map(
      (kind) => {
        const tokens = interfaceStateTokens(kind as InterfaceStateKind);
        return `${tokens.label}|${tokens.background}|${tokens.border}|${tokens.accent}`;
      },
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });

  it('provides complete night-surface tokens for every state', () => {
    for (const kind of KINDS) {
      const tokens = interfaceStateTokens(kind, 'night');
      expect(Object.values(tokens).every((value) => value.length > 0), kind).toBe(true);
    }
  });

  it('announces actionable failure states without announcing empty content as an error', () => {
    expect(interfaceStateIsAlert('loading')).toBe(false);
    expect(interfaceStateIsAlert('empty')).toBe(false);
    expect(interfaceStateIsAlert('offline')).toBe(true);
    expect(interfaceStateIsAlert('error')).toBe(true);
    expect(interfaceStateIsAlert('unavailable')).toBe(true);
    expect(interfaceStateIsAlert('corrupt')).toBe(true);
    expect(interfaceStateIsAlert('locked')).toBe(true);
    expect(interfaceStateIsAlert('destructive')).toBe(true);
  });
});
