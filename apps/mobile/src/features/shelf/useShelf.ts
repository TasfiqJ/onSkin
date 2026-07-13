import type { ProductStatus } from '@onskin/types';
import { useQuery } from '@tanstack/react-query';

import {
  detectConflicts,
  isReassuring,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import { deriveConcentration } from '@/features/intelligence/concentration';
import {
  choiceForConflict,
  unresolvedConflicts as filterUnresolvedConflicts,
  type ConflictChoices,
} from '@/features/intelligence/conflictChoices';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import { getConflictChoices } from '@/features/intelligence/overrides';
import { expiryBadge, type ExpiryBadge } from '@/features/intelligence/pao';
import { shippableRules } from '@/features/intelligence/rules';
import { tagsForIngredientList } from '@/features/intelligence/tags';
import { readProfileBits } from '@/features/scheduler/profile';
import { localDateString } from '@/features/today/useToday';
import { useLocalDateBoundary } from '@/lib/query/localDateBoundaryStore';
import { queryKeys, shouldRefetchCurrentLocalDayQuery } from '@/lib/query/queryKeys';
import { useOwnerQueryScope } from '@/lib/query/useOwnerQueryScope';

import { functionalTagsForCategory, isSafetyCriticalCategory } from './categories';
import { isEstimatedExpiry, surfacedExpiry } from './expiry';
import { formatShelfMetaLine } from './metadata';
import { pairedProductIdsForResolvedConflicts } from './pairedConflicts';
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
  unresolvedConflicts: DetectedConflict[];
  conflictChoices: ConflictChoices;
  reassurances: DetectedConflict[];
  /** The top noteworthy (non-reassuring) interaction for the calm shelf banner. */
  banner: DetectedConflict | null;
};

/** True when the product's surfaced expiry is only an estimate (a category PAO
 *  default, not a label/catalog value or a printed expiry). Drives the honest
 *  two-line "est.\n{Mon}" badge (design frame 03, Vitamin C). Mirrors the "est."
 *  branch of formatShelfMetaLine so the badge and the meta line never disagree. */
/** Apply a just-persisted choice to the shared Shelf cache without a second
 * private read. This prevents a transient post-write read failure from
 * resurrecting the advisory the user just resolved. */
export function applyConflictChoicesToShelfData(
  data: ShelfData,
  conflictChoices: ConflictChoices,
  today = localDateString(),
): ShelfData {
  const unresolvedConflicts = filterUnresolvedConflicts(data.conflicts, conflictChoices);
  const overridden = new Set(
    data.conflicts.flatMap((conflict) =>
      choiceForConflict(conflictChoices, conflict) === 'use_together'
        ? [conflictKey(conflict)]
        : [],
    ),
  );
  const pairedIds = pairedProductIdsForResolvedConflicts(
    data.conflicts,
    new Set<string>(),
    overridden,
  );
  const synergyIds = new Set<string>();
  for (const conflict of data.reassurances) {
    if (conflict.productAId && !pairedIds.has(conflict.productAId)) {
      synergyIds.add(conflict.productAId);
    }
    if (conflict.productBId && !pairedIds.has(conflict.productBId)) {
      synergyIds.add(conflict.productBId);
    }
  }

  const updateItem = (item: ShelfItem): ShelfItem => {
    const paired = pairedIds.has(item.id);
    return {
      ...item,
      paired,
      badge: expiryBadge(surfacedExpiry(item.product), today, {
        safetyCritical: isSafetyCriticalCategory(item.category),
        paired,
        synergy: synergyIds.has(item.id),
        estimate: isEstimatedExpiry(item.product),
      }),
    };
  };

  return {
    ...data,
    items: data.items.map(updateItem),
    archive: data.archive.map(updateItem),
    unresolvedConflicts,
    conflictChoices,
    banner:
      unresolvedConflicts.find(
        (conflict) => !isReassuring(conflict) && conflict.computedSeverity !== 'none',
      ) ?? null,
  };
}

export function useShelf() {
  const ownerScope = useOwnerQueryScope();
  const boundary = useLocalDateBoundary();
  const { localDate: today } = boundary;

  return useQuery<ShelfData>({
    queryKey: queryKeys.shelf(ownerScope, boundary),
    refetchOnReconnect: shouldRefetchCurrentLocalDayQuery,
    refetchOnWindowFocus: shouldRefetchCurrentLocalDayQuery,
    retry: 1,
    queryFn: async () => {
      const [products, profileBits, conflictChoices] = await Promise.all([
        loadShelf(),
        readProfileBits(),
        getConflictChoices(),
      ]);
      const profile: EngineProfile = {
        sensitivity: profileBits.sensitivity,
        // Conflict copy may assert pregnancy only after an affirmative answer.
        // Unknown/prefer-not still filter routine products through the separate
        // pregnancySafety mode, without creating a literal Pregnancy pseudo-item.
        pregnancy: profileBits.pregnancy,
      };

      const active = products.filter((p) => p.status === 'active');

      const engineProducts: EngineProduct[] = active.map((p) => {
        const { tags, subflags } = tagsForIngredientList([p.name, ...p.ingredients]);
        const tagArr = [...new Set([...tags, ...functionalTagsForCategory(p.category)])];
        // Coarse concentration band from the name/INCI percent (docs/02 §4.2) so the
        // engine escalates high-dose severity and the high-dose pregnancy safety rule
        // can fire. Was never populated before (review fix); B-CATALOG-SEED upgrades it.
        // Preserve catalog field boundaries. Without a delimiter, an unrelated
        // ingredient percentage can attach to the next ingredient name and falsely
        // clear a cautious unknown-strength active.
        const concentration = deriveConcentration([p.name, ...p.ingredients].join('; '), tagArr);
        return { id: p.id, name: p.name, tags: tagArr, subflags: [...subflags], concentration };
      });

      const conflicts = detectConflicts(engineProducts, profile, shippableRules());
      const reassurances = conflicts.filter(isReassuring);
      // Either explicit timing choice resolves repeat prompts for the exact pair
      // and current rule version. Safety and stale-version rows remain unresolved.
      const unresolvedConflicts = filterUnresolvedConflicts(conflicts, conflictChoices);
      const overridden = new Set(
        conflicts.flatMap((conflict) =>
          choiceForConflict(conflictChoices, conflict) === 'use_together'
            ? [conflictKey(conflict)]
            : [],
        ),
      );
      const banner =
        unresolvedConflicts.find((c) => !isReassuring(c) && c.computedSeverity !== 'none') ?? null;

      // "paired" means the active scheduler/real routine placement has actually
      // separated the products. Shelf-level detection only sees ownership, so it
      // must not infer placement from a resolution verb such as alternate_nights.
      const schedulerResolvedConflictKeys = new Set<string>();
      const pairedIds = pairedProductIdsForResolvedConflicts(
        conflicts,
        schedulerResolvedConflictKeys,
        overridden,
      );

      // Products in a surfaced synergy/myth pairing earn the calm "synergy" pill
      // (design frame 03, Niacinamide 10%). Mirrors the pairedIds loop over the
      // already-filtered reassurances. "paired" wins the calm slot if a product is
      // in both (a resolved conflict is the higher-signal state).
      const synergyIds = new Set<string>();
      for (const c of reassurances) {
        if (c.productAId && !pairedIds.has(c.productAId)) synergyIds.add(c.productAId);
        if (c.productBId && !pairedIds.has(c.productBId)) synergyIds.add(c.productBId);
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
          synergy: synergyIds.has(p.id),
          estimate: isEstimatedExpiry(p),
        });
        return {
          id: p.id,
          name: p.name,
          brand: p.brand,
          category: p.category,
          metaLine: formatShelfMetaLine(p),
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
      // Bucket by badge urgency, then within a bucket order by the actual computed
      // expiry date (soonest first; unknown dates last) so two dated products read
      // chronologically rather than in insertion order (review fix).
      items.sort((a, b) => sortWeight(a) - sortWeight(b) || cmpExpiry(a, b));

      return {
        items,
        archive,
        conflicts,
        unresolvedConflicts,
        conflictChoices,
        reassurances,
        banner,
      };
    },
  });
}

/** Chronological tiebreak within a sort bucket: soonest surfaced-expiry first, items
 *  with no known date last. ISO date strings compare chronologically. */
function cmpExpiry(a: ShelfItem, b: ShelfItem): number {
  const ea = surfacedExpiry(a.product);
  const eb = surfacedExpiry(b.product);
  if (ea && eb) return ea < eb ? -1 : ea > eb ? 1 : 0;
  if (ea) return -1;
  if (eb) return 1;
  return 0;
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
