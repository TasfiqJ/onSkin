import {
  stagingTrafficFreezeResponse,
  STAGING_TRAFFIC_FREEZE_ERROR,
  STAGING_TRAFFIC_FREEZE_INVALID,
} from './stagingTrafficFreeze.ts';

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

function assertThrows(callback: () => unknown, expectedMessage: string): void {
  try {
    callback();
  } catch (error) {
    if (error instanceof Error && error.message === expectedMessage) return;
    throw error;
  }
  throw new Error(`expected function to throw ${expectedMessage}`);
}

function reader(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

Deno.test('staging traffic is frozen unless the state is explicitly open', async () => {
  for (const freeze of [undefined, '', 'frozen', 'invalid']) {
    const response = stagingTrafficFreezeResponse(
      reader({ APP_ENV: 'staging', DB06_TRAFFIC_FREEZE: freeze }),
    );
    assertEquals(response?.status, 503);
    assertEquals(response?.headers.get('cache-control'), 'no-store');
    assertEquals(await response?.json(), { error: STAGING_TRAFFIC_FREEZE_ERROR });
  }
  assertEquals(
    stagingTrafficFreezeResponse(reader({ APP_ENV: 'staging', DB06_TRAFFIC_FREEZE: 'open' })),
    null,
  );
});

Deno.test('an explicit freeze blocks every environment', () => {
  for (const environment of ['development', 'production']) {
    assertEquals(
      stagingTrafficFreezeResponse(reader({ APP_ENV: environment, DB06_TRAFFIC_FREEZE: 'frozen' }))
        ?.status,
      503,
    );
  }
});

Deno.test('non-staging environments may omit the freeze but reject invalid values', () => {
  assertEquals(stagingTrafficFreezeResponse(reader({ APP_ENV: 'production' })), null);
  assertThrows(
    () =>
      stagingTrafficFreezeResponse(reader({ APP_ENV: 'production', DB06_TRAFFIC_FREEZE: 'maybe' })),
    STAGING_TRAFFIC_FREEZE_INVALID,
  );
});
