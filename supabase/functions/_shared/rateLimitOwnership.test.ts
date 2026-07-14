function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function compact(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function occurrences(value: string, pattern: string): number {
  return value.split(pattern).length - 1;
}

const authenticatedCallers = [
  {
    name: 'data-export',
    url: new URL('../data-export/index.ts', import.meta.url),
    authClient: 'supabase',
    invocation: 'enforceRateLimit(admin, userId)',
  },
  {
    name: 'catalog-search',
    url: new URL('../catalog-search/index.ts', import.meta.url),
    authClient: 'caller',
    invocation: "enforceRateLimit(admin, 'catalog-search', userId)",
  },
  {
    name: 'catalog-lookup',
    url: new URL('../catalog-lookup/index.ts', import.meta.url),
    authClient: 'caller',
    invocation: "enforceRateLimit(admin, 'catalog-lookup', userId)",
  },
] as const;

for (const caller of authenticatedCallers) {
  Deno.test(`${caller.name} binds its rate-limit row to the verified Auth owner`, async () => {
    const source = compact(await Deno.readTextFile(caller.url));

    assert(
      source.includes(`await ${caller.authClient}.auth.getUser()`),
      `${caller.name} must verify the bearer token with Auth before rate limiting`,
    );
    assert(
      source.includes('const userId = userData.user?.id'),
      `${caller.name} must derive the owner only from the verified Auth result`,
    );
    assert(
      source.includes(caller.invocation),
      `${caller.name} must pass the verified Auth owner into its rate-limit helper`,
    );
    assert(
      source.includes('p_owner_user_id: userId'),
      `${caller.name} must use the five-argument owner-aware rate-limit overload`,
    );
    assert(
      occurrences(source, 'p_owner_user_id:') === 1,
      `${caller.name} must have exactly one explicit rate-limit owner binding`,
    );
    assert(
      source.includes('p_key_hash: keyHash') && !source.includes('p_key_hash: userId'),
      `${caller.name} must keep the bucket key HMAC-derived instead of storing the raw user ID as its key`,
    );
  });
}

const publicCallers = [
  {
    name: 'growth-event',
    url: new URL('../growth-event/index.ts', import.meta.url),
  },
  {
    name: 'waitlist',
    url: new URL('../waitlist/index.ts', import.meta.url),
  },
] as const;

for (const caller of publicCallers) {
  Deno.test(`${caller.name} keeps public rate-limit identity hash-only`, async () => {
    const source = compact(await Deno.readTextFile(caller.url));

    assert(
      source.includes("rpc('consume_edge_rate_limit', {") && source.includes('p_key_hash: keyHash'),
      `${caller.name} must pass only its derived key hash to the public rate-limit RPC`,
    );
    assert(
      !source.includes('p_owner_user_id:'),
      `${caller.name} must stay on the four-argument public overload without a raw owner ID`,
    );
    assert(
      !source.includes('p_key_hash: clientAddress(req)') &&
        !source.includes('p_key_hash: userAgent'),
      `${caller.name} must not pass raw client identifiers as the persisted bucket key`,
    );
    assert(
      source.includes('const keyHash = await hmacSha256Hex('),
      `${caller.name} must HMAC its public client inputs before the RPC`,
    );
  });
}
