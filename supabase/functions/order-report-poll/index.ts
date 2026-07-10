// ShopMy Order-Report poll -> order_attributions ingestion (docs/10 §5).
// Runs on Supabase Edge (Deno) with the service-role key (bypasses RLS), invoked on a
// schedule (pg_cron, daily). *** ShopMy has NO webhooks *** — attribution reporting is
// poll-only, so this scheduled job is the only path commission/order data reaches the
// commerce wall. order_attributions is SERVICE-ROLE ONLY (RLS deny-all to clients), so
// commission data never touches the ranking path or a user (church and state, D-058).
//
// Deploy: `supabase functions deploy order-report-poll --no-verify-jwt`
// Schedule (pg_cron): select cron.schedule('order-report-poll','0 9 * * *', ...)
//
// *** BLOCKED: B-SHOPMY — this is an INERT STUB. ***
// The build-time-unconfirmed items (the deep-research pass, D-059): (1) ShopMy API
// access is GATED to approved partners; (2) it is UNCONFIRMED that a brand/app can mint
// links on its OWN first-party recommendations under a house account (link creation is
// creator-OAuth-only; this Brand Partners "Fetch Order Report" API is reporting-only).
// Until partnerships confirms the account model + provisions a brand API key, this
// no-ops. The shape below documents the poll contract so it stays version-controlled.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { fetchWithTimeout, readLimitedResponseJson } from '../_shared/fetch.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey =
  Deno.env.get('SUPABASE_SECRET_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const shopmyBrandKey = Deno.env.get('SHOPMY_BRAND_API_KEY') ?? ''; // BLOCKED: B-SHOPMY
const schedulerSecret =
  Deno.env.get('ORDER_REPORT_POLL_SECRET') ?? Deno.env.get('SHOPMY_ORDER_REPORT_POLL_SECRET') ?? '';

// The documented Fetch Order Report contract (verified against docs.shopmy.us):
//   POST https://api.shopmy.us/api/v1/Partners/OrderReport
//   headers: { 'x-api-key': <brand key> }
//   body: { recordUpdatedStartDate, recordUpdatedEndDate, page, pageSize<=500 }
//   limits: 200 requests/day; 500 records/page (~100k orders/day).
// Incremental key: record_updated_at — re-poll the 30–120-day pending window so
// 'pending' commissions flip to 'locked'/'returned' as retailers settle.
const ORDER_REPORT_URL = 'https://api.shopmy.us/api/v1/Partners/OrderReport';
const PAGE_SIZE = 500;

type ShopMyOrder = {
  orderId: string;
  orderAmountUSD?: number;
  commissionAmountUSD?: number;
  status?: string; // pending | locked | returned
  transactionDate?: string;
  recordUpdatedDate?: string;
  clickToken?: string;
};
type ShopMyOrderReport = { orders?: ShopMyOrder[] };

function mapStatus(s: string | undefined): 'pending' | 'locked' | 'returned' {
  const u = (s ?? '').toLowerCase();
  return u === 'locked' ? 'locked' : u === 'returned' ? 'returned' : 'pending';
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function authorizedSchedulerRequest(req: Request): boolean {
  if (!schedulerSecret) return false;
  const authHeader = req.headers.get('Authorization') ?? '';
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i)?.[1] ?? '';
  const schedulerHeader = req.headers.get('x-scheduler-secret') ?? '';
  return (
    constantTimeEqual(bearer, schedulerSecret) ||
    constantTimeEqual(schedulerHeader, schedulerSecret)
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });

  // INERT until B-SHOPMY: no brand key => no poll. Returns 200 so a scheduler treats it
  // as a successful no-op rather than retrying.
  if (!shopmyBrandKey) {
    return json({ ok: true, skipped: 'B-SHOPMY: no brand API key (poll inert)' });
  }
  if (!schedulerSecret) return json({ error: 'scheduler_secret_not_configured' }, 503);
  if (!authorizedSchedulerRequest(req)) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  // Incremental: poll from the last record_updated_at we ingested (re-cover the pending
  // window). For the stub, a fixed 30-day lookback documents the intent.
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const until = new Date().toISOString();

  let page = 1;
  let upserted = 0;
  // The real loop paginates until a short page; capped here to respect 200 req/day.
  for (; page <= 200; page++) {
    const res = await fetchWithTimeout(ORDER_REPORT_URL, {
      method: 'POST',
      headers: { 'x-api-key': shopmyBrandKey, 'content-type': 'application/json' },
      body: JSON.stringify({
        recordUpdatedStartDate: since,
        recordUpdatedEndDate: until,
        page,
        pageSize: PAGE_SIZE,
      }),
    }).catch(() => null);
    if (!res?.ok) break;
    const orders = ((await readLimitedResponseJson<ShopMyOrderReport>(res))?.orders ??
      []) as ShopMyOrder[];
    if (orders.length === 0) break;

    // Idempotent upsert on external_order_id (the report is re-polled as statuses
    // settle). NO health-adjacent field is read or stored — only the opaque clickToken.
    const rows = orders.map((o) => ({
      external_order_id: o.orderId,
      click_token: o.clickToken ?? null,
      order_amount_cents: o.orderAmountUSD != null ? Math.round(o.orderAmountUSD * 100) : null,
      commission_cents:
        o.commissionAmountUSD != null ? Math.round(o.commissionAmountUSD * 100) : null,
      status: mapStatus(o.status),
      transaction_date: o.transactionDate ?? null,
      record_updated_at: o.recordUpdatedDate ?? null,
    }));
    await supabase.from('order_attributions').upsert(rows, { onConflict: 'external_order_id' });
    upserted += rows.length;
    if (orders.length < PAGE_SIZE) break;
  }

  return json({ ok: true, upserted });
});
