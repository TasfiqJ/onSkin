# Expo DevTools output boundary diagnostic — immutable scope

Provenance: explicit user execution request dated 2026-10-31 and the prepared
ENGINEERING_REVIEW.md / NEXT_CODEX_TASK.md, read from the local project outputs.
DIAGNOSTIC_ONLY / NO_GO. CAMPAIGN29_ACCEPTED_SCOPED / PARTIAL_DIAGNOSIS / NO_GO
is retained within its existing bounded-reader scope; no new acceptance is granted.

Parent PR33: stage/m1-windows-reader-integrity29, open/draft/unmerged.
HEAD 71dde4eed92edd20ff0e9611da42086d6e0f2b89;
tree f9e5f995d37a7dc058b07271e6b98f79cf698951. Verified live before writes;
stop dependent work on drift. New branch stage/devtools-output-boundary30 only.

Pins: installed @expo/cli 57.0.32 and Zod 3.25.76 after normal npm ci/hooks.
CLI archive https://registry.npmjs.org/@expo/cli/-/cli-57.0.32.tgz
SRI sha512-3p1qL/pvWblGNwDE1bt2wh/NUiGpSer61s5GKKFfpEpBkZTYnqve0pdK1UvEFzJGT6PW9vX2RofQQ2LP6MgvDQ==
Reference SHA256 9a73b4030fe119f8098e5a09ff50cdd146a73dea02663ac4c28b824b8f6cf841.
Authenticate the lock/archive and compare at most eight relevant installed CLI modules.
Trace actual callers/input origin, local tooling versus shipping/network exposure,
MAX_STRING_LENGTH, default 10-second timeout, truncation and entrypoint controls.

Exactly five permitted tracked paths:
- docs/brain/task-specs/M1X-30/SCOPE_PLAN.md (first commit; immutable)
- scripts/security30/devtools-output-probe.mjs
- scripts/security30/devtools-output.test.mjs
- docs/security/security30/devtools-output-boundary.md
- PROGRESS.md (short diagnostic observation only)

Use independent consumer probes with real installed schema validation: valid text/image,
malformed JSON/empty/stderr/errors; invalid and valid arrays of 32/128/512;
actual issue counts and input/output lengths; deterministic callback ordering around
synchronous validation; injected synthetic executor only at genuine constructor seam.
Vary truncation only through a documented limit interface, otherwise static/NOT_RUN.

Each probe child: 128 MiB V8 heap, 512 KiB stack, <=5 seconds,
<=64 KiB captured output; terminate and await owned children on timeout.
<=32 invocations/platform, <=512 records and <=64 KiB synthetic input/invocation.
No exhaustion or actual plugins, servers/sockets, scanners, provider actions or private
Security evidence. Credential-free installation/probe environment; no dependency changes.
Record actual commands/exits, runtime/module hashes, denominators and NOT_RUNs.
Second platform only if already available in a clean environment; no OS installation.

No existing workflow, lock, package, patcher, tests or gate changes. No mitigation
implementation: if useful, describe smallest caller proposal, compatibility and test budget.
If only known behavior/no useful diagnostic addition, external result and no speculative PR.
Otherwise one draft unmerged PR stacked on PR33; auto-merge/maintainer modification off,
USD0 only. Reverify source/base/diff and draft metadata at publication.
No merge/main/deploy/signing/purchase/Apple/acceptance. All Security/DB/native/clinical/J01/
provider/release gates remain NO_GO. Stop after this finite matrix; independent Brain reviews.
