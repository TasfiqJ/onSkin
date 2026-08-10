import type { ProductStatus } from '@layerwell/types';
import { useQuery } from '@tanstack/react-query';

import {
  evaluateConflicts,
  isReassuring,
  type ConflictEvaluationStatus,
  type DetectedConflict,
  type EngineProduct,
  type EngineProfile,
} from '@/features/intelligence/engine';
import {
  choiceForConflict,
  unresolvedConflicts as filterUnresolvedConflicts,
  type ConflictChoices,
} from '@/features/intelligence/conflictChoices';
import { conflictKey } from '@/features/intelligence/conflictIdentity';
import { getConflictChoices } from '@/features/intelligence/overrides';
import { expiryBadge, type ExpiryBadge } from '@/features/intelligence/pao';
import { tagsForIngredientList } from '@/features/intelligence/tags';
import { readProfileBits } from '@/features/scheduler/profile';
import { localDateString } from '@/features/today/useToday';
import { runCurrentHealthDataOperation } from '@/lib/consent/healthDataWriteAdmission';

import { functionalTagsForCategory } from './categories';
import { isEstimatedExpiry, surfacedExpiry } from './expiry';
import { formatShelfMetaLine } from './metadata';
import { pairedProductIdsForResolvedConflicts } from './pairedConflicts';
import {
  getShelfMirrorIncompatibilities,
  loadShelf,
  type ShelfMirrorIncompatibility,
  type ShelfProduct,
} from './store';

// The Shelf data layer (docs/04 §5): reads the local-first store, tags products
// via the client dictionary, runs the launch-gated conflict engine, and computes
// the provenance-aware PAO/expiry badge per card. usePlan + the conflict-detail sheet
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
  conflictCoverageStatus: ConflictEvaluationStatus;
  unsupportedConflictPairs: string[];
  /** Local rows remain visible; these deterministic issues require user repair
   * before the encrypted mirror queue can represent them truthfully. */
  mirrorIncompatibilities: ShelfMirrorIncompatibility[];
  /** The top noteworthy (non-reassuring) interaction for the calm shelf banner. */
  banner: DetectedConflict | null;
};

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
  const today = localDateString();

  return useQuery<ShelfData>({
    queryKey: ['shelf'],
    retry: 1,
    queryFn: () =>
      runCurrentHealthDataOperation(async (lease) => {
        lease.assertCurrent();
        const [products, mirrorIncompatibilities, profileBits, conflictChoices] = await Promise.all(
          [loadShelf(), getShelfMirrorIncompatibilities(), readProfileBits(), getConflictChoices()],
        );
        lease.assertCurrent();
        const profile: EngineProfile = {
          sensitivity: profileBits.sensitivity,
          reproductiveStatus: profileBits.pregnancyStatus,
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
          return { id: p.id, name: p.name, tags: tagArr, subflags: [...subflags] };
        });

        const conflictEvaluation = evaluateConflicts(engineProducts, profile);
        const conflicts = conflictEvaluation.conflicts;
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
          unresolvedConflicts.find((c) => !isReassuring(c) && c.computedSeverity !== 'none') ??
          null;

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

        const result = {
          items,
          archive,
          conflicts,
          unresolvedConflicts,
          conflictChoices,
          reassurances,
          banner,
          conflictCoverageStatus: conflictEvaluation.status,
          unsupportedConflictPairs: conflictEvaluation.unsupportedPairs,
          mirrorIncompatibilities,
        };
        lease.assertCurrent();
        return result;
      }),
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

/** Lower = surfaced first by supported tracked-date state, then unknown. */
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
