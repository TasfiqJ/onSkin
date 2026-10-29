import { close25, flush25, ports25, profile25, reset25, shelf25 } from './firstValue25TestPorts';
import { createElement, useLayoutEffect, useRef } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

// Keep one loaded module across local midnight and Toronto's 25-hour DST day.
vi.useFakeTimers({ toFake: ['Date'] });
vi.setSystemTime(new Date('2026-10-31T23:55:00-04:00'));
const { default: Opened } = await import('@/app/shelf/opened');
const { IntakeProvider, useIntake } = await import('./IntakeContext');
const { loadShelf } = await import('./store');
const { localDateString } = await import('@/features/today/useToday');

let client: QueryClient;
let view: ReactTestRenderer | undefined;
function Seed() {
  const intake = useIntake();
  const seeded = useRef(false);
  useLayoutEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    ports25.params = {
      intakeId: intake.reset({
        name: 'Synthetic new package',
        category: 'moisturiser_tube',
        addedVia: 'manual',
      }),
    };
  }, [intake]);
  return null;
}
async function mount() {
  // Real source must already be confirmed before the standalone form is used.
  const { useShelf } = await import('./useShelf');
  function ReadyForm() {
    const shelf = useShelf();
    return shelf.data && !shelf.isError ? createElement(Opened) : null;
  }
  await act(async () => {
    view = create(
      createElement(
        QueryClientProvider,
        { client },
        createElement(IntakeProvider, null, createElement(Seed), createElement(ReadyForm)),
      ),
    );
  });
  await flush25();
}
function action(label: string) {
  const found = view!.root
    .findAllByType('Pressable' as never)
    .find(
      (node) =>
        node.props.accessibilityLabel === label ||
        node.findAllByType('Text' as never).some((text) => text.props.children === label),
    );
  expect(found, label).toBeDefined();
  return found!.props.onPress as () => void | Promise<void>;
}
async function savedDate() {
  await act(async () => {
    await action('Add to shelf')();
  });
  return (await loadShelf()).find((p) => p.name === 'Synthetic new package')?.openedAt;
}
beforeEach(async () => {
  vi.setSystemTime(new Date('2026-11-02T10:00:00-05:00'));
  client = await reset25();
  await profile25();
  await shelf25();
});
afterEach(async () => {
  await act(async () => {
    view?.unmount();
  });
  view = undefined;
  await close25(client);
});
afterAll(() => {
  vi.useRealTimers();
});

it('resolves a relative two-week shortcut from the current calendar, not module-import time', async () => {
  await mount();
  await act(async () => {
    action('Pick a date')();
  });
  await act(async () => {
    action('2 weeks ago')();
  });
  const expected = new Date();
  expected.setDate(expected.getDate() - 14);
  expect(await savedDate()).toBe(localDateString(expected));
});

it('rechecks Just opened at dispatch after local midnight even before a clock render', async () => {
  await mount();
  await act(async () => {
    action('Just opened it')();
  });
  const oldSave = action('Add to shelf');
  vi.setSystemTime(new Date('2026-11-03T00:01:00-05:00'));
  await act(async () => {
    await oldSave();
  });
  expect((await loadShelf()).find((p) => p.name === 'Synthetic new package')?.openedAt).toBe(
    localDateString(),
  );
});

it('refreshes current date on foreground/timezone change but retains a chosen absolute date', async () => {
  await mount();
  await act(async () => {
    action('Pick a date')();
  });
  const input = view!.root
    .findAllByType('TextInput' as never)
    .find((node) => node.props.accessibilityLabel === 'Exact opened date')!;
  await act(async () => {
    input.props.onChangeText('2026-09-14');
  });
  vi.setSystemTime(new Date('2026-11-04T11:00:00+09:00'));
  await act(async () => {
    for (const fn of ports25.appState) fn('active');
  });
  expect(await savedDate()).toBe('2026-09-14');
});
