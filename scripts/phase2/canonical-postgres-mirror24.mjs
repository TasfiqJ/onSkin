// Campaign24: the official mirrors were independently read as identical OCI
// bytes. Pins bind the index, native manifest and config, rather than tag names.
import { setTimeout as delay } from 'node:timers/promises';
import { CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS } from './local-supabase-reset-retry.mjs';

const INDEX = 'sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b';
const CANONICAL = 'public.ecr.aws/supabase/postgres:15.8.1.085';
const MIRROR = `ghcr.io/supabase/postgres@${INDEX}`;
const SECONDARY_MIRROR = `docker.io/supabase/postgres@${INDEX}`;
const MIRRORS = Object.freeze([
  Object.freeze({ reference: MIRROR, label: 'ghcr.io', repoDigests: Object.freeze([MIRROR]) }),
  Object.freeze({ reference: SECONDARY_MIRROR, label: 'docker.io',
    repoDigests: Object.freeze([SECONDARY_MIRROR, `supabase/postgres@${INDEX}`]) }),
]);
const PLATFORMS = Object.freeze({
  amd64: Object.freeze({
    manifest: 'sha256:caae3d066f437332d593011e3e7ecf78ab005ce9b89378efd53f97f0410563ad',
    config: 'sha256:8613ba8eab946dff6674a2db6aab75b80aa101da39035fe20f62b0c7591ab35d',
  }),
  arm64: Object.freeze({
    manifest: 'sha256:4e4ce13a16fa33bae61c878d11ec002584b3a55114ccdcab79bc1dda3fe5e767',
    config: 'sha256:a5a0c2b809d5415edff7c010d9facf29063cb138f88ed3a66efdf24b83e79a96',
  }),
});

export const CANONICAL_POSTGRES24 = Object.freeze({
  index: INDEX, canonical: CANONICAL, mirror: MIRROR, secondaryMirror: SECONDARY_MIRROR, platforms: PLATFORMS,
});

function refuse() {
  // Fixed diagnostic: no registry response, image field or inherited value.
  throw new Error('H01_CANONICAL_POSTGRES24: exact pinned image proof required.');
}

export function assertCanonicalPostgres24(identity) {
  if (!identity || !Object.hasOwn(PLATFORMS, identity.architecture)) refuse();
  const expected = PLATFORMS[identity.architecture];
  if (identity.id !== expected.config || identity.digest !== INDEX) refuse();
}

export function isCanonicalPostgresQuota24(error) {
  const failure = error?.cause;
  return typeof error?.message === 'string' && error.message.startsWith('H01_SQL_PROBE_FAILED: ') &&
    failure?.reason === 'exit-nonzero' && failure?.originReason === 'exit-nonzero' &&
    ['posix-process-group-empty', 'windows-job-object-empty'].includes(failure?.containment) &&
    typeof failure.diagnostic === 'string' &&
    /^Error response from daemon: error from registry: (?:Data limit exceeded|toomanyrequests: Rate exceeded|429 Too Many Requests)\s*$/u.test(failure.diagnostic);
}

export function isCanonicalPostgresMirrorQuota24(error) {
  const failure = error?.cause;
  if (typeof error?.message !== 'string' || !error.message.startsWith('H01_SQL_PROBE_FAILED: ') ||
      failure?.reason !== 'exit-nonzero' || failure?.originReason !== 'exit-nonzero' ||
      !['posix-process-group-empty', 'windows-job-object-empty'].includes(failure?.containment) ||
      typeof failure.diagnostic !== 'string' || failure.diagnostic.length > 65_536) return false;
  const lines = failure.diagnostic.trimEnd().split(/\r?\n/u);
  const terminal = lines.pop();
  return lines.length <= 300 &&
    /^error from registry: retry-after: \d{1,9}(?:\.\d{1,9})?(?:ns|us|µs|ms|s), allowed: [1-9]\d{0,7}\/minute$/u.test(terminal) &&
    lines.every(line => line.length <= 512 && (
      MIRRORS.some(source => line === `${source.reference}: Pulling from supabase/postgres`) ||
      line === `supabase/postgres@${INDEX}: Pulling from supabase/postgres` ||
      /^[a-f0-9]{12}: (?:Pulling fs layer|Already exists|Download complete|Pull complete|Waiting|Verifying Checksum)$/u.test(line) ||
      /^[a-f0-9]{12}: (?:Downloading|Extracting)\s+\[[=> ]{1,80}\]\s+\d{1,9}(?:\.\d{1,3})?(?:B|kB|MB|GB)(?:\/\d{1,9}(?:\.\d{1,3})?(?:B|kB|MB|GB))?$/u.test(line)
    ));
}

async function pull(runDocker, source, architecture, signal, wait) {
  for (let attempt = 0; ; attempt += 1) {
    signal?.throwIfAborted();
    try {
      return await runDocker(['pull', '--platform', `linux/${architecture}`, source.reference]);
    } catch (error) {
      if (attempt >= CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS.length || !isCanonicalPostgresMirrorQuota24(error)) throw error;
      console.log(`[db05-local] canonical identical-image ${source.label} rate retry ${attempt + 1}/3`);
      await wait(CANONICAL_POSTGRES_PULL_RETRY_DELAYS_MS[attempt], undefined, { signal });
    }
  }
}

function inspect(raw, architecture, canonical, source) {
  let rows;
  try { rows = JSON.parse(raw); } catch { refuse(); }
  const image = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (!image || !PLATFORMS[architecture] || image.Id !== PLATFORMS[architecture].config ||
      image.Os !== 'linux' || image.Architecture !== architecture ||
      !Array.isArray(image.RepoDigests) || !source.repoDigests.some(value => image.RepoDigests.includes(value)) ||
      (canonical && (!Array.isArray(image.RepoTags) || !image.RepoTags.includes(CANONICAL)))) refuse();
  return image.Id;
}

export async function prepareCanonicalPostgresMirror24({ runDocker, architecture, signal, wait = delay }) {
  if (!Object.hasOwn(PLATFORMS, architecture) || typeof runDocker !== 'function') refuse();
  signal?.throwIfAborted();
  let pulled;
  let source;
  for (const candidate of MIRRORS) {
    try {
      pulled = await pull(runDocker, candidate, architecture, signal, wait);
      source = candidate;
      break;
    } catch (error) {
      if (candidate !== MIRRORS[0] || !isCanonicalPostgresMirrorQuota24(error)) throw error;
      console.log('[db05-local] canonical identical-image GHCR quota persisted; using pinned official Docker Hub');
    }
  }
  const digests = [...`${pulled.stdout}\n${pulled.stderr}`.matchAll(/^Digest: (sha256:[a-f0-9]{64})\s*$/gmu)];
  if (digests.length !== 1 || digests[0][1] !== INDEX) refuse();
  signal?.throwIfAborted();
  const id = inspect((await runDocker(['image', 'inspect', source.reference])).stdout, architecture, false, source);
  signal?.throwIfAborted();
  // This is the SAME pinned image, never an alternative PostgreSQL build.
  // Seeding the CLI's first cache entry retains its exact canonical Config.Image
  // and every original run-owned SQL/container identity assertion.
  await runDocker(['image', 'tag', id, CANONICAL]);
  signal?.throwIfAborted();
  if (inspect((await runDocker(['image', 'inspect', CANONICAL])).stdout, architecture, true, source) !== id) refuse();
  signal?.throwIfAborted();
  const identity = Object.freeze({ id, digest: INDEX, architecture });
  assertCanonicalPostgres24(identity);
  return identity;
}
