import type {
  EdgeAppEnvironment,
  EdgeEnvironmentReader,
} from "../_shared/env.ts";

const HOSTED_OPERATOR_USERNAME_PATTERN =
  /^catalog_operator_edge\.[a-z0-9]{20}$/;
const HOSTED_POOLER_PATTERN =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pooler\.supabase\.com$/;
const HOSTED_SUPABASE_URL_PATTERN = /^([a-z0-9]{20})\.supabase\.co$/;

function hostedSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const parsed = new URL(supabaseUrl);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash ||
      parsed.origin !== supabaseUrl
    ) {
      return null;
    }
    return parsed.hostname.match(HOSTED_SUPABASE_URL_PATTERN)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function readCatalogOperatorDatabaseUrl(
  environment: EdgeAppEnvironment,
  supabaseUrl: string,
  read: EdgeEnvironmentReader = (name) => Deno.env.get(name),
): string {
  const raw = read("CATALOG_OPERATOR_DATABASE_URL")?.trim() ?? "";
  let url: URL;
  let username: string;
  try {
    url = new URL(raw);
    username = decodeURIComponent(url.username);
  } catch {
    throw new Error("CATALOG_OPERATOR_DATABASE_URL_INVALID");
  }

  const local = environment === "development" &&
    (url.hostname === "127.0.0.1" ||
      url.hostname === "localhost" ||
      url.hostname === "[::1]");
  const hostedPooler = url.port === "6543" &&
    HOSTED_POOLER_PATTERN.test(url.hostname);
  const expectedProjectRef = environment === "development"
    ? null
    : hostedSupabaseProjectRef(supabaseUrl);
  const validUsername = local
    ? username === "catalog_operator_edge"
    : HOSTED_OPERATOR_USERNAME_PATTERN.test(username) &&
      expectedProjectRef !== null &&
      username === `catalog_operator_edge.${expectedProjectRef}`;

  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !validUsername ||
    !url.password ||
    (environment !== "development" && expectedProjectRef === null) ||
    (!local && !hostedPooler) ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash
  ) {
    throw new Error("CATALOG_OPERATOR_DATABASE_URL_INVALID");
  }

  return raw;
}
