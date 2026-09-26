# DB-08 Current-Head Source Readiness — 2026-09-26

## Scope and conclusion

This checkpoint audits only the generated database-type parity path. It does
not claim DB-08 completion, a successful current-chain PostgreSQL replay, a
linked staging comparison, or launch readiness.

The checked-in `packages/types/src/database.types.ts` is still the canonical
artifact generated at commit `e5588ae69`, when the repository contained 71
migrations through `20260729000072`. The current source contains 93 migrations
through `20260926000077`. The generated artifact remains well-formed, but it is
not current-head evidence and must not be represented as such.

## Provable source drift

The current generated artifact has canonical SHA-256
`2c14252f882294d2ca42832405fb0fe157f855a85a9d3fc5d47999457be9b1d3`
and 6,770 canonical lines. It has no diff from the artifact committed at
`e5588ae69`.

Current migrations added public schema objects that are absent from that
artifact. Representative exact omissions include:

- tables `account_deletion_requests`, `account_deletion_click_tombstones`,
  `catalog_import_versions`, `catalog_import_staged_products`,
  `catalog_import_batch_receipts`, `catalog_active_imports`,
  `shelf_mirror_versions`, `mobile_outbox_receipts`, and
  `conflict_choice_mirror_versions`;
- functions `has_current_exact_consent`, `apply_shelf_outbox_batch`,
  `apply_notification_preferences_outbox_batch`,
  `apply_recommendation_preferences_outbox_batch`,
  `apply_notification_delivery_outbox_batch`, `apply_shelf_scan_outbox_batch`,
  `apply_photo_delete_outbox_batch`, and the current account-deletion and
  catalog-import functions; and
- columns added after the historical generation, including
  `subscriptions_events.account_deletion_suppressed`,
  `product_ingredient_lists.import_version_id`, and
  `mobile_outbox_receipts.payload_hash`.

This is sufficient to prove that formatting, TypeScript compilation, and the
mobile capability overlay cannot close DB-08 by themselves.

## Source contract hardening

`scripts/phase2/database-types-contract-lib.mjs` now parses the candidate with
the TypeScript compiler and requires one exported `Json` alias, one exported
`Database` alias, an actual `public` type-literal member, and actual `Tables`,
`Views`, `Functions`, `Enums`, and `CompositeTypes` members. The previous
substring check could accept required words embedded only in comments or a
syntactically incomplete artifact. Focused regression tests cover both cases.

The existing hash-equality gates remain authoritative:

1. `local-supabase-reset.mjs --types-update` must replay the complete isolated
   local chain and replace the generated artifact from Supabase CLI output;
2. `--types-check` and full DB-05 verification must reproduce the exact
   repository hash; and
3. after DB-06 provisions reviewed staging, the retained repository, clean
   local, and linked generation hashes must be identical.

## Remaining gates

- Run the credential-stripped, isolated 93-migration local replay and
  `--types-update`; never hand-edit the generated artifact.
- Re-run package typecheck and the DB-08 source contract against the new file.
- Complete DB-06 reviewed staging provisioning and retain linked type output.
- Prove exact repository/local/linked hash equality in the staging evidence
  packet.

The attempted local regeneration on this Windows host could not start because
Docker Desktop 4.63.0 crashed before its engine came online on a stale
`dockerInference` runtime socket. No database was started, no credentials were
used, and no generated artifact was replaced. CI or another functioning local
Docker engine can execute the existing isolated update path without changing
this contract.
