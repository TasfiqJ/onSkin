import { expect, it } from 'vitest';
import {
  readAccountDeletionFixturePhase,
  resolveAccountDeletionRecoveryFixture,
  writeAccountDeletionFixturePhase,
} from './accountDeletionRecoveryE2E';

const admitted = {
  platform: 'web',
  isDev: true,
  appEnvironment: 'development',
  supabaseConfigured: false,
  mode: 'pending_then_completed_manual',
};
it('admits only explicit local DEV fixture modes', () => {
  expect(resolveAccountDeletionRecoveryFixture(admitted)).toBe(admitted.mode);
  for (const override of [
    { isDev: false },
    { appEnvironment: 'production' },
    { appEnvironment: 'staging' },
    { supabaseConfigured: true },
    { platform: 'ios' },
    { platform: 'android' },
    { mode: undefined },
    { mode: 'unknown' },
  ]) {
    expect(resolveAccountDeletionRecoveryFixture({ ...admitted, ...override })).toBeNull();
  }
});

it('retains simulated completion and acknowledgement across a new transport reader', () => {
  const bytes = new Map<string, string>();
  const storage = {
    getItem: (key: string) => bytes.get(key) ?? null,
    setItem: (key: string, value: string) => {
      bytes.set(key, value);
    },
  };
  expect(readAccountDeletionFixturePhase(storage)).toBe('pending');
  writeAccountDeletionFixturePhase('completed', storage);
  expect(readAccountDeletionFixturePhase({ ...storage })).toBe('completed');
  writeAccountDeletionFixturePhase('acknowledged', storage);
  expect(readAccountDeletionFixturePhase({ ...storage })).toBe('acknowledged');
});

it('refuses corrupt or unavailable fixture state instead of inventing completion', () => {
  expect(() =>
    readAccountDeletionFixturePhase({ getItem: () => 'unknown', setItem: () => {} }),
  ).toThrow('PHASE_INVALID');
  expect(() =>
    writeAccountDeletionFixturePhase('completed', {
      getItem: () => null,
      setItem: () => {
        throw new Error('unavailable');
      },
    }),
  ).toThrow('unavailable');
});
