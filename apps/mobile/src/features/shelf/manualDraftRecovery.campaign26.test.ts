import { createElement, StrictMode, useLayoutEffect, useRef } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

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
import { addProduct, loadShelf } from './store';
import {
  activeHealthProcessingLeaseSnapshot,
  clearActiveHealthProcessingEpoch,
  setActiveHealthProcessingEpoch,
} from '@/lib/consent/healthProcessingEpoch';
import {
  beginAccountGenerationBoundary,
  endAccountGenerationBoundary,
  runAccountGenerationOperation,
} from '@/lib/auth/accountGeneration';

// Only native navigator/rendering/storage boundaries are controlled. Actual
// layout, UI, Query, encrypted stores/mutations, consent and intake execute.
let screen: ReactTestRenderer | undefined;
let client: QueryClient;
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
function action(label: string) {
  return screen!.root
    .findAllByType('Pressable' as never)
    .find((node) => node.props.accessibilityLabel === label)!;
}
function button(label: string) {
  return screen!.root.findAllByType(Button).find((node) => node.props.label === label)!;
}
function picker() {
  return screen!.root
    .findAllByType('View' as never)
    .find((node) => node.props.accessibilityLabel === 'Choose product category');
}
async function typeDraft() {
  await act(async () => {
    input('Product name')!.props.onChangeText('Unsaved synthetic cleanser');
    input('Brand')!.props.onChangeText('Synthetic brand');
    input('Barcode, optional')!.props.onChangeText('96385074');
    input('Ingredients')!.props.onChangeText('Aqua, Glycerin');
  });
  await act(async () => {
    action('Eight-digit barcode type, EAN-8').props.onPress();
    action('Category').props.onPress();
  });
  await act(async () => action('Category, Cleanser').props.onPress());
}
function callbacks() {
  return {
    next: button('Continue').props.onPress as () => void,
    cancel: action('Cancel').props.onPress as () => void,
    name: input('Product name')!.props.onChangeText as (text: string) => void,
    brand: input('Brand')!.props.onChangeText as (text: string) => void,
    barcode: input('Barcode, optional')!.props.onChangeText as (text: string) => void,
    ingredients: input('Ingredients')!.props.onChangeText as (text: string) => void,
    format: action('Eight-digit barcode type, UPC-E').props.onPress as () => void,
    category: action('Category, Cleanser').props.onPress as () => void,
  };
}
function invokeAll(captured: ReturnType<typeof callbacks>) {
  captured.name('STALE NAME');
  captured.brand('STALE BRAND');
  captured.barcode('00425261');
  captured.ingredients('STALE INCI');
  captured.format();
  captured.category();
  captured.next();
  captured.cancel();
}
function expectDraft() {
  expect(input('Product name')?.props.value).toBe('Unsaved synthetic cleanser');
  expect(input('Brand')?.props.value).toBe('Synthetic brand');
  expect(input('Barcode, optional')?.props.value).toBe('96385074');
  expect(input('Ingredients')?.props.value).toBe('Aqua, Glycerin');
  expect(action('Eight-digit barcode type, EAN-8').props.accessibilityState.checked).toBe(true);
  expect(action('Category, Cleanser')).toBeDefined();
}
async function refetch() {
  await act(async () => {
    await client.refetchQueries({ queryKey: ['shelf'], exact: true });
  });
  await flush26();
}
beforeEach(async () => {
  client = await reset26();
  await profile26();
  await shelf26();
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  ports26.release?.();
  await act(async () => {
    screen?.unmount();
  });
  screen = undefined;
  await close26(client);
});

it('retains every field, barcode choice and open picker through real offline read failure/recovery', async () => {
  await mount();
  await typeDraft();
  await act(async () => action('Category, Cleanser').props.onPress());
  const before = new Map(ports26.bytes);
  ports26.failRead = 'layerwell.shelf.v1';
  await refetch();
  expect(client.getQueryState(['shelf'])?.status).toBe('error');
  expect(JSON.stringify(screen!.toJSON())).toContain('Shelf data unavailable');
  const hidden = screen!.root
    .findAllByType('View' as never)
    .find((node) => node.props['aria-hidden'] === true && node.props.pointerEvents === 'none')!;
  expect(hidden.props.style.display).toBe('none');
  expect(hidden.props.accessibilityElementsHidden).toBe(true);
  expect(hidden.props.importantForAccessibility).toBe('no-hide-descendants');
  expect(ports26.keyboardDismiss).toHaveBeenCalled();
  expect(ports26.bytes).toEqual(before);
  ports26.failRead = null;
  await refetch();
  expectDraft();
  expect(picker()).toBeDefined();
  expect(await loadShelf()).toHaveLength(3);
  expect(ports26.push).not.toHaveBeenCalled();
});

it('refuses every captured control in source error even when hardware becomes readable first', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  await act(async () => old.category());
  const select = action('Category, Serum').props.onPress;
  const close = action('Close category picker').props.onPress;
  const dismiss = action('Dismiss category picker').props.onPress;
  const revision = intake.draftRevision;
  ports26.failRead = 'layerwell.shelf.v1';
  await refetch();
  ports26.failRead = null;
  await act(async () => {
    invokeAll(old);
    select();
    close();
    dismiss();
  });
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
  expect(intake.draftRevision).toBe(revision);
  await refetch();
  expectDraft();
  expect(picker()).toBeDefined();
});

it('refuses controls during a genuinely pending current-grant private read and retains fields', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  ports26.holdRead = 'layerwell.shelf.v1';
  let pending!: Promise<void>;
  await act(async () => {
    pending = client.refetchQueries({ queryKey: ['shelf'], exact: true });
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  });
  expect(client.getQueryState(['shelf'])?.fetchStatus).toBe('fetching');
  await act(async () => invokeAll(old));
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
  await act(async () => {
    ports26.release?.();
    await pending;
  });
  await flush26();
  expectDraft();
});

it('refuses invalidated idle Query data before a refetch can begin', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['shelf'], exact: true, refetchType: 'none' });
    invokeAll(old);
  });
  expect(client.getQueryState(['shelf'])?.isInvalidated).toBe(true);
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
  await refetch();
  expectDraft();
});

it('rejects callbacks from a replaced source and accepts fresh callbacks after real recovery', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  await addProduct({ name: 'New current synthetic balm', addedVia: 'manual' });
  await refetch();
  await act(async () => invokeAll(old));
  expect(ports26.push).not.toHaveBeenCalled();
  expectDraft();
  await act(async () => button('Continue').props.onPress());
  expect(ports26.push).toHaveBeenCalledTimes(1);
});

it('refuses old Continue when the actual Query instance is rebuilt with identical data', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  const snapshot = client.getQueryData(['shelf']);
  const oldQuery = client.getQueryCache().find({ queryKey: ['shelf'], exact: true });
  const revision = intake.draftRevision;
  await act(async () => {
    client.removeQueries({ queryKey: ['shelf'], exact: true });
    client.setQueryData(['shelf'], snapshot);
    expect(client.getQueryCache().find({ queryKey: ['shelf'], exact: true })).not.toBe(oldQuery);
    old.next();
  });
  expect(ports26.push).not.toHaveBeenCalled();
  expect(intake.draftRevision).toBe(revision);
});

it('refuses old edits and cancellation when a replacement Query reuses its exact data object', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  const snapshot = client.getQueryData(['shelf']);
  const oldQuery = client.getQueryCache().find({ queryKey: ['shelf'], exact: true });
  await act(async () => {
    client.removeQueries({ queryKey: ['shelf'], exact: true });
    client.setQueryData(['shelf'], snapshot);
    expect(client.getQueryCache().find({ queryKey: ['shelf'], exact: true })).not.toBe(oldQuery);
    old.name('STALE QUERY OVERWRITE');
    old.brand('STALE QUERY BRAND');
    old.barcode('00425261');
    old.ingredients('STALE QUERY INCI');
    old.format();
    old.category();
  });
  expectDraft();
  expect(picker()).toBeUndefined();
  await act(async () => old.cancel());
  expect(ports26.back).not.toHaveBeenCalled();
});

it('accepts a freshly rendered form after replacement Query and genuine private-source recovery', async () => {
  await mount();
  await typeDraft();
  const snapshot = client.getQueryData(['shelf']);
  const oldQuery = client.getQueryCache().find({ queryKey: ['shelf'], exact: true });
  await act(async () => {
    client.removeQueries({ queryKey: ['shelf'], exact: true });
    client.setQueryData(['shelf'], snapshot);
    ports26.routeChild = createElement(ManualAddScreen);
    screen!.update(tree());
  });
  await refetch();
  expect(client.getQueryCache().find({ queryKey: ['shelf'], exact: true })).not.toBe(oldQuery);
  expectDraft();
  await act(async () => input('Brand')!.props.onChangeText('Fresh current brand'));
  await act(async () => button('Continue').props.onPress());
  expect(ports26.push).toHaveBeenCalledTimes(1);
  expect(intake.draft.brand).toBe('Fresh current brand');
});

it.each(['same-owner', 'A-B-A', 'withdrawal', 'new-epoch', 'account-boundary'] as const)(
  'retires every old control and typed draft on %s before React rerenders',
  async (transition) => {
    await mount();
    await typeDraft();
    const old = callbacks();
    const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
    await act(async () => {
      if (transition === 'account-boundary') {
        beginAccountGenerationBoundary();
        invokeAll(old);
        endAccountGenerationBoundary();
      } else {
        clearActiveHealthProcessingEpoch();
        if (transition === 'A-B-A') {
          setActiveHealthProcessingEpoch(25, {
            ownerUserId: 'synthetic-first-value-b',
            accountGeneration,
          });
          clearActiveHealthProcessingEpoch();
        }
        if (transition !== 'withdrawal')
          setActiveHealthProcessingEpoch(transition === 'new-epoch' ? 26 : 25, {
            ownerUserId: 'synthetic-first-value-a',
            accountGeneration,
          });
        invokeAll(old);
      }
    });
    expect(ports26.push).not.toHaveBeenCalled();
    expect(ports26.back).not.toHaveBeenCalled();
    if (transition === 'withdrawal' || transition === 'account-boundary')
      await act(async () => grant26());
    await refetch();
    for (const label of ['Product name', 'Brand', 'Barcode, optional', 'Ingredients'])
      expect(input(label)?.props.value).toBe('');
    expect(picker()).toBeUndefined();
  },
);

it('does not rehydrate a matching incoming intake token from a retired grant', async () => {
  await mount();
  await act(async () => {
    const intakeId = intake.reset({ name: 'Old incoming private name', brand: 'Old brand' });
    ports26.params = { intakeId };
  });
  expect(input('Product name')?.props.value).toBe('Old incoming private name');
  await act(async () => grant26());
  await refetch();
  expect(input('Product name')?.props.value).toBe('');
  expect(input('Brand')?.props.value).toBe('');
});

it('retires replacement draft callbacks without clearing or overwriting a successor', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  let successor!: string;
  await act(async () => {
    successor = intake.reset({ name: 'Successor current product' });
    ports26.params = { intakeId: successor };
    invokeAll(old);
  });
  expect(intake.sessionId).toBe(successor);
  expect(intake.draft.name).toBe('Successor current product');
  expect(input('Product name')?.props.value).toBe('Successor current product');
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
});

it('retires null-session ABA and refuses callbacks after form unmount', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  await act(async () => {
    const intervening = intake.reset({ name: 'Intervening product' });
    intake.clearIfCurrent(intervening);
    invokeAll(old);
  });
  expect(intake.sessionId).toBeNull();
  expect(input('Product name')?.props.value).toBe('');
  await act(async () => screen!.unmount());
  await act(async () => invokeAll(old));
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
});

it('refuses an expired captured health lease synchronously', async () => {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(25, {
    ownerUserId: 'synthetic-first-value-a',
    accountGeneration,
    serverVerifiedAt: new Date().toISOString(),
  });
  await mount();
  await typeDraft();
  const old = callbacks();
  vi.spyOn(Date, 'now').mockReturnValue(activeHealthProcessingLeaseSnapshot()!.expiresAt! + 1);
  await act(async () => invokeAll(old));
  expect(ports26.push).not.toHaveBeenCalled();
  expect(ports26.back).not.toHaveBeenCalled();
});

it('continues once then uses actual opening UI/mutations to save the exact product once', async () => {
  await mount();
  await typeDraft();
  const old = callbacks();
  const before = new Map(ports26.bytes);
  await act(async () => {
    old.next();
    old.next();
    old.next();
  });
  expect(ports26.push).toHaveBeenCalledTimes(1);
  expect(ports26.bytes).toEqual(before);
  expect(intake.draft).toMatchObject({
    name: 'Unsaved synthetic cleanser',
    brand: 'Synthetic brand',
    category: 'cleanser',
    barcode: '96385074',
    ingredients: ['Aqua', 'Glycerin'],
    addedVia: 'manual',
  });
  ports26.params = { intakeId: intake.sessionId! };
  ports26.routeName = 'opened';
  ports26.routeChild = createElement(OpenedDateScreen);
  await act(async () => screen!.update(tree()));
  await flush26();
  await act(async () => action('Not opened yet').props.onPress());
  const save = button('Add to shelf').props.onPress;
  await act(async () => {
    await Promise.all([save(), save(), save()]);
  });
  await flush26();
  const products = await loadShelf();
  expect(products).toHaveLength(4);
  expect(products.filter((product) => product.name === 'Unsaved synthetic cleanser')).toHaveLength(
    1,
  );
  expect(intake.sessionId).toBeNull();
  expect(ports26.replace).toHaveBeenCalledTimes(1);
});

it.each(['same-owner', 'A-B-A'] as const)(
  'does not reanimate an accepted manual session via actual Opened after %s regrant',
  async (transition) => {
    await mount();
    await typeDraft();
    await act(async () => button('Continue').props.onPress());
    const oldToken = intake.sessionId!;
    await act(async () => {
      if (transition === 'A-B-A') await grant26('synthetic-first-value-b');
      await grant26();
    });
    await refetch();
    ports26.params = { intakeId: oldToken };
    ports26.routeName = 'opened';
    ports26.routeChild = createElement(OpenedDateScreen);
    await act(async () => screen!.update(tree()));
    await flush26();
    const unopened = action('Not opened yet');
    if (unopened) await act(async () => unopened.props.onPress());
    const save = button('Add to shelf');
    if (save) await act(async () => save.props.onPress());
    await flush26();
    const products = await loadShelf();
    expect(
      products.filter((product) => product.name === 'Unsaved synthetic cleanser'),
    ).toHaveLength(0);
    expect(products).toHaveLength(3);
    expect(intake.isSessionCurrent(oldToken)).toBe(false);
    expect(JSON.stringify(screen!.toJSON())).toContain('Add product details first.');
  },
);

it('admits a fresh manual session after retirement and saves only its new current-grant product', async () => {
  await mount();
  await typeDraft();
  await act(async () => button('Continue').props.onPress());
  const oldToken = intake.sessionId!;
  await act(async () => grant26());
  await refetch();
  ports26.params = { intakeId: oldToken };
  ports26.routeName = 'opened';
  ports26.routeChild = createElement(OpenedDateScreen);
  await act(async () => screen!.update(tree()));
  await flush26();
  await act(async () => action('Add product by hand').props.onPress());
  expect(ports26.replace).toHaveBeenCalledWith('/shelf/manual');
  ports26.params = {};
  ports26.routeName = 'manual';
  ports26.routeChild = createElement(ManualAddScreen);
  await act(async () => screen!.update(tree()));
  await flush26();
  expect(input('Product name')?.props.value).toBe('');
  await act(async () => input('Product name')!.props.onChangeText('Fresh current-grant cleanser'));
  await act(async () => button('Continue').props.onPress());
  const currentToken = intake.sessionId!;
  expect(currentToken).not.toBe(oldToken);
  expect(intake.isSessionCurrent(oldToken)).toBe(false);
  expect(intake.isSessionCurrent(currentToken)).toBe(true);
  ports26.params = { intakeId: currentToken };
  ports26.routeName = 'opened';
  ports26.routeChild = createElement(OpenedDateScreen);
  await act(async () => screen!.update(tree()));
  await flush26();
  await act(async () => action('Not opened yet').props.onPress());
  await act(async () => button('Add to shelf').props.onPress());
  await flush26();
  const products = await loadShelf();
  expect(products).toHaveLength(4);
  expect(
    products.filter((product) => product.name === 'Fresh current-grant cleanser'),
  ).toHaveLength(1);
  expect(products.filter((product) => product.name === 'Unsaved synthetic cleanser')).toHaveLength(
    0,
  );
});

it('refuses a captured Opened Save/reset and never lets a retired completion clear a fresh session', async () => {
  await mount();
  await typeDraft();
  await act(async () => button('Continue').props.onPress());
  const oldToken = intake.sessionId!;
  const oldReset = intake.reset;
  ports26.params = { intakeId: oldToken };
  ports26.routeName = 'opened';
  ports26.routeChild = createElement(OpenedDateScreen);
  await act(async () => screen!.update(tree()));
  await flush26();
  await act(async () => action('Not opened yet').props.onPress());
  const oldSave = button('Add to shelf').props.onPress;
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  await act(async () => {
    clearActiveHealthProcessingEpoch();
    setActiveHealthProcessingEpoch(25, {
      ownerUserId: 'synthetic-first-value-a',
      accountGeneration,
    });
    expect(intake.isSessionCurrent(oldToken)).toBe(false);
    expect(intake.clearIfCurrent(oldToken)).toBe(false);
    expect(() => oldReset({ name: 'Captured old private payload' })).toThrow(
      'INTAKE_LEASE_RETIRED',
    );
    await oldSave();
  });
  expect(intake.sessionId).toBe(oldToken); // Inert opaque provenance only.
  expect(intake.draft.name).toBe('');
  await refetch();
  let currentToken!: string;
  await act(async () => {
    currentToken = intake.reset({ name: 'New current session' });
    expect(intake.clearIfCurrent(oldToken)).toBe(false);
    await oldSave();
  });
  expect(intake.sessionId).toBe(currentToken);
  expect(intake.isSessionCurrent(currentToken)).toBe(true);
  expect(intake.draft.name).toBe('New current session');
  expect(await loadShelf()).toHaveLength(3);
  expect(ports26.replace).not.toHaveBeenCalled();
});

it('reconciles a lease transition that occurs before the provider subscribes', async () => {
  let oldToken!: string;
  let refusedBeforeSubscribe = false;
  function RetireDuringLayout() {
    const context = useIntake();
    const done = useRef(false);
    useLayoutEffect(() => {
      if (done.current) return;
      done.current = true;
      oldToken = context.reset({ name: 'Private before subscription' });
      const accountGeneration = activeHealthProcessingLeaseSnapshot()!.accountGeneration!;
      clearActiveHealthProcessingEpoch();
      setActiveHealthProcessingEpoch(25, {
        ownerUserId: 'synthetic-first-value-a',
        accountGeneration,
      });
      refusedBeforeSubscribe =
        !context.isSessionCurrent(oldToken) && !context.clearIfCurrent(oldToken);
    }, [context]);
    return createElement('Text', null, context.draft.name);
  }
  await act(async () => {
    screen = create(
      createElement(IntakeProvider, null, createElement(Probe), createElement(RetireDuringLayout)),
    );
  });
  expect(refusedBeforeSubscribe).toBe(true);
  expect(intake.sessionId).toBe(oldToken);
  expect(intake.isSessionCurrent(oldToken)).toBe(false);
  expect(intake.draft.name).toBe('');
  expect(JSON.stringify(screen!.toJSON())).not.toContain('Private before subscription');
});

it('purges private session fields when the bounded health lease expires without another event', async () => {
  const accountGeneration = await runAccountGenerationOperation((lease) => lease.generation);
  clearActiveHealthProcessingEpoch();
  setActiveHealthProcessingEpoch(25, {
    ownerUserId: 'synthetic-first-value-a',
    accountGeneration,
    serverVerifiedAt: new Date().toISOString(),
  });
  vi.useFakeTimers();
  await act(async () => {
    screen = create(createElement(IntakeProvider, null, createElement(Probe)));
  });
  let oldToken!: string;
  await act(async () => {
    oldToken = intake.reset({ name: 'Private before expiry' });
  });
  const expiresAt = activeHealthProcessingLeaseSnapshot()!.expiresAt!;
  await act(async () => {
    await vi.advanceTimersByTimeAsync(expiresAt - Date.now() + 2);
  });
  expect(intake.sessionId).toBe(oldToken);
  expect(intake.isSessionCurrent(oldToken)).toBe(false);
  expect(intake.draft.name).toBe('');
});

it.each(['same-grant replacement', 'same-owner regrant'] as const)(
  'refuses a captured context clear after %s without erasing its successor',
  async (transition) => {
    await mount();
    await typeDraft();
    await act(async () => button('Continue').props.onPress());
    const oldClear = intake.clear;
    if (transition === 'same-owner regrant') {
      await act(async () => grant26());
      await refetch();
    }
    let currentToken!: string;
    await act(async () => {
      currentToken = intake.reset({ name: 'Current successor remains' });
    });
    await act(async () => oldClear());
    expect(intake.sessionId).toBe(currentToken);
    expect(intake.isSessionCurrent(currentToken)).toBe(true);
    expect(intake.draft.name).toBe('Current successor remains');
  },
);

it('refuses a captured context reset after same-grant replacement and accepts a fresh reset', async () => {
  await mount();
  const oldReset = intake.reset;
  let successor!: string;
  await act(async () => {
    successor = intake.reset({ name: 'Current successor remains' });
  });
  let refused = false;
  await act(async () => {
    try {
      oldReset({ name: 'Obsolete captured product' });
    } catch {
      refused = true;
    }
  });
  expect(intake.sessionId).toBe(successor);
  expect(intake.draft.name).toBe('Current successor remains');
  expect(refused).toBe(true);
  let fresh!: string;
  await act(async () => {
    fresh = intake.reset({ name: 'Fresh accepted product' });
  });
  expect(fresh).not.toBe(successor);
  expect(intake.sessionId).toBe(fresh);
  expect(intake.isSessionCurrent(fresh)).toBe(true);
  expect(intake.draft.name).toBe('Fresh accepted product');
});

it('guards forced invalid Continue and makes rapid Cancel a single navigation', async () => {
  await mount();
  await act(async () => button('Continue').props.onPress());
  expect(ports26.push).not.toHaveBeenCalled();
  await act(async () => {
    input('Product name')!.props.onChangeText('Valid name');
    input('Barcode, optional')!.props.onChangeText('123');
  });
  await act(async () => button('Continue').props.onPress());
  expect(ports26.push).not.toHaveBeenCalled();
  const cancel = action('Cancel').props.onPress;
  await act(async () => {
    cancel();
    cancel();
    cancel();
  });
  expect(ports26.back).toHaveBeenCalledTimes(1);
});

it('never admits private inputs on first-entry failure and starts empty after recovery', async () => {
  ports26.failRead = 'layerwell.shelf.v1';
  await mount();
  await flush26();
  expect(input('Product name')).toBeUndefined();
  expect(JSON.stringify(screen!.toJSON())).toContain('Shelf data unavailable');
  ports26.failRead = null;
  await refetch();
  expect(input('Product name')?.props.value).toBe('');
  await act(async () => input('Product name')!.props.onChangeText('New admitted form'));
  await act(async () => button('Continue').props.onPress());
  expect(ports26.push).toHaveBeenCalledTimes(1);
});
