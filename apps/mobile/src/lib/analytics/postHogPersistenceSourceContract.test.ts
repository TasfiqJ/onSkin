import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const MOBILE_PACKAGE = fileURLToPath(
  new URL("../../../package.json", import.meta.url),
);
const mobileRequire = createRequire(import.meta.url);
const posthogReactNativeEntry = mobileRequire.resolve("posthog-react-native");
const posthogReactNativeDist = dirname(posthogReactNativeEntry);
const POSTHOG_STORAGE_SOURCE = resolve(posthogReactNativeDist, "storage.js");
const POSTHOG_NATIVE_DEPS_SOURCE = resolve(
  posthogReactNativeDist,
  "native-deps.js",
);
const posthogCoreEntry = createRequire(posthogReactNativeEntry).resolve(
  "@posthog/core",
);
const POSTHOG_CORE_SOURCE = resolve(
  dirname(posthogCoreEntry),
  "..",
  "src",
  "posthog-core.ts",
);

describe("pinned PostHog local-persistence source contract", () => {
  it("pins the audited SDK and its two persistence keys/backends", () => {
    const mobilePackage = JSON.parse(readFileSync(MOBILE_PACKAGE, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const storageSource = readFileSync(POSTHOG_STORAGE_SOURCE, "utf8");
    const nativeDepsSource = readFileSync(POSTHOG_NATIVE_DEPS_SOURCE, "utf8");

    expect(mobilePackage.dependencies?.["posthog-react-native"]).toBe("4.54.4");
    expect(storageSource).toContain("EVENTS_STORAGE_FILE='.posthog-rn.json'");
    expect(storageSource).toContain(
      "LOGS_STORAGE_FILE='.posthog-rn-logs.json'",
    );
    expect(nativeDepsSource).toContain(
      "new filesystem.File(filesystem.Paths.document,key)",
    );
    expect(nativeDepsSource).toContain(
      "(filesystem.documentDirectory||'')+key",
    );
    expect(nativeDepsSource).toContain(
      "_OptionalAsyncStorage.OptionalAsyncStorage",
    );
  });

  it("pins the audited reset behavior that preserves both queues", () => {
    const coreSource = readFileSync(POSTHOG_CORE_SOURCE, "utf8");

    expect(coreSource).toContain("PostHogPersistedProperty.Queue,");
    expect(coreSource).toContain("PostHogPersistedProperty.LogsQueue,");
    expect(coreSource).toContain("are always preserved regardless");
  });
});
