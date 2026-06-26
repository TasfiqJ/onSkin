import type { ProductStatus, ResolutionType } from '@onskin/types';
import { useQuery } from '@tanstack/react-query';

import {
  detectConflicts,
  isReassuring,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { conflictKey, getOverriddenKeys } from '@/features/intelligence/overrides';
import { expiryBadge, type ExpiryBadge } from '@/features/intelligence/pao';
import { shippableRules } from '@/features/intelligence/rules';
import { tagsForIngredientList } from '@/features/intelligence/tags';
import { localDateString } from '@/features/today/useToday';
import { supabase } from '@/lib/supabase/client';

import { categoryLabel, isSafetyCriticalCategory, usesPrintedExpiry } from './categories';
import { surfacedExpiry } from './expiry';
import { loadShelf, type ShelfProduct } from './store';

// The Shelf data layer (docs/04 §5): reads the local-first store, tags products
// via the client dictionary, runs the launch-gated conflict engine, and computes
// the five-state PAO/expiry badge per card. usePlan + the conflict-detail sheet
// also read from here, so they reflect the user's real cabinet.

export type ShelfItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  metaLine: string;
  badge: ExpiryBadge;
  status: ProductStatus;
  /** The raw store row, for the detail / lifecycle surfaces. */
  product: ShelfProduct;
  engineProduct: EngineProduct;
  paired: boolean;
};

export type ShelfData = {
  /** Active products only (the main list + the routine/plan source). */
  items: ShelfItem[];
  /** Finished/discarded products (the archive, docs/04 §5.7). */
  archive: ShelfItem[];
  conflicts: DetectedConflict[];
  reassurances: DetectedConflict[];
  /** The top noteworthy (non-reassuring) interaction for the calm shelf banner. */
  banner: DetectedConflict | null;
};

// Resolutions that *separate* two products in time. I.e. a conflict the engine
// has already handled, which earns the calm "paired" badge (docs/04 §5.3).
const PAIRED_RESOLUTIONS = new Set<ResolutionType>([
  'alternate_nights',
  'separate_am_pm',
  'buffer',
  'lower_frequency',
]);

function monthLabel(iso: string | null): string | null {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString('en-US', { month: 'short' });
}

function sensitivityFromAxis(score: number | null): EngineProfile['sensitivity'] {
  if (score == null || score === 0) return 'neutral';
  return score > 0 ? 'sensitive' : 'resistant'; // positive axis = Sensitive pole
}

/** The honest mono metadata line under a product name (docs/04 §5.2). */
function metaLine(p: ShelfProduct): string {
  const parts: (string | null | undefined)[] = [];
  parts.push(p.brand ?? (p.addedVia === 'manual' ? 'added by hand' : categoryLabel(p.category)));
  if (!p.isOpened) parts.push('unopened');
  else if (p.openedAt) parts.push(`opened ${monthLabel(p.openedAt)}`);
  else parts.push('no date set');
  if (usesPrintedExpiry(p.category) && p.expiryDate) {
    parts.push('printed expiry');
  } else if (p.paoMonths != null) {
    const fromLabel = p.paoSource === 'label' || p.paoSource === 'catalog';
    parts.push(fromLabel ? `${p.paoMonths} mo PAO` : `est. ${p.paoMonths} mo`);
  }
  return parts.filter(Boolean).join(' · ');
}

export function useShelf() {
  const today = localDateString();

  return useQuery<ShelfData>({
    queryKey: ['shelf'],
    retry: 1,
    queryFn: async () => {
      const products = await loadShelf();

      // Skin profile drives sensitivity/pregnancy modulation; guarded so the
      // shelf renders before the backend is configured (B-SUPABASE).
      let profile: EngineProfile = { sensitivity: 'neutral', pregnancy: false };
      try {
        const { data: profileRow } = await supabase
          .from('skin_profiles')
          .select('sensitive_resistant, pregnancy_status')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (profileRow) {
          profile = {
            sensitivity: sensitivityFromAxis(profileRow.sensitive_resistant ?? null),
            pregnancy:
              profileRow.pregnancy_status === 'pregnant' ||
              profileRow.pregnancy_status === 'breastfeeding',
          };
        }
      } catch {
        /* offline / no DB. Neutral profile */
      }

      const active = products.filter((p) => p.status === 'active');

      const engineProducts: EngineProduct[] = active.map((p) => {
        const { tags, subflags } = tagsForIngredientList([p.name, ...p.ingredients]);
        return { id: p.id, name: p.name, tags: [...tags], subflags: [...subflags] };
      });

      const conflicts = detectConflicts(engineProducts, profile, shippableRules());
      const reassurances = conflicts.filter(isReassuring);
      // Respect "use together anyway" overrides (docs/03 §7): a conflict the user
      // already resolved that way is not re-surfaced in the calm banner ("we won't
      // re-nag"). Server mirror is routine_conflicts (B-SUPABASE).
      const overridden = await getOverriddenKeys();
      const banner =
        conflicts.find(
          (c) => !isReassuring(c) && c.computedSeverity !== 'none' && !overridden.has(conflictKey(c)),
        ) ?? null;

      // Products in an already-resolved (separated) interaction earn "paired".
      const pairedIds = new Set<string>();
      for (const c of conflicts) {
        if (c.rule.interactionType === 'safety' || isReassuring(c)) continue;
        if (!PAIRED_RESOLUTIONS.has(c.rule.resolutionType)) continue;
        if (c.productAId) pairedIds.add(c.productAId);
        if (c.productBId) pairedIds.add(c.productBId);
      }

      const byEngine = new Map(engineProducts.map((e) => [e.id, e] as const));

      const toItem = (p: ShelfProduct): ShelfItem => {
        const engine = byEngine.get(p.id) ?? {
          id: p.id,
          name: p.name,
          tags: [...tagsForIngredientList([p.name, ...p.ingredients]).tags],
        };
        const badge = expiryBadge(surfacedExpiry(p), today, {
          safetyCritical: isSafetyCriticalCategory(p.category),
          paired: pairedIds.has(p.id),
        });
        return {
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          metaLine: metaLine(p),
          badge,
          status: p.status,
          product: p,
          engineProduct: engine,
          paired: pairedIds.has(p.id),
        };
      };

      const items = active.map(toItem);
      const archive = products.filter((p) => p.status !== 'active').map(toItem);

      // Default sort: soonest expiry first, unopened/unknown last (docs/04 §5.4).
      items.sort((a, b) => sortWeight(a) - sortWeight(b));

      return { items, archive, conflicts, reassurances, banner };
    },
  });
}

/** Lower = surfaced first (expired, then countdown, then dated, then unknown). */
function sortWeight(i: ShelfItem): number {
  switch (i.badge.kind) {
    case 'expired':
      return 0;
    case 'countdown':
      return 1;
    case 'paired':
    case 'date':
      return 2;
    default:
      return 3; // unknown / unopened last
  }
}
