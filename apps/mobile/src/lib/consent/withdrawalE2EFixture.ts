const E2E_SESSION_STORAGE_NAMESPACE = 'routinekind';

export const DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY = `${E2E_SESSION_STORAGE_NAMESPACE}.e2e.dataSharingWithdrawalAttempts.v1`;
export const DATA_SHARING_WITHDRAWAL_E2E_FAILURE = 'E2E_DATA_SHARING_WITHDRAWAL_UNAVAILABLE';
export const DATA_SHARING_WITHDRAWAL_E2E_STORAGE_UNAVAILABLE =
  'E2E_DATA_SHARING_WITHDRAWAL_STORAGE_UNAVAILABLE';
export const DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK =
  '__ROUTINEKIND_E2E_RELEASE_DATA_SHARING_WITHDRAWAL__';

export type ConsentWithdrawalE2EFixture = 'fail_twice_then_succeed' | 'hold_then_succeed';

type SessionStorageLike = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}>;

type FixtureGlobal = typeof globalThis & {
  __ROUTINEKIND_E2E_RELEASE_DATA_SHARING_WITHDRAWAL__?: () => void;
};

const DATA_SHARING_WITHDRAWAL_ACKNOWLEDGEMENT = Object.freeze({
  withdrawn: true,
  consent_type: 'data_sharing',
  cleanup: Object.freeze({
    order_attributions_detached: 0,
    commerce_click_events_deleted: 0,
  }),
});

export function resolveConsentWithdrawalE2EFixture(input: {
  consentType: string;
  development: boolean;
  platform: string;
  raw: string | null | undefined;
}): ConsentWithdrawalE2EFixture | null {
  if (!input.development || input.platform !== 'web' || input.consentType !== 'data_sharing') {
    return null;
  }
  const mode = input.raw?.trim().toLowerCase();
  return mode === 'fail_twice_then_succeed' || mode === 'hold_then_succeed' ? mode : null;
}

function readAttempts(storage: SessionStorageLike): number {
  const raw = storage.getItem(DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY);
  if (!raw || !/^(?:0|[1-9]\d{0,5})$/.test(raw)) return 0;
  return Number(raw);
}

function storageUnavailable(): Error {
  return new Error(DATA_SHARING_WITHDRAWAL_E2E_STORAGE_UNAVAILABLE);
}

function defaultSessionStorage(): SessionStorageLike {
  try {
    const storage = globalThis.sessionStorage;
    if (!storage) throw storageUnavailable();
    return storage;
  } catch {
    throw storageUnavailable();
  }
}

export async function runConsentWithdrawalE2EFixture(
  fixture: ConsentWithdrawalE2EFixture,
  options: Readonly<{
    root?: FixtureGlobal;
    storage?: SessionStorageLike;
  }> = {},
): Promise<unknown> {
  const storage = options.storage ?? defaultSessionStorage();
  let attempt: number;
  try {
    attempt = readAttempts(storage) + 1;
    storage.setItem(DATA_SHARING_WITHDRAWAL_E2E_ATTEMPTS_KEY, String(attempt));
  } catch {
    throw storageUnavailable();
  }

  if (fixture === 'fail_twice_then_succeed') {
    if (attempt <= 2) throw new Error(DATA_SHARING_WITHDRAWAL_E2E_FAILURE);
    return DATA_SHARING_WITHDRAWAL_ACKNOWLEDGEMENT;
  }

  const root = options.root ?? (globalThis as FixtureGlobal);
  return new Promise((resolve) => {
    let settled = false;
    const release = () => {
      if (settled) return;
      settled = true;
      if (root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK] === release) {
        delete root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK];
      }
      resolve(DATA_SHARING_WITHDRAWAL_ACKNOWLEDGEMENT);
    };
    root[DATA_SHARING_WITHDRAWAL_E2E_RELEASE_HOOK] = release;
  });
}
