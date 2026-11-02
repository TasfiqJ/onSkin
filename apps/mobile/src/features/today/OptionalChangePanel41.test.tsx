import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, vi } from 'vitest';

import { OptionalChangePanel41 } from './OptionalChangePanel41';
import type { OptionalChangeEvent41, OptionalChangeInput41 } from './optionalChange41';
import type { OptionalChangeSnapshot41 } from './completionsStore';
import type { HealthDataWriteLease } from '@/lib/consent/healthDataWriteAdmission';

type Node41 = { type: unknown; props: Record<string, unknown>; children: (Node41 | string)[]; findAll: (test: (node: Node41) => boolean) => Node41[] };
type Renderer41 = { root: Node41; update: (element: React.ReactElement) => void; unmount: () => void };
const { act, create } = createRequire(import.meta.url)('react-test-renderer') as {
  act: (run: () => void | Promise<void>) => PromiseLike<void>; create: (element: React.ReactElement) => Renderer41;
};
const ports = vi.hoisted(() => ({
  active: undefined as HealthDataWriteLease | undefined, sourceCurrent: true,
  get: vi.fn(), append: vi.fn(), sequence: 0, blur: undefined as (() => void) | undefined,
}));
vi.mock('react-native', () => ({ TextInput: 'TextInput', View: 'View' }));
vi.mock('@/components/ui', () => ({ Button: 'Button', Text: 'Text' }));
vi.mock('@/theme/tokens', () => ({ colors: {} }));
vi.mock('expo-crypto', () => ({ randomUUID: () => `41000000-0000-4000-8000-${String(++ports.sequence).padStart(12, '0')}` }));
vi.mock('expo-router', async () => {
  const { useEffect } = await import('react');
  return { useFocusEffect: (callback: () => () => void) => useEffect(() => {
    ports.blur = callback(); return ports.blur;
  }, [callback]) };
});
vi.mock('./completionsStore', () => ({ getOptionalChanges41: ports.get, appendOptionalChange41: ports.append }));
vi.mock('./useToday', () => ({ localDateString: () => '2026-11-02' }));
vi.mock('@/lib/consent/healthDataWriteAdmission', () => ({
  assertHealthDataWriteLease: (expected: HealthDataWriteLease) => {
    const active = ports.active;
    if (!active || ['ownerUserId', 'accountGeneration', 'generation', 'epoch', 'expiresAt']
      .some((key) => expected[key as keyof HealthDataWriteLease] !== active[key as keyof HealthDataWriteLease]) ||
      (expected.expiresAt !== null && expected.expiresAt <= Date.now())) throw new Error('CLOSED');
  },
}));
const globals = globalThis as typeof globalThis & { React?: typeof React; IS_REACT_ACT_ENVIRONMENT?: boolean };
const previousReact = globals.React, previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { globals.React = React; globals.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => {
  if (previousReact === undefined) Reflect.deleteProperty(globals, 'React'); else globals.React = previousReact;
  if (previousAct === undefined) delete globals.IS_REACT_ACT_ENVIRONMENT; else globals.IS_REACT_ACT_ENVIRONMENT = previousAct;
});
let renderer: Renderer41 | undefined;
let client: QueryClient;
let disk: OptionalChangeSnapshot41;
const initial = (): OptionalChangeSnapshot41 => ({ revision: 0, sourceProof: 'a'.repeat(64), sourceBytes: null, events: [] });
const view = (lease = ports.active) => React.createElement(QueryClientProvider, { client }, React.createElement(OptionalChangePanel41, {
  key: JSON.stringify(lease), lease: lease!, isSourceCurrent: () => ports.sourceCurrent,
}));
async function flush(run: () => void = () => undefined) {
  await act(async () => { run(); });
  await act(async () => { for (let i = 0; i < 3; i++) { for (let n = 0; n < 16; n++) await Promise.resolve(); await new Promise<void>((resolve) => setTimeout(resolve, 0)); } });
}
const words = (node: Node41 | string): string => typeof node === 'string' ? node : node.children.map(words).join(' ');
function button(label: string) {
  const rows = renderer!.root.findAll((node) => node.type === 'Button' && node.props.label === label);
  assert.equal(rows.length, 1, `One button ${label}`); return rows[0]!;
}
async function press(label: string) {
  const node = button(label); assert.equal(node.props.disabled ?? false, false);
  await flush(() => { (node.props.onPress as () => void)(); });
}
async function fill(label: string, value: string) {
  const rows = renderer!.root.findAll((node) => node.type === 'TextInput' && node.props.accessibilityLabel === label);
  assert.equal(rows.length, 1); assert.equal(rows[0]!.props.editable, true);
  await flush(() => { (rows[0]!.props.onChangeText as (text: string) => void)(value); });
}
function commit(input: OptionalChangeInput41): OptionalChangeSnapshot41 {
  const prior = disk.events.find((event) => event.id === input.id);
  if (!prior) {
    const event: OptionalChangeEvent41 = { id: input.id, ownerUserId: ports.active!.ownerUserId,
      observedOn: input.observedOn, recordedAt: '2026-11-02T12:00:00.000Z', actor: 'owner', basis: 'owner_reported',
      kind: input.kind, category: input.category, text: input.text, targetEventId: input.targetEventId,
      expectedRevision: input.expectedRevision, revision: disk.revision + 1, sourceProof: input.expectedSourceProof, contentHash: 'b'.repeat(64) };
    disk = { revision: event.revision, events: [...disk.events, event], sourceProof: 'c'.repeat(64), sourceBytes: 'committed' };
  }
  return disk;
}
async function mount() {
  await flush(() => { renderer = create(view()); });
  await press('Record a change (optional)');
}
async function draft(text = 'I used a different cleanser.') {
  await press('Record a change (optional)'); await press('Other personal note');
  await fill('Your factual note', text); await press('Review this change');
}
beforeEach(() => {
  ports.active = { ownerUserId: 'owner-a', accountGeneration: 1, generation: 1, epoch: 1, expiresAt: null };
  ports.sourceCurrent = true; ports.sequence = 0; ports.blur = undefined;
  disk = initial(); ports.get.mockReset(); ports.append.mockReset();
  ports.get.mockImplementation(async () => disk);
  ports.append.mockImplementation(async (input: OptionalChangeInput41, _lease: HealthDataWriteLease, current: () => void) => { current(); return commit(input); });
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});
afterEach(async () => { await flush(() => { renderer?.unmount(); }); renderer = undefined; client.clear(); });

describe('optional change panel41 actual interaction', () => {
  it('offers a visible inline entry before initializing private history or opening an editor', async () => {
    await flush(() => { renderer = create(view()); });
    assert.equal(button('Record a change (optional)').props.disabled ?? false, false);
    assert.equal(ports.get.mock.calls.length, 0); assert.equal(ports.append.mock.calls.length, 0);
    assert.doesNotMatch(words(renderer!.root), /Nothing recorded|No change to report/);
    await press('Record a change (optional)'); assert.match(words(renderer!.root), /Nothing recorded/);
  });
  it('distinguishes confirmed empty history from affirmative no change and requires final confirmation', async () => {
    await mount(); assert.match(words(renderer!.root), /Nothing recorded/); assert.equal(ports.append.mock.calls.length, 0);
    await press('Record a change (optional)'); await press('No change to report');
    assert.equal(ports.append.mock.calls.length, 0); await press('Review this change');
    assert.equal(ports.append.mock.calls.length, 0); await press('Confirm and save this change');
    assert.equal(ports.append.mock.calls.length, 1); assert.equal(disk.events[0]!.category, 'no_change');
    assert.equal(disk.events[0]!.text, ''); assert.match(words(renderer!.root), /Saved on this device and read back/);
    assert.doesNotMatch(words(renderer!.root), /Nothing recorded/);
  });
  it('retains originals and date when appending a correction and retraction, then shows them after remount', async () => {
    await mount(); await draft('Original factual report'); await press('Confirm and save this change');
    const original = JSON.stringify(disk.events[0]);
    await press('Correct entry 1'); await press('Other personal note'); await fill('Your factual note', 'Corrected factual report');
    await press('Review this change'); await press('Confirm and save this change');
    assert.equal(JSON.stringify(disk.events[0]), original); assert.equal(disk.events[1]!.targetEventId, disk.events[0]!.id);
    assert.equal(disk.events[1]!.observedOn, disk.events[0]!.observedOn);
    await press('Retract entry 2'); await fill('Retraction reason', 'I retract my correction.');
    await press('Review this change'); await press('Confirm and save this change');
    await flush(() => renderer!.unmount()); await mount();
    assert.match(words(renderer!.root), /Original factual report/); assert.match(words(renderer!.root), /Correction of entry 1/);
    assert.match(words(renderer!.root), /Retraction of entry 2/); assert.equal(disk.events.length, 3);
  });
  it('captures fresh exact completion source when opening after an original check-off', async () => {
    await mount();
    disk = { ...disk, sourceBytes: 'source after original check-off', sourceProof: 'd'.repeat(64) };
    await draft(); await press('Confirm and save this change');
    assert.equal(ports.append.mock.calls[0]![0].expectedSourceBytes, 'source after original check-off');
    assert.equal(ports.append.mock.calls[0]![0].expectedSourceProof, 'd'.repeat(64));
  });
  it('cancels a draft without a write and allows a chosen date', async () => {
    await mount(); await press('Record a change (optional)'); await fill('Observed local date', '2026-10-31');
    await press('No change to report'); await press('Review this change'); await press('Cancel draft');
    assert.equal(ports.append.mock.calls.length, 0); assert.match(words(renderer!.root), /Draft canceled. Nothing was saved/);
    await press('Record a change (optional)'); await fill('Observed local date', '2026-10-31');
    await press('No change to report'); await press('Review this change'); await press('Confirm and save this change');
    assert.equal(disk.events[0]!.observedOn, '2026-10-31');
  });
  it.each(['cancel', 'edit', 'new draft'] as const)('revokes a captured final confirmation after %s without replacing a newer editor', async (transition) => {
    await mount(); await draft('Old reviewed statement');
    const captured = button('Confirm and save this change').props.onPress as () => void;
    if (transition === 'edit') {
      await press('Back to draft'); await fill('Your factual note', 'New unconfirmed statement');
    } else {
      await press('Cancel draft');
      if (transition === 'new draft') {
        await press('Record a change (optional)'); await press('Other personal note'); await fill('Your factual note', 'New unconfirmed statement');
      }
    }
    await flush(captured); assert.equal(ports.append.mock.calls.length, 0);
    if (transition !== 'cancel') {
      const field = renderer!.root.findAll((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Your factual note');
      assert.equal(field[0]!.props.value, 'New unconfirmed statement');
    }
  });
  it('suppresses same-render duplicate tap and preserves the exact id/input for an unconfirmed retry', async () => {
    let reject!: (error: Error) => void;
    ports.append.mockImplementationOnce(() => new Promise((_resolve, no) => { reject = no; }));
    await mount(); await draft(); const confirm = button('Confirm and save this change').props.onPress as () => void;
    await flush(() => { confirm(); confirm(); }); assert.equal(ports.append.mock.calls.length, 1);
    await flush(() => reject(new Error('OPTIONAL_CHANGE41_READBACK_UNCONFIRMED')));
    assert.match(words(renderer!.root), /may already be recorded/);
    const first = ports.append.mock.calls[0]![0]; await press('Confirm and save this change');
    assert.deepEqual(ports.append.mock.calls[1]![0], first); assert.equal(disk.events.length, 1);
  });
  it('ignores captured input and back callbacks while an explicit save is pending', async () => {
    let settle!: () => void;
    ports.append.mockImplementationOnce((input: OptionalChangeInput41) => new Promise((resolve) => {
      settle = () => resolve(commit(input));
    }));
    await mount(); await press('Record a change (optional)'); await press('Other personal note');
    await fill('Your factual note', 'Reviewed statement stays unchanged');
    const oldInput = renderer!.root.findAll((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Your factual note')[0]!.props.onChangeText as (value: string) => void;
    await press('Review this change');
    const oldBack = button('Back to draft').props.onPress as () => void;
    const confirm = button('Confirm and save this change').props.onPress as () => void;
    await flush(() => { confirm(); oldInput('Stale callback substitution'); oldBack(); });
    assert.equal(ports.append.mock.calls.length, 1); assert.equal(button('Saving change…').props.disabled, true);
    assert.equal(renderer!.root.findAll((node) => node.type === 'TextInput' && node.props.accessibilityLabel === 'Your factual note').length, 0);
    assert.doesNotMatch(words(renderer!.root), /Stale callback substitution/);
    await flush(settle);
    assert.equal(disk.events[0]!.text, 'Reviewed statement stays unchanged');
    assert.match(words(renderer!.root), /Saved on this device and read back/);
  });
  it.each(['owner', 'regrant', 'account', 'expiry', 'withdrawal'] as const)('masks old history/draft and refuses captured confirm after %s', async (transition) => {
    await mount(); await draft('Owner A private draft'); const old = button('Confirm and save this change').props.onPress as () => void;
    const previous = ports.active!;
    ports.active = transition === 'withdrawal' ? undefined : { ...previous, generation: previous.generation + 1,
      ownerUserId: transition === 'owner' ? 'owner-b' : previous.ownerUserId,
      accountGeneration: transition === 'account' ? previous.accountGeneration + 1 : previous.accountGeneration,
      expiresAt: transition === 'expiry' ? Date.now() - 1 : null };
    await flush(() => renderer!.update(view(transition === 'withdrawal' ? previous : ports.active))); assert.doesNotMatch(words(renderer!.root), /Owner A private draft/);
    await flush(old); assert.equal(ports.append.mock.calls.length, 0);
  });
  it('refuses a stale source and a blurred draft without fake success', async () => {
    await mount(); await draft(); const old = button('Confirm and save this change').props.onPress as () => void;
    ports.sourceCurrent = false; await flush(old); assert.equal(ports.append.mock.calls.length, 0);
    assert.doesNotMatch(words(renderer!.root), /Saved on this device/);
    ports.sourceCurrent = true; await flush(() => renderer!.update(view())); await press('Refresh changes'); await draft();
    const blurred = button('Confirm and save this change').props.onPress as () => void;
    await flush(() => ports.blur?.()); await flush(blurred); assert.equal(ports.append.mock.calls.length, 0);
  });
  it('shows storage refusal rather than an empty success and sanitizes error text', async () => {
    ports.get.mockRejectedValue(new Error('private note body must stay out of diagnostics'));
    await mount(); assert.match(words(renderer!.root), /Private changes unavailable/);
    assert.doesNotMatch(words(renderer!.root), /Nothing recorded|private note body/); assert.equal(ports.append.mock.calls.length, 0);
  });
  it('places one storage refusal alert immediately before the retry confirmation in the current editor', async () => {
    ports.append.mockRejectedValue(new Error('STORAGE_REFUSED'));
    await mount(); await draft(); await press('Confirm and save this change');
    const alerts = renderer!.root.findAll((node) => node.type === 'Text' && node.props.accessibilityRole === 'alert' && words(node).includes('Storage did not confirm'));
    assert.equal(alerts.length, 1);
    const containers = renderer!.root.findAll((node) => node.type === 'View' && node.children.includes(alerts[0]!));
    assert.equal(containers.length, 1);
    const siblings = containers[0]!.children;
    const index = siblings.indexOf(alerts[0]!);
    assert.equal((siblings[index + 1] as Node41).props.label, 'Confirm and save this change');
  });
  it('does not announce success when the post-save query cannot read back', async () => {
    await mount(); await draft(); ports.get.mockRejectedValue(new Error('READ_FAILURE'));
    await press('Confirm and save this change'); assert.equal(disk.events.length, 1);
    assert.doesNotMatch(words(renderer!.root), /Saved on this device and read back/);
    assert.match(words(renderer!.root), /Storage did not confirm/);
    await press('Cancel draft'); assert.match(words(renderer!.root), /unconfirmed save may already be recorded/);
  });
});
