import { useQuery } from '@tanstack/react-query';

import { localDateString } from '@/features/today/useToday';
import { supabase } from '@/lib/supabase/client';

import { detectConflicts, isReassuring, type DetectedConflict, type EngineProduct, type EngineProfile } from './engine';
import { expiryBadge, type ExpiryBadge } from './pao';
import { shippableRules } from './rules';
import { tagsForIngredientList } from './tags';

export type ShelfItem = {
  id: string;
  name: string;
  brand: string | null;
  metaLine: string;
  badge: ExpiryBadge;
  engineProduct: EngineProduct;
};

export type ShelfData = {
  items: ShelfItem[];
  conflicts: DetectedConflict[];
  reassurances: DetectedConflict[];
  /** The top noteworthy (non-reassuring) interaction for the calm shelf banner. */
  banner: DetectedConflict | null;
};

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short' });
}

function sensitivityFromAxis(score: number | null): EngineProfile['sensitivity'] {
  if (score == null || score === 0) return 'neutral';
  return score > 0 ? 'sensitive' : 'resistant'; // positive axis = Sensitive pole
}

export function useShelf() {
  const today = localDateString();

  return useQuery<ShelfData>({
    queryKey: ['shelf'],
    retry: 1,
    queryFn: async () => {
      const { data: products } = await supabase
        .from('user_products')
        .select('id, manual_name, manual_brand, opened_at, pao_months, expiry_computed, status')
        .eq('status', 'active');

      const { data: profileRow } = await supabase
        .from('skin_profiles')
        .select('sensitive_resistant, pregnancy_status')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const profile: EngineProfile = {
        sensitivity: sensitivityFromAxis(profileRow?.sensitive_resistant ?? null),
        pregnancy:
          profileRow?.pregnancy_status === 'pregnant' || profileRow?.pregnancy_status === 'breastfeeding',
      };

      const items: ShelfItem[] = (products ?? []).map((p) => {
        const name = p.manual_name ?? 'Product';
        const { tags, subflags } = tagsForIngredientList([name]);
        const opened = monthLabel(p.opened_at);
        const metaParts = [
          p.manual_brand,
          opened ? `opened ${opened}` : null,
          p.pao_months != null ? `${p.pao_months} mo PAO` : null,
        ].filter(Boolean);
        return {
          id: p.id,
          name,
          brand: p.manual_brand,
          metaLine: metaParts.join(' · '),
          badge: expiryBadge(p.expiry_computed, today),
          engineProduct: { id: p.id, name, tags: [...tags], subflags: [...subflags] },
        };
      });

      const conflicts = detectConflicts(
        items.map((i) => i.engineProduct),
        profile,
        shippableRules(),
      );
      const reassurances = conflicts.filter(isReassuring);
      const banner = conflicts.find((c) => !isReassuring(c) && c.computedSeverity !== 'none') ?? null;

      return { items, conflicts, reassurances, banner };
    },
  });
}
