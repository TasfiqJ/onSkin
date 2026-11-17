# Test and browser evidence index

Final source tests:8,378 PASS (7,704 mobile/545 files +650 professional/18 +24 operator/7), three uncached tasks. `verified-*` are the final passing root/type/lint checks. `p0-authenticated-final` is an intermediate failure despite its historical name. All original failures remain present. Browser/native/provider qualifications remain separate.

| Receipt | Exit | Source HEAD | Command |
|---|---|---|---|
| [authentic-replacement](../tests/authentic-replacement.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/photoDeleteR3.integration.test.ts` |
| [consumer-375](../tests/consumer-375.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node .tmp/engineering19/consumer-flow.mjs` |
| [consumer-430](../tests/consumer-430.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node .tmp/engineering19/consumer-flow.mjs` |
| [final-lint](../tests/final-lint.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `npm.cmd run lint -- --force` |
| [final-mobile-build](../tests/final-mobile-build.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `python -X utf8 ..\ENGINEERING19_EVIDENCE\builds.py` |
| [final-professional-build](../tests/final-professional-build.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `npm.cmd --workspace apps/professional-web run build` |
| [final-root](../tests/final-root.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `npm.cmd run test -- --force` |
| [final-typecheck](../tests/final-typecheck.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `npm.cmd run typecheck -- --force` |
| [p0-authenticated-final](../tests/p0-authenticated-final.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts src/features/photos/progressDetailStore.c08b2.test.ts src/lib/storage/privateKV.test.ts src/features/shelf/formulaHistoryJourney.test.ts` |
| [p0-authenticated-v2](../tests/p0-authenticated-v2.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts src/features/photos/progressDetailStore.c08b2.test.ts src/lib/storage/privateKV.test.ts src/features/shelf/formulaHistoryJourney.test.ts` |
| [p0-authenticated](../tests/p0-authenticated.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts src/features/photos/progressDetailStore.c08b2.test.ts src/lib/storage/privateKV.test.ts src/features/shelf/formulaHistoryJourney.test.ts` |
| [p0-expanded](../tests/p0-expanded.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts` |
| [p0-focused-initial](../tests/p0-focused-initial.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts` |
| [p0-focused-v2](../tests/p0-focused-v2.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts` |
| [p0-focused-v3](../tests/p0-focused-v3.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts` |
| [p0-focused-v4](../tests/p0-focused-v4.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/store.test.ts` |
| [p0-green-initial](../tests/p0-green-initial.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts -t E19` |
| [p0-lint](../tests/p0-lint.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run lint` |
| [p0-red](../tests/p0-red.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts -t E19` |
| [p0-root-initial](../tests/p0-root-initial.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd run test -- --force` |
| [p0-storage-final](../tests/p0-storage-final.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/encryptedStorage.test.ts src/features/photos/photoDeleteR3.integration.test.ts src/features/photos/progressDetailStore.c08b2.test.ts src/lib/storage/privateKV.test.ts` |
| [p0-types-initial](../tests/p0-types-initial.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run typecheck` |
| [p0-types-v2](../tests/p0-types-v2.json) | 0 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run typecheck` |
| [professional-owner-375](../tests/professional-owner-375.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node scripts/e2e/professional-owner.mjs 375 667` |
| [professional-owner-430](../tests/professional-owner-430.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node scripts/e2e/professional-owner.mjs 430 932` |
| [professional-queue-375-v2](../tests/professional-queue-375-v2.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node scripts/e2e/professional-reconciliation.mjs 375 667` |
| [professional-queue-375](../tests/professional-queue-375.json) | 1 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node scripts/e2e/professional-reconciliation.mjs 375 667` |
| [professional-queue-430](../tests/professional-queue-430.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node scripts/e2e/professional-reconciliation.mjs 430 932` |
| [recovery-browser-v2](../tests/recovery-browser-v2.json) | 0 | `6e5e0acb11e08e3bde29e5b0cb81eb07fb9b0a76` | `node .tmp/engineering19/recovery-browser.mjs` |
| [recovery-ui](../tests/recovery-ui.json) | 0 | `73be77ad5ab8bfd5f1846148800f8b70f6a4b7ca` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/progressDataAuthority.c08a1.test.ts src/features/photos/progressRoutes.test.ts src/features/photos/manualCompare20Route.test.ts` |
| [unsigned-journal-red](../tests/unsigned-journal-red.json) | 1 | `77d929253ed283fff30cae6f8cc753c61c666320` | `npm.cmd --workspace apps/mobile run test -- src/features/photos/photoDeleteR3.integration.test.ts -t unsigned plaintext` |
| [verified-lint](../tests/verified-lint.json) | 0 | `f3398a5d97a1df8c4b0b964c05de5ccacdd91d69` | `npm.cmd run lint -- --force` |
| [verified-root](../tests/verified-root.json) | 0 | `f3398a5d97a1df8c4b0b964c05de5ccacdd91d69` | `npm.cmd run test -- --force` |
| [verified-typecheck](../tests/verified-typecheck.json) | 0 | `f3398a5d97a1df8c4b0b964c05de5ccacdd91d69` | `npm.cmd run typecheck -- --force` |

Complete stdout/stderr logs and all parts are listed in the root index. Empty consumer wrapper logs are real zero-byte logs; command receipts and actual routine/C41/Engineering17/privacy browser sub-summaries carry their results. Recorded timestamps and start identities are preserved.
