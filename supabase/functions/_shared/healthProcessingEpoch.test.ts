import {
  HEALTH_PROCESSING_EPOCH_HEADER,
  healthProcessingCallerHeaders,
  preflightActiveHealthProcessing,
  readHealthProcessingEpochHeader,
} from './healthProcessingEpoch.ts';
import { CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT } from '../consent-withdrawal/healthConsentContract.ts';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const userId = '00000000-0000-4000-8000-000000000001';

function activeStatus(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    user_id: userId,
    state: 'active',
    epoch: '7',
    consent_version: CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.version,
    consent_text_hash: CURRENT_HEALTH_CONSENT_DISCLOSURE_CONTRACT.grantTextHash,
    ...overrides,
  };
}

function statusClient(data: unknown, error: unknown = null) {
  return {
    rpc: (functionName: 'get_health_data_consent_status') => {
      assert(
        functionName === 'get_health_data_consent_status',
        'preflight must call only the authenticated status authority',
      );
      return Promise.resolve({ data, error });
    },
  };
}

Deno.test('health processing epoch accepts only exact positive PostgreSQL bigint decimals', () => {
  for (const value of ['1', '42', '9223372036854775807']) {
    const headers = new Headers({ [HEALTH_PROCESSING_EPOCH_HEADER]: value });
    assert(readHealthProcessingEpochHeader(headers) === value, `expected ${value} to pass`);
  }

  for (const value of [
    '',
    '0',
    '-1',
    '+1',
    '01',
    '1.0',
    '1, 2',
    '9223372036854775808',
    '99999999999999999999',
  ]) {
    const headers = new Headers({ [HEALTH_PROCESSING_EPOCH_HEADER]: value });
    assert(readHealthProcessingEpochHeader(headers) === null, `expected ${value} to fail`);
  }
  assert(readHealthProcessingEpochHeader(new Headers()) === null, 'missing header must fail');
});

Deno.test('validated epoch is forwarded under the exact database request header', () => {
  const headers = healthProcessingCallerHeaders('Bearer token', '7');
  assert(headers.Authorization === 'Bearer token', 'authorization must be retained');
  assert(headers[HEALTH_PROCESSING_EPOCH_HEADER] === '7', 'epoch must be retained exactly');
  assert(Object.keys(headers).length === 2, 'no unvalidated forwarding surface is allowed');
});

Deno.test(
  'health processing preflight accepts only the active caller, exact epoch, and current disclosure',
  async () => {
    const stringEpoch = await preflightActiveHealthProcessing(
      statusClient([activeStatus()]),
      userId,
      '7',
    );
    assert(stringEpoch.ok, 'an exact bigint string status should pass');

    const safeNumberEpoch = await preflightActiveHealthProcessing(
      statusClient([activeStatus({ epoch: 7 })]),
      userId,
      '7',
    );
    assert(safeNumberEpoch.ok, 'a safe integer status epoch should pass');
  },
);

Deno.test(
  'health processing preflight rejects inactive, stale-epoch, and stale-copy states',
  async () => {
    const inactive = await preflightActiveHealthProcessing(
      statusClient([activeStatus({ state: 'withdrawing', epoch: '8' })]),
      userId,
      '7',
    );
    assert(
      !inactive.ok && inactive.error === 'HEALTH_PROCESSING_NOT_ACTIVE' && inactive.status === 409,
      'withdrawal must fail as inactive before epoch comparison',
    );

    const staleEpoch = await preflightActiveHealthProcessing(
      statusClient([activeStatus({ epoch: '8' })]),
      userId,
      '7',
    );
    assert(
      !staleEpoch.ok && staleEpoch.error === 'HEALTH_PROCESSING_EPOCH_STALE',
      'an old caller epoch must fail closed',
    );

    for (const staleCopy of [
      activeStatus({ consent_version: 'retired-copy' }),
      activeStatus({ consent_text_hash: '0'.repeat(64) }),
    ]) {
      const result = await preflightActiveHealthProcessing(statusClient([staleCopy]), userId, '7');
      assert(
        !result.ok && result.error === 'HEALTH_PROCESSING_CONSENT_STALE',
        'a stale disclosure receipt must fail closed',
      );
    }
  },
);

Deno.test(
  'health processing preflight treats RPC failures and malformed authority rows as unavailable',
  async () => {
    const malformedStatuses: unknown[] = [
      null,
      [],
      [activeStatus(), activeStatus()],
      [{}],
      [activeStatus({ user_id: '00000000-0000-4000-8000-000000000002' })],
      [activeStatus({ epoch: Number.MAX_SAFE_INTEGER + 1 })],
      [activeStatus({ epoch: '9223372036854775808' })],
    ];

    for (const data of malformedStatuses) {
      const result = await preflightActiveHealthProcessing(statusClient(data), userId, '7');
      assert(
        !result.ok &&
          result.error === 'HEALTH_PROCESSING_STATUS_UNAVAILABLE' &&
          result.status === 503,
        'malformed authority data must never authorize catalog processing',
      );
    }

    const rpcError = await preflightActiveHealthProcessing(
      statusClient([activeStatus()], { message: 'private database detail' }),
      userId,
      '7',
    );
    assert(
      !rpcError.ok && rpcError.error === 'HEALTH_PROCESSING_STATUS_UNAVAILABLE',
      'RPC errors must fail closed without exposing details',
    );

    const thrown = await preflightActiveHealthProcessing(
      {
        rpc: () => Promise.reject(new Error('network detail')),
      },
      userId,
      '7',
    );
    assert(
      !thrown.ok && thrown.error === 'HEALTH_PROCESSING_STATUS_UNAVAILABLE',
      'transport failures must fail closed without escaping',
    );
  },
);
