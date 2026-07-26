import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAccountActivityBlockedForDeletion } from '@/features/settings/accountDeletionBarrier';
import {
  closeAnalyticsPublication,
  getAnalyticsPublicationGeneration,
  openAnalyticsPublication,
  publishAnalyticsEvent,
  type AnalyticsPublicationTransport,
  type VerifiedAnalyticsPublicationReceipt,
} from './publicationGate';

function receipt(ownerId: string, token: string, generation: number) {
  return { ownerId, token, generation, verified: true as const };
}

function transport() {
  const publish = vi.fn<AnalyticsPublicationTransport['publish']>();
  return { publish, transport: { publish } };
}

describe('analytics publication gate', () => {
  beforeEach(() => {
    setAccountActivityBlockedForDeletion(false);
    closeAnalyticsPublication();
  });

  afterEach(() => {
    closeAnalyticsPublication();
    setAccountActivityBlockedForDeletion(true);
  });

  it('defaults closed and never replays events emitted before a grant', () => {
    const target = transport();

    expect(publishAnalyticsEvent('screen_viewed', { screen_name: 'today' })).toBe(false);
    expect(target.publish).not.toHaveBeenCalled();

    const generation = getAnalyticsPublicationGeneration();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'verified-receipt-a', generation),
        transport: target.transport,
      }),
    ).toBe(true);
    expect(target.publish).not.toHaveBeenCalled();

    expect(publishAnalyticsEvent('screen_viewed', { screen_name: 'today' })).toBe(true);
    expect(target.publish).toHaveBeenCalledOnce();
  });

  it('opens only for exact nonempty owner and verified current receipt inputs', () => {
    const generation = getAnalyticsPublicationGeneration();
    const target = transport();

    for (const [ownerId, ownerInReceipt, token, receiptGeneration, verified] of [
      ['', '', 'verified-receipt', generation, true],
      [' owner-a', ' owner-a', 'verified-receipt', generation, true],
      ['owner-a ', 'owner-a ', 'verified-receipt', generation, true],
      ['owner-a', 'owner-b', 'verified-receipt', generation, true],
      ['owner-a', 'owner-a', '', generation, true],
      ['owner-a', 'owner-a', ' verified-receipt', generation, true],
      ['owner-a', 'owner-a', 'verified-receipt', generation - 1, true],
      ['owner-a', 'owner-a', 'verified-receipt', generation, false],
    ] as const) {
      expect(
        openAnalyticsPublication({
          ownerId,
          receipt: {
            ownerId: ownerInReceipt,
            token,
            generation: receiptGeneration,
            verified,
          } as VerifiedAnalyticsPublicationReceipt,
          transport: target.transport,
        }),
      ).toBe(false);
    }

    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'verified-receipt', generation),
        transport: target.transport,
      }),
    ).toBe(true);
  });

  it('closes synchronously, discards the transport, and fences stale receipts', () => {
    const first = transport();
    const firstGeneration = getAnalyticsPublicationGeneration();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'receipt-a', firstGeneration),
        transport: first.transport,
      }),
    ).toBe(true);

    closeAnalyticsPublication();
    expect(getAnalyticsPublicationGeneration()).toBe(firstGeneration + 1);
    expect(publishAnalyticsEvent('screen_viewed', { screen_name: 'today' })).toBe(false);
    expect(first.publish).not.toHaveBeenCalled();

    const second = transport();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-b',
        receipt: receipt('owner-b', 'stale-receipt-b', firstGeneration),
        transport: second.transport,
      }),
    ).toBe(false);
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-b',
        receipt: receipt(
          'owner-b',
          'current-receipt-b',
          getAnalyticsPublicationGeneration(),
        ),
        transport: second.transport,
      }),
    ).toBe(true);
    expect(publishAnalyticsEvent('screen_viewed', { screen_name: 'progress' })).toBe(true);
    expect(first.publish).not.toHaveBeenCalled();
    expect(second.publish).toHaveBeenCalledOnce();
  });

  it('keeps the current owner open and rejects a second owner until an explicit close', () => {
    const first = transport();
    const second = transport();
    const generation = getAnalyticsPublicationGeneration();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'receipt-a', generation),
        transport: first.transport,
      }),
    ).toBe(true);
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-b',
        receipt: receipt('owner-b', 'receipt-b', generation),
        transport: second.transport,
      }),
    ).toBe(false);

    expect(publishAnalyticsEvent('screen_viewed', undefined)).toBe(true);
    expect(first.publish).toHaveBeenCalledOnce();
    expect(second.publish).not.toHaveBeenCalled();
  });

  it('closes immediately when the account deletion barrier activates', () => {
    const target = transport();
    const generation = getAnalyticsPublicationGeneration();
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'receipt-a', generation),
        transport: target.transport,
      }),
    ).toBe(true);

    setAccountActivityBlockedForDeletion(true);
    expect(getAnalyticsPublicationGeneration()).toBe(generation + 1);
    expect(publishAnalyticsEvent('screen_viewed', undefined)).toBe(false);
    expect(target.publish).not.toHaveBeenCalled();

    setAccountActivityBlockedForDeletion(false);
    expect(publishAnalyticsEvent('screen_viewed', undefined)).toBe(false);
    expect(target.publish).not.toHaveBeenCalled();
  });

  it('does not throw app code when an injected transport rejects an event', () => {
    const generation = getAnalyticsPublicationGeneration();
    const publish = vi.fn(() => {
      throw new Error('transport unavailable');
    });
    expect(
      openAnalyticsPublication({
        ownerId: 'owner-a',
        receipt: receipt('owner-a', 'receipt-a', generation),
        transport: { publish },
      }),
    ).toBe(true);

    expect(publishAnalyticsEvent('screen_viewed', undefined)).toBe(false);
    expect(publish).toHaveBeenCalledOnce();
  });
});
