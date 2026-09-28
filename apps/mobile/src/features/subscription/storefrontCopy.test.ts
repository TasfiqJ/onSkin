import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { subscriptionStorefrontCopy } from './storefrontCopy';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function source(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

function renderedCopy(platform: string): string {
  const copy = subscriptionStorefrontCopy(platform);
  return [
    copy.billingContinuation,
    copy.cancellationNote('July 31, 2026'),
    copy.managementUnavailable,
    copy.manageLabel,
  ].join(' ');
}

describe('subscription storefront copy', () => {
  it('names only Apple and the App Store on iOS', () => {
    const copy = renderedCopy('ios');

    expect(copy).toContain('App Store');
    expect(copy).not.toMatch(/Google|Google Play/);
  });

  it('names only Google Play on Android', () => {
    const copy = renderedCopy('android');

    expect(copy).toContain('Google Play');
    expect(copy).not.toMatch(/Apple|App Store/);
  });

  it('uses provider-neutral copy on runtimes without a native subscription store', () => {
    const copy = renderedCopy('web');

    expect(copy).toContain('subscription provider');
    expect(copy).not.toMatch(/Apple|App Store|Google Play/);
  });

  it('routes every production marketplace notice through the platform copy boundary', () => {
    const you = source('app/(tabs)/you.tsx');
    const subscription = source('app/settings/subscription.tsx');
    const noticeHost = source('features/subscription/StoreTransactionNoticeHost.tsx');
    const runtimeSources = [you, subscription, noticeHost].join('\n');

    expect(runtimeSources).not.toMatch(/Apple or Google|App Store or Google Play/);
    expect(you).toContain('subscriptionStorefrontCopy(Platform.OS)');
    expect(you).toContain('SUBSCRIPTION_STOREFRONT_COPY.billingContinuation');
    expect(subscription).toContain('subscriptionStorefrontCopy(Platform.OS)');
    expect(subscription).toContain('SUBSCRIPTION_STOREFRONT_COPY.managementUnavailable');
    expect(subscription).toContain('SUBSCRIPTION_STOREFRONT_COPY.manageLabel');
    expect(subscription).toContain('SUBSCRIPTION_STOREFRONT_COPY.cancellationNote(endDateLabel)');
    expect(noticeHost).toContain('subscriptionStorefrontCopy(Platform.OS)');
    expect(noticeHost).toContain('storefrontCopy.managementUnavailable');
  });

  it('does not promise a universal one-tap cancellation flow', () => {
    expect(renderedCopy('ios')).not.toMatch(/one tap|no maze/iu);
    expect(renderedCopy('android')).not.toMatch(/one tap|no maze/iu);
  });
});
