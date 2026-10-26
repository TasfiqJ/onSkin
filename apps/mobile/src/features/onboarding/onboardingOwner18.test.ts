import { createElement, useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import { ONBOARDING_QUIZ, scoreQuiz, type QuizAnswers } from './quiz';
import { HEALTH_DATA_CONSENT } from './consentCopy';
import { setHealthDataCollectionConsentLocal } from './healthConsentStore';
import { readStoredSkinProfile } from './skinProfileStore';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';
import {
  captureHealthDataWriteLease,
  assertHealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

// Only persistence/transport hardware is synthetic. Consent, scoring, the receipt
// codec and BOTH account/health admission implementations are the real modules.
const ports = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  writes: [] as { owner: string; value: string }[],
  owner: (): string => '',
  assert: (_lease: unknown) => {},
  capture: () => ({}) as unknown,
  readGate: null as Promise<void> | null,
  writeGate: null as Promise<void> | null,
  failWrite: false,
  inaccessible: false,
  insert: vi.fn(),
  user: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('expo-router/build/react-navigation/core/NavigationContext', async () => ({
  NavigationContext: (await import('react')).createContext(undefined),
}));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: ports.invalidate }),
}));
vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: vi.fn(),
}));
vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: ports.user,
  supabase: { from: () => ({ insert: ports.insert }) },
}));
vi.mock('@/lib/storage/privateKV', () => ({
  getPrivateItem: async (key: string) => {
    const owner = ports.owner();
    if (key.includes('Consent') && ports.readGate) await ports.readGate;
    if (ports.inaccessible) throw new Error('SYNTHETIC_PRIVATE_SOURCE_UNAVAILABLE');
    return ports.storage.get(owner + ':' + key) ?? null;
  },
  removePrivateItem: async (key: string) => {
    ports.storage.delete(ports.owner() + ':' + key);
  },
  updatePrivateItem: async (key: string, update: (raw: string | null) => string | null) => {
    const owner = ports.owner();
    const health = key === 'layerwell.skinprofile.v1' ? ports.capture() : null;
    if (health && ports.writeGate) await ports.writeGate;
    if (health) ports.assert(health);
    if (ports.inaccessible || (health && ports.failWrite))
      throw new Error('SYNTHETIC_PRIVATE_WRITE_FAILED');
    const next = update(ports.storage.get(owner + ':' + key) ?? null);
    if (next === null) ports.storage.delete(owner + ':' + key);
    else {
      ports.storage.set(owner + ':' + key, next);
      if (health) ports.writes.push({ owner, value: next });
    }
  },
}));
const ANSWERS = Object.fromEntries(
  ONBOARDING_QUIZ.map((q) => [q.id, q.multiSelect ? [q.options[0]!.id] : q.options[0]!.id]),
) as QuizAnswers;
let context: ReturnType<typeof useOnboarding>;
let view: ReactTestRenderer | undefined;
let accountGeneration: number;
function Probe() {
  const value = useOnboarding();
  useLayoutEffect(() => {
    context = value;
  });
  return null;
}
function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((done) => {
    release = done;
  });
  return { promise, release };
}
async function grant(ownerUserId = 'synthetic-a', expiry = false) {
  clearActiveHealthProcessingEpoch();
  const previousOwner = ports.owner;
  ports.owner = () => ownerUserId;
  await setHealthDataCollectionConsentLocal({
    granted: true,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.fullText,
  });
  ports.owner = previousOwner;
  setActiveHealthProcessingEpoch(18, {
    ownerUserId,
    accountGeneration,
    ...(expiry ? { serverVerifiedAt: new Date().toISOString() } : {}),
  });
}
async function mount() {
  await act(async () => {
    view = create(createElement(OnboardingProvider, null, createElement(Probe)));
  });
}
async function complete() {
  await act(async () => {
    context.toggleGoal('clear_skin');
    for (const [id, value] of Object.entries(ANSWERS)) context.setAnswer(id, value);
  });
}
function empty(value = context) {
  expect(value.goals).toEqual([]);
  expect(value.quizAnswers).toEqual({});
  expect(value.profileResult).toBeNull();
}
beforeEach(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ports.storage.clear();
  ports.writes = [];
  ports.readGate = null;
  ports.writeGate = null;
  ports.failWrite = false;
  ports.inaccessible = false;
  ports.owner = () => activeHealthProcessingLeaseSnapshot()?.ownerUserId ?? 'closed';
  ports.capture = captureHealthDataWriteLease;
  ports.assert = (lease) =>
    assertHealthDataWriteLease(lease as ReturnType<typeof captureHealthDataWriteLease>);
  ports.insert.mockReset().mockResolvedValue({ error: null });
  ports.user
    .mockReset()
    .mockImplementation(async () => ({ data: { user: { id: ports.owner() } } }));
  ports.invalidate.mockReset().mockResolvedValue(undefined);
  accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await grant();
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  clearActiveHealthProcessingEpoch();
  vi.useRealTimers();
});

it('exposes no draft and denies every private API while actual consent storage is pending', async () => {
  const gate = deferred();
  ports.readGate = gate.promise;
  await mount();
  const stale = context;
  expect(context.privacyStatus).toBe('checking');
  empty();
  await act(async () => {
    context.toggleGoal('clear_skin');
    context.setAnswer('pregnancy', 'pregnant');
  });
  expect(() => context.computeResult()).toThrow();
  await expect(context.persistSkinProfile()).rejects.toThrow();
  empty();
  ports.readGate = null;
  await act(async () => gate.release());
  expect(context.privacyStatus).toBe('ready');
  empty();
  // A function captured before admission cannot acquire the later permission.
  await act(async () => stale.setAnswer('pregnancy', 'pregnant'));
  empty();
});

it.each(['owner-return', 'same-owner-regrant', 'account-generation'] as const)(
  'retires all old APIs synchronously for %s, even before React commits',
  async (boundary) => {
    await mount();
    await complete();
    const old = context;
    expect(old.computeResult()).toEqual(scoreQuiz(ANSWERS));
    await act(async () => {
      if (boundary === 'owner-return') await grant('synthetic-b');
      if (boundary === 'account-generation') {
        beginAccountGenerationBoundary();
        endAccountGenerationBoundary();
        accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
      }
      await grant();
      empty(old);
      old.toggleGoal('hydration');
      old.setAnswer('pregnancy', 'pregnant');
      old.reset();
      expect(() => old.computeResult()).toThrow();
      await expect(old.persistSkinProfile()).rejects.toThrow();
    });
    empty();
    await act(async () => context.toggleGoal('hydration'));
    old.reset();
    expect(context.goals).toEqual(['hydration']);
    expect(ports.writes).toHaveLength(0);
    expect(ports.insert).not.toHaveBeenCalled();
  },
);

it('expires and erases the draft without needing a route render or a new lease event', async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-26T18:00:00Z'));
  await grant('synthetic-a', true);
  await mount();
  await complete();
  const old = context;
  await act(async () => {
    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
  });
  empty(old);
  empty();
  expect(context.privacyStatus).toBe('denied');
  expect(() => old.computeResult()).toThrow();
  await expect(old.persistSkinProfile()).rejects.toThrow();
});

it('rejects revoked canonical consent at persistence and clears the draft rather than reporting offline success', async () => {
  await mount();
  await complete();
  await setHealthDataCollectionConsentLocal({
    granted: false,
    version: HEALTH_DATA_CONSENT.version,
    consentText: HEALTH_DATA_CONSENT.declineText,
  });
  await act(async () => {
    await expect(context.persistSkinProfile()).rejects.toThrow('CURRENT_HEALTH_CONSENT_REQUIRED');
  });
  empty();
  expect(ports.writes).toHaveLength(0);
  expect(ports.insert).not.toHaveBeenCalled();
});

it('does not publish an obsolete consent promise after A to B to A', async () => {
  const gate = deferred();
  ports.readGate = gate.promise;
  await mount();
  const old = context;
  await act(async () => {
    await grant('synthetic-b');
    await grant();
  });
  empty();
  await expect(old.persistSkinProfile()).rejects.toThrow();
  ports.readGate = null;
  await act(async () => gate.release());
  expect(context.privacyStatus).toBe('ready');
  empty();
});

it('keeps current answers on local failure, then stores an exact local-first receipt and retires raw answers', async () => {
  await mount();
  await complete();
  ports.failWrite = true;
  await expect(context.persistSkinProfile()).rejects.toThrow('SYNTHETIC_PRIVATE_WRITE_FAILED');
  expect(context.quizAnswers).toEqual(ANSWERS);
  expect(context.profileResult).toBeNull();
  ports.failWrite = false;
  await act(async () => {
    await context.persistSkinProfile();
  });
  expect(context.quizAnswers).toEqual({});
  expect(context.profileResult).toEqual(scoreQuiz(ANSWERS));
  expect(context.computeResult()).toEqual(scoreQuiz(ANSWERS));
  expect(ports.writes).toHaveLength(1);
  expect(ports.writes[0]!.owner).toBe('synthetic-a');
  expect(ports.writes[0]!.value).not.toContain('quizAnswers');
  await expect(readStoredSkinProfile()).resolves.toMatchObject({
    status: 'available',
    profile: { goals: ['clear_skin'] },
  });
  expect(ports.insert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'synthetic-a', version: 2 }),
  );
});

it('coalesces concurrent requests into one local receipt and one best-effort mirror', async () => {
  await mount();
  await complete();
  const gate = deferred();
  ports.writeGate = gate.promise;
  const a = context.persistSkinProfile();
  const b = context.persistSkinProfile();
  expect(a).toBe(b);
  ports.writeGate = null;
  await act(async () => {
    gate.release();
    await Promise.all([a, b]);
  });
  expect(ports.writes).toHaveLength(1);
  expect(ports.insert).toHaveBeenCalledTimes(1);
});

it('cannot commit A as authorized B when the actual receipt transaction is queued', async () => {
  await mount();
  await complete();
  const gate = deferred();
  ports.writeGate = gate.promise;
  const save = context.persistSkinProfile().then(
    () => 'FALSE_SUCCESS',
    () => 'retired',
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  await act(async () => {
    await grant('synthetic-b');
  });
  ports.writeGate = null;
  await act(async () => {
    gate.release();
    expect(await save).toBe('retired');
  });
  empty();
  expect(ports.writes).toHaveLength(0);
  expect(ports.insert).not.toHaveBeenCalled();
  await complete();
  await act(async () => {
    await context.persistSkinProfile();
  });
  expect(ports.writes.map((w) => w.owner)).toEqual(['synthetic-b']);
});

it('retires publication and remote dispatch when owner changes after local durability', async () => {
  await mount();
  await complete();
  const gate = deferred();
  ports.user.mockImplementationOnce(async () => {
    await gate.promise;
    return { data: { user: { id: 'synthetic-a' } } };
  });
  const save = context.persistSkinProfile().then(
    () => 'FALSE_SUCCESS',
    () => 'retired',
  );
  await act(async () => {
    for (let n = 0; n < 20; n++) await Promise.resolve();
  });
  expect(ports.writes.map((w) => w.owner)).toEqual(['synthetic-a']);
  await act(async () => {
    await grant('synthetic-b');
    gate.release();
    expect(await save).toBe('retired');
  });
  empty();
  expect(ports.insert).not.toHaveBeenCalled();
});

it.each(['missing', 'unavailable', 'malformed'] as const)(
  'fails closed for %s consent storage',
  async (source) => {
    if (source === 'missing') ports.storage.clear();
    if (source === 'unavailable') ports.inaccessible = true;
    if (source === 'malformed')
      ports.storage.set('synthetic-a:layerwell.healthDataCollectionConsent.v1', '{bad');
    await mount();
    empty();
    expect(context.privacyStatus).toBe('denied');
    await expect(context.persistSkinProfile()).rejects.toThrow();
    expect(ports.writes).toHaveLength(0);
  },
);

it('keeps a truthful local success when only the server mirror fails', async () => {
  await mount();
  await complete();
  ports.insert.mockRejectedValue(new Error('SYNTHETIC_OFFLINE'));
  await act(async () => {
    await expect(context.persistSkinProfile()).resolves.toEqual(scoreQuiz(ANSWERS));
  });
  expect(context.profileResult).toEqual(scoreQuiz(ANSWERS));
  expect(ports.writes).toHaveLength(1);
});

it('never restores private memory on unmount/remount and rejects retained old callbacks', async () => {
  await mount();
  await complete();
  const old = context;
  await act(async () => view!.unmount());
  view = undefined;
  empty(old);
  old.setAnswer('pregnancy', 'pregnant');
  await expect(old.persistSkinProfile()).rejects.toThrow();
  await mount();
  empty();
  expect(context.privacyStatus).toBe('ready');
});

it('rejects a health lease with an unknown or mismatched current account generation', async () => {
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(18, {
    ownerUserId: 'synthetic-a',
    accountGeneration: accountGeneration + 1,
  });
  await mount();
  empty();
  expect(context.privacyStatus).toBe('denied');
  await act(async () => {
    context.toggleGoal('clear_skin');
    context.setAnswer('pregnancy', 'pregnant');
  });
  empty();
  expect(() => context.computeResult()).toThrow();
  await expect(context.persistSkinProfile()).rejects.toThrow();
});

// Campaign19: independently exercise the original pre-consent and retained-profile promises.
it('Campaign19 performs no private I/O when mounted without an active authority', async () => {
  clearActiveHealthProcessingEpoch();
  const reads = vi.spyOn(ports.storage, 'get');
  await mount();
  expect(context.privacyStatus).toBe('denied');
  empty();
  expect(reads).not.toHaveBeenCalled();
  expect(ports.insert).not.toHaveBeenCalled();
  expect(ports.writes).toHaveLength(0);
  reads.mockRestore();
});

it.each(['same-owner-regrant', 'owner-return'] as const)(
  'Campaign19 masks retained pregnancy, sensitivities and profile after %s and React rerender',
  async (boundary) => {
    await mount();
    await complete();
    await act(async () => {
      context.setAnswer('q_pregnancy', 'pregnant');
      context.setAnswer('q_sensitivities', ['fragrance']);
    });
    const old = context;
    await act(async () => {
      await context.persistSkinProfile();
    });
    expect(context.profileResult).not.toBeNull();
    await act(async () => {
      if (boundary === 'owner-return') await grant('synthetic-b');
      await grant();
      view!.update(createElement(OnboardingProvider, null, createElement(Probe)));
    });
    empty(old);
    empty();
    await act(async () => {
      old.setAnswer('q_pregnancy', 'pregnant');
      old.toggleGoal('hydration');
      old.reset();
      context.toggleGoal('hydration');
    });
    expect(context.goals).toEqual(['hydration']);
    expect(context.quizAnswers).toEqual({});
    expect(context.profileResult).toBeNull();
    expect(() => old.computeResult()).toThrow();
    await expect(old.persistSkinProfile()).rejects.toThrow();
    expect(ports.writes).toHaveLength(1);
  },
);

it('Campaign19 rejects a queued save across same-owner regrant and retains only the new draft', async () => {
  await mount();
  await complete();
  const gate = deferred();
  ports.writeGate = gate.promise;
  const save = context.persistSkinProfile().then(
    () => 'FALSE_SUCCESS',
    () => 'retired',
  );
  await act(async () => {
    for (let n = 0; n < 20; n++) await Promise.resolve();
  });
  await act(async () => {
    await grant();
  });
  await complete();
  const currentAnswers = context.quizAnswers;
  ports.writeGate = null;
  await act(async () => {
    gate.release();
    expect(await save).toBe('retired');
  });
  expect(context.quizAnswers).toEqual(currentAnswers);
  expect(context.profileResult).toBeNull();
  expect(ports.writes).toHaveLength(0);
  expect(ports.insert).not.toHaveBeenCalled();
  await act(async () => {
    await context.persistSkinProfile();
  });
  expect(ports.writes).toHaveLength(1);
});
