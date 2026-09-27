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
    expect(hook).toContain('const refreshingStaleSnapshot = query.isSuccess && query.isStale;');
    expect(hook).toContain(
      'data: query.isSuccess && !refreshingStaleSnapshot ? query.data : undefined',
    );
    expect(hook).toContain('isPending: query.isPending || refreshingStaleSnapshot');

    const gate = read('features/shelf/ShelfDataAvailabilityGate.tsx');
    expect(gate).toContain('the private Shelf data this screen needs');
    expect(gate).toContain('OnSkin did not reset or remove it');
    expect(gate).toContain('Retry loading private Shelf data');
    expect(gate).not.toContain('Nothing was changed');
  });

  it('lets route view models reuse an owned Shelf query without changing the standalone gate', () => {
    const hook = read('features/shelf/useShelf.ts');
    const gate = read('features/shelf/ShelfDataAvailabilityGate.tsx');
    const boundaryStart = gate.indexOf('export function ShelfDataAvailabilityBoundary');
    const standaloneStart = gate.indexOf('export function ShelfDataAvailabilityGate');
    const boundary = gate.slice(boundaryStart, standaloneStart);
    const standalone = gate.slice(standaloneStart);

    expect(hook).toContain(
      'export function useShelfFromBoundary(boundary: LocalDateBoundaryIdentity)',
    );
    expect(hook).toContain('return useShelfFromBoundary(boundary);');
    expect(gate).toContain('export type ShelfAvailabilityQuery = Pick<');
    expect(gate).toContain('export type ShelfDataAvailabilityBoundaryProps = {');
    expect(gate).toContain('query: ShelfAvailabilityQuery;');
    expect(boundary).toContain('query,');
    expect(boundary).not.toContain('useShelf()');
    expect(standalone).toContain('const query = useShelf();');
    expect(standalone).toContain('<ShelfDataAvailabilityBoundary {...props} query={query} />');
  });

  it('prevents unreadable Shelf state from becoming routine, Ask, or purchase guidance', () => {
    const plan = read('features/routine/usePlan.ts');
    const ramp = read('features/routine/useRamp.ts');
    const ask = read('features/ask/useAsk.ts');
    const recommendations = read('features/recommendations/useRecommendations.ts');
    const teaser = read('features/recommendations/RecommendationsTeaser.tsx');
    const triggers = read('features/notifications/BehaviouralTriggers.tsx');
    const triggerSnapshot = read('features/notifications/behaviouralSnapshot.ts');

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
    expect(triggers).toContain('readBehaviouralTriggerSnapshot(lease, currentEnabled)');
    expect(triggerSnapshot).toContain('awaitAccountGenerationLease(lease, dependencies.readShelf)');
    expect(triggerSnapshot).toContain('enabled.replenishment && input.shelf');
    expect(triggerSnapshot).toContain('hasReplenishmentSignalForProducts(input.shelf, today)');
    expect(triggerSnapshot).not.toContain('catch');
  });

  it('gates every Shelf-derived route before it can render an empty or stale state', () => {
    for (const route of ['ask', 'recommendations', 'community']) {
      const layout = read(`app/${route}/_layout.tsx`);
      expect(layout).toContain('screenLayout={DeferredScreen}');
      expect(layout).toContain('<DeferredSurface');
      expect(layout).not.toContain('{children}');
    }
    const shelfLayout = read('app/shelf/_layout.tsx');
    expect(shelfLayout).toContain('ShelfRouteSourcesProvider');
    expect(shelfLayout).toContain('useShelfRouteSources');
    expect(shelfLayout).toContain('<ShelfDataAvailabilityBoundary');
    expect(shelfLayout).toContain('query={shelf}');
    expect(shelfLayout).toContain(
      '<ShelfScreenLayout>{props.children}</ShelfScreenLayout>',
    );
    expect(shelfLayout).not.toContain('screenLayout={ShelfScreenLayout}');
    expect(shelfLayout).not.toContain('<ShelfDataAvailabilityGate');

    for (const path of ['app/conflict/_layout.tsx', 'app/share/_layout.tsx']) {
      const layout = read(path);
      expect(layout, path).toContain('ShelfDataAvailabilityGate');
      expect(layout, path).toContain('screenLayout=');
    }

    expect(read('app/(tabs)/shelf.tsx')).toContain('isError ? (');
    const today = read('app/(tabs)/today.tsx');
    expect(today).toContain('<ShelfDataAvailabilityBoundary query={shelf}>');
    expect(today).toContain('const shelf = useShelfFromBoundary(boundary);');
    expect(read('app/onboarding/products.tsx')).toContain('<ShelfDataAvailabilityGate');
    expect(read('app/onboarding/reveal.tsx')).toContain('planResult.isError');
    const routineLayout = read('app/routine/_layout.tsx');
    expect(routineLayout).toContain('screenLayout={RoutineScreenLayout}');
    expect(routineLayout).toContain("'plan'");
    expect(routineLayout).toContain('<RoutineRouteSourcesProvider>');
    expect(routineLayout).toContain('<ShelfDataAvailabilityBoundary query={shelf}>');
    expect(routineLayout).not.toContain('<ShelfDataAvailabilityGate');
    expect(routineLayout).not.toContain('<ShelfDataAvailabilityGate>{stack}');
    expect(read('app/routine/plan.tsx')).toContain('if (planQuery.isError)');
  });

  it('shares one owner/date Shelf source across the Shelf stack and its derived detail graph', () => {
    const sources = read('features/shelf/ShelfRouteSources.tsx');
    const detailViewModel = read('features/shelf/useShelfDetailViewModel.ts');
    const detail = read('app/shelf/[id].tsx');
    const archive = read('app/shelf/archive.tsx');
    const replenish = read('app/shelf/replenish.tsx');
    const shelfHook = read('features/shelf/useShelf.ts');

    expect(sources.match(/useLocalDateBoundary\(\)/g)).toHaveLength(1);
    expect(sources).toContain('const shelf = useShelfFromBoundary(boundary);');
    expect(sources).toContain('ShelfRouteSourcesContext.Provider');
    expect(detailViewModel).toContain('const plan = usePlanFromSources(shelf, profile);');
    expect(detailViewModel).toContain('const ramp = useRampFromPlan(plan, boundary);');
    expect(detailViewModel).toContain(
      'const cycle = useCycleFromSources(shelf, profile, ramp, boundary);',
    );
    expect(shelfHook).toContain('profile: profileBits');
    expect(detail).toContain('const routeSources = useShelfRouteSources();');
    expect(detail).toContain('function ProductRoutineGuidance({');
    expect(detail).toContain('const viewModel = useShelfDetailViewModel(routeSources);');
    expect(detail).toContain(
      '<ProductRoutineGuidance productId={id} routeSources={routeSources} />',
    );
    expect(detail).not.toContain('useShelf()');
    expect(detail).not.toContain('usePlan()');
    expect(detail).not.toContain('useCycle()');
    expect(archive).toContain('const { shelf } = useShelfRouteSources();');
    expect(replenish).toContain('const { shelf } = useShelfRouteSources();');
  });

  it('keeps replenishment atomic, retry-stable, and outbox-ordered', () => {
    const store = read('features/shelf/store.ts');
    const mutations = read('features/shelf/mutations.ts');

    expect(store).toContain('export type ReAddedShelfProduct =');
    expect(store).toContain('replacementIdForSource(id)');
    expect(store).toContain('replacementId === id');
    expect(store).toContain('Crypto.CryptoDigestAlgorithm.SHA256');
    expect(mutations).toContain('const replaced = await reAddProduct(');
    expect(store).toContain('shelfUpsertChange(archived)');
    expect(store).toContain('shelfUpsertChange(fresh)');
    expect(store).toContain('updatePrivateItemsTransactionally([KEY, OUTBOX_STORAGE_KEY]');
    expect(mutations).not.toContain('loadShelf');
    expect(mutations).not.toContain('shelfMirrorTails');
    expect(mutations).not.toContain('enqueueShelfMirror');
    expect(mutations).toContain('scheduleOutboxFlush()');
    expect(mutations).toContain('const replenishmentAttempts = new Map');
    expect(mutations).toContain('const attemptKey = replenishmentAttemptKey(ownerScope, id)');
    expect(mutations).toContain('return runOwnerQueryOperation(ownerScope');
    expect(mutations).toContain('failClosedShelfQueriesAfterMutationFailure(qc, ownerScope)');
  });
});
