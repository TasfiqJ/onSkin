export type CommerceDisclosureResult = 'completed' | 'consent_closed';

/**
 * Compatibility boundary for dormant callers. It deliberately does not inspect
 * callbacks, refresh consent, acquire a lease, log a click, or perform a handoff.
 */
export async function runCommerceDisclosure(_params: {
  refreshConsent: () => Promise<boolean>;
  confirmServerClick: () => Promise<void>;
  finalAction: () => Promise<void> | void;
}): Promise<CommerceDisclosureResult> {
  return 'consent_closed';
}
