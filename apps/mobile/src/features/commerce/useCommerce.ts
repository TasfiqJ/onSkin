import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { isCommerceConsented } from './consent';
import { demoWhereToBuy, resolveWhereToBuy, type AffiliateLinkRow } from './links';

// Commerce data hooks (docs/10). The "where to buy" options resolve from the
// affiliate_links catalogue (guarded; offline-safe, B-SUPABASE), degrading to a
// dev-only demo set so the surface renders before the catalogue lands
// (B-CATALOG-SEED) and to an honest empty state in production. *** No commission field
// is ever read or sorted on (church and state). ***

export function useCommerceConsent() {
  const ownerScope = useOwnerQueryScope();
  return useQuery({
    queryKey: queryKeys.commerceConsent(ownerScope),
    queryFn: isCommerceConsented,
  });
}

export function useWhereToBuy(productType: string | null) {
  return useQuery({
    queryKey: ['whereToBuy', productType],
    enabled: !!productType,
    queryFn: async () => {
      if (!productType) return [];
      let rows: AffiliateLinkRow[] = [];
      try {
        const { data } = await supabase
          .from('affiliate_links')
          .select(
            'id, product_type, retailer, label, url, price_cents, currency, source, is_paid, is_active',
          )
          .eq('product_type', productType)
          .eq('is_active', true);
        rows = (data ?? []) as AffiliateLinkRow[];
      } catch {
        /* offline / no DB */
      }
      // Dev-only demo when the catalogue is empty; [] in production (honest empty).
      if (rows.length === 0) rows = demoWhereToBuy(productType);
      return resolveWhereToBuy(productType, rows);
    },
  });
}
