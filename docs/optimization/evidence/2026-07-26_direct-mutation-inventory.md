# Direct Mutation Inventory

Date: 2026-07-26

## Finding

The production request-policy inventory froze which source files could contain
direct Supabase mutations, but an already-approved file could change its table,
verb, or number of mutations without failing that filename-only allowlist.

That left a regression path around the transactional outbox and request-policy
review boundary.

## Change

`apps/mobile/src/lib/network/requestPolicyInventory.test.ts` now freezes the
complete direct-mutation contract:

```text
commerce_click_events insert x1
photos                 delete x1
routine_completions    insert x1
skin_profiles          insert x1
consents               insert x1
```

The first three remain explicitly bound to their idempotent request-policy
endpoints. The onboarding `skin_profiles` insert and consent-ledger `consents`
insert remain explicitly classified as deferred outbox migrations because
their ordering/identity contracts are not yet safe to invent.

For every approved file, the test compares parsed literal table/verb pairs and
raw mutation-verb counts. A changed table, changed verb, duplicate occurrence,
extra mutation, or dynamic table reference now fails closed.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/lib/network/requestPolicyInventory.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec eslint -- --max-warnings=0 src/lib/network/requestPolicyInventory.test.ts
npm.cmd exec prettier -- --check apps/mobile/src/lib/network/requestPolicyInventory.test.ts
git diff --check
```

Results:

- Focused inventory matrix: 1 file / 4 tests passed.
- Mobile type-check: passed.
- Exact changed-file lint with zero warnings: passed.
- Prettier and patch whitespace checks: passed.

Human-simulated E2E is not applicable because this is a source-contract
regression guard with no runtime or UI behavior change.

## Remaining Work

The onboarding and consent calls still require authoritative terminal ordering
and idempotency designs before they can move into the encrypted outbox.
