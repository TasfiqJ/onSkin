import { env } from '@/lib/env';

export const POLICY_LINKS = {
  terms: {
    label: 'Terms',
    url: env.termsUrl,
  },
  privacy: {
    label: 'Privacy policy',
    url: env.privacyUrl,
  },
  consumerHealthPrivacy: {
    label: 'Consumer health privacy',
    url: env.consumerHealthPrivacyUrl,
  },
  support: {
    label: 'Support',
    url: env.supportUrl,
  },
  accountDeletion: {
    label: 'Account deletion',
    url: env.accountDeletionUrl,
  },
  dataExport: {
    label: 'Data export',
    url: env.dataExportUrl,
  },
} as const;

export type PolicyLinkKey = keyof typeof POLICY_LINKS;

export function policyLinkRows(keys: PolicyLinkKey[]) {
  return keys.map((key) => ({ key, ...POLICY_LINKS[key] }));
}
