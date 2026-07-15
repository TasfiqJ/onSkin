import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  anonymousHandoffNeedsSessionPublication,
  createPendingAnonymousOnboardingHandoff,
  createWelcomeHandoffCoordinator,
  decideAnonymousOnboardingHandoff,
  decideAnonymousSessionResolution,
  type AwaitingAnonymousOnboardingHandoff,
} from './welcomeSessionHandoff';

const pending: AwaitingAnonymousOnboardingHandoff = Object.freeze({
  expectedUserId: 'anonymous-user-b',
  minimumSessionPublication: 4,
  phase: 'awaiting_publication',
  requestId: 7,
});

function decide(
  overrides: Partial<Parameters<typeof decideAnonymousOnboardingHandoff>[0]> = {},
) {
  return decideAnonymousOnboardingHandoff({
    completedSessionPublication: 3,
    initializing: false,
    mounted: true,
    onboardingGate: 'welcome',
    ownerScopeCurrent: true,
    pending,
    publishedUserId: 'anonymous-user-b',
    requestIsLatest: true,
    ...overrides,
  });
}

describe('anonymous onboarding session handoff', () => {
  it('actively requires publication for an unpublished restored session', () => {
    expect(anonymousHandoffNeedsSessionPublication('user-b', null, false)).toBe(true);
    expect(anonymousHandoffNeedsSessionPublication('user-b', 'user-a', false)).toBe(true);
    expect(anonymousHandoffNeedsSessionPublication('user-b', 'user-b', true)).toBe(true);
    expect(anonymousHandoffNeedsSessionPublication('user-b', 'user-b', false)).toBe(false);

    expect(
      createPendingAnonymousOnboardingHandoff({
        completedSessionPublication: 3,
        expectedUserId: 'user-b',
        requestId: 7,
        requiresSessionPublication: true,
      }),
    ).toEqual({
      expectedUserId: 'user-b',
      minimumSessionPublication: 4,
      phase: 'awaiting_publication',
      requestId: 7,
    });
  });

  it('waits through a delayed Begin until the exact session publication completes', () => {
    expect(decide()).toBe('wait');
    expect(decide({ completedSessionPublication: 4, initializing: true })).toBe('wait');
    expect(decide({ completedSessionPublication: 4, ownerScopeCurrent: false })).toBe('wait');
    expect(decide({ completedSessionPublication: 4 })).toBe('navigate');
  });

  it('waits for a fetch-idle welcome decision and cancels behind a Today redirect', () => {
    expect(decide({ completedSessionPublication: 4, onboardingGate: 'checking' })).toBe('wait');
    expect(decide({ completedSessionPublication: 4, onboardingGate: 'error' })).toBe('wait');
    expect(
      decide({ completedSessionPublication: 4, onboardingGate: 'redirect_today' }),
    ).toBe('cancel');
  });

  it('cancels rather than navigating when the completed publication belongs to another user', () => {
    expect(
      decide({
        completedSessionPublication: 4,
        publishedUserId: 'different-user-c',
      }),
    ).toBe('cancel');
  });

  it('never navigates after unmount or from a superseded request', () => {
    expect(decide({ completedSessionPublication: 4, mounted: false })).toBe('wait');
    expect(decide({ completedSessionPublication: 4, requestIsLatest: false })).toBe('wait');
  });
});

describe('anonymous auth response ordering', () => {
  it('applies a returned session only when no auth transition happened after request start', () => {
    expect(
      decideAnonymousSessionResolution({
        authTransitionEpochAtStart: 3,
        currentAuthTransitionEpoch: 3,
        expectedUserId: 'user-b',
        latestAuthTargetUserId: 'user-a',
      }),
    ).toBe('apply_returned_session');
  });

  it('coalesces the intended callback when it already targets the returned user', () => {
    expect(
      decideAnonymousSessionResolution({
        authTransitionEpochAtStart: 3,
        currentAuthTransitionEpoch: 4,
        expectedUserId: 'user-b',
        latestAuthTargetUserId: 'user-b',
      }),
    ).toBe('coalesce_same_target');
  });

  it('rejects a stale response after a newer callback selected another user', () => {
    expect(
      decideAnonymousSessionResolution({
        authTransitionEpochAtStart: 3,
        currentAuthTransitionEpoch: 4,
        expectedUserId: 'user-b',
        latestAuthTargetUserId: 'different-user-c',
      }),
    ).toBe('superseded_by_newer_target');
  });
});

describe('provider-owned Welcome handoff coordinator', () => {
  it('publishes resolving synchronously before the expected user is known', () => {
    const published: unknown[] = [];
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: (value) => published.push(value),
    });

    const resolving = coordinator.begin(11);

    expect(resolving).toEqual({
      authTransitionEpochAtStart: 11,
      phase: 'resolving',
      requestId: 1,
    });
    expect(coordinator.getCurrent()).toBe(resolving);
    expect(published).toEqual([resolving]);
  });

  it('advances only the current resolving request to exact-session publication', () => {
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: () => undefined,
    });
    const first = coordinator.begin(1);
    const second = coordinator.begin(2);

    expect(
      coordinator.advanceToAwaitingPublication({
        completedSessionPublication: 5,
        expectedUserId: 'stale-user-a',
        requestId: first.requestId,
        requiresSessionPublication: true,
      }),
    ).toBeNull();

    const awaiting = coordinator.advanceToAwaitingPublication({
      completedSessionPublication: 5,
      expectedUserId: 'current-user-b',
      requestId: second.requestId,
      requiresSessionPublication: true,
    });
    expect(awaiting).toEqual({
      expectedUserId: 'current-user-b',
      minimumSessionPublication: 6,
      phase: 'awaiting_publication',
      requestId: second.requestId,
    });
  });

  it('abandons a resolving request after ordinary route blur and ignores its late result', () => {
    const scheduled: (() => void)[] = [];
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: () => undefined,
      scheduleAbandonment: (callback) => scheduled.push(callback),
    });
    const unregister = coordinator.registerConsumer();
    const resolving = coordinator.begin(7);

    unregister();
    expect(coordinator.getCurrent()).toBe(resolving);
    expect(scheduled).toHaveLength(1);
    scheduled[0]!();

    expect(coordinator.getCurrent()).toBeNull();
    expect(
      coordinator.advanceToAwaitingPublication({
        completedSessionPublication: 2,
        expectedUserId: 'late-user',
        requestId: resolving.requestId,
        requiresSessionPublication: true,
      }),
    ).toBeNull();
  });

  it('keeps a request across React StrictMode consumer replay', () => {
    const scheduled: (() => void)[] = [];
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: () => undefined,
      scheduleAbandonment: (callback) => scheduled.push(callback),
    });
    const firstCleanup = coordinator.registerConsumer();
    const resolving = coordinator.begin(4);

    firstCleanup();
    const replayCleanup = coordinator.registerConsumer();
    scheduled[0]!();

    expect(coordinator.getCurrent()).toBe(resolving);
    replayCleanup();
    scheduled[1]!();
    expect(coordinator.getCurrent()).toBeNull();
  });

  it('keeps a request across SessionBoundaryGate unmount and lets the new tree consume it', () => {
    let boundaryActive = true;
    const scheduled: (() => void)[] = [];
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: () => undefined,
      scheduleAbandonment: (callback) => scheduled.push(callback),
    });
    const oldTreeCleanup = coordinator.registerConsumer(() => boundaryActive);
    const resolving = coordinator.begin(8);

    oldTreeCleanup();
    expect(scheduled).toHaveLength(0);
    expect(coordinator.getCurrent()).toBe(resolving);

    boundaryActive = false;
    const newTreeCleanup = coordinator.registerConsumer(() => boundaryActive);
    const awaiting = coordinator.advanceToAwaitingPublication({
      completedSessionPublication: 9,
      expectedUserId: 'anonymous-user-b',
      requestId: resolving.requestId,
      requiresSessionPublication: false,
    });
    expect(awaiting?.phase).toBe('awaiting_publication');
    expect(coordinator.settle(resolving.requestId)).toBe(true);
    newTreeCleanup();
    expect(coordinator.getCurrent()).toBeNull();
  });

  it('does not let a boundary that starts after ordinary blur rescue an abandoned request', () => {
    let boundaryActive = false;
    const scheduled: (() => void)[] = [];
    const coordinator = createWelcomeHandoffCoordinator({
      onChange: () => undefined,
      scheduleAbandonment: (callback) => scheduled.push(callback),
    });
    const unregister = coordinator.registerConsumer(() => boundaryActive);
    const resolving = coordinator.begin(12);

    unregister();
    boundaryActive = true;
    scheduled[0]!();

    expect(coordinator.getCurrent()).toBeNull();
    expect(coordinator.isCurrent(resolving.requestId)).toBe(false);
  });
});

describe('Welcome/AuthProvider handoff wiring contract', () => {
  it('publishes resolving before auth I/O and checks callback ordering before applying a session', () => {
    const provider = readFileSync(
      fileURLToPath(new URL('../../lib/auth/AuthProvider.tsx', import.meta.url)),
      'utf8',
    );
    const begin = provider.indexOf('welcomeHandoffCoordinator.begin(');
    const authRead = provider.indexOf('await supabase.auth.getSession()', begin);
    const resolution = provider.indexOf('decideAnonymousSessionResolution({', begin);
    const staleDecision = provider.indexOf(
      "resolution === 'superseded_by_newer_target'",
      resolution,
    );
    const applyReturned = provider.indexOf('void applySessionBoundaryRef.current(nextSession)', begin);

    expect(begin).toBeGreaterThan(-1);
    expect(resolution).toBeGreaterThan(begin);
    expect(staleDecision).toBeGreaterThan(resolution);
    expect(applyReturned).toBeGreaterThan(staleDecision);
    expect(authRead).toBeGreaterThan(applyReturned);
    expect(provider).toContain('welcomeHandoffCoordinator.registerConsumer(');
  });

  it('registers a focus-scoped consumer and never sends resolving state to navigation', () => {
    const welcome = readFileSync(
      fileURLToPath(new URL('../../app/index.tsx', import.meta.url)),
      'utf8',
    );

    expect(welcome).toContain('const isFocused = useIsFocused();');
    expect(welcome).toContain('const unregisterConsumer = registerAnonymousOnboardingConsumer();');
    expect(welcome).toContain("if (!pending || pending.phase === 'resolving') return;");
    expect(welcome).toContain('if (!isFocused || !activeWelcomeRef.current) return;');
  });
});
