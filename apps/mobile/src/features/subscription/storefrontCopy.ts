export type SubscriptionStorefrontCopy = Readonly<{
  billingContinuation: string;
  cancellationNote: (date: string) => string;
  managementUnavailable: string;
  manageLabel: string;
}>;

const APP_STORE_COPY: SubscriptionStorefrontCopy = {
  billingContinuation:
    'Your App Store subscription continues until you cancel it in the App Store.',
  cancellationNote: (date) =>
    `You keep Pro until ${date}. Manage or cancel the subscription in App Store settings.`,
  managementUnavailable:
    'We could not open subscription management. You can manage billing from your App Store account settings.',
  manageLabel: 'Manage in App Store',
};

const GOOGLE_PLAY_COPY: SubscriptionStorefrontCopy = {
  billingContinuation:
    'Your Google Play subscription continues until you cancel it in Google Play.',
  cancellationNote: (date) =>
    `You keep Pro until ${date}. Manage or cancel the subscription in Google Play settings.`,
  managementUnavailable:
    'We could not open subscription management. You can manage billing from your Google Play account settings.',
  manageLabel: 'Manage in Google Play',
};

const GENERIC_STORE_COPY: SubscriptionStorefrontCopy = {
  billingContinuation:
    'Your subscription continues until you cancel it with your subscription provider.',
  cancellationNote: (date) =>
    `You keep Pro until ${date} after cancelling with your subscription provider.`,
  managementUnavailable:
    "We could not open subscription management. You can manage billing from your subscription provider's account settings.",
  manageLabel: 'Manage subscription',
};

/** Keeps marketplace names aligned with the store available on this runtime. */
export function subscriptionStorefrontCopy(platform: string): SubscriptionStorefrontCopy {
  if (platform === 'ios') return APP_STORE_COPY;
  if (platform === 'android') return GOOGLE_PLAY_COPY;
  return GENERIC_STORE_COPY;
}
