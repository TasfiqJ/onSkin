import { readCatalogOperatorDatabaseUrl } from "./databaseUrl.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function read(value: string | undefined) {
  return (name: string) =>
    name === "CATALOG_OPERATOR_DATABASE_URL" ? value : undefined;
}

Deno.test("operator database URL requires the dedicated login over a hosted transaction pooler", () => {
  const url =
    "postgresql://catalog_operator_edge.abcdefghijklmnopqrst:encoded-password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
  assert(
    readCatalogOperatorDatabaseUrl(
      "production",
      "https://abcdefghijklmnopqrst.supabase.co",
      read(url),
    ) === url,
    "dedicated Supavisor URL retained",
  );
});

Deno.test("operator database URL rejects admin roles, direct production ports, and malformed URLs", () => {
  for (
    const value of [
      undefined,
      "",
      "not-a-url",
      "postgresql://postgres:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://service_role:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge:password@db.example.supabase.co:5432/postgres",
      "postgresql://catalog_operator_edge@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge:password@evil.example:6543/postgres",
      "postgresql://catalog_operator_edge.:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge.arbitrary:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge.abcdefghijklmnopqrst:password@.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge.abcdefghijklmnopqrst:password@bad_label.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge.zyxwvutsrqponmlkjihg:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
      "postgresql://catalog_operator_edge:password@aws-0-ca-central-1.pooler.supabase.com:6543/other",
      "postgresql://catalog_operator_edge:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres?sslmode=disable",
      "postgresql://catalog_operator_edge%ZZ:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres",
    ]
  ) {
    let threw = false;
    try {
      readCatalogOperatorDatabaseUrl(
        "production",
        "https://abcdefghijklmnopqrst.supabase.co",
        read(value),
      );
    } catch {
      threw = true;
    }
    assert(threw, `unsafe database URL rejected: ${value ?? "missing"}`);
  }
});

Deno.test("operator database URL permits only loopback development transport outside the pooler", () => {
  const url =
    "postgresql://catalog_operator_edge:local-only@127.0.0.1:54322/postgres";
  assert(
    readCatalogOperatorDatabaseUrl(
      "development",
      "http://127.0.0.1:54321",
      read(url),
    ) === url,
    "local CLI database accepted for source E2E",
  );
  let threw = false;
  try {
    readCatalogOperatorDatabaseUrl(
      "staging",
      "https://abcdefghijklmnopqrst.supabase.co",
      read(url),
    );
  } catch {
    threw = true;
  }
  assert(threw, "loopback never accepted for staging");
});

Deno.test("operator database URL rejects hosted configuration that cannot bind the exact project ref", () => {
  const url =
    "postgresql://catalog_operator_edge.abcdefghijklmnopqrst:password@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
  for (
    const supabaseUrl of [
      "https://custom.example.com",
      "https://short.supabase.co",
      "not-a-url",
    ]
  ) {
    let threw = false;
    try {
      readCatalogOperatorDatabaseUrl("production", supabaseUrl, read(url));
    } catch {
      threw = true;
    }
    assert(threw, `unbound hosted project rejected: ${supabaseUrl}`);
  }
});
