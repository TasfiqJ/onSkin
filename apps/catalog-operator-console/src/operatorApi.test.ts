import { describe, expect, it, vi } from 'vitest';

import type { OperatorConsoleEnvironment } from './env';
import { OperatorApi, OperatorApiError, type OperatorFetch } from './operatorApi';

const environment: OperatorConsoleEnvironment = {
  environment: 'production',
  supabaseUrl: 'https://project.supabase.co',
  publishableKey: 'sb_publishable_0123456789abcdefghijklmnopqrstuvwxyz',
  operatorApiUrl: 'https://project.supabase.co/functions/v1/catalog-operator',
};
const requestId = '6a2a55fc-9214-4a17-8c13-723af6b00830';
const sessionId = 'f1e90bb0-1ca1-4cbf-a469-363b5a814b2c';
const operatorUserId = '274469d4-c6d0-42af-b0db-13441a89d8e3';
const leaseId = 'f73d0b85-0e52-4a14-96ec-6c702ea879ec';

function jsonResponse(value: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Request-Id': requestId,
      ...headers,
    },
  });
}

describe('operator API', () => {
  it('sends a bearer-scoped no-store request and validates a session response', async () => {
    const fetchMock = vi.fn<OperatorFetch>(async (_input, init) => {
      expect(init?.method).toBe('POST');
      expect(init?.cache).toBe('no-store');
      expect(init?.credentials).toBe('omit');
      expect(init?.redirect).toBe('error');
      expect(init?.referrerPolicy).toBe('no-referrer');
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer user-jwt');
      expect(headers.get('apikey')).toBe(environment.publishableKey);
      expect(headers.get('cache-control')).toBeNull();
      expect(headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
      expect(init?.body).toBe(JSON.stringify({ action: 'session' }));
      return jsonResponse({
        result: {
          action: 'session',
          operatorSessionId: sessionId,
          operatorUserId,
          operatorEmail: 'operator@example.test',
          expiresAt: '2026-07-22T20:00:00.000Z',
          capabilities: ['correction_queue_read'],
          environment: 'production',
          sourceRevision: 'b'.repeat(40),
          edgeDeploymentId: 'project_function_42',
          admissionState: 'open',
          controlGeneration: 7,
        },
      });
    });
    const api = new OperatorApi(environment, async () => 'user-jwt', fetchMock);

    await expect(api.call({ action: 'session' })).resolves.toEqual({
      operatorSessionId: sessionId,
      operatorUserId,
      operatorEmail: 'operator@example.test',
      expiresAt: '2026-07-22T20:00:00.000Z',
      capabilities: ['correction_queue_read'],
      environment: 'production',
      sourceRevision: 'b'.repeat(40),
      edgeDeploymentId: 'project_function_42',
      admissionState: 'open',
      controlGeneration: 7,
    });
  });

  it('rejects non-normalized identity and unexpected Auth metadata in a session receipt', async () => {
    for (const unsafeFields of [
      { operatorEmail: 'Operator@example.test' },
      { authMetadata: { provider: 'email' } },
    ]) {
      const api = new OperatorApi(
        environment,
        async () => 'user-jwt',
        async () =>
          jsonResponse({
            result: {
              action: 'session',
              operatorSessionId: sessionId,
              operatorUserId,
              operatorEmail: 'operator@example.test',
              expiresAt: '2026-07-22T20:00:00.000Z',
              capabilities: ['correction_queue_read'],
              environment: 'production',
              sourceRevision: 'b'.repeat(40),
              edgeDeploymentId: 'project_function_42',
              admissionState: 'open',
              controlGeneration: 7,
              ...unsafeFields,
            },
          }),
      );

      await expect(api.call({ action: 'session' })).rejects.toMatchObject({
        code: 'request_failed',
      });
    }
  });

  it('rejects unexpected projection fields even when the server returns success', async () => {
    const api = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () =>
        jsonResponse({
          result: {
            action: 'detail',
            itemKind: 'correction_report',
            itemId: '7bb4352f-cb78-40cf-8ba5-f5f06a112f66',
            itemVersion: 1,
            status: 'open',
            detail: { reporterEmail: 'must-not-escape@example.test' },
          },
        }),
    );

    await expect(
      api.call({
        action: 'detail',
        itemKind: 'correction_report',
        itemId: '7bb4352f-cb78-40cf-8ba5-f5f06a112f66',
        leaseId,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'request_failed' });
  });

  it('accepts the bounded correction review projection without reporter identity', async () => {
    const itemId = '7bb4352f-cb78-40cf-8ba5-f5f06a112f66';
    const productId = 'dd30b420-2c1d-4f17-99c2-c31058e79917';
    const api = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () =>
        jsonResponse({
          result: {
            action: 'detail',
            itemKind: 'correction_report',
            itemId,
            itemVersion: 1,
            status: 'open',
            detail: {
              correctionType: 'wrong_match',
              productId,
              barcode: '12345670',
              description: 'Wrong match from product detail',
              proposedPayload: { productName: 'Barrier Cream', defaultPaoMonths: 12 },
              createdAt: '2026-07-22T16:00:00.000Z',
              status: 'pending',
              product: { id: productId, name: 'Barrier Cream', brand: null, category: null },
            },
          },
        }),
    );

    await expect(
      api.call({
        action: 'detail',
        itemKind: 'correction_report',
        itemId,
        leaseId,
        expectedVersion: 1,
      }),
    ).resolves
      .toMatchObject({ itemId, detail: { description: 'Wrong match from product detail' } });
  });

  it('maps only allowlisted errors and never exposes database text', async () => {
    const api = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () => jsonResponse({ error: 'conflict' }, 409),
    );

    const error = await api.call({ action: 'session' }).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(OperatorApiError);
    expect(error).toMatchObject({ code: 'conflict', status: 409, requestId });
    expect((error as Error).message).not.toContain('database');

    const unsafeApi = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () => jsonResponse({ error: 'select failed: secret row data' }, 500),
    );
    await expect(unsafeApi.call({ action: 'session' })).rejects.toMatchObject({
      code: 'request_failed',
    });

    const invalidApi = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () => jsonResponse({ error: 'invalid_request' }, 400),
    );
    await expect(invalidApi.call({ action: 'session' })).rejects.toMatchObject({
      code: 'invalid_request',
      status: 400,
    });
  });

  it('rejects non-JSON and oversized responses', async () => {
    const nonJsonApi = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () => new Response('not json', { headers: { 'Content-Type': 'text/plain' } }),
    );
    await expect(nonJsonApi.call({ action: 'session' })).rejects.toMatchObject({
      code: 'request_failed',
    });

    const oversizedApi = new OperatorApi(
      environment,
      async () => 'user-jwt',
      async () =>
        new Response('{}', {
          headers: {
            'Content-Length': String(128 * 1024 + 1),
            'Content-Type': 'application/json',
          },
        }),
    );
    await expect(oversizedApi.call({ action: 'session' })).rejects.toMatchObject({
      code: 'request_failed',
    });
  });
});
