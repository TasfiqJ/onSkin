# Cross-Surface Consent Ordering

Date: 2026-07-26

## Finding

Ask, photo-trend, and Community consent mutations each had account-generation
fencing, but their grant and withdrawal workflows did not enter the shared
consent queue. A slow affirmative ledger insert could remain in flight while a
later withdrawal locally locked the feature, completed deletion cleanup, and
appended its revocation. When the old grant then finished last, the
ledger-authoritative read reopened the privacy-gated feature after the user had
completed withdrawal.

## Change

All six production mutations now enter the generation-scoped consent workflow
once around their complete local and remote operation:

- Ask grant and revoke;
- photo-trend grant and revoke;
- Community grant and withdrawal.

The queue preserves invocation order across domains, not merely within one
screen. Local state changes, rollback/deletion, immutable grant publication,
withdrawal cleanup, and analytics are therefore one ordered unit.

Existing failure semantics remain unchanged:

- Ask and Trend grants still propagate ledger failure after their existing
  local rollback and cleanup;
- Community still keeps its explicit local-first grant when the ledger mirror
  is unavailable;
- withdrawals still lock or delete local data before remote cleanup;
- account-generation cancellation is not flattened into an offline success;
- analytics cannot publish after a stale-owner boundary;
- no queued function calls another queued function, avoiding a non-reentrant
  serializer deadlock.

## Verification

```text
npm.cmd --workspace apps/mobile exec vitest run src/features/ask/consent.test.ts src/features/trend/consent.test.ts src/features/community/consent.test.ts src/features/commerce/consentWorkflowIntegration.test.ts
npm.cmd --workspace apps/mobile run typecheck
npm.cmd --workspace apps/mobile exec -- eslint <exact changed consent files> --max-warnings=0
npm.cmd exec -- prettier --check <exact changed consent files>
npm.cmd --workspace apps/mobile test -- --run
git diff --check
```

Results:

- Focused consent matrix: 4 files / 39 tests passed.
- The final combined consent, notification, entitlement, and source-contract
  matrix: 8 files / 164 tests passed.
- Mobile type-check, exact changed-file lint, Prettier, and patch whitespace
  checks passed.
- Full mobile run: 364 of 366 files and 4,475 of 4,479 tests passed. The same
  four unrelated dirty-worktree failures remain in Shelf expiry provenance and
  the notification behavioural snapshot.
- Independent adversarial review found no remaining P0/P1 after checking queue
  ownership, rollback/local-first semantics, account cancellation, analytics,
  serializer reentrancy, production call inventory, and test seams.

The cross-surface matrix holds each remote mutation and proves the later local
mutation cannot start. Its six-edge ring covers slow grant followed by later
withdrawal and slow withdrawal followed by later grant across Ask, Trend, and
Community. Domain tests additionally cover Community grant and Trend
withdrawal account-boundary cancellation; existing Ask mutation-boundary tests
remain green.

## Human-Simulated E2E

Not applicable to this slice. It changes concurrency ordering behind existing
consent controls without changing navigation, copy, accessibility, or visible
states. Authenticated hosted cleanup/ledger ordering and physical-device
account-switch/process-kill proof remain release gates.
