// Campaign24: the official mirrors were independently read as identical OCI
// bytes. Pins bind the index, native manifest and config, rather than tag names.
const INDEX = 'sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b';
const CANONICAL = 'public.ecr.aws/supabase/postgres:15.8.1.085';
const MIRROR = `ghcr.io/supabase/postgres@${INDEX}`;
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
  index: INDEX, canonical: CANONICAL, mirror: MIRROR, platforms: PLATFORMS,
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

function inspect(raw, architecture, canonical) {
  let rows;
  try { rows = JSON.parse(raw); } catch { refuse(); }
  const image = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
  if (!image || !PLATFORMS[architecture] || image.Id !== PLATFORMS[architecture].config ||
      image.Os !== 'linux' || image.Architecture !== architecture ||
      !Array.isArray(image.RepoDigests) || !image.RepoDigests.includes(MIRROR) ||
      (canonical && (!Array.isArray(image.RepoTags) || !image.RepoTags.includes(CANONICAL)))) refuse();
  return image.Id;
}

export async function prepareCanonicalPostgresMirror24({ runDocker, architecture, signal }) {
  if (!Object.hasOwn(PLATFORMS, architecture) || typeof runDocker !== 'function') refuse();
  signal?.throwIfAborted();
  const pulled = await runDocker(['pull', '--platform', `linux/${architecture}`, MIRROR]);
  const digests = [...`${pulled.stdout}\n${pulled.stderr}`.matchAll(/^Digest: (sha256:[a-f0-9]{64})\s*$/gmu)];
  if (digests.length !== 1 || digests[0][1] !== INDEX) refuse();
  signal?.throwIfAborted();
  const id = inspect((await runDocker(['image', 'inspect', MIRROR])).stdout, architecture, false);
  signal?.throwIfAborted();
  // This is the SAME pinned image, never an alternative PostgreSQL build.
  // Seeding the CLI's first cache entry retains its exact canonical Config.Image
  // and every original run-owned SQL/container identity assertion.
  await runDocker(['image', 'tag', id, CANONICAL]);
  signal?.throwIfAborted();
  if (inspect((await runDocker(['image', 'inspect', CANONICAL])).stdout, architecture, true) !== id) refuse();
  signal?.throwIfAborted();
  const identity = Object.freeze({ id, digest: INDEX, architecture });
  assertCanonicalPostgres24(identity);
  return identity;
}
