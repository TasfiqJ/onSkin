import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  clearActiveHealthProcessingEpoch,
  createHealthEpochFetch,
  registerDependentConsentTransportSnapshotProvider,
  setActiveHealthProcessingEpoch,
} from './healthProcessingEpoch';

const URL = 'https://project.supabase.co';

describe('dependent consent PostgREST generation carrier', () => {
  let dependentOpen = true;
  let photoCloudOpen = true;
  let transport: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    dependentOpen = true;
    photoCloudOpen = true;
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(7, { ownerUserId: 'user-a', accountGeneration: 3 });
    registerDependentConsentTransportSnapshotProvider((type) =>
      (dependentOpen && type === 'data_sharing') ||
      (photoCloudOpen && type === 'photo_cloud_backup')
        ? {
            type,
            generation: 12,
            processGeneration: 44,
            assertCurrent: () => {
              if (!dependentOpen) throw new Error('HEALTH_DEPENDENT_CONSENT_STALE');
            },
          }
        : null,
    );
    transport = vi.fn(async () => new Response('{}', { status: 201 }));
  });
  afterEach(() => {
    clearActiveHealthProcessingEpoch();
  });

  const remote = () => ({
    state: 'active',
    generation: 2,
    subject: 'user-a',
    sessionId: 'session-a',
  });

  it('adds exact type:generation metadata only to the classified table', async () => {
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);
    await wrapped(`${URL}/rest/v1/commerce_click_events`, {
      headers: { 'x-client-info': 'supabase-js/2' },
    });
    const headers = new Headers(transport.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-client-info')).toBe(
      'supabase-js/2; onskin-health-epoch=7; onskin-consent-generation=data_sharing:12',
    );
  });

  it('blocks before dispatch when a classified purpose has no active lease', async () => {
    dependentOpen = false;
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);
    await expect(wrapped(`${URL}/rest/v1/commerce_click_events`)).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_CLOSED',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('requires cloud-backup authority for every non-delete photos transport', async () => {
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);
    for (const method of ['GET', 'HEAD', 'POST', 'PUT', 'PATCH']) {
      await wrapped(`${URL}/rest/v1/photos`, { method });
      const headers = new Headers(transport.mock.calls.at(-1)?.[1]?.headers);
      expect(headers.get('x-client-info')).toBe(
        'onskin-health-epoch=7; onskin-consent-generation=photo_cloud_backup:12',
      );
    }

    photoCloudOpen = false;
    await expect(wrapped(`${URL}/rest/v1/photos`, { method: 'POST' })).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_CLOSED',
    );
    expect(transport).toHaveBeenCalledTimes(5);
  });

  it('never blocks a privacy-reducing photos DELETE on cloud-backup consent', async () => {
    photoCloudOpen = false;
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);

    await expect(
      wrapped(`${URL}/rest/v1/photos?id=eq.photo-a`, { method: 'DELETE' }),
    ).resolves.toBeInstanceOf(Response);

    expect(transport).toHaveBeenCalledOnce();
    const headers = new Headers(transport.mock.calls[0]?.[1]?.headers);
    expect(headers.get('x-client-info')).toBe('onskin-health-epoch=7');
    expect(headers.get('x-client-info')).not.toContain('onskin-consent-generation');
  });

  it('uses the effective init method when a Request method is overridden', async () => {
    photoCloudOpen = false;
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);
    const deleteRequest = new Request(`${URL}/rest/v1/photos`, { method: 'DELETE' });

    await expect(wrapped(deleteRequest, { method: 'POST' })).rejects.toThrow(
      'HEALTH_DEPENDENT_CONSENT_CLOSED',
    );
    expect(transport).not.toHaveBeenCalled();
  });

  it('drains and rejects a response that arrives after dependent revocation', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    transport.mockImplementationOnce(async () => {
      await gate;
      return new Response('{"ok":true}', { status: 201 });
    });
    const wrapped = createHealthEpochFetch(transport as typeof fetch, URL, remote);
    const pending = wrapped(`${URL}/rest/v1/commerce_click_events`);
    dependentOpen = false;
    release();
    await expect(pending).rejects.toThrow('HEALTH_DEPENDENT_CONSENT_STALE');
  });
});
