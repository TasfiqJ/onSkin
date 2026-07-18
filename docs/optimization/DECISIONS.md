# Optimization Decision Index

Date: 2026-07-18 (America/Toronto)
Branch: `optimization`
Baseline SHA: `fc5d512f7e0ccbab8d3b5a2beb4268dd8a24595f`
Current checkpoint parent SHA: `878e145224197cee0a4fafb20d43484edf9a5d8d`

This file records optimization-specific decision needs and links to authoritative decision updates. It does not approve product, privacy, architecture, device-support, release, or operational changes by itself. Current statuses derive only from the authoritative sources named in each row.

Consolidated decision input: [OPEN_DECISION_PACKET.md](./OPEN_DECISION_PACKET.md).

| ID          | Decision required                                                                                                  | Status        | Authoritative update/evidence required                                                                                                      | Safe work that may continue                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| OPT-DEC-000 | Reconcile the newer iOS-only/all-features launch contract with older dual-platform source and generated documents. | `not-started` | `docs/DEVICE_SUPPORT_POLICY.md`, product/architecture/roadmap/decision sources, generated policy artifacts, and launch-contract governance. | Platform-neutral correctness, tests, measurement tooling, and evidence structure.  |
| OPT-DEC-001 | Photo-v2 envelope and narrow native photo/crypto module.                                                           | `not-started` | Master Plan Update, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, privacy/security review, migration and rollback plan.                      | Revalidate v1 behavior, add fixtures/failure tests, and document measurements.     |
| OPT-DEC-002 | Encrypted transactional database for growing structured local data.                                                | `not-started` | Architecture/decision update, dependency review, key/migration/rollback/account-isolation plan.                                             | Make bounded private-KV records atomic and typed store by store.                   |
| OPT-DEC-003 | Transactional encrypted outbox schema, conflict, ordering, and coalescing policy.                                  | `not-started` | Architecture/decision update and server idempotency contract.                                                                               | Inventory writes, add owner-generation tests, and define failure taxonomy.         |
| OPT-DEC-004 | Mounted privacy shield versus full verification/remount bootstrap behavior.                                        | `not-started` | Architecture/privacy decision plus the implemented `SECURE_STARTUP_TRUTH_TABLE.md` and signed-device startup distributions.                  | Maintain current fixed instrumentation and collect distributions without changing authorization gates. |
| OPT-DEC-005 | Production performance telemetry under current privacy constraints.                                                | `not-started` | Privacy/security decision and allowlisted content-free schema.                                                                              | Local monotonic markers and native offline profiling.                              |
| OPT-DEC-006 | EAS Update adoption versus store-only releases and correction of OTA claims.                                       | `accepted` | `docs/UPDATE_DELIVERY_POLICY.md`, `docs/ARCHITECTURE.md` A-007, `docs/DECISIONS.md`, and `evidence/2026-07-17_store-only-update-delivery-policy.md` accept store-bundled client releases for V1. | Preserve store-build and migration compatibility evidence; future EAS Update adoption requires a new governed decision and complete reactivation proof. |
| OPT-DEC-007 | Full dark mode versus explicit light-only launch.                                                                  | `accepted` | `docs/DECISIONS.md` accepts an explicit light-only launch with deterministic paper/night status contrast; `evidence/2026-07-17_theme-system-bar-and-predictive-back-scope.md` records the implementation boundary. | Retain intentional night routes and collect supported-iPhone screenshots in both device appearance settings; full dark mode requires a new reviewed token/route/accessibility matrix. |
| OPT-DEC-008 | Android Baseline Profile/Macrobenchmark ownership and CI device strategy for a future Android release.                     | `deferred`    | `docs/DECISIONS.md`, `docs/DEVICE_SUPPORT_POLICY.md`, and `docs/hugeToDo/launch-contract.json` exclude Android from this release; reactivate only with an authoritative Android release/ownership decision. | Keep shared Android configuration healthy and continue platform-neutral measurement; do not add a generated native harness without an owner/device strategy. |
| OPT-DEC-009 | Photo dimensions, format, quality, thumbnail tiers, and visual acceptance set.                                     | `not-started` | Product/privacy/quality decision supported by representative image evidence.                                                                | Build content-free fixture and measurement harnesses.                              |
| OPT-DEC-010 | Absolute binary, memory, startup, interaction, and backend latency gates.                                          | `not-started` | Two clean release baselines, threshold owner, and independent signoff owner.                                                                | Record suggested targets as proposals only and collect non-acceptance diagnostics. |

## Decision Rules

- Update authoritative sources before or with the governed implementation.
- Do not infer approval from this index, the optimization plan, or a passing unit test.
- Do not invent a founder, legal, privacy, clinical, store, threshold, or signoff owner.
- Record alternatives, user/privacy impact, migration/rollback impact, and safe independent work in each future decision packet.
- Keep blocked decisions from stopping unrelated safe work.
