import { runHealthDependentConsentOperation } from '@/lib/consent/dependentConsentLease';

export type CommerceDisclosureResult = 'completed' | 'consent_closed';

/**
 * One exact dependent lease spans refresh → confirmed server log → final
 * partner handoff. A withdrawal at any await prevents the next stage.
 */
export async function runCommerceDisclosure(params: {
  refreshConsent: () => Promise<boolean>;
  confirmServerClick: () => Promise<void>;
  finalAction: () => Promise<void> | void;
}): Promise<CommerceDisclosureResult> {
  if (!(await params.refreshConsent())) return 'consent_closed';
  await runHealthDependentConsentOperation('data_sharing', async (lease) => {
    lease.assertCurrent();
    await params.confirmServerClick();
    lease.assertCurrent();
    await params.finalAction();
    lease.assertCurrent();
  });
  return 'completed';
}
