import {
  close25,
  flush25,
  grant25,
  ports25,
  profile25,
  reset25,
  shelf25,
} from '../shelf/firstValue25TestPorts';
import { createElement, useLayoutEffect } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it } from 'vitest';

// No feature, generator, Query, owner/grant, consent, profile, store, or encrypted
// KV mocks. The shared adapter controls only actual native/external boundaries.
const { default: Reveal } = await import('@/app/onboarding/reveal');
const { default: Adaptation } = await import('@/app/routine/adaptation');
const { OnboardingProvider, useOnboarding } =
  await import('@/features/onboarding/OnboardingContext');
const { usePlan } = await import('./usePlan');
const { routineOrderQueryKeyForLease } = await import('./orderStore');
const { removePrivateItem } = await import('@/lib/storage/privateKV');

let client: QueryClient;
let view: ReactTestRenderer | undefined;
let context: ReturnType<typeof useOnboarding>;
let plan: ReturnType<typeof usePlan>;
let answers: Awaited<ReturnType<typeof profile25>>;
let route: 'reveal' | 'adaptation';
let revision = 0;
function Probe() {
  const value = useOnboarding();
  const next = usePlan();
  useLayoutEffect(() => {
    context = value;
    plan = next;
  });
  return null;
}
function tree() {
  return createElement(
    QueryClientProvider,
    { client },
    createElement(
      OnboardingProvider,
      null,
      createElement(Probe),
      createElement(route === 'reveal' ? Reveal : Adaptation, { key: revision }),
    ),
  );
}
async function mount(which: typeof route) {
  route = which;
  await act(async () => {
    view = create(tree());
  });
  await flush25();
  await act(async () => {
    context.toggleGoal('clear_skin');
    for (const [id, answer] of Object.entries(answers)) context.setAnswer(id, answer);
  });
  await flush25();
  expect(plan.sourceReady).toBe(true);
  expect(plan.isSourceCurrent()).toBe(true);
  expect(plan.data?.isExample).toBe(false);
}
function text() {
  return JSON.stringify(view!.toJSON());
}
function press(label: string) {
  const found = view!.root
    .findAllByType('Pressable' as never)
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node
          .findAllByType('Text' as never)
          .some(
            (text) =>
              text.props.children === label ||
              (label === 'Back to routine' && text.props.children === 'Looks good'),
          ),
    );
  expect(found, label).toBeDefined();
  return found!.props.onPress as () => void;
}
async function failOrder() {
  ports25.failRead = 'layerwell.routineOrder.v1';
  await act(async () => {
    await client.refetchQueries({
      queryKey: routineOrderQueryKeyForLease(plan.orderLease),
      exact: true,
    });
  });
  await flush25();
  expect(plan.isError).toBe(true);
  expect(plan.data).toBeDefined(); // Actual retained data: the route must reject it.
}
beforeEach(async () => {
  revision = 0;
  client = await reset25();
  answers = await profile25();
  await shelf25();
});
afterEach(async () => {
  await act(async () => {
    ports25.release?.();
    view?.unmount();
  });
  view = undefined;
  await close25(client);
});

it.each(['reveal', 'adaptation'] as const)(
  '%s refuses actual retained order-error data and recovers offline',
  async (which) => {
    await mount(which);
    await failOrder();
    expect(text()).toContain('Your routine is unavailable.');
    expect(text()).not.toContain('ROUTINE UPDATED');
    for (const name of ['Synthetic cleanser', 'Synthetic balm', 'Synthetic SPF'])
      expect(text()).not.toContain(name);
    ports25.failRead = null;
    await act(async () => {
      press('Retry routine')();
    });
    await flush25();
    expect(plan.sourceReady).toBe(true);
    expect(text()).not.toContain('Your routine is unavailable.');
    expect(plan.data?.activeProductIds).toHaveLength(3);
  },
);

it.each(['reveal', 'adaptation'] as const)(
  '%s masks retained routine data during a delayed read and checks the continuation authority',
  async (which) => {
    await mount(which);
    const oldAction = press(which === 'reveal' ? 'Continue' : 'Back to routine');
    ports25.holdRead = 'layerwell.routineOrder.v1';
    await act(async () => {
      void client.refetchQueries({
        queryKey: routineOrderQueryKeyForLease(plan.orderLease),
        exact: true,
      });
    });
    await flush25();
    expect(plan.isRefreshing).toBe(true);
    expect(text()).toContain('Loading your routine');
    ports25.push.mockClear();
    ports25.back.mockClear();
    await act(async () => {
      oldAction();
    });
    // Reveal's independent current quiz profile may continue to notifications;
    // it neither consumes nor confirms the unavailable routine. Adaptation does.
    if (which === 'reveal') expect(ports25.push).toHaveBeenCalledWith('/onboarding/notifications');
    else expect(ports25.push).not.toHaveBeenCalled();
    expect(ports25.back).not.toHaveBeenCalled();
    await act(async () => {
      ports25.release?.();
    });
    await flush25();
    expect(plan.sourceReady).toBe(true);
  },
);

it('Reveal never reserves first-insight analytics from an unconfirmed retained plan', async () => {
  await mount('reveal');
  await failOrder();
  await removePrivateItem('layerwell.routineActivation.v1');
  ports25.track.mockClear();
  await act(async () => {
    revision++;
    view!.update(tree());
  });
  await flush25();
  expect(ports25.track.mock.calls.filter(([name]) => name === 'first_useful_insight')).toEqual([]);
  expect(ports25.bytes.has('layerwell.routineActivation.v1')).toBe(false);
});

it('Recent changes reports current pending review without claiming a change or a fake Undo', async () => {
  await mount('adaptation');
  expect(plan.data?.plan.sequencingWithheld.length).toBeGreaterThan(0);
  expect(text()).toContain('Automatic order not set');
  expect(text()).toContain('Current routine');
  expect(text()).not.toContain('ROUTINE UPDATED');
  expect(text()).not.toContain('We rechecked');
  expect(
    view!.root
      .findAllByType('Pressable' as never)
      .some((node) => node.props.accessibilityLabel === 'Undo'),
  ).toBe(false);
});

it.each(['reveal', 'adaptation'] as const)(
  '%s refuses old actions and private output across real same-owner regrant and A/B/A',
  async (which) => {
    await mount(which);
    const old = press(which === 'reveal' ? 'Continue' : 'Back to routine');
    ports25.push.mockClear();
    ports25.back.mockClear();
    // The new grant may legitimately re-read this owner's durable records. Hold
    // its canonical source so the assertion challenges reuse before fresh proof.
    ports25.holdRead = 'layerwell.routineOrder.v1';
    await act(async () => {
      await grant25('synthetic-first-value-b');
      await grant25('synthetic-first-value-a');
      old();
    });
    await flush25();
    expect(ports25.push).not.toHaveBeenCalled();
    expect(ports25.back).not.toHaveBeenCalled();
    for (const name of ['Synthetic cleanser', 'Synthetic balm', 'Synthetic SPF'])
      expect(text()).not.toContain(name);
  },
);
