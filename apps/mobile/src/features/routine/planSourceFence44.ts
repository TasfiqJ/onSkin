import { bytesToHex, utf8ToBytes } from '@noble/ciphers/utils.js';
import { sha256 } from '@noble/hashes/sha256';

import { loadConflictChoices } from '@/features/intelligence/overrides';
import { pregnancySafetyModeForStatus } from '@/features/intelligence/pregnancySafety';
import { tagsForIngredientList } from '@/features/intelligence/tags';
import { hasCurrentHealthDataCollectionConsent } from '@/features/onboarding/healthConsentStore';
import { readStoredSkinProfile } from '@/features/onboarding/skinProfileStore';
import { sensitivityFromAxis } from '@/features/scheduler/profileMapping';
import { functionalTagsForCategory } from '@/features/shelf/categories';
import { loadShelf } from '@/features/shelf/store';
import {
  assertHealthDataWriteLease,
  type HealthDataWriteLease,
} from '@/lib/consent/healthDataWriteAdmission';
import { updatePrivateItemWithSources } from '@/lib/storage/privateKV';

import { generatePlan } from './generate';
import { applyRoutineOrderOverrides, loadRoutineOrderOverrides, type RoutineOrderOverrides } from './orderStore';

export const PLAN_SOURCE44_UNAVAILABLE = 'PLAN_SOURCE44_UNAVAILABLE';
export const PLAN_SOURCE44_STALE = 'PLAN_SOURCE44_STALE';
export const PLAN_SOURCE44_INVALID_ORDER = 'PLAN_SOURCE44_INVALID_ORDER';

const ORDER_KEY = 'layerwell.routineOrder.v1';
const SOURCE_KEYS = [
  'layerwell.shelf.v1',
  'layerwell.skinprofile.v1',
  'layerwell.conflict.overrides',
  'layerwell.healthDataCollectionConsent.v1',
  ORDER_KEY,
] as const;

type FactualStep44 = Readonly<{ productId: string; name: string }>;
/** Ephemeral owner facts only. No routine version/history record is created. */
export type PlanSourceSnapshot44 = Readonly<{
  source: 'local';
  sourceHash: string;
  activeProductIds: readonly string[];
  am: readonly FactualStep44[];
  pm: readonly FactualStep44[];
}>;

type SourceProof44 = Readonly<{
  lease: HealthDataWriteLease;
  expected: ReadonlyMap<string, string | null>;
}>;
// Exact source bytes and authority stay private in memory. A copied or forged
// snapshot cannot borrow the current owner's lease or manufacture a proof.
const proofs = new WeakMap<PlanSourceSnapshot44, SourceProof44>();

function sourceHash(values: ReadonlyMap<string, string | null>): string {
  return bytesToHex(sha256(utf8ToBytes(JSON.stringify([
    'onSkin.local-plan-source44',
    ...SOURCE_KEYS.map((key) => [key, values.get(key)]),
  ]))));
}

export async function capturePlanSource44(
  expectedLease: HealthDataWriteLease,
): Promise<PlanSourceSnapshot44> {
  const lease = Object.freeze({ ...expectedLease });
  const assertCurrent = () => assertHealthDataWriteLease(lease);
  assertCurrent();
  let snapshot: PlanSourceSnapshot44 | undefined;
  let expected: ReadonlyMap<string, string | null> | undefined;
  await updatePrivateItemWithSources(
    ORDER_KEY,
    SOURCE_KEYS,
    (values) => values.get(ORDER_KEY) ?? null,
    assertCurrent,
    async (values) => {
      // Absent choices/order have explicit successful empty defaults. A real
      // local profile, granted receipt and nonempty active Shelf are required.
      for (const key of [SOURCE_KEYS[0], SOURCE_KEYS[1], SOURCE_KEYS[3]]) {
        if (values.get(key) == null) throw new Error(PLAN_SOURCE44_UNAVAILABLE);
      }
      const [products, profileRead, choices, order, consent] = await Promise.all([
        loadShelf(),
        readStoredSkinProfile(),
        loadConflictChoices(),
        loadRoutineOrderOverrides(lease),
        hasCurrentHealthDataCollectionConsent(),
      ]);
      assertCurrent();
      if (!consent || profileRead.status !== 'available') {
        throw new Error(PLAN_SOURCE44_UNAVAILABLE);
      }
      const active = products.filter((product) => product.status === 'active');
      if (active.length === 0) throw new Error(PLAN_SOURCE44_UNAVAILABLE);
      const profile = profileRead.profile;
      const status = profile.result.pregnancyStatus;
      // Match useShelf/usePlan's exact name+INCI/category projection. Stored
      // expiry, display ordering, Today and cycle state are not snapshot fields.
      const inputs = active.map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        tags: [...new Set([
          ...tagsForIngredientList([product.name, ...product.ingredients]).tags,
          ...functionalTagsForCategory(product.category),
        ])],
      }));
      const plan = applyRoutineOrderOverrides(generatePlan(inputs, {
        sensitivity: sensitivityFromAxis(profile.result.axisScores.sensitive_resistant),
        pregnancy: status === 'pregnant' || status === 'breastfeeding',
        reproductiveStatus: status,
        pregnancyStatus: status,
        pregnancySafety: pregnancySafetyModeForStatus(status),
        goals: profile.goals,
      }, choices), order);
      const steps = (items: typeof plan.am) => Object.freeze(items.map(({ productId, name }) =>
        Object.freeze({ productId, name })));
      expected = new Map(SOURCE_KEYS.map((key) => [key, values.get(key) ?? null]));
      snapshot = Object.freeze({
        source: 'local',
        sourceHash: sourceHash(expected),
        activeProductIds: Object.freeze(active.map((product) => product.id)),
        am: steps(plan.am),
        pm: steps(plan.pm),
      });
    },
  );
  assertCurrent();
  if (!snapshot || !expected) throw new Error(PLAN_SOURCE44_UNAVAILABLE);
  proofs.set(snapshot, Object.freeze({ lease, expected }));
  return snapshot;
}

function validatedOrder(value: RoutineOrderOverrides, activeIds: readonly string[]): RoutineOrderOverrides {
  const keys = value && typeof value === 'object' ? Object.keys(value).sort() : [];
  const active = new Set(activeIds);
  if (keys.length !== 3 || keys.join(',') !== 'am,pm,schemaVersion' || value.schemaVersion !== 1) {
    throw new Error(PLAN_SOURCE44_INVALID_ORDER);
  }
  for (const ids of [value.am, value.pm]) {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length ||
        ids.some((id) => typeof id !== 'string' || !active.has(id))) {
      throw new Error(PLAN_SOURCE44_INVALID_ORDER);
    }
  }
  return { schemaVersion: 1, am: [...value.am], pm: [...value.pm] };
}

/** Opt-in existing order write, never a historical-plan append or UI action. */
export async function savePlanOrderWithSource44(
  snapshot: PlanSourceSnapshot44,
  nextOrder: RoutineOrderOverrides,
): Promise<RoutineOrderOverrides> {
  const proof = proofs.get(snapshot);
  if (!proof) throw new Error(PLAN_SOURCE44_STALE);
  const next = validatedOrder(nextOrder, snapshot.activeProductIds);
  const assertCurrent = () => assertHealthDataWriteLease(proof.lease);
  assertCurrent();
  await updatePrivateItemWithSources(ORDER_KEY, SOURCE_KEYS, (values) => {
    assertCurrent();
    if (snapshot.sourceHash !== sourceHash(proof.expected) || SOURCE_KEYS.some((key) =>
      values.get(key) !== proof.expected.get(key))) throw new Error(PLAN_SOURCE44_STALE);
    return next.am.length > 0 || next.pm.length > 0 ? JSON.stringify(next) : null;
  }, assertCurrent);
  assertCurrent();
  return next;
}
