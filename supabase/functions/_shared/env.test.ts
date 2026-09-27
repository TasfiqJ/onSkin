import {
  EDGE_APP_ENVIRONMENT_ERROR,
  readEdgeAppEnvironment,
  resolveEdgeAppEnvironment,
  type EdgeEnvironmentReader,
} from './env.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function environment(values: Record<string, string | undefined>): EdgeEnvironmentReader {
  return (name) => values[name];
}

function assertThrowsCode(run: () => unknown, expected: string, privateValue?: string): void {
  let thrown: unknown;
  try {
    run();
  } catch (error) {
    thrown = error;
  }
  assert(thrown instanceof Error, `expected ${expected} to be thrown.`);
  assert(thrown.message === expected, `expected ${expected}, got ${thrown.message}.`);
  if (privateValue) {
    assert(!thrown.message.includes(privateValue), 'environment error leaked its input value.');
  }
}

Deno.test('APP_ENV is required and EXPO_PUBLIC_APP_ENV cannot replace it', () => {
  assertThrowsCode(
    () => readEdgeAppEnvironment(environment({})),
    EDGE_APP_ENVIRONMENT_ERROR.missing,
  );
  assertThrowsCode(
    () => readEdgeAppEnvironment(environment({ APP_ENV: '   ', EXPO_PUBLIC_APP_ENV: 'staging' })),
    EDGE_APP_ENVIRONMENT_ERROR.missing,
  );
});

Deno.test('invalid environment values fail with stable value-free codes', () => {
  const invalidPrivateValue = 'preview-private-value';
  assertThrowsCode(
    () => resolveEdgeAppEnvironment(invalidPrivateValue),
    EDGE_APP_ENVIRONMENT_ERROR.invalid,
    invalidPrivateValue,
  );
  assertThrowsCode(
    () => resolveEdgeAppEnvironment('staging', invalidPrivateValue),
    EDGE_APP_ENVIRONMENT_ERROR.publicInvalid,
    invalidPrivateValue,
  );
  assertThrowsCode(
    () => resolveEdgeAppEnvironment('staging', '  '),
    EDGE_APP_ENVIRONMENT_ERROR.publicInvalid,
  );
});

Deno.test('contradictory server and public environments fail closed', () => {
  assertThrowsCode(
    () => resolveEdgeAppEnvironment('staging', 'production'),
    EDGE_APP_ENVIRONMENT_ERROR.conflict,
  );
});

Deno.test('development, staging, and production normalize consistently', () => {
  for (const expected of ['development', 'staging', 'production'] as const) {
    const mixedCase = `  ${expected.toUpperCase()}  `;
    assert(
      resolveEdgeAppEnvironment(mixedCase) === expected,
      `${expected} must normalize without a public mirror.`,
    );
    assert(
      resolveEdgeAppEnvironment(mixedCase, expected.toUpperCase()) === expected,
      `${expected} must accept a matching normalized public mirror.`,
    );
  }
});
