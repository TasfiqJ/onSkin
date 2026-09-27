import { describe, expect, it, vi } from 'vitest';

import type { StoredRamps } from '@/features/routine/rampStore';
import type { ShelfProduct } from '@/features/shelf/store';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
  waitForAccountGenerationOperationsToSettle,
} from '@/lib/auth/accountGeneration';

import {
  deriveBehaviouralTriggerSnapshot,
  readBehaviouralTriggerSnapshot,
  type BehaviouralSnapshotDependencies,
} from './behaviouralSnapshot';

vi.mock('@/features/routine/rampStore', () => ({ getStoredRamps: vi.fn() }));
vi.mock('@/features/shelf/store', () => ({ loadShelf: vi.fn() }));
vi.mock('@/features/today/completionsStore', () => ({ getCompletionSummary: vi.fn() }));
vi.mock('@/features/today/useToday', () => ({ localDateString: () => '2026-07-18' }));

function product(input: {
  id: string;
  status?: ShelfProduct['status'];
  expiryDate?: string | null;
}): ShelfProduct {
  return {
    id: input.id,
    name: input.id,
    brand: null,
    category: 'serum',
    barcode: null,
    catalogProductId: null,
    status: input.status ?? 'active',
    isOpened: false,
    openedAt: null,
    paoMonths: null,
    expiryDate: input.expiryDate ?? null,
    expirySource: input.expiryDate ? 'printed' : 'unknown',
  } as ShelfProduct;
}

const allEnabled = Object.freeze({
  promotional: true,
  ramp: true,
  replenishment: true,
});

describe('behavioural lifecycle snapshot', () => {
  it('derives only content-free booleans and ignores ramps for inactive products', () => {
    const ramps: StoredRamps = {
      inactive: {
        startedAt: '2025-01-01',
        lastStepUp: null,
        freqPerWeek: 2,
        targetPerWeek: 3,
        toleranceState: 'building',
      },
    };

    expect(
      deriveBehaviouralTriggerSnapshot(
        allEnabled,
        {
          shelf: [product({ id: 'active' })],
          ramps,
          completedDates: new Set(['2025-01-01']),
        },
        '2026-07-18',
      ),
    ).toEqual({ promotional: true, ramp: false, replenishment: false });
  });

  it('starts one shared Shelf/Ramp/completion batch only for enabled domains', async () => {
    const starts: string[] = [];
    const dependencies: BehaviouralSnapshotDependencies = {
      readShelf: vi.fn(async () => {
        starts.push('shelf');
        return [product({ id: 'active', expiryDate: '2026-07-01' })];
      }),
      readRamps: vi.fn(async (): Promise<StoredRamps> => {
        starts.push('ramps');
        return {
          active: {
            startedAt: '2026-01-01',
            lastStepUp: null,
            freqPerWeek: 2,
            targetPerWeek: 3,
            toleranceState: 'building',
          },
        };
      }),
      readCompletions: vi.fn(async () => {
        starts.push('completions');
        return {
          completedDates: new Set(['2025-01-01']),
          countByDate: new Map([['2025-01-01', 1]]),
        };
      }),
    };

    await expect(
      runAccountGenerationOperation((lease) =>
        readBehaviouralTriggerSnapshot(lease, allEnabled, '2026-07-18', dependencies),
      ),
    ).resolves.toEqual({ promotional: true, ramp: true, replenishment: true });

    expect(new Set(starts)).toEqual(new Set(['shelf', 'ramps', 'completions']));
    expect(dependencies.readShelf).toHaveBeenCalledOnce();
    expect(dependencies.readRamps).toHaveBeenCalledOnce();
    expect(dependencies.readCompletions).toHaveBeenCalledOnce();
  });

  it('performs zero private-domain reads when every trigger is disabled', async () => {
    const dependencies: BehaviouralSnapshotDependencies = {
      readShelf: vi.fn(),
      readRamps: vi.fn(),
      readCompletions: vi.fn(),
    };

    await expect(
      runAccountGenerationOperation((lease) =>
        readBehaviouralTriggerSnapshot(
          lease,
          { promotional: false, ramp: false, replenishment: false },
          '2026-07-18',
          dependencies,
        ),
      ),
    ).resolves.toEqual({ promotional: false, ramp: false, replenishment: false });

    expect(dependencies.readShelf).not.toHaveBeenCalled();
    expect(dependencies.readRamps).not.toHaveBeenCalled();
    expect(dependencies.readCompletions).not.toHaveBeenCalled();
  });

  it('detaches an owner-A batch at the boundary and contains its late result', async () => {
    let resolveShelf!: (products: ShelfProduct[]) => void;
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    const dependencies: BehaviouralSnapshotDependencies = {
      readShelf: vi.fn(
        () =>
          new Promise<ShelfProduct[]>((resolve) => {
            resolveShelf = resolve;
            markStarted();
          }),
      ),
      readRamps: vi.fn(),
      readCompletions: vi.fn(),
    };
    const evaluation = runAccountGenerationOperation((lease) =>
      readBehaviouralTriggerSnapshot(
        lease,
        { promotional: false, ramp: false, replenishment: true },
        '2026-07-18',
        dependencies,
      ),
    );
    const rejection = expect(evaluation).rejects.toMatchObject({
      message: 'ACCOUNT_GENERATION_CHANGED',
    });
    await started;

    beginAccountGenerationBoundary();
    try {
      await waitForAccountGenerationOperationsToSettle();
      await rejection;
    } finally {
      endAccountGenerationBoundary();
    }

    resolveShelf([product({ id: 'late-owner-a', expiryDate: '2026-01-01' })]);
    await Promise.resolve();
    expect(dependencies.readRamps).not.toHaveBeenCalled();
    expect(dependencies.readCompletions).not.toHaveBeenCalled();
  });
});
