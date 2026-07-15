import { readdirSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activeHealthProcessingEpoch,
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  createHealthEpochFetch,
  HEALTH_PROCESSING_RESULT_STALE,
  HEALTH_PROCESSING_STATUS_LEASE_MS,
  isHealthProcessingStatusLeaseCurrent,
  setActiveHealthProcessingEpoch,
} from './healthProcessingEpoch';

const SUPABASE_URL = 'https://project.supabase.co';
const MOBILE_SRC = fileURLToPath(new URL('../../', import.meta.url));

function productionTypeScriptSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return productionTypeScriptSources(path);
    if (!entry.isFile() || !/\.tsx?$/u.test(entry.name) || /\.test\.tsx?$/u.test(entry.name)) {
      return [];
    }
    return [path];
  });
}

function recordingTransport() {
  const calls: { input: RequestInfo | URL; init?: RequestInit }[] = [];
  const transport = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  return { calls, transport };
}

type TestRemoteAuthority = {
  state: string;
  generation: number;
  subject: string | null;
  sessionId: string | null;
};

const activeRemoteAuthority = () =>
  ({
    state: 'active',
    generation: 1,
    subject: 'owner-a',
    sessionId: 'session-a',
  }) as const;

function deferredBodyResponse() {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(streamController) {
        controller = streamController;
      },
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'application/json', 'x-response-id': 'old-response' },
    },
  );
  return {
    response,
    finish(body: string) {
      if (controller === null) throw new Error('DEFERRED_RESPONSE_NOT_STARTED');
      controller.enqueue(new TextEncoder().encode(body));
      controller.close();
    },
  };
}

function activate(epoch: number, ownerUserId = 'owner-a', accountGeneration = 1) {
  return setActiveHealthProcessingEpoch(epoch, {
    ownerUserId,
    accountGeneration,
    serverVerifiedAt: null,
  });
}

describe('health processing epoch transport', () => {
  afterEach(() => {
    clearActiveHealthProcessingEpoch();
    vi.useRealTimers();
  });

  it('uses CORS-admitted client metadata for PostgREST without changing Prefer', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(7);

    await wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`, {
      headers: {
        Authorization: 'Bearer redacted',
        'X-Client-Info': 'supabase-js/2.108.1; runtime=web',
        Prefer: 'handling=strict, return=representation',
      },
    });

    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('x-onskin-health-epoch')).toBeNull();
    expect(headers.get('Authorization')).toBe('Bearer redacted');
    expect(headers.get('x-client-info')).toBe(
      'supabase-js/2.108.1; runtime=web; onskin-health-epoch=7',
    );
    expect(headers.get('Prefer')).toBe('handling=strict, return=representation');
  });

  it('uses the dedicated header only for the three catalog Edge functions', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(9);

    for (const functionName of ['catalog-lookup', 'catalog-report', 'catalog-search']) {
      await wrapped(`${SUPABASE_URL}/functions/v1/${functionName}?source=mobile`, {
        headers: { 'x-client-info': 'supabase-js/2.108.1; runtime=web' },
      });
    }

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('x-onskin-health-epoch')).toBe('9');
      expect(headers.get('x-client-info')).toBe('supabase-js/2.108.1; runtime=web');
    }
  });

  it('does not mark Auth, Storage, or non-catalog Edge requests', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(11);

    for (const url of [
      `${SUPABASE_URL}/auth/v1/user`,
      `${SUPABASE_URL}/rest/v1/consents`,
      `${SUPABASE_URL}/storage/v1/object/photos/owner/file.enc`,
      `${SUPABASE_URL}/functions/v1/consent-withdrawal`,
      `${SUPABASE_URL}/functions/v1/data-export`,
      `${SUPABASE_URL}/functions/v1/subscription-grants`,
      `${SUPABASE_URL}/functions/v1/subscription-reconciliation`,
    ]) {
      await wrapped(url, { headers: { 'x-client-info': 'sdk' } });
    }

    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('x-onskin-health-epoch')).toBeNull();
      expect(headers.get('x-client-info')).toBe('sdk');
    }
  });

  it('classifies URL and Request inputs and merges init headers over Request headers', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(13);

    await wrapped(new URL(`${SUPABASE_URL}/rest/v1/skin_profiles`), {
      headers: { 'x-client-info': 'url-input' },
    });
    await wrapped(
      new Request(`${SUPABASE_URL}/functions/v1/catalog-lookup`, {
        headers: { 'x-client-info': 'request-input', 'x-request-only': 'kept' },
      }),
      { headers: { 'X-Client-Info': 'init-override' } },
    );

    const restHeaders = new Headers(calls[0]?.init?.headers);
    expect(restHeaders.get('x-client-info')).toBe('url-input; onskin-health-epoch=13');
    const edgeHeaders = new Headers(calls[1]?.init?.headers);
    expect(edgeHeaders.get('x-onskin-health-epoch')).toBe('13');
    expect(edgeHeaders.get('x-client-info')).toBe('init-override');
    expect(edgeHeaders.get('x-request-only')).toBe('kept');
  });

  it('fails safe for relative, malformed, cross-origin, port, and path lookalikes', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(17);

    for (const input of [
      '/rest/v1/photos',
      '://malformed',
      'https://project.supabase.co.evil.invalid/rest/v1/photos',
      'https://project.supabase.co:444/rest/v1/photos',
      `${SUPABASE_URL}/prefix/rest/v1/photos`,
      `${SUPABASE_URL}/rest/v10/photos`,
      `${SUPABASE_URL}/functions/v1/catalog-lookup/extra`,
      `${SUPABASE_URL}/functions/v1/catalog-lookup-evil`,
    ]) {
      await wrapped(input, { headers: { 'x-client-info': 'sdk' } });
    }

    for (const call of calls) {
      const headers = new Headers(call.init?.headers);
      expect(headers.get('x-onskin-health-epoch')).toBeNull();
      expect(headers.get('x-client-info')).toBe('sdk');
    }
  });

  it('removes stale or caller-supplied markers case-insensitively', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(19);

    await wrapped(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'X-OnSkin-Health-Epoch': '999',
        'X-Client-Info': 'sdk; ONSKIN-HEALTH-EPOCH=999',
        Authorization: 'Bearer retained',
      },
    });
    await wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`, {
      headers: {
        'X-OnSkin-Health-Epoch': '999',
        'X-Client-Info': 'sdk; onskin-health-epoch=999',
      },
    });

    const authHeaders = new Headers(calls[0]?.init?.headers);
    expect(authHeaders.get('x-onskin-health-epoch')).toBeNull();
    expect(authHeaders.get('x-client-info')).toBeNull();
    expect(authHeaders.get('Authorization')).toBe('Bearer retained');
    const restHeaders = new Headers(calls[1]?.init?.headers);
    expect(restHeaders.get('x-onskin-health-epoch')).toBeNull();
    expect(restHeaders.get('x-client-info')).toBe('onskin-health-epoch=19');
  });

  it('leaves requests unchanged while health processing is closed', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    await wrapped(`${SUPABASE_URL}/auth/v1/user`);
    expect(calls[0]?.init).toBeUndefined();
  });

  it('keeps unmarked requests as direct transport pass-throughs', async () => {
    const original = new Response('auth response', { status: 200 });
    const transportPromise = Promise.resolve(original);
    const transport = vi.fn(() => transportPromise) as unknown as typeof fetch;
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(7);

    const resultPromise = wrapped(`${SUPABASE_URL}/auth/v1/user`);

    expect(resultPromise).toBe(transportPromise);
    await expect(resultPromise).resolves.toBe(original);
    expect(original.bodyUsed).toBe(false);
  });

  it('fully buffers a marked response and returns an equivalent unread Response', async () => {
    const original = new Response('{"ok":true}', {
      status: 201,
      statusText: 'Created',
      headers: { 'content-type': 'application/json', 'x-response-id': 'response-1' },
    });
    const transport = vi.fn(async () => original) as unknown as typeof fetch;
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    activate(7);

    const result = await wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`);

    expect(result).not.toBe(original);
    expect(original.bodyUsed).toBe(true);
    expect(result.bodyUsed).toBe(false);
    expect(result.status).toBe(201);
    expect(result.statusText).toBe('Created');
    expect(result.headers.get('content-type')).toBe('application/json');
    expect(result.headers.get('x-response-id')).toBe('response-1');
    await expect(result.text()).resolves.toBe('{"ok":true}');
  });

  it('rejects a fully buffered epoch-1 response after close and epoch-2 regrant', async () => {
    let remote: TestRemoteAuthority = {
      state: 'active',
      generation: 1,
      subject: 'owner-a',
      sessionId: 'session-a',
    };
    const deferred = deferredBodyResponse();
    const transport = vi.fn(async () => deferred.response) as unknown as typeof fetch;
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, () => remote);
    activate(1, 'owner-a', 4);

    const pending = wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`);
    let settled = false;
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    clearActiveHealthProcessingEpoch();
    remote = { state: 'closed', generation: 2, subject: null, sessionId: null };
    activate(2, 'owner-a', 4);
    remote = {
      state: 'active',
      generation: 3,
      subject: 'owner-a',
      sessionId: 'session-a-next',
    };
    await Promise.resolve();
    expect(settled).toBe(false);

    deferred.finish('{"epoch":1}');
    await expect(pending).rejects.toThrow(HEALTH_PROCESSING_RESULT_STALE);
    expect(deferred.response.bodyUsed).toBe(true);
  });

  it('rejects a fully buffered owner-A response after owner-B takes the same epoch', async () => {
    let remote: TestRemoteAuthority = {
      state: 'active',
      generation: 8,
      subject: 'owner-a',
      sessionId: 'session-a',
    };
    const deferred = deferredBodyResponse();
    const transport = vi.fn(async () => deferred.response) as unknown as typeof fetch;
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, () => remote);
    activate(12, 'owner-a', 10);

    const pending = wrapped(`${SUPABASE_URL}/functions/v1/catalog-search`);
    clearActiveHealthProcessingEpoch();
    remote = { state: 'closed', generation: 9, subject: null, sessionId: null };
    activate(12, 'owner-b', 11);
    remote = {
      state: 'active',
      generation: 10,
      subject: 'owner-b',
      sessionId: 'session-b',
    };

    deferred.finish('{"owner":"owner-a"}');
    await expect(pending).rejects.toThrow(HEALTH_PROCESSING_RESULT_STALE);
    expect(deferred.response.bodyUsed).toBe(true);
  });

  it('strips stale markers even while health processing is closed', async () => {
    const { calls, transport } = recordingTransport();
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, activeRemoteAuthority);
    await wrapped(`${SUPABASE_URL}/rest/v1/photos`, {
      method: 'DELETE',
      headers: {
        'x-onskin-health-epoch': '23',
        'x-client-info': 'sdk; onskin-health-epoch=23',
      },
    });
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get('x-onskin-health-epoch')).toBeNull();
    expect(headers.get('x-client-info')).toBeNull();
  });

  it('keeps cloud Storage publication unavailable until it has a reviewed epoch lane', () => {
    const storageReferences = productionTypeScriptSources(MOBILE_SRC)
      .filter((path) => {
        const source = readFileSync(path, 'utf8');
        return /supabase\s*\.\s*storage|\/storage\/v1\//u.test(source);
      })
      .map((path) => relative(MOBILE_SRC, path).replaceAll('\\', '/'));
    expect(storageReferences).toEqual(['lib/supabase/remoteRequestAdmission.ts']);
  });

  it('rejects non-positive, fractional, and unsafe epochs', () => {
    for (const epoch of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => setActiveHealthProcessingEpoch(epoch)).toThrow(
        'HEALTH_PROCESSING_EPOCH_INVALID',
      );
    }
    expect(activeHealthProcessingEpoch()).toBeNull();
  });

  it('expires configured status and removes the epoch from later requests', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    expect(activeHealthProcessingEpoch('owner-a')).toBe(7);

    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    expect(activeHealthProcessingEpoch('owner-a')).toBeNull();
  });

  it('rejects a foreign owner and fail-closes future server timestamps', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'owner-a',
      accountGeneration: 1,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    expect(activeHealthProcessingEpoch('owner-b')).toBeNull();
    expect(isHealthProcessingStatusLeaseCurrent('2026-07-15T12:02:00.000Z')).toBe(false);
  });

  it('binds marker issuance to the active remote-request subject even at an exact epoch collision', async () => {
    const { calls, transport } = recordingTransport();
    let remote: TestRemoteAuthority = {
      state: 'active',
      generation: 1,
      subject: 'owner-b',
      sessionId: 'session-b',
    };
    const wrapped = createHealthEpochFetch(transport, SUPABASE_URL, () => remote);
    activate(7, 'owner-a', 3);

    await wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`);
    expect(new Headers(calls[0]?.init?.headers).get('x-client-info')).toBeNull();

    activate(7, 'owner-b', 3);
    await wrapped(`${SUPABASE_URL}/rest/v1/skin_profiles`);
    expect(new Headers(calls[1]?.init?.headers).get('x-client-info')).toBe('onskin-health-epoch=7');

    remote = {
      state: 'candidate',
      generation: 2,
      subject: 'owner-b',
      sessionId: 'session-b',
    };
    await wrapped(`${SUPABASE_URL}/functions/v1/catalog-search`);
    expect(new Headers(calls[2]?.init?.headers).get('x-onskin-health-epoch')).toBeNull();
  });

  it('uses exact lease CAS so stale owners and renewed proof timers cannot clear a later lease', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    const first = setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'owner-a',
      accountGeneration: 4,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });
    vi.advanceTimersByTime(1_000);
    const renewed = setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'owner-a',
      accountGeneration: 4,
      serverVerifiedAt: '2026-07-15T12:00:01.000Z',
    });

    expect(renewed.generation).not.toBe(first.generation);
    expect(
      clearActiveHealthProcessingEpoch({
        ownerUserId: 'owner-a',
        generation: first.generation,
        accountGeneration: 4,
      }),
    ).toBe(false);
    expect(activeHealthProcessingLeaseSnapshot()).toEqual(renewed);

    activate(7, 'owner-b', 5);
    expect(clearActiveHealthProcessingEpoch({ ownerUserId: 'owner-a' })).toBe(false);
    expect(activeHealthProcessingEpoch('owner-b')).toBe(7);
  });

  it('lets the exact deadline timer claim an expired raw lease even after a reader observed closure', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00.000Z'));
    const scheduled = setActiveHealthProcessingEpoch(7, {
      ownerUserId: 'owner-a',
      accountGeneration: 6,
      serverVerifiedAt: '2026-07-15T12:00:00.000Z',
    });

    vi.advanceTimersByTime(HEALTH_PROCESSING_STATUS_LEASE_MS);
    expect(activeHealthProcessingEpoch('owner-a')).toBeNull();
    expect(
      clearActiveHealthProcessingEpoch({
        ownerUserId: 'owner-a',
        generation: scheduled.generation,
        accountGeneration: 6,
      }),
    ).toBe(true);
    expect(activeHealthProcessingLeaseSnapshot()).toBeNull();
  });
});
