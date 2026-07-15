import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const REVENUECAT_SOURCE = fileURLToPath(new URL('./revenuecat.ts', import.meta.url));
const COORDINATOR_SOURCE = fileURLToPath(
  new URL('./revenuecatOwnerCoordinator.ts', import.meta.url),
);

describe('RevenueCat identity boundary', () => {
  it('gates RevenueCat writes on the durable deletion receipt', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');
    const coordinator = readFileSync(COORDINATOR_SOURCE, 'utf8');

    expect(source).toContain('if (accountDeletionVendorWritesBlocked()) return null;');
    expect(source).toContain('export async function freezeRevenueCatIdentityForAccountDeletion');
    expect(source).toContain('export async function resetRevenueCatIdentity');
    expect(source).toContain('ownerCoordinator.reset');
    expect(source).toContain('ownerCoordinator.configureFor');
    expect(source).toContain('ownerCoordinator.runRead');
    expect(source).toContain('ownerCoordinator.runHazard');
    expect(source).toContain('deletionOperationBarrier.waitForSettled()');
    expect(source).toContain('ownerCoordinator.waitForNativeHazardsToSettle()');
    expect(source).toContain('cachedOfferings = null');
    expect(source).toContain('accountDeletionVendorWritesBlocked()');
    expect(source).not.toContain('let configurePromise');
    expect(source).not.toContain('let accountDeletionWritesFrozen');

    expect(source).toContain('type OwnerTaggedOfferings');
    expect(source).toContain('cachedOfferings.stamp.appUserId !== context.appUserId');
    expect(source).toContain('!ownerCoordinator.isStampCurrent(cachedOfferings.stamp)');
    expect(source).toContain("'purchase',");
    expect(source).toContain("'restore',");
    expect(source).toContain("'manage',");
    expect(coordinator).toContain('adapter.getAppUserID()');
    expect(coordinator).toContain('awaitAccountGenerationLease(context.lease');
    expect(coordinator).toContain('if (!anonymous && nativeUserId === context.appUserId)');
    expect(coordinator).toContain('await this.logOutAndProveAnonymous(adapter);');
    expect(coordinator).toContain('await this.logInAndProveExpected(adapter, context);');
  });

  it('owner-fences exact trial eligibility and keeps unknown platforms fail closed', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    expect(source).toContain("if (Platform.OS !== 'ios') return unknown;");
    expect(source).toContain(
      '(current) => current.checkTrialOrIntroductoryPriceEligibility(productIds)',
    );
    expect(source).toContain('context.lease.assertCurrent();');
    expect(source).toContain("trialEligibility: 'unknown'");
    expect(source).toContain("trialEligibility === 'eligible'");
    expect(source).toContain('introLabel: null');
  });

  it('keeps finite win-back terms separate from standard renewal terms', () => {
    const source = readFileSync(REVENUECAT_SOURCE, 'utf8');

    expect(source).toContain('purchasePeriodLabel: revenueCatPeriodLabel');
    expect(source).toContain('purchasePriceLabel: winBackOffer.priceString');
    expect(source).toContain('offerDurationLabel: revenueCatOfferDurationLabel');
    expect(source).toContain('renewalPriceLabel: annualPackage.product.priceString');
    expect(source).toContain("renewalPeriodLabel: periodLabelFor('annual', annualPackage)");
  });
});
