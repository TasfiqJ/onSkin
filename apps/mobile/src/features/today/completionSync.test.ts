import { describe, expect, it, vi } from 'vitest';

import {
  COMPLETION_SYNC_INVALID,
  COMPLETION_SYNC_UUID_UNAVAILABLE,
  canonicalCompletionSyncDate,
  canonicalCompletionSyncInstant,
  canonicalCompletionSyncStepOrder,
  canonicalCompletionSyncTimezone,
  canonicalCompletionSyncUuid,
  completionSyncDateInTimezone,
  completionSyncStepIdentity,
  COMPLETION_DEPENDENCY_TERMINAL,
  createCompletionSyncUuid,
  currentCompletionSyncTimezone,
  decodeCompletionSyncState,
  emptyCompletionSyncState,
  remoteTerminalCompletionSyncCode,
  retryableCompletionSyncCode,
  terminalCompletionSyncCode,
} from './completionSync';

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ROUTINE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const EVENT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const STEP = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('completion sync identity and provenance primitives', () => {
  it('accepts only lowercase canonical UUIDv4 identities', () => {
    expect(canonicalCompletionSyncUuid(UUID)).toBe(UUID);
    expect(canonicalCompletionSyncUuid(UUID.toUpperCase())).toBeNull();
    expect(canonicalCompletionSyncUuid('aaaaaaaa-aaaa-1aaa-8aaa-aaaaaaaaaaaa')).toBeNull();
    expect(canonicalCompletionSyncUuid('not-a-uuid')).toBeNull();
  });

  it('retries a bounded UUID factory and fails closed when no UUID is available', () => {
    const factory = vi.fn().mockReturnValueOnce('bad').mockReturnValueOnce(UUID);
    expect(createCompletionSyncUuid(factory)).toBe(UUID);
    expect(factory).toHaveBeenCalledTimes(2);

    expect(() => createCompletionSyncUuid(() => 'bad')).toThrow(COMPLETION_SYNC_UUID_UNAVAILABLE);
  });

  it('derives the exact phase and Shelf UUID from a strict local step key', () => {
    expect(completionSyncStepIdentity(`PM:${UUID}`)).toEqual({
      routineType: 'PM',
      userProductId: UUID,
    });
    expect(completionSyncStepIdentity(`AM:${UUID.toUpperCase()}`)).toBeNull();
    expect(completionSyncStepIdentity('PM:m-retinol')).toBeNull();
    expect(completionSyncStepIdentity(` PM:${UUID}`)).toBeNull();
  });

  it('accepts only real dates, canonical instants, and bounded step order', () => {
    expect(canonicalCompletionSyncDate('2024-02-29')).toBe('2024-02-29');
    expect(canonicalCompletionSyncDate('2026-02-29')).toBeNull();
    expect(canonicalCompletionSyncInstant('2026-07-26T18:00:00.000Z')).toBe(
      '2026-07-26T18:00:00.000Z',
    );
    expect(canonicalCompletionSyncInstant('2026-07-26T18:00:00Z')).toBeNull();
    expect(canonicalCompletionSyncStepOrder(1)).toBe(1);
    expect(canonicalCompletionSyncStepOrder(100)).toBe(100);
    expect(canonicalCompletionSyncStepOrder(0)).toBeNull();
    expect(canonicalCompletionSyncStepOrder(1.5)).toBeNull();
  });

  it('accepts supported persisted IANA aliases without trimming or controls', () => {
    expect(canonicalCompletionSyncTimezone('America/Toronto')).toBe('America/Toronto');
    expect(canonicalCompletionSyncTimezone('Canada/Eastern')).toBe('Canada/Eastern');
    expect(canonicalCompletionSyncTimezone(' America/Toronto')).toBeNull();
    expect(canonicalCompletionSyncTimezone('America/Toronto\n')).toBeNull();
    expect(canonicalCompletionSyncTimezone('Not/A_Real_Zone')).toBeNull();
    expect(currentCompletionSyncTimezone()).toBe(
      new Intl.DateTimeFormat('en-US').resolvedOptions().timeZone,
    );
    expect(completionSyncDateInTimezone('2026-07-26T02:30:00.000Z', 'Canada/Eastern')).toBe(
      '2026-07-25',
    );
  });

  it('upgrades legacy unsynced evidence to explicit bounded dispositions', () => {
    const evidence = {
      hasCompletedStep: (date: string, key: string) =>
        date === '2026-07-26' && (key === `AM:${UUID}` || key === 'AM:legacy-product'),
      hasCompletedDay: () => false,
    };
    const common = {
      eventId: EVENT,
      routineType: 'AM',
      stepOrder: 1,
      completedAt: '2026-07-26T18:00:00.000Z',
      completedDate: '2026-07-26',
      completionDayInserted: false,
    };
    const decode = (unsynced: Record<string, unknown>) =>
      decodeCompletionSyncState(
        {
          routineIds: { AM: null, PM: null },
          stepIds: {},
          journal: [],
          outbox: [],
          terminal: [],
          unsynced: [unsynced],
        },
        evidence,
      ).unsynced[0];

    expect(
      decode({
        ...common,
        stepKey: `AM:${UUID}`,
        reason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
      }),
    ).toMatchObject({ disposition: 'recoverable', timezoneEvidence: null });
    expect(
      decode({
        ...common,
        stepKey: 'AM:legacy-product',
        reason: 'COMPLETION_PRODUCT_IDENTITY_REPAIR_REQUIRED',
      }),
    ).toMatchObject({ disposition: 'terminal', timezoneEvidence: null });
    expect(() =>
      decode({
        ...common,
        stepKey: `AM:${UUID}`,
        reason: 'COMPLETION_TIMEZONE_UNAVAILABLE',
        disposition: 'recoverable',
        timezoneEvidence: 'America/Toronto',
      }),
    ).toThrow(COMPLETION_SYNC_INVALID);
  });

  it('starts with no remote identity, journal, outbox, terminal work, or owner ID', () => {
    const empty = emptyCompletionSyncState();
    expect(empty).toEqual({
      routineIds: { AM: null, PM: null },
      stepIds: {},
      journal: [],
      outbox: [],
      terminal: [],
      unsynced: [],
    });
    expect(JSON.stringify(empty)).not.toContain('userId');
  });

  it('accepts only the planned retryable, remote-terminal, and local dependency codes', () => {
    expect(retryableCompletionSyncCode('COMPLETION_PRODUCT_RETRY_LATER')).toBe(
      'COMPLETION_PRODUCT_RETRY_LATER',
    );
    expect(remoteTerminalCompletionSyncCode('COMPLETION_EVENT_CONFLICT')).toBe(
      'COMPLETION_EVENT_CONFLICT',
    );
    expect(terminalCompletionSyncCode(COMPLETION_DEPENDENCY_TERMINAL)).toBe(
      COMPLETION_DEPENDENCY_TERMINAL,
    );
    expect(retryableCompletionSyncCode('COMPLETION_EVENT_CONFLICT')).toBeNull();
    expect(remoteTerminalCompletionSyncCode('COMPLETION_PRODUCT_RETRY_LATER')).toBeNull();
    expect(terminalCompletionSyncCode('ROUTINE_COMPLETION_BACKFILL_LIMIT')).toBeNull();
    expect(terminalCompletionSyncCode('COMPLETION_NEW_UNKNOWN_CODE')).toBeNull();
    expect(terminalCompletionSyncCode('permission denied')).toBeNull();
  });

  it('decodes an exact journal whose identities are bound to local evidence', () => {
    const decoded = decodeCompletionSyncState(
      {
        routineIds: { AM: null, PM: ROUTINE },
        stepIds: { [`PM:${UUID}`]: { id: STEP, stepOrder: 2 } },
        journal: [
          {
            eventId: EVENT,
            kind: 'step',
            routineId: ROUTINE,
            routineType: 'PM',
            stepId: STEP,
            userProductId: UUID,
            stepOrder: 2,
            completedAt: '2026-07-26T18:00:00.000Z',
            completedDate: '2026-07-26',
            timezone: 'Canada/Eastern',
          },
        ],
        outbox: [EVENT],
        terminal: [],
      },
      {
        hasCompletedStep: (date, key) => date === '2026-07-26' && key === `PM:${UUID}`,
        hasCompletedDay: () => false,
      },
    );

    expect(decoded.journal[0]).toMatchObject({
      eventId: EVENT,
      completedAt: '2026-07-26T18:00:00.000Z',
      timezone: 'Canada/Eastern',
    });
    expect(decoded.outbox).toEqual([EVENT]);
  });

  it('rejects transplanted identities, missing evidence, duplicate facts, and bad queue order', () => {
    const base = {
      routineIds: { AM: null, PM: ROUTINE },
      stepIds: { [`PM:${UUID}`]: { id: STEP, stepOrder: 2 } },
      journal: [
        {
          eventId: EVENT,
          kind: 'step',
          routineId: ROUTINE,
          routineType: 'PM',
          stepId: STEP,
          userProductId: UUID,
          stepOrder: 2,
          completedAt: '2026-07-26T18:00:00.000Z',
          completedDate: '2026-07-26',
          timezone: 'America/Toronto',
        },
      ],
      outbox: [EVENT],
      terminal: [],
    };
    const evidence = {
      hasCompletedStep: (date: string, key: string) =>
        date === '2026-07-26' && key === `PM:${UUID}`,
      hasCompletedDay: () => false,
    };

    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          journal: [{ ...base.journal[0], routineId: UUID }],
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(base, {
        ...evidence,
        hasCompletedStep: () => false,
      }),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          journal: [
            ...base.journal,
            {
              ...base.journal[0],
              eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            },
          ],
          outbox: [EVENT, 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'],
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          terminal: [{ eventId: EVENT, code: 'COMPLETION_EVENT_CONFLICT' }],
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          routineIds: { AM: ROUTINE, PM: ROUTINE },
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          routineIds: {
            AM: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
            PM: ROUTINE,
          },
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
    expect(() =>
      decodeCompletionSyncState(
        {
          ...base,
          stepIds: {
            ...base.stepIds,
            'PM:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee': {
              id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
              stepOrder: 3,
            },
          },
        },
        evidence,
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
  });

  it('requires routine-day events to immediately bind the final PM step and completed day', () => {
    const stepEvent = {
      eventId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      kind: 'step',
      routineId: ROUTINE,
      routineType: 'PM',
      stepId: STEP,
      userProductId: UUID,
      stepOrder: 2,
      completedAt: '2026-07-26T18:00:00.000Z',
      completedDate: '2026-07-26',
      timezone: 'America/Toronto',
    };
    const routineDay = {
      eventId: EVENT,
      kind: 'routine_day',
      routineId: ROUTINE,
      routineType: 'PM',
      stepId: null,
      userProductId: null,
      stepOrder: null,
      completedAt: '2026-07-26T18:00:00.000Z',
      completedDate: '2026-07-26',
      timezone: 'America/Toronto',
    };
    expect(
      decodeCompletionSyncState(
        {
          routineIds: { AM: null, PM: ROUTINE },
          stepIds: { [`PM:${UUID}`]: { id: STEP, stepOrder: 2 } },
          journal: [stepEvent, routineDay],
          outbox: [stepEvent.eventId, EVENT],
          terminal: [],
        },
        {
          hasCompletedStep: (date, key) => date === '2026-07-26' && key === `PM:${UUID}`,
          hasCompletedDay: (date) => date === '2026-07-26',
        },
      ).journal,
    ).toEqual([stepEvent, routineDay]);

    expect(
      decodeCompletionSyncState(
        {
          routineIds: { AM: null, PM: ROUTINE },
          stepIds: { [`PM:${UUID}`]: { id: STEP, stepOrder: 2 } },
          journal: [stepEvent, routineDay],
          outbox: [],
          terminal: [
            { eventId: stepEvent.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' },
            {
              eventId: EVENT,
              code: COMPLETION_DEPENDENCY_TERMINAL,
              dependencyEventIds: [stepEvent.eventId],
            },
          ],
        },
        {
          hasCompletedStep: (date, key) => date === '2026-07-26' && key === `PM:${UUID}`,
          hasCompletedDay: (date) => date === '2026-07-26',
        },
      ).terminal,
    ).toEqual([
      { eventId: stepEvent.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' },
      {
        eventId: EVENT,
        code: COMPLETION_DEPENDENCY_TERMINAL,
        dependencyEventIds: [stepEvent.eventId],
      },
    ]);

    for (const terminal of [
      [{ eventId: stepEvent.eventId, code: 'COMPLETION_IDENTITY_CONFLICT' }],
      [{ eventId: EVENT, code: COMPLETION_DEPENDENCY_TERMINAL }],
      [{ eventId: stepEvent.eventId, code: COMPLETION_DEPENDENCY_TERMINAL }],
    ]) {
      expect(() =>
        decodeCompletionSyncState(
          {
            routineIds: { AM: null, PM: ROUTINE },
            stepIds: { [`PM:${UUID}`]: { id: STEP, stepOrder: 2 } },
            journal: [stepEvent, routineDay],
            outbox: [],
            terminal,
          },
          {
            hasCompletedStep: (date, key) => date === '2026-07-26' && key === `PM:${UUID}`,
            hasCompletedDay: (date) => date === '2026-07-26',
          },
        ),
      ).toThrow(COMPLETION_SYNC_INVALID);
    }

    expect(() =>
      decodeCompletionSyncState(
        {
          routineIds: { AM: null, PM: ROUTINE },
          stepIds: {},
          journal: [routineDay],
          outbox: [EVENT],
          terminal: [],
        },
        {
          hasCompletedStep: () => false,
          hasCompletedDay: () => true,
        },
      ),
    ).toThrow(COMPLETION_SYNC_INVALID);
  });
});
