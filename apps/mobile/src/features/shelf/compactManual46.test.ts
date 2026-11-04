import { createElement, StrictMode, useLayoutEffect } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it } from 'vitest';

import {
  close26,
  flush26,
  grant26,
  ports26,
  profile26,
  reset26,
  shelf26,
} from './firstValue26TestPorts';
import ManualAddScreen from '@/app/shelf/manual';
import OpenedDateScreen from '@/app/shelf/opened';
import ShelfLayout from '@/app/shelf/_layout';
import { Button } from '@/components/ui/Button';
import { IntakeProvider, useIntake } from './IntakeContext';
import { loadShelf } from './store';

// Real routes, Query, intake, consent/owner admission and encrypted storage;
// only native rendering/storage and navigation use the existing platform ports.
// Mounted structure is not browser geometry or physical-device qualification.
let client: QueryClient;
let screen: ReactTestRenderer | undefined;
let intake: ReturnType<typeof useIntake>;
function Probe() {
  const value = useIntake();
  useLayoutEffect(() => {
    intake = value;
  }, [value]);
  return null;
}
function tree() {
  return createElement(
    StrictMode,
    null,
    createElement(
      QueryClientProvider,
      { client },
      createElement(IntakeProvider, null, createElement(Probe), createElement(ShelfLayout)),
    ),
  );
}
async function mount() {
  ports26.routeChild = createElement(ManualAddScreen);
  await act(async () => {
    screen = create(tree());
  });
  await flush26();
}
function input(label: string) {
  return screen!.root
    .findAllByType('TextInput' as never)
    .find((node) => node.props.accessibilityLabel === label);
}
function button(label: string) {
  return screen!.root.findAllByType(Button).find((node) => node.props.label === label);
}
function action(label: string) {
  return screen!.root
    .findAllByType('Pressable' as never)
    .find((node) => node.props.accessibilityLabel === label);
}
beforeEach(async () => {
  client = await reset26();
  await profile26();
  await shelf26();
});
afterEach(async () => {
  ports26.release?.();
  await act(async () => {
    screen?.unmount();
  });
  screen = undefined;
  await close26(client);
});

it.each([
  { width: 360, height: 640, fontScale: 1 },
  { width: 375, height: 667, fontScale: 2 },
])(
  'keeps optional INCI editable at $width x $height / scale $fontScale and saves only explicitly',
  async (dimensions) => {
    ports26.dimensions = dimensions;
    await mount();
    const ingredients = input('Ingredients');
    expect(
      ingredients,
      'Compact manual fallback must retain the optional ingredient input',
    ).toBeDefined();
    const scroll = screen!.root
      .findAllByType('ScrollView' as never)
      .find((node) => node.findAllByType('TextInput' as never).includes(ingredients!));
    expect(scroll).toBeDefined();
    expect(scroll!.props.keyboardShouldPersistTaps).toBe('handled');
    const before = new Map(ports26.bytes);
    await act(async () => {
      input('Product name')!.props.onChangeText('Compact synthetic cleanser');
      ingredients!.props.onChangeText('Aqua, Glycerin');
    });
    expect(input('Ingredients')!.props.value).toBe('Aqua, Glycerin');
    expect(ports26.bytes).toEqual(before);
    const next = button('Continue')!.props.onPress;
    await act(async () => {
      next();
      next();
    });
    expect(ports26.push).toHaveBeenCalledTimes(1);
    expect(intake.draft.ingredients).toEqual(['Aqua', 'Glycerin']);
    expect(ports26.bytes).toEqual(before);
    ports26.params = { intakeId: intake.sessionId! };
    ports26.routeName = 'opened';
    ports26.routeChild = createElement(OpenedDateScreen);
    await act(async () => {
      screen!.update(tree());
    });
    await flush26();
    await act(async () => {
      action('Not opened yet')!.props.onPress();
    });
    const save = button('Add to shelf')!.props.onPress;
    await act(async () => {
      await Promise.all([save(), save()]);
    });
    await flush26();
    const products = await loadShelf();
    const saved = products.filter((product) => product.name === 'Compact synthetic cleanser');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.ingredients).toEqual(['Aqua', 'Glycerin']);
    expect(products).toHaveLength(4);
    expect(ports26.bytes.get('layerwell.shelf.v1')).not.toContain('Compact synthetic cleanser');
    expect(ports26.replace).toHaveBeenCalledTimes(1);
  },
);

it('retires compact ingredient/Continue callbacks on a real health regrant without writing', async () => {
  ports26.dimensions = { width: 375, height: 667, fontScale: 2 };
  await mount();
  expect(input('Ingredients')).toBeDefined();
  await act(async () => {
    input('Product name')!.props.onChangeText('Retired compact draft');
    input('Ingredients')!.props.onChangeText('Aqua, Glycerin');
  });
  const edit = input('Ingredients')!.props.onChangeText;
  const next = button('Continue')!.props.onPress;
  const before = new Map(ports26.bytes);
  await act(async () => {
    await grant26();
    edit('Retired overwrite');
    next();
  });
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.bytes).toEqual(before);
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush26();
  expect(input('Ingredients')!.props.value).toBe('');
  expect(input('Product name')!.props.value).toBe('');
});

it.each(['failed', 'pending'] as const)(
  'offers a byte-neutral exit while the genuine private read is %s',
  async (state) => {
    if (state === 'failed') ports26.failRead = 'layerwell.shelf.v1';
    else ports26.holdRead = 'layerwell.shelf.v1';
    const before = new Map(ports26.bytes);
    await mount();
    await flush26();
    expect(client.getQueryState(['shelf'])?.[state === 'failed' ? 'status' : 'fetchStatus']).toBe(
      state === 'failed' ? 'error' : 'fetching',
    );
    expect(input('Product name')).toBeUndefined();
    const back = button('Back');
    expect(
      back,
      'Unavailable private storage must not trap the user in the intake route',
    ).toBeDefined();
    await act(async () => {
      back!.props.onPress();
    });
    expect(ports26.back).toHaveBeenCalledTimes(1);
    expect(ports26.push).not.toHaveBeenCalled();
    expect(ports26.replace).not.toHaveBeenCalled();
    expect(ports26.bytes).toEqual(before);
    if (state === 'failed') expect(button('Try again')).toBeDefined();
    ports26.failRead = null;
    await act(async () => {
      ports26.release?.();
      await client.refetchQueries({ queryKey: ['shelf'], exact: true });
    });
    await flush26();
    expect(input('Product name')).toBeDefined();
    expect(ports26.bytes).toEqual(before);
  },
);
