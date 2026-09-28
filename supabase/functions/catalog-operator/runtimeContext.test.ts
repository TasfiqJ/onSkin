import { readCatalogOperatorRuntimeContext } from "./runtimeContext.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const REVISION = "a".repeat(40);

function reader(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

Deno.test("operator runtime context is exact, server-owned, and bounded", () => {
  const context = readCatalogOperatorRuntimeContext(
    "production",
    reader({
      CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
      DENO_DEPLOYMENT_ID: "project_function_42",
      CATALOG_OPERATOR_CONTROL_GENERATION: "7",
    }),
  );
  assert(context.environment === "production", "server environment retained");
  assert(context.sourceRevision === REVISION, "full revision retained");
  assert(
    context.edgeDeploymentId === "project_function_42",
    "deployment retained",
  );
  assert(context.controlGeneration === 7, "control generation retained");
});

Deno.test("operator runtime context fails closed when missing, stale-shaped, or noncanonical", () => {
  for (
    const values of [
      {},
      {
        CATALOG_OPERATOR_SOURCE_REVISION: "ABC",
        DENO_DEPLOYMENT_ID: "project_function_42",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "project\nfunction",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "project function",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "project.function",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "-project_function",
        CATALOG_OPERATOR_CONTROL_GENERATION: "7",
      },
      {
        CATALOG_OPERATOR_SOURCE_REVISION: REVISION,
        DENO_DEPLOYMENT_ID: "project_function_42",
        CATALOG_OPERATOR_CONTROL_GENERATION: "1.5",
      },
    ]
  ) {
    let threw = false;
    try {
      readCatalogOperatorRuntimeContext("staging", reader(values));
    } catch {
      threw = true;
    }
    assert(threw, "invalid runtime context rejected");
  }
});
