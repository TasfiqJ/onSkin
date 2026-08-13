# Incremental Export Source Gate

Date: 2026-07-25 (America/Toronto)

Branch: `optimization`

Baseline SHA: `7a3ad4c9b6658b6f98ea2912e9eee7338d38118b`

Evidence class: source contract and focused command verification

## Finding

The hardened mobile export implementation was correct, but `npm run phase9:data-rights-smoke` still required its deleted predecessor:

- `const json = JSON.stringify(...)`;
- `FileSystem.writeAsStringAsync(staging.uri, json)`.

The code gate therefore failed the release pipeline after the incremental writer landed. This was a control-plane regression: satisfying the stale assertion would have reintroduced the artifact-sized plaintext duplicate that OPT-013 removed.

## Source Contract

The Phase 9 gate now requires the complete current ordering:

1. reserve the content-free `data_export_json` journal entry;
2. construct the combined bundle only after reservation;
3. call `writeMobileDataExportFile`;
4. reject any actions-layer `JSON.stringify` or `writeAsStringAsync`;
5. create the owned file with `overwrite: false`;
6. open one `FileMode.WriteOnly` handle;
7. stream through `writePrettyJsonIncrementally` and `handle.writeBytes`;
8. close that handle before returning success;
9. promote the journal to `plaintext_written` only after the writer resolves.

The gate also protects the fixed 64 KiB fragment ceiling, per-chunk UTF-8 encoding, host yield, and account-generation revalidation.

## Verification

| Check | Result |
| --- | --- |
| `node --check scripts/phase9/data-rights-smoke.mjs` | Pass |
| `npm.cmd run phase9:data-rights-smoke` | Pass code gates; expected missing live evidence warning |
| Export writer/actions/staging/account matrix | Pass, 6 files / 101 tests |
| `npm.cmd run phase9:privacy-payload-audit` | Pass code gates; expected missing live provider sample warning |

No runtime product behavior changed, so the existing supported-phone export interaction remains the UI evidence. Complete exports above the current 8 MiB response boundary and native FileHandle/heap/share proof remain separate hosted, policy, and physical-device gates.
