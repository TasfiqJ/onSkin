// COM-01A commerce zero-admission boundary.
//
// The Order Report adapter remains available as separately tested, inert source
// for a future reviewed rail. This deployed handler intentionally reads no
// commerce credential, calls no provider, creates no Supabase client, and writes
// no attribution. An environment variable is configuration, not publication
// authority. Reopening requires a later reviewed source migration and handler
// revision after COM-01 through COM-04 are genuinely cleared.
import { stagingTrafficFreezeResponse } from "../_shared/stagingTrafficFreeze.ts";

function json(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

Deno.serve((req) => {
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, { Allow: "POST" });
  }

  return json({
    ok: true,
    skipped: "COM-01A: commerce admission closed",
  });
});
