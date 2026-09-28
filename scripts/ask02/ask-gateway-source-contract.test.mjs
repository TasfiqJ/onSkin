import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { auditAskGatewaySources } from "./ask-gateway-source-contract.mjs";

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

function currentSnapshot() {
  const directory = "supabase/functions/ask-layerwell";
  const files = Object.fromEntries(
    readdirSync(new URL(`../../${directory}`, import.meta.url))
      .filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))
      .map((name) => [`${directory}/${name}`, read(`${directory}/${name}`)]),
  );
  return {
    files,
    manifest: JSON.parse(read("supabase/functions/manifest.json")),
    config: read("supabase/config.toml"),
    packageJson: JSON.parse(read("package.json")),
  };
}

function errorsFor(snapshot) {
  return auditAskGatewaySources(snapshot).join("\n");
}

function mutateFile(snapshot, path, mutate) {
  const next = structuredClone(snapshot);
  const original = next.files[path];
  next.files[path] = mutate(original);
  assert.notEqual(
    next.files[path],
    original,
    `mutation did not change ${path}`,
  );
  return next;
}

test("current ASK-02 executable source contract passes", () => {
  assert.deepEqual(auditAskGatewaySources(currentSnapshot()), []);
});

test("comments and dead text cannot forge disabled executable admission", () => {
  const snapshot = currentSnapshot();
  const mutated = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace("enabled: false", "enabled: true /* enabled: false */"),
  );
  assert.match(
    errorsFor(mutated),
    /config\.enabled must be the false literal/u,
  );
});

test("auth and adjacent purpose-consent ordering are AST anchored", () => {
  const snapshot = currentSnapshot();
  const noAuth = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "const { data: userData } = await caller.auth.getUser();",
        "const { data: userData } = { data: { user: null } }; // caller.auth.getUser()",
      ),
  );
  assert.match(errorsFor(noAuth), /getUser must be followed/u);

  const deadAuth = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "const { data: userData } = await caller.auth.getUser();",
        "if (false) { await caller.auth.getUser(); }\n  const { data: userData } = { data: { user: null } };",
      ),
  );
  assert.match(errorsFor(deadAuth), /getUser must be followed/u);

  const deadAccountGuard = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "if (!initialAccountAccess.ok) {",
        "if (false && !initialAccountAccess.ok) {",
      ),
  );
  assert.match(
    errorsFor(deadAccountGuard),
    /initialAccountAccess must be immediately/u,
  );

  const missingAccountReturn = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "if (!initialAccountAccess.ok) {\n    return error(",
        "if (!initialAccountAccess.ok) {\n    error(",
      ),
  );
  assert.match(
    errorsFor(missingAccountReturn),
    /initialAccountAccess must be immediately/u,
  );

  for (
    const [from, to, expected] of [
      [
        'if (!userId) return error("unauthorized", 401);',
        'if (!userId) error("unauthorized", 401);',
        /getUser must be followed/u,
      ],
      [
        'if (!userId) return error("unauthorized", 401);',
        'if (userId) return error("unauthorized", 401);',
        /getUser must be followed/u,
      ],
      [
        "if (!initialAccountAccess.ok) {",
        "if (initialAccountAccess.ok) {",
        /initialAccountAccess must be immediately/u,
      ],
      [
        "if (!healthAdmission.ok) {",
        "if (healthAdmission.ok) {",
        /healthAdmission must be immediately/u,
      ],
      [
        "if (!executionConsent.ok) return askConsentError(executionConsent);",
        "if (executionConsent.ok) return askConsentError(executionConsent);",
        /purpose consent declaration and fail-closed rejection/u,
      ],
    ]
  ) {
    const reversed = mutateFile(
      snapshot,
      "supabase/functions/ask-layerwell/index.ts",
      (source) => source.replace(from, to),
    );
    assert.match(errorsFor(reversed), expected);
  }

  const separated = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "if (!executionConsent.ok) return askConsentError(executionConsent);\n\n  const gatewayResult",
        "if (!executionConsent.ok) return askConsentError(executionConsent);\n  void 0;\n\n  const gatewayResult",
      ),
  );
  assert.match(
    errorsFor(separated),
    /two executable statements immediately before/u,
  );
});

test("dead comments cannot forge registry-authority quarantine", () => {
  const snapshot = currentSnapshot();
  const mutated = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/consentAdmission.ts",
    (source) =>
      source.replace(
        'return { ok: false, error: "ASK_CONSENT_AUTHORITY_UNAVAILABLE" };',
        "return { ok: true }; // ASK_CONSENT_AUTHORITY_UNAVAILABLE",
      ),
  );
  const errors = errorsFor(mutated);
  assert.match(errors, /cannot return executable ok:true/u);
  assert.match(errors, /explicitly fail for unavailable registry authority/u);
});

test("provider SDK imports and credential environment reads are rejected", () => {
  const snapshot = currentSnapshot();
  const providerImport = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) => `import OpenAI from "openai";\n${source}`,
  );
  assert.match(errorsFor(providerImport), /imports provider SDK openai/u);

  const dynamicProvider = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) => `void import("@ai-sdk/anthropic");\n${source}`,
  );
  assert.match(errorsFor(dynamicProvider), /dynamically loads provider SDK/u);

  const credentialRead = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) => `Deno.env.get("OPENAI_API_KEY");\n${source}`,
  );
  assert.match(
    errorsFor(credentialRead),
    /provider credential identifier OPENAI_API_KEY/u,
  );
  assert.match(
    errorsFor(credentialRead),
    /unapproved direct environment read/u,
  );
});

test("endpoint cannot inject a fingerprint implementation", () => {
  const snapshot = currentSnapshot();
  const injected = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source.replace(
        "    circuit,\n  });",
        '    circuit,\n    fingerprint: async () => "0".repeat(64),\n  });',
      ),
  );
  assert.match(errorsFor(injected), /exact production keys/u);

  const deadRun = mutateFile(
    snapshot,
    "supabase/functions/ask-layerwell/index.ts",
    (source) =>
      source
        .replace(
          "const gatewayResult = await runAskGateway({",
          "if (false) { await runAskGateway({",
        )
        .replace(
          "  });\n\n  const responseAccountError",
          "  }); }\n\n  const responseAccountError",
        ),
  );
  assert.match(errorsFor(deadRun), /direct awaited gatewayResult declaration/u);
});

test("manifest, config, package, and launch wiring mutations fail closed", () => {
  const snapshot = currentSnapshot();

  const manifest = structuredClone(snapshot);
  manifest.manifest.functions["ask-layerwell"].requiredSecrets = [
    "OPENAI_API_KEY",
  ];
  assert.match(errorsFor(manifest), /manifest authority/u);
  assert.match(
    errorsFor(manifest),
    /manifest\/config contains provider material/u,
  );

  const config = structuredClone(snapshot);
  config.config += '\nprovider_secret = "ANTHROPIC_API_KEY"\n';
  assert.match(
    errorsFor(config),
    /manifest\/config contains provider material/u,
  );

  const packageSdk = structuredClone(snapshot);
  packageSdk.packageJson.dependencies = {
    ...packageSdk.packageJson.dependencies,
    openai: "latest",
  };
  assert.match(
    errorsFor(packageSdk),
    /package\.json adds provider SDK openai/u,
  );

  const packageCredential = structuredClone(snapshot);
  packageCredential.packageJson.scripts["ask-provider"] = "echo OPENAI_API_KEY";
  assert.match(
    errorsFor(packageCredential),
    /package\.json contains provider credential material/u,
  );

  const unwired = structuredClone(snapshot);
  unwired.packageJson.scripts["launch:contract:verify"] = unwired.packageJson
    .scripts["launch:contract:verify"].replace(
      "npm run ask02:gateway-source-contract:test && ",
      "",
    );
  assert.match(errorsFor(unwired), /launch:contract:verify must execute/u);
});
