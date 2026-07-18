import { useQuery } from '@tanstack/react-query';

import {
  runRequestWithLease,
  supabaseRequestFailure,
} from '@/lib/network/requestPolicy';
import { queryKeys, runOwnerQueryOperation } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';
import { supabase } from '@/lib/supabase/client';

import { commerceConsentQueryOptions } from './consentQuery';
import { demoWhereToBuy, resolveWhereToBuy, type AffiliateLinkRow } from './links';

// Commerce data hooks (docs/10). The "where to buy" options resolve from the
// affiliate_links catalogue (guarded; offline-safe, B-SUPABASE), degrading to a
// dev-only demo set so the surface renders before the catalogue lands
// (B-CATALOG-SEED) and to an honest empty state in production. *** No commission field
// is ever read or sorted on (church and state). ***

export function useCommerceConsent() {
  const ownerScope = useOwnerQueryScope();
  const query = useQuery(commerceConsentQueryOptions(ownerScope));
  // Consent enforcement never publishes a prior grant while a fresh strict
  // read is pending or unavailable. Management screens use separate semantics.
  return { ...query, data: query.isSuccess && !query.isFetching ? query.data : undefined };
}

export function useWhereToBuy(productType: string | null) {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.whereToBuy(ownerScope, productType),
    enabled: !!productType,
    queryFn: () =>
      runOwnerQueryOperation(ownerScope, async (lease) => {
        if (!productType) return [];
        let rows: AffiliateLinkRow[] = [];
        try {
          const data = await runRequestWithLease(
            lease,
            {
              endpoint: 'commerce_links',
              deadlineMs: 8_000,
              idempotent: true,
              maxAttempts: 2,
              maxResponseBytes: 512 * 1024,
            },
            async ({ signal }) => {
              const response = await supabase
                .from('affiliate_links')
                .select(
                  'id, product_type, retailer, label, url, price_cents, currency, source, is_paid, is_active',
                )
                .eq('product_type', productType)
                .eq('is_active', true)
                .abortSignal(signal);
              if (response.error) {
                throw supabaseRequestFailure(response.error, response.status);
              }
              return response.data;
            },
          );
          rows = (data ?? []) as AffiliateLinkRow[];
        } catch {
          lease.assertCurrent();
          /* offline / no DB */
        }
        // Dev-only demo when the catalogue is empty; [] in production (honest empty).
        if (rows.length === 0) rows = demoWhereToBuy(productType);
        return resolveWhereToBuy(productType, rows);
      }),
  });
}
