import type {
  EdgeAppEnvironment,
  EdgeEnvironmentReader,
} from "../_shared/env.ts";

const SOURCE_REVISION_PATTERN = /^[a-f0-9]{40}$/;
const DEPLOYMENT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,254}$/;

export type CatalogOperatorRuntimeContext = Readonly<{
  environment: EdgeAppEnvironment;
  sourceRevision: string;
  edgeDeploymentId: string;
  controlGeneration: number;
}>;

export function readCatalogOperatorRuntimeContext(
  environment: EdgeAppEnvironment,
  read: EdgeEnvironmentReader = (name) => Deno.env.get(name),
): CatalogOperatorRuntimeContext {
  const sourceRevision = read("CATALOG_OPERATOR_SOURCE_REVISION")?.trim() ?? "";
  const edgeDeploymentId = read("DENO_DEPLOYMENT_ID")?.trim() ?? "";
  const generationText = read("CATALOG_OPERATOR_CONTROL_GENERATION")?.trim() ??
    "";
  const controlGeneration = Number(generationText);

  if (
    !SOURCE_REVISION_PATTERN.test(sourceRevision) ||
    !DEPLOYMENT_ID_PATTERN.test(edgeDeploymentId) ||
    !Number.isSafeInteger(controlGeneration) ||
    controlGeneration < 1
  ) {
    throw new Error("CATALOG_OPERATOR_RUNTIME_CONTEXT_NOT_CONFIGURED");
  }

  return {
    environment,
    sourceRevision,
    edgeDeploymentId,
    controlGeneration,
  };
}
