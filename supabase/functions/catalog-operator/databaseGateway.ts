import { CATALOG_OPERATOR_RPCS } from "./contract.ts";
import type { CatalogOperatorDatabaseResult } from "./httpHandler.ts";

type CatalogOperatorSql = (
  strings: TemplateStringsArray,
  ...values: readonly unknown[]
) => unknown;

function stringArgument(
  args: Readonly<Record<string, unknown>>,
  name: string,
): string {
  const value = args[name];
  if (typeof value !== "string") {
    throw new Error("CATALOG_OPERATOR_DATABASE_ARGUMENT_INVALID");
  }
  return value;
}

function nullableStringArgument(
  args: Readonly<Record<string, unknown>>,
  name: string,
): string | null {
  const value = args[name];
  if (value !== null && typeof value !== "string") {
    throw new Error("CATALOG_OPERATOR_DATABASE_ARGUMENT_INVALID");
  }
  return value;
}

function integerArgument(
  args: Readonly<Record<string, unknown>>,
  name: string,
): number {
  const value = args[name];
  if (!Number.isSafeInteger(value)) {
    throw new Error("CATALOG_OPERATOR_DATABASE_ARGUMENT_INVALID");
  }
  return value as number;
}

export function createCatalogOperatorDatabaseGateway(
  database: CatalogOperatorSql,
): (
  rpcName: (typeof CATALOG_OPERATOR_RPCS)[keyof typeof CATALOG_OPERATOR_RPCS],
  args: Readonly<Record<string, unknown>>,
  authority: Readonly<Record<string, unknown>>,
) => Promise<CatalogOperatorDatabaseResult> {
  return async (rpcName, input, authority) => {
    const args = { ...input, ...authority };
    try {
      // This separate auto-committed statement spends the actor's global
      // attempt budget even when session establishment or an action rejects.
      await database`
        select *
        from catalog_operator_gateway.catalog_operator_session(
          ${stringArgument(args, "p_auth_session_id")},
          ${stringArgument(args, "p_edge_environment")},
          ${stringArgument(args, "p_source_revision")},
          ${stringArgument(args, "p_edge_deployment_id")},
          ${integerArgument(args, "p_control_generation")},
          ${"preflight"}
        )
      `;
      let data: unknown;
      switch (rpcName) {
        case CATALOG_OPERATOR_RPCS.session:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_session(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${"session"}
            )
          `;
          break;
        case CATALOG_OPERATOR_RPCS.queue:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_queue(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${stringArgument(args, "p_queue_kind")},
              ${nullableStringArgument(args, "p_after_created_at")},
              ${nullableStringArgument(args, "p_after_id")},
              ${integerArgument(args, "p_limit")}
            )
          `;
          break;
        case CATALOG_OPERATOR_RPCS.detail:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_detail(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${stringArgument(args, "p_item_kind")},
              ${stringArgument(args, "p_item_id")},
              ${stringArgument(args, "p_lease_id")},
              ${integerArgument(args, "p_expected_version")}
            )
          `;
          break;
        case CATALOG_OPERATOR_RPCS.claim:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_claim(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${stringArgument(args, "p_operation_id")},
              ${stringArgument(args, "p_item_kind")},
              ${stringArgument(args, "p_item_id")},
              ${integerArgument(args, "p_expected_version")}
            )
          `;
          break;
        case CATALOG_OPERATOR_RPCS.transition:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_transition(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${stringArgument(args, "p_operation_id")},
              ${stringArgument(args, "p_item_kind")},
              ${stringArgument(args, "p_item_id")},
              ${stringArgument(args, "p_lease_id")},
              ${integerArgument(args, "p_expected_version")},
              ${stringArgument(args, "p_decision")},
              ${stringArgument(args, "p_reason_code")},
              ${nullableStringArgument(args, "p_evidence_sha256")}
            )
          `;
          break;
        case CATALOG_OPERATOR_RPCS.releaseHold:
          data = await database`
            select *
            from catalog_operator_gateway.catalog_operator_release_hold(
              ${stringArgument(args, "p_auth_session_id")},
              ${stringArgument(args, "p_edge_environment")},
              ${stringArgument(args, "p_source_revision")},
              ${stringArgument(args, "p_edge_deployment_id")},
              ${integerArgument(args, "p_control_generation")},
              ${stringArgument(args, "p_operation_id")},
              ${stringArgument(args, "p_hold_id")},
              ${stringArgument(args, "p_lease_id")},
              ${integerArgument(args, "p_expected_version")},
              ${stringArgument(args, "p_repair_receipt_id")},
              ${stringArgument(args, "p_reason_code")}
            )
          `;
          break;
      }
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };
}
