import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ShelfMirrorOperation,
  ShelfMirrorTerminalCode,
  ShelfMirrorUpsertPayload,
} from '@/features/shelf/store';
import {
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';

import { flushShelfMirrorQueue, SHELF_MIRROR_RESPONSE_INVALID } from './shelfMirrorQueue';

const h = vi.hoisted(() => ({
  pending: [] as ShelfMirrorOperation[],
  acknowledged: [] as string[],
  rejected: [] as { operation: ShelfMirrorOperation; code: ShelfMirrorTerminalCode }[],
  currentUserId: 'owner-a' as string | null,
  rpc: vi.fn(),
}));

vi.mock('@/features/shelf/store', () => ({
  getPendingShelfMirrorOperations: vi.fn(async () => [...h.pending]),
  acknowledgeShelfMirrorOperation: vi.fn(async (operationId: string) => {
    if (h.pending[0]?.operationId !== operationId) return false;
    h.pending.shift();
    h.acknowledged.push(operationId);
    return true;
  }),
  rejectShelfMirrorOperation: vi.fn(async (operationId: string, code: ShelfMirrorTerminalCode) => {
    if (h.pending[0]?.operationId !== operationId) return false;
    const operation = h.pending.shift()!;
    h.rejected.push({ operation, code });
    return true;
  }),
}));

vi.mock('@/lib/supabase/client', () => ({
  getPersistedSupabaseUser: vi.fn(async () => ({
    data: { user: h.currentUserId === null ? null : { id: h.currentUserId } },
  })),
  supabase: { rpc: h.rpc },
}));

const OPERATION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OPERATION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const PRODUCT_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const PRODUCT_B = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

function payload(id = PRODUCT_A): ShelfMirrorUpsertPayload {
  return {
    id,
    catalog_product_id: null,
    catalog_source_id: null,
    catalog_match_quality: 'manual',
    catalog_source_snapshot_date: null,
    manual_name: 'Offline cleanser',
    manual_brand: 'Example',
    barcode: null,
    opened_at: '2026-07-26',
    pao_months: 12,
    expiry_date: null,
    is_opened: true,
    pao_source: 'label',
    expiry_source: 'pao_computed',
    added_via: 'manual',
    source_disclosure_ack_at: null,
    status: 'active',
    finished_at: null,
  };
}

function upsertOperation(operationId: string, productId = PRODUCT_A): ShelfMirrorOperation {
  return {
    operationId,
    enqueuedAt: '2026-07-26T18:00:00.000Z',
    kind: 'upsert',
    payload: payload(productId),
  };
}

function deleteOperation(operationId: string, productId = PRODUCT_A): ShelfMirrorOperation {
  return {
    operationId,
    enqueuedAt: '2026-07-26T19:00:00.000Z',
    kind: 'delete',
    productId,
  };
}

function response(
  operationId: string,
  status: 'accepted' | 'idempotent' | 'retryable' | 'terminal' = 'accepted',
  code: string | null = status === 'retryable'
    ? 'SHELF_SYNC_RETRY_LATER'
    : status === 'terminal'
      ? 'SHELF_PRODUCT_PAYLOAD_INVALID'
      : null,
) {
  return {
    data: {
      version: 1,
      operation_id: operationId,
      status,
      code,
    },
    error: null,
  };
}

describe('Shelf v3 RPC replay worker', () => {
  beforeEach(() => {
    h.pending = [];
    h.acknowledged = [];
    h.rejected = [];
    h.currentUserId = 'owner-a';
    h.rpc.mockReset();
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(9, {
      ownerUserId: 'owner-a',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
  });

  it('does not touch Auth or the network when there is no replay work', async () => {
    await expect(flushShelfMirrorQueue()).resolves.toEqual({
      flushed: 0,
      terminal: 0,
      remaining: 0,
      retryable: false,
    });
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it('sends the exact owner-free upsert RPC and acknowledges accepted work', async () => {
    h.pending = [upsertOperation(OPERATION_A)];
    h.rpc.mockResolvedValueOnce(response(OPERATION_A));

    await expect(flushShelfMirrorQueue()).resolves.toEqual({
      flushed: 1,
      terminal: 0,
      remaining: 0,
      retryable: false,
    });
    expect(h.rpc).toHaveBeenCalledWith('sync_shelf_product', {
      p_operation_id: OPERATION_A,
      p_operation_kind: 'upsert',
      p_enqueued_at: '2026-07-26T18:00:00.000Z',
      p_product_id: PRODUCT_A,
      p_payload: payload(),
    });
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('owner-a');
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('user_id');
    expect(JSON.stringify(h.rpc.mock.calls)).not.toContain('legacy_unverified_expiry_date');
    expect(h.acknowledged).toEqual([OPERATION_A]);
  });

  it('routes delete intent through the RPC without a direct table-delete payload', async () => {
    h.pending = [deleteOperation(OPERATION_A)];
    h.rpc.mockResolvedValueOnce(response(OPERATION_A, 'idempotent'));

    await expect(flushShelfMirrorQueue()).resolves.toMatchObject({
      flushed: 1,
      remaining: 0,
    });
    expect(h.rpc).toHaveBeenCalledWith('sync_shelf_product', {
      p_operation_id: OPERATION_A,
      p_operation_kind: 'delete',
      p_enqueued_at: '2026-07-26T19:00:00.000Z',
      p_product_id: PRODUCT_A,
      p_payload: null,
    });
  });

  it('drains accepted and idempotent operations in strict FIFO order', async () => {
    h.pending = [upsertOperation(OPERATION_A), upsertOperation(OPERATION_B, PRODUCT_B)];
    h.rpc
      .mockResolvedValueOnce(response(OPERATION_A, 'idempotent'))
      .mockResolvedValueOnce(response(OPERATION_B));

    await expect(flushShelfMirrorQueue()).resolves.toEqual({
      flushed: 2,
      terminal: 0,
      remaining: 0,
      retryable: false,
    });
    expect(h.acknowledged).toEqual([OPERATION_A, OPERATION_B]);
  });

  it('retains the FIFO head on retryable, PostgREST, and network ambiguity', async () => {
    for (const firstResult of [
      Promise.resolve(response(OPERATION_A, 'retryable')),
      Promise.resolve({ data: null, error: { code: '42501', message: 'not admitted' } }),
      Promise.reject(new Error('offline')),
    ]) {
      h.pending = [upsertOperation(OPERATION_A), upsertOperation(OPERATION_B, PRODUCT_B)];
      h.acknowledged = [];
      h.rpc.mockReset().mockReturnValueOnce(firstResult);

      await expect(flushShelfMirrorQueue()).resolves.toEqual({
        flushed: 0,
        terminal: 0,
        remaining: 2,
        retryable: true,
      });
      expect(h.rpc).toHaveBeenCalledOnce();
      expect(h.acknowledged).toEqual([]);
    }
  });

  it('quarantines an explicit terminal with its full operation and continues later FIFO work', async () => {
    const terminalOperation = upsertOperation(OPERATION_A);
    h.pending = [terminalOperation, upsertOperation(OPERATION_B, PRODUCT_B)];
    h.rpc
      .mockResolvedValueOnce(response(OPERATION_A, 'terminal'))
      .mockResolvedValueOnce(response(OPERATION_B));

    await expect(flushShelfMirrorQueue()).resolves.toEqual({
      flushed: 1,
      terminal: 1,
      remaining: 0,
      retryable: false,
    });
    expect(h.rejected).toEqual([
      {
        operation: terminalOperation,
        code: 'SHELF_PRODUCT_PAYLOAD_INVALID',
      },
    ]);
    expect(JSON.stringify(h.rejected[0]!.operation)).toBe(JSON.stringify(terminalOperation));
    expect(h.acknowledged).toEqual([OPERATION_B]);
    expect(h.rpc).toHaveBeenCalledTimes(2);
  });

  it('fails closed and retains work for malformed or foreign-operation responses', async () => {
    for (const data of [
      null,
      {
        version: 1,
        operation_id: OPERATION_B,
        status: 'accepted',
        code: null,
      },
      {
        version: 1,
        operation_id: OPERATION_A,
        status: 'accepted',
        code: null,
        extra: true,
      },
      {
        version: 1,
        operation_id: OPERATION_A,
        status: 'terminal',
        code: 'permission denied',
      },
      {
        version: 1,
        operation_id: OPERATION_A,
        status: 'terminal',
        code: 'SHELF_NEW_UNKNOWN_CODE',
      },
      {
        version: 1,
        operation_id: OPERATION_A,
        status: 'terminal',
        code: 'SHELF_SYNC_RETRY_LATER',
      },
      {
        version: 1,
        operation_id: OPERATION_A,
        status: 'retryable',
        code: 'SHELF_PRODUCT_PAYLOAD_INVALID',
      },
    ]) {
      h.pending = [upsertOperation(OPERATION_A)];
      h.rpc.mockReset().mockResolvedValueOnce({ data, error: null });

      await expect(flushShelfMirrorQueue()).rejects.toThrow(SHELF_MIRROR_RESPONSE_INVALID);
      expect(h.pending).toHaveLength(1);
      expect(h.acknowledged).toEqual([]);
      expect(h.rejected).toEqual([]);
    }
  });

  it('retains work without a session and rejects an Auth/lease owner mismatch', async () => {
    h.pending = [upsertOperation(OPERATION_A)];
    h.currentUserId = null;
    await expect(flushShelfMirrorQueue()).resolves.toEqual({
      flushed: 0,
      terminal: 0,
      remaining: 1,
      retryable: true,
    });
    expect(h.rpc).not.toHaveBeenCalled();

    h.currentUserId = 'owner-b';
    await expect(flushShelfMirrorQueue()).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    expect(h.rpc).not.toHaveBeenCalled();
    expect(h.pending).toHaveLength(1);
  });

  it('coalesces concurrent wakeups and runs one dirty follow-up snapshot', async () => {
    h.pending = [upsertOperation(OPERATION_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    h.rpc
      .mockImplementationOnce(async () => {
        markStarted();
        await gate;
        return response(OPERATION_A);
      })
      .mockResolvedValueOnce(response(OPERATION_B));

    const first = flushShelfMirrorQueue();
    await started;
    h.pending.push(upsertOperation(OPERATION_B, PRODUCT_B));
    const wake = flushShelfMirrorQueue();
    expect(wake).toBe(first);
    release();

    await expect(first).resolves.toEqual({
      flushed: 2,
      terminal: 0,
      remaining: 0,
      retryable: false,
    });
    expect(h.rpc).toHaveBeenCalledTimes(2);
    expect(h.acknowledged).toEqual([OPERATION_A, OPERATION_B]);
  });

  it('serializes a fresh owner behind a stale flight and never acknowledges the stale response', async () => {
    h.pending = [upsertOperation(OPERATION_A)];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    h.rpc
      .mockImplementationOnce(async () => {
        markStarted();
        await gate;
        return response(OPERATION_A);
      })
      .mockResolvedValueOnce(response(OPERATION_B));

    const ownerA = flushShelfMirrorQueue();
    await started;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(10, {
      ownerUserId: 'owner-b',
      accountGeneration: 0,
      serverVerifiedAt: null,
    });
    h.currentUserId = 'owner-b';
    h.pending = [upsertOperation(OPERATION_B, PRODUCT_B)];
    const ownerB = flushShelfMirrorQueue();
    expect(ownerB).not.toBe(ownerA);
    expect(h.rpc).toHaveBeenCalledOnce();

    release();
    await expect(ownerA).rejects.toThrow('HEALTH_DATA_WRITE_OWNER_MISMATCH');
    await expect(ownerB).resolves.toMatchObject({ flushed: 1, remaining: 0 });
    expect(h.acknowledged).toEqual([OPERATION_B]);
  });

  it('returns a rejected promise after admission closes', async () => {
    clearActiveHealthProcessingEpoch();

    const pending = flushShelfMirrorQueue();

    await expect(pending).rejects.toThrow('HEALTH_DATA_WRITE_ADMISSION_CLOSED');
    expect(h.rpc).not.toHaveBeenCalled();
  });
});
