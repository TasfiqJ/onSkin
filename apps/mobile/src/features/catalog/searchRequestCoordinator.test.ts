import { describe, expect, it } from 'vitest';

import { CatalogSearchRequestCoordinator } from './searchRequestCoordinator';

describe('CatalogSearchRequestCoordinator', () => {
  it('deduplicates the same active query synchronously', () => {
    const coordinator = new CatalogSearchRequestCoordinator();
    const first = coordinator.begin('ceramide cleanser');
    const duplicate = coordinator.begin('ceramide cleanser');

    expect(first.kind).toBe('started');
    expect(duplicate).toEqual({ kind: 'duplicate', request: first.request });
    expect(first.request.controller.signal.aborted).toBe(false);
  });

  it('aborts a superseded request and rejects its late success or error publication', () => {
    const coordinator = new CatalogSearchRequestCoordinator();
    const first = coordinator.begin('first query');
    const second = coordinator.begin('second query');
    const publications: string[] = [];
    const publishIfCurrent = (label: string, controller: AbortController) => {
      if (coordinator.canPublish(controller, true)) publications.push(label);
    };

    expect(first.kind).toBe('started');
    expect(second).toMatchObject({ kind: 'started', superseded: true });
    expect(first.request.controller.signal.aborted).toBe(true);
    expect(coordinator.canPublish(first.request.controller, true)).toBe(false);
    expect(coordinator.canPublish(second.request.controller, true)).toBe(true);

    publishIfCurrent('late success', first.request.controller);
    publishIfCurrent('late error', first.request.controller);
    publishIfCurrent('current analytics and state', second.request.controller);
    expect(publications).toEqual(['current analytics and state']);
  });

  it('does not let an older completion clear a newer request', () => {
    const coordinator = new CatalogSearchRequestCoordinator();
    const first = coordinator.begin('first query');
    const second = coordinator.begin('second query');

    expect(coordinator.finish(first.request.controller)).toBe(false);
    expect(coordinator.current()).toBe(second.request);
    expect(coordinator.finish(second.request.controller)).toBe(true);
    expect(coordinator.current()).toBeNull();
  });

  it('rejects publication after blur cancellation or unmount', () => {
    const coordinator = new CatalogSearchRequestCoordinator();
    const blurred = coordinator.begin('blurred query');

    expect(coordinator.cancel()).toBe(true);
    expect(coordinator.canPublish(blurred.request.controller, true)).toBe(false);

    const unmounted = coordinator.begin('unmounted query');
    expect(coordinator.canPublish(unmounted.request.controller, false)).toBe(false);
    expect(coordinator.cancel()).toBe(true);
    expect(coordinator.current()).toBeNull();
  });
});
