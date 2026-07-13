# Optimization Decision Index

Date: 2026-07-12 (America/Toronto)
Branch: `optimization`
Baseline/current SHA: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`

This file records optimization-specific decision needs and links to authoritative decision updates. It does not approve product, privacy, architecture, device-support, release, or operational changes by itself. No decision below is approved at this baseline.

Consolidated decision input: [OPEN_DECISION_PACKET.md](./OPEN_DECISION_PACKET.md).

| ID          | Decision required                                                                                                  | Status        | Authoritative update/evidence required                                                                                                      | Safe work that may continue                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| OPT-DEC-000 | Reconcile the newer iOS-only/all-features launch contract with older dual-platform source and generated documents. | `not-started` | `docs/DEVICE_SUPPORT_POLICY.md`, product/architecture/roadmap/decision sources, generated policy artifacts, and launch-contract governance. | Platform-neutral correctness, tests, measurement tooling, and evidence structure.  |
| OPT-DEC-001 | Photo-v2 envelope and narrow native photo/crypto module.                                                           | `not-started` | Master Plan Update, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, privacy/security review, migration and rollback plan.                      | Revalidate v1 behavior, add fixtures/failure tests, and document measurements.     |
| OPT-DEC-002 | Encrypted transactional database for growing structured local data.                                                | `not-started` | Architecture/decision update, dependency review, key/migration/rollback/account-isolation plan.                                             | Make bounded private-KV records atomic and typed store by store.                   |
| OPT-DEC-003 | Transactional encrypted outbox schema, conflict, ordering, and coalescing policy.                                  | `not-started` | Architecture/decision update and server idempotency contract.                                                                               | Inventory writes, add owner-generation tests, and define failure taxonomy.         |
| OPT-DEC-004 | Mounted privacy shield versus full verification/remount bootstrap behavior.                                        | `not-started` | Architecture/privacy decision and bootstrap truth-table evidence.                                                                           | Instrument current startup phases without changing authorization gates.            |
| OPT-DEC-005 | Production performance telemetry under current privacy constraints.                                                | `not-started` | Privacy/security decision and allowlisted content-free schema.                                                                              | Local monotonic markers and native offline profiling.                              |
| OPT-DEC-006 | EAS Update adoption versus store-only releases and correction of OTA claims.                                       | `not-started` | Product/release decision, runtime-version and rollback policy if adopted.                                                                   | Signed store-build and migration compatibility planning.                           |
| OPT-DEC-007 | Full dark mode versus explicit light-only launch.                                                                  | `not-started` | Product/design/accessibility decision and route/system-bar evidence.                                                                        | Fix theme-independent accessibility and semantic-state behavior.                   |
| OPT-DEC-008 | Android Baseline Profile/Macrobenchmark ownership and CI device strategy.                                          | `not-started` | Platform ownership and maintainability decision after the device-policy conflict is resolved.                                               | Manual/release profiling plans and platform-neutral benchmarks.                    |
| OPT-DEC-009 | Photo dimensions, format, quality, thumbnail tiers, and visual acceptance set.                                     | `not-started` | Product/privacy/quality decision supported by representative image evidence.                                                                | Build content-free fixture and measurement harnesses.                              |
| OPT-DEC-010 | Absolute binary, memory, startup, interaction, and backend latency gates.                                          | `not-started` | Two clean release baselines, threshold owner, and independent signoff owner.                                                                | Record suggested targets as proposals only and collect non-acceptance diagnostics. |

## Decision Rules

- Update authoritative sources before or with the governed implementation.
- Do not infer approval from this index, the optimization plan, or a passing unit test.
- Do not invent a founder, legal, privacy, clinical, store, threshold, or signoff owner.
- Record alternatives, user/privacy impact, migration/rollback impact, and safe independent work in each future decision packet.
- Keep blocked decisions from stopping unrelated safe work.
