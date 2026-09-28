import assert from 'node:assert/strict';
import test from 'node:test';

import { auditPhoto02Sources, photo02Source } from './photo02-source-contract.mjs';

test('the repository satisfies the aggregate PHOTO-02 AST/control-flow contract', () => {
  assert.deepEqual(auditPhoto02Sources(), { checks: 11, status: 'pass' });
});

test('rejects an additive Stack mounted before AppLockProvider', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        layout: photo02Source('layout').replace(
          '<AppLockProvider>',
          '<Stack screenOptions={{ headerShown: false }} /><AppLockProvider>',
        ),
      }),
    /no routed content may mount before AppLockProvider/u,
  );
});

test('rejects additive children mounted before the loaded decision', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        provider: photo02Source('provider').replace(
          '{loaded ? children : null}',
          '{children}{loaded ? children : null}',
        ),
      }),
    /exactly one mount path/u,
  );
});

for (const status of ['corrupt', 'unsupported_version']) {
  test(`rejects an early ${status} preference unlock`, () => {
    assert.throws(
      () =>
        auditPhoto02Sources({
          decision: photo02Source('decision').replace(
            '  if (result.status',
            `  if (result.status === '${status}') return { enabled: false, locked: false, recovery: null };\n  if (result.status`,
          ),
        }),
      /cannot gain an early unlock/u,
    );
  });
}

test('rejects unauthenticated preference disable', () => {
  const accountOperations = photo02Source('accountOperations');
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: accountOperations
          .replace(
            '    const authStatus = await authenticateWithLease(',
            '    if (input.enabled) {\n    const authStatus = await authenticateWithLease(',
          )
          .replace(
            '    let result: AppLockPreferenceSaveResult;',
            '    }\n    let result: AppLockPreferenceSaveResult;',
          ),
      }),
    /authentication must cover both enable and disable/u,
  );
});

test('rejects an additive unauthenticated setLocked(false)', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        provider: photo02Source('provider').replace(
          '  const requestUnlock = useCallback',
          '  setLocked(false);\n\n  const requestUnlock = useCallback',
        ),
      }),
    /must be dominated by authenticated success/u,
  );
});

test('rejects usePhotos in the route component before PhotoTimelineLockGate', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        detail: photo02Source('detail').replace(
          'export default function PhotoDetailScreen() {',
          "export default function PhotoDetailScreen() {\n  usePhotos('front');",
        ),
      }),
    /cannot read photos before PhotoTimelineLockGate/u,
  );
});

test('rejects malformed-preference deletion moved before authentication', () => {
  const source = photo02Source('accountOperations');
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: source.replace(
          '    const status = await authenticateWithLease(',
          '    await clearMalformedAppLockPreference();\n    const status = await authenticateWithLease(',
        ),
      }),
    /authenticate before destructive repair/u,
  );
});

test('rejects native success publication without current-request revalidation', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        authenticate: photo02Source('authenticate').replace(
          "    return requestEpoch === authenticationInvalidationEpoch && isRequestCurrent()\n      ? status\n      : 'not_authenticated';",
          '    return status;',
        ),
      }),
    /revalidated before publication/u,
  );
});

test('rejects a preference authentication failure guard weakened with && false', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: photo02Source('accountOperations').replace(
          "if (authStatus !== 'success')",
          "if (authStatus !== 'success' && false)",
        ),
      }),
    /authentication failure must terminate before storage mutation/u,
  );
});

test('rejects a reset authentication failure guard weakened with && false', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: photo02Source('accountOperations').replace(
          "if (status !== 'success')",
          "if (status !== 'success' && false)",
        ),
      }),
    /reset authentication failure must terminate before destructive repair/u,
  );
});

test('rejects provider success dominance weakened with || true', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        provider: photo02Source('provider').replace(
          "if (result.status === 'success')",
          "if (result.status === 'success' || true)",
        ),
      }),
    /must be dominated by authenticated success/u,
  );
});

test('rejects timeline unlock predicate weakened with || true', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        timelineGate: photo02Source('timelineGate').replace(
          'if (!locked) return children;',
          'if (!locked || true) return children;',
        ),
      }),
    /only after the shared unlock/u,
  );
});

test('rejects private readiness predicate weakened with || true', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        availability: photo02Source('availability').replace(
          "if (appUnlocked && (availability === 'ready' || availability === 'restoring'))",
          "if ((appUnlocked && (availability === 'ready' || availability === 'restoring')) || true)",
        ),
      }),
    /only after successful encrypted-read readiness/u,
  );
});

test('rejects an aliased photo hook call before the timeline gate', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        detail: photo02Source('detail')
          .replace(
            'import { usePhotoActions, usePhotos }',
            'import { usePhotoActions, usePhotos, usePhotos as readPhotos }',
          )
          .replace(
            'export default function PhotoDetailScreen() {',
            "export default function PhotoDetailScreen() {\n  readPhotos('front');",
          ),
      }),
    /cannot read photos before PhotoTimelineLockGate/u,
  );
});

function removeFailureReturn(source, guard) {
  const guardIndex = source.indexOf(guard);
  assert.notEqual(guardIndex, -1);
  const returnIndex = source.indexOf('      return result;', guardIndex);
  assert.notEqual(returnIndex, -1);
  return `${source.slice(0, returnIndex)}${source.slice(returnIndex + '      return result;'.length)}`;
}

test('rejects preference authentication failure falling through after its return is removed', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: removeFailureReturn(
          photo02Source('accountOperations'),
          "if (authStatus !== 'success')",
        ),
      }),
    /authentication failure must terminate before storage mutation/u,
  );
});

test('rejects reset authentication failure falling through after its return is removed', () => {
  assert.throws(
    () =>
      auditPhoto02Sources({
        accountOperations: removeFailureReturn(
          photo02Source('accountOperations'),
          "if (status !== 'success')",
        ),
      }),
    /reset authentication failure must terminate before destructive repair/u,
  );
});
