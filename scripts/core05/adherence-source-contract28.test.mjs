import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { assertReminderLifecycle28 } from './adherence-source-contract.test.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const route = readFileSync(
  resolve(root, 'apps/mobile/src/app/onboarding/notifications.tsx'),
  'utf8',
).replaceAll('\r\n', '\n');
test('current onboarding reminder uses the captured focus and owner lease', () => {
  assertReminderLifecycle28(route);
});
test('AST guard accepts whitespace and comments at the call boundary', () => {
  const changed = route.replace(
    'PROPOSED_ROUTINE_REMINDER_TIMES,\n          undefined,\n          assertLifecycle,',
    'PROPOSED_ROUTINE_REMINDER_TIMES, /* default dependencies */ undefined,\n          /* current lifecycle */ assertLifecycle,',
  );
  assert.notEqual(changed, route);
  assertReminderLifecycle28(changed);
});
for (const [label, before, after] of [
  ['missing lifecycle argument', '          assertLifecycle,\n', ''],
  [
    'reordered arguments',
    '          undefined,\n          assertLifecycle,',
    '          assertLifecycle,\n          undefined,',
  ],
  ['no-op lifecycle argument', '          assertLifecycle,\n', '          () => {},\n'],
  [
    'wrong proposed times',
    '          PROPOSED_ROUTINE_REMINDER_TIMES,\n',
    '          DEFAULT_ROUTINE_REMINDER_TIMES,\n',
  ],
  ['wrong callee', 'await acceptRoutineReminderSoftAsk(', 'await retryRoutineReminderSoftAsk('],
  ['unawaited acceptance', 'await acceptRoutineReminderSoftAsk(', 'acceptRoutineReminderSoftAsk('],
  [
    'missing accept call',
    'const outcome = await acceptRoutineReminderSoftAsk(\n          PROPOSED_ROUTINE_REMINDER_TIMES,\n          undefined,\n          assertLifecycle,\n        );',
    "const outcome = { state: 'authorized' };",
  ],
  [
    'no-op lifecycle definition',
    '      assertCurrent();\n      assertHealthDataWriteLease(accepted);',
    '      return;',
  ],
  ['missing captured-lease assertion', '      assertHealthDataWriteLease(accepted);', ''],
  [
    'wrong captured lease',
    '      assertHealthDataWriteLease(accepted);',
    '      assertHealthDataWriteLease(authority.current);',
  ],
  [
    'reordered lifecycle assertions',
    '      assertCurrent();\n      assertHealthDataWriteLease(accepted);',
    '      assertHealthDataWriteLease(accepted);\n      assertCurrent();',
  ],
  [
    'async lifecycle callback',
    'const assertLifecycle = () => {',
    'const assertLifecycle = async () => {',
  ],
  [
    'guard hidden in dead branch',
    '      assertCurrent();\n      assertHealthDataWriteLease(accepted);',
    '      if (false) { assertCurrent(); assertHealthDataWriteLease(accepted); }',
  ],
  [
    'no-op current assertion',
    "      throw new Error('ONBOARDING_REMINDER_RETIRED');\n    assertHealthDataWriteLease(authority.current);",
    '      return;',
  ],
  ['missing focus predicate', '!focused.current ||\n      ', ''],
  ['missing focus generation predicate', 'renderedFocus !== focusToken.current ||\n      ', ''],
  ['missing navigation predicate', 'navigated.current ||\n      ', ''],
  [
    'missing current health assertion',
    '    assertHealthDataWriteLease(authority.current);\n  }',
    '  }',
  ],
  ['wrong accepted capture', 'const accepted = authority.current!;', 'const accepted = null;'],
  [
    'guard binding shadowed in enable branch',
    "if (choice === 'enable') {",
    "if (choice === 'enable') { const assertLifecycle = () => {};",
  ],
  [
    'call import shadowed',
    "if (choice === 'enable') {",
    "if (choice === 'enable') { const acceptRoutineReminderSoftAsk = async () => ({ state: 'authorized' });",
  ],
  [
    'current assertion shadowed',
    'const accepted = authority.current!;',
    'const assertCurrent = () => {}; const accepted = authority.current!;',
  ],
  [
    'health assertion shadowed',
    'const accepted = authority.current!;',
    'const assertHealthDataWriteLease = () => {}; const accepted = authority.current!;',
  ],
  [
    'enable hidden in dead branch',
    "if (choice === 'enable') {",
    "if (false) if (choice === 'enable') {",
  ],
  ['async current assertion', 'function assertCurrent() {', 'async function assertCurrent() {'],
  [
    'injected current assertion parameter',
    'function assertCurrent() {',
    'function assertCurrent(ignored = true) {',
  ],
  [
    'wrong health assertion import',
    "from '@/lib/consent/healthDataWriteAdmission';",
    "from '@/features/notifications/onboarding';",
  ],
  [
    'aliased wrong health assertion import',
    '  assertHealthDataWriteLease,',
    '  captureHealthDataWriteLease as assertHealthDataWriteLease,',
  ],
  [
    'shadowed default dependency argument',
    'const accepted = authority.current!;',
    'const undefined = {}; const accepted = authority.current!;',
  ],
  [
    'destructured default dependency shadow',
    'const accepted = authority.current!;',
    'const { lane: undefined } = { lane: {} }; const accepted = authority.current!;',
  ],
  [
    'destructured health assertion shadow',
    'const accepted = authority.current!;',
    'const { guard: assertHealthDataWriteLease } = { guard: () => {} }; const accepted = authority.current!;',
  ],
]) {
  test('current source contract refuses ' + label, () => {
    const changed = route.replace(before, after);
    assert.notEqual(changed, route, 'mutation must alter current authentic route');
    assert.throws(() => assertReminderLifecycle28(changed), assert.AssertionError);
  });
}
