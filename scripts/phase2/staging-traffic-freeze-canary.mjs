import { Db06EvidenceError } from './staging-deployment-evidence-lib.mjs';
import { BoundedResponseBodyError, readBoundedResponseBody } from './bounded-response-body.mjs';

const PROJECT_REF = /^[a-z0-9]{20}$/u;
const FUNCTION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_RESPONSE_BYTES = 4096;
const EXPECTED_ERROR = 'DB06_STAGING_TRAFFIC_FROZEN';

function fail(code) {
  throw new Db06EvidenceError(code);
}

function exactKeys(value, keys) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

export async function verifyStagingTrafficFreeze({
  projectRef,
  functionSlugs,
  fetchImpl = fetch,
  timeoutMs = 15_000,
  signal,
}) {
  if (
    !PROJECT_REF.test(String(projectRef)) ||
    !Array.isArray(functionSlugs) ||
    functionSlugs.length === 0 ||
    new Set(functionSlugs).size !== functionSlugs.length ||
    functionSlugs.some((slug) => !FUNCTION_SLUG.test(String(slug))) ||
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 100 ||
    timeoutMs > 60_000
  ) {
    fail('DB06_TRAFFIC_FREEZE_CANARY_INPUT_INVALID');
  }
  const results = [];
  for (const slug of [...functionSlugs].sort((left, right) => left.localeCompare(right))) {
    const controller = new AbortController();
    const onExternalAbort = () => controller.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    let bytes;
    try {
      response = await fetchImpl(`https://${projectRef}.supabase.co/functions/v1/${slug}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal,
      });
      bytes = await readBoundedResponseBody(response, {
        maxBytes: MAX_RESPONSE_BYTES,
        abortController: controller,
      });
    } catch (error) {
      if (error instanceof BoundedResponseBodyError) {
        fail('DB06_TRAFFIC_FREEZE_CANARY_RESPONSE_INVALID');
      }
      fail('DB06_TRAFFIC_FREEZE_CANARY_REQUEST_FAILED');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onExternalAbort);
    }
    let body;
    try {
      body = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail('DB06_TRAFFIC_FREEZE_CANARY_RESPONSE_INVALID');
    }
    const cacheControl = response.headers.get('cache-control') ?? '';
    if (
      response.status !== 503 ||
      !cacheControl
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .includes('no-store') ||
      !exactKeys(body, ['error']) ||
      body.error !== EXPECTED_ERROR
    ) {
      fail('DB06_TRAFFIC_FREEZE_CANARY_NOT_FROZEN');
    }
    results.push({ slug, status: 503, errorCode: EXPECTED_ERROR });
  }
  return {
    checkedFunctionCount: results.length,
    allReturnedFrozenNoStore: true,
    functions: results,
  };
}
