import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MOBILE_SRC = fileURLToPath(new URL('../../', import.meta.url));

function read(path: string): string {
  return readFileSync(`${MOBILE_SRC}/${path}`, 'utf8');
}

describe('Shelf private-data availability contract', () => {
  it('classifies every private read state without destructive fallback', () => {
    const store = read('features/shelf/store.ts');

    expect(store).toContain('export type ShelfStateRead =');
    expect(store).toContain('export async function readShelfState()');
    expect(store).toContain('await readPrivateItem(KEY)');
    expect(store).toContain("status: 'unsupported_version', products: null");
    expect(store).toContain('throw new Error(SHELF_STATE_UNAVAILABLE)');
    expect(store).toContain('EXPO_PUBLIC_E2E_SHELF_STORAGE_FAILURE');
    expect(store).not.toContain('return decodeShelfState(await getPrivateItem(KEY))');
    expect(store).not.toContain('await removePrivateItem(KEY)');
  });

  it('hides retained Shelf data and binds the complete derivation to its captured owner', () => {
    const hook = read('features/shelf/useShelf.ts');

    expect(hook).toContain('runOwnerQueryOperation(ownerScope');
    expect(hook).toContain('loadConflictChoices()');
    expect(hook).toContain('lease.assertCurrent();');
    expect(hook).toContain('retry: false');
    expect(hook).toContain('retryOnMount: false');
    expect(hook).toContain("networkMode: 'always'");
    expect(hook).toContain("activeQuery.state.status !== 'error'");
    expect(hook).toContain('data: query.isSuccess ? query.data : undefined');

    const gate = read('features/shelf/ShelfDataAvailabilityGate.tsx');
    expect(gate).toContain('the private Shelf data this screen needs');
    expect(gate).toContain('OnSkin did not reset or remove it');
    expect(gate).toContain('Retry loading private Shelf data');
    expect(gate).not.toContain('Nothing was changed');
  });

  it('prevents unreadable Shelf state from becoming routine, Ask, or purchase guidance', () => {
    const plan = read('features/routine/usePlan.ts');
    const ramp = read('features/routine/useRamp.ts');
    const ask = read('features/ask/useAsk.ts');
    const recommendations = read('features/recommendations/useRecommendations.ts');
    const teaser = read('features/recommendations/RecommendationsTeaser.tsx');
    const triggers = read('features/notifications/BehaviouralTriggers.tsx');

    expect(plan).toContain('shelf.isError ||');
    expect(plan).toContain('!shelf.isSuccess ||');
    expect(plan).toContain('data: undefined');
    expect(ramp).toContain('isError: planQuery.isError ||');
    expect(ramp).toContain('isSuccess: planQuery.isSuccess &&');
    expect(ask).toContain('if (!isSuccess) return safetyRefusal');
    expect(ask).toContain('hasShelf: isSuccess && ctx.hasShelfProducts');
    expect(recommendations).toContain(
      'const inputIsSuccess = shelf.isSuccess && profile.isSuccess && prefsQ.isSuccess;',
    );
    expect(recommendations).toContain('const isSuccess = inputIsSuccess && !manualRetrying;');
    expect(teaser).toContain('if (!isSuccess || isError) return null;');
    expect(triggers).toContain('notifyReplenishmentFromFreshShelf(');
    expect(triggers).toContain('latest.replenishment.refetch');
    expect(triggers).toContain('if (!freshShelf.isSuccess || !hasReplenishmentSignal');
  });

  it('gates every Shelf-derived route before it can render an empty or stale state', () => {
    for (const path of [
      'app/shelf/_layout.tsx',
      'app/ask/_layout.tsx',
      'app/conflict/_layout.tsx',
      'app/share/_layout.tsx',
      'app/recommendations/_layout.tsx',
    ]) {
      const layout = read(path);
      expect(layout, path).toContain('ShelfDataAvailabilityGate');
      expect(layout, path).toContain('screenLayout=');
    }

    expect(read('app/(tabs)/shelf.tsx')).toContain('isError ? (');
    expect(read('app/(tabs)/today.tsx')).toContain('<ShelfDataAvailabilityGate>');
    expect(read('app/onboarding/products.tsx')).toContain('<ShelfDataAvailabilityGate');
    expect(read('app/onboarding/reveal.tsx')).toContain('planResult.isError');
    const routineLayout = read('app/routine/_layout.tsx');
    expect(routineLayout).toContain('screenLayout={RoutineScreenLayout}');
    expect(routineLayout).toContain("'plan'");
    expect(routineLayout).not.toContain('<ShelfDataAvailabilityGate>{stack}');
    expect(read('app/routine/plan.tsx')).toContain('if (planQuery.isError)');
  });

  it('keeps replenishment atomic, retry-stable, and mirror-ordered', () => {
    const store = read('features/shelf/store.ts');
    const mutations = read('features/shelf/mutations.ts');

    expect(store).toContain('export type ReAddedShelfProduct =');
    expect(store).toContain('replacementIdForSource(id)');
    expect(store).toContain('replacementId === id');
    expect(store).toContain('Crypto.CryptoDigestAlgorithm.SHA256');
    expect(mutations).toContain('reAddProduct(id)');
    expect(mutations).toContain('replaced.archived');
    expect(mutations).toContain('replaced.fresh');
    expect(mutations).not.toContain('loadShelf');
    expect(mutations).toContain('const shelfMirrorTails = new Map');
    expect(mutations).toContain('enqueueShelfMirror(ownerScope, product.id');
    expect(mutations).toContain('const replenishmentAttempts = new Map');
    expect(mutations).toContain('const attemptKey = replenishmentAttemptKey(ownerScope, id)');
    expect(mutations).toContain('return runOwnerQueryOperation(ownerScope');
    expect(mutations).toContain('failClosedShelfQueriesAfterMutationFailure(qc, ownerScope)');
  });
});
