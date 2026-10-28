# Campaign24 public dependency engineering

Authority: `BRAIN-M1X-SECURITY-DEPENDENCY-DB24-CANDIDATE-01`.
This is a source mitigation proposal, `SUBMITTED_REVIEW_REQUIRED`, never Security
acceptance. `G97 FAIL/NO_GO`, DB06/DB08/R2B NOT_ACCEPTED, M1-03 external custody,
M2 NOT_AUTHORIZED and all native/J01/public-release closures remain unchanged.

## Primary sources and decision

On 2026-10-28, the [reviewed Zod advisory](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5)
still names versions below 4.6.6 as affected and 4.6.6 as patched. Its upstream
[collection-size repair](https://github.com/colinhacks/zod/pull/6652) explicitly
preserves unbounded behavior and respects transformations preceding bounds.
The [v3 issue](https://github.com/colinhacks/zod/issues/6653) remains open. Registry
metadata identifies 4.6.7 as latest; upgrading default v3 consumers to v4 would
change their API and still would not close unbounded or embedded-v3 exposure.

The [reviewed deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
still affects 4.2.0 through 4.3.1 with no patched version. The upstream
[prototype-poisoning discussion](https://github.com/TehShrike/deepmerge/issues/273)
describes poisoning of returned objects, including null/primitive placeholders
and target copies; global Object.prototype need not change. The npm registry's
latest release remains 4.3.1. Disputed upstream severity does not clear a finding.

No package version or lock entry changes. The independent upstream tarballs were
downloaded from `https://registry.npmjs.org/`, verified against their registry
SHA512 SRI and parsed as bounded regular-file archives before source execution.
The exact package/SRI, every patched preimage/postimage and immutable source pins
are in `scripts/security24/backports.json`, whose bytes are pinned by the patcher.

| npm source | Tarball SHA256 |
| --- | --- |
| zod 3.25.76 | `9e1f1a05f0dd0c1dab64ee91ceb9bf55cd44d35368c70edda80a2fdc70a88377` |
| zod 4.6.7, reference only | `84efd155bed93270286e793fc951be270b536cbd5b0eeb111f0fa3967201d698` |
| deepmerge 4.3.1 | `4003a0a348276a95543fa969f561f6b5968629acbbb59d66018dd23e7b8f1d5c` |

## Implemented behavior and residuals

The mandatory postinstall retains every previous call and adds an unconditional
Campaign24 patch/check call under the original check mode. Standalone Campaign24
execution also requires the original Campaign22 bounded-v3 patch check and its
complete declared-installation directory reconciliation before doing any work.
Every declared nested copy must have the pinned registry identity and source.
Unknown source, aliases, omitted copies, links or incomplete input refuse.

For deepmerge, the source, CJS and UMD forms now reject `__proto__`, `constructor`
and `prototype` in both copy loops before reading/writing their values. Each
ordinary result property is defined as an own data property, avoiding inherited
setters. Unexpected throwing `in` traps fail closed, while null, undefined and
primitive targets retain their prior ordinary merge behavior. This fixes the
demonstrated default-merge poison paths; array concatenation, ordinary nested
merges, frozen inputs and the real Expo config dry-run consumer are retained.

Trusted executable options retain their documented power. `clone:false` can
return an already poisoned input object unchanged, and a `customMerge` callback
can deliberately return an object with an arbitrary prototype. These cases are
tested and are outside the default JSON-data merge repair. The mitigation does
not sandbox hostile JavaScript, accessors, callbacks or unlimited recursion.

For Zod's embedded v4, CJS, ESM and published TypeScript now reject an oversized
array/set/map against its first applicable leading upper-bound check before
parsing elements. The original check constructs the error; subsequent parsing,
refinements and async element transformations do not execute after that refusal.
Only leading built-in size checks participate. Preprocessing and an overwrite
before a later bound retain their original successful transformation behavior.
The unchanged historical v3 array/set safeguards remain mandatory and pinned.

Unbounded arrays/sets/maps still accumulate issues proportional to input size.
Transformed output can create a new unbounded collection. v3 maps have no native
size-bound API, and active custom iterators can exceed their apparent collection
size. The actual Expo DevTools output schema still returns 128 issues for 128
invalid output items. These are demonstrated OPEN_REQUIRED paths, not green
results. An arbitrary global default size cap would change legitimate unbounded
schema semantics; no such unproven compatibility change was introduced.

| Scope | Classification |
| --- | --- |
| Demonstrated default deepmerge return-prototype/copy-loop repair | FIXED_AND_PROVED by bounded synthetic and actual Expo config probes |
| Embedded-v4 leading array/set/map upper bounds | FIXED_AND_PROVED within that explicit bound/transform scope |
| Unbounded Zod, generated unbounded values and active custom iterators | OPEN_REQUIRED; no complete compatible upstream repair proved |
| Reviewed advisory/version findings for both installed packages | OPEN_REQUIRED; deepmerge patched upstream release BLOCKED_UPSTREAM |
| Private original Security, custody and qualified acceptance | BLOCKED_EXTERNAL_CUSTODY / NOT_RUN |

## Reproducible controls and coverage

Run after a normal `npm ci` with mandatory hooks:

```text
node scripts/postinstall.mjs --check
node --test scripts/security24/advisory-behavior.test.mjs scripts/security24/patch-tooling.test.mjs
node scripts/security24/graph.mjs
node scripts/security22/dependency.mjs
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --types node node_modules/zod/src/v4/core/schemas.ts
```

The new suite has 16 Node tests and zero intentional skips. Its bounded child
uses a 128MiB V8 heap, 512KiB stack, 30-second deadline and 512KiB output cap.
It compares 118 collection behavior records and 60 merge behavior records on
authenticated reconstructed originals versus patched installed forms. Original
bytes are reconstituted only when their SHA256 equals the independently pinned
published preimage. CJS/ESM, default/v3/v4 imports, sync/async, bounded/unbounded,
transform/refinement and custom iterators are accounted separately.

The before-v4 constrained probes produce 257 array/set issues and 513 map issues
for 256 invalid entries; after mitigation each produces one. Unbounded issue
counts remain 64/256 for arrays/sets and 128/512 for maps, explicitly proving
linear growth remains. Official default-v4 4.6.7 and its embedded v3 were also
executed separately in 24 reference cells; those downloaded reference bytes are
not an installed dependency, upgrade or substitute proof.

The patch tests exercise every changed source form, immutable helper/dispatch
metadata, registry/SRI/version changes, omitted sources/copies, nested installs,
malformed/duplicate-key/invalid-byte manifests, Unicode aliases, Windows
junctions/POSIX directory links, original-v3 safeguard refusal, actual rollback,
growth during bounded descriptor reading, mutation between actual renames and
fixed disclosure-safe CLI refusal. A discovered primitive-target compatibility
regression was repaired and assigned its own before/after controls.

The graph enumerates all 1,114 lock entries and 2,676 declared dependency edges,
including optional/dev/peer declarations, and records resolution or absence
explicitly. It accounts for 1,114/1,114 installed/optional/workspace records and
1,038 unique registry coordinates. Two complete installed inventories must agree
and fixed public consumer files are independently hashed. Lock edges are not a
claim that every dependency API is runtime-reachable. Known direct consumers are
Expo CLI, eslint-plugin-react-hooks and zod-validation-error for Zod, and
@expo/config for deepmerge. Actual consumer checks exercise Expo config dry-run,
DevTools output, ESLint hook compilation and v3/v4 error formatting.

The real public npm and OSV collector remains unchanged. Investigation execution
reported nine npm affected/propagation rows and both exact advisory IDs; OSV
queried 1,038/1,038 coordinates and retained both package findings. Version-based
scanners do not infer local postinstall patch safety. Final integrated results,
source identities and later CI belong in the campaign's external final report.

Both platforms execute the new tests in the public candidate workflow and in
the existing tooling component. Their programs/configuration enter the complete
tool identity. Original tests, source inventory drift, private history/static
coverage, archive gaps and custody are preserved. `candidateReady=false` and
nonzero candidate findings remain required; no exception, suppression, renamed
package or scanner-clean claim is introduced.

## Finite changed-path purpose

Seven new task-owned paths: the six files in `scripts/security24/` (patcher,
exact-source pins, behavior tests, patch tests, bounded probe/helper and complete
graph) and this document. Existing integrations are only
`scripts/postinstall.mjs`, `scripts/security22/toolchain.py`,
`scripts/security22/run.py` and `.github/workflows/security-candidate22.yml`.
The package lock stays byte-identical to PR27, so native succession24 is not
created. Original native witnesses/validators and original Security workflow,
exceptions, privacy/runtime and production/database sources are untouched.
