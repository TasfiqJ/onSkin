import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function readSource(path: string): string {
  return readFileSync(`${SRC_DIR}/${path}`, 'utf8');
}

describe('Routine Plan route ownership', () => {
  it('mounts one shared Plan and Cycle source graph', () => {
    const route = readSource('app/routine/plan.tsx');
    const layout = readSource('app/routine/_layout.tsx');
    const sources = readSource('features/routine/RoutineRouteSources.tsx');
    const viewModel = readSource('features/routine/useRoutinePlanViewModel.ts');

    expect(route).toContain(
      "import { useRoutinePlanViewModel } from '@/features/routine/useRoutinePlanViewModel';",
    );
    expect(route).toContain('const { planQuery, cycleQuery } = useRoutinePlanViewModel();');
    expect(route).not.toMatch(/\busePlan\(\)/);
    expect(route).not.toMatch(/\buseCycle\(\)/);
    expect(layout).toContain('<RoutineRouteSourcesProvider>');
    expect(layout).toContain('<ShelfDataAvailabilityBoundary query={shelf}>');
    expect(layout).not.toContain('<ShelfDataAvailabilityGate');
    expect(sources.match(/useLocalDateBoundary\(\)/g)).toHaveLength(1);
    expect(sources.match(/useShelfFromBoundary\(boundary\)/g)).toHaveLength(1);
    expect(viewModel.match(/useRoutineRouteSources\(\)/g)).toHaveLength(1);
    expect(viewModel).toContain('data: shelf.data?.profile');
    expect(viewModel).not.toContain('useProfileBits');
    expect(viewModel.match(/usePlanFromSources\(shelf, profile\)/g)).toHaveLength(1);
    expect(viewModel.match(/useRampFromPlan\(plan, boundary\)/g)).toHaveLength(1);
    expect(viewModel.match(/useCycleFromSources\(shelf, profile, ramp, boundary\)/g)).toHaveLength(
      1,
    );
  });
});
