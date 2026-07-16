// ShopMy Order-Report poll -> order_attributions ingestion (docs/10 §5).
// Runs on Supabase Edge with the service-role key on an authenticated schedule.
// ShopMy has no webhook; this poll is the only commission/order ingestion path.
//
// BLOCKED: B-SHOPMY. Without an approved brand API key this stays an inert no-op.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { stagingTrafficFreezeResponse } from '../_shared/stagingTrafficFreeze.ts';
import { fetchWithTimeout, readLimitedResponseJson } from '../_shared/fetch.ts';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import {
  ORDER_ATTRIBUTION_PERSIST_FAILED,
  ORDER_REPORT_MAX_PAGES,
  ORDER_REPORT_PAGE_SIZE,
  normalizeShopMyBrandDomain,
  orderReportFailure,
  persistOrderAttributionPage,
  pollOrderReportPages,
} from './orderAttributionCore.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = readSupabaseSecretKey();
const shopmyBrandKey = Deno.env.get('SHOPMY_BRAND_API_KEY') ?? '';
const shopmyBrandDomain = normalizeShopMyBrandDomain(Deno.env.get('SHOPMY_BRAND_DOMAIN'));
const schedulerSecret =
  Deno.env.get('ORDER_REPORT_POLL_SECRET') ?? Deno.env.get('SHOPMY_ORDER_REPORT_POLL_SECRET') ?? '';

// Official brand-partner contract: docs.shopmy.us/reference/fetch-order-report
// Pages are zero-indexed, `limit` is at most 500, and production permits 200
// requests/day. The bounded record-updated window captures provider corrections
// without assigning undocumented attribution or commission-status semantics.
const ORDER_REPORT_URL = 'https://api.shopmy.us/v1/Partners/OrderReport';

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let index = 0; index < max; index += 1) {
    diff |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return diff === 0;
}

function shopMyUtcTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19);
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
  const frozen = stagingTrafficFreezeResponse();
  if (frozen) return frozen;
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405, { Allow: 'POST' });

  if (!shopmyBrandKey) {
    return json({ ok: true, skipped: 'B-SHOPMY: no brand API key (poll inert)' });
  }
  if (!schedulerSecret) return json({ error: 'scheduler_secret_not_configured' }, 503);
  if (!shopmyBrandDomain) return json({ error: 'shopmy_brand_domain_not_configured' }, 503);
  if (!authorizedSchedulerRequest(req)) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(supabaseUrl, serviceKey);
  const until = new Date();
  const since = new Date(until.getTime() - 30 * 86_400_000);

  try {
    const upserted = await pollOrderReportPages(
      {
        recordUpdatedStartDate: shopMyUtcTimestamp(since),
        recordUpdatedEndDate: shopMyUtcTimestamp(until),
        pageSize: ORDER_REPORT_PAGE_SIZE,
        maxPages: ORDER_REPORT_MAX_PAGES,
      },
      {
        fetchPage(request) {
          return fetchWithTimeout(ORDER_REPORT_URL, {
            method: 'POST',
            redirect: 'error',
            headers: {
              Authorization: `Bearer ${shopmyBrandKey}`,
              Accept: 'application/json',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              domain: shopmyBrandDomain,
              ...request,
            }),
          });
        },
        readJson(response) {
          return readLimitedResponseJson<unknown>(response);
        },
        persistPage(orders) {
          return persistOrderAttributionPage(orders, {
            async findKnownClickTokens(tokens) {
              if (tokens.length === 0) return [];
              const { data, error } = await supabase
                .from('commerce_click_events')
                .select('click_token')
                .in('click_token', [...tokens]);
              if (error || !Array.isArray(data)) {
                throw new Error(ORDER_ATTRIBUTION_PERSIST_FAILED);
              }
              return data
                .map((row: { click_token?: unknown }) => row.click_token)
                .filter((token: unknown): token is string => typeof token === 'string');
            },
            async upsertOrderAttributions(rows) {
              const { error } = await supabase
                .from('order_attributions')
                .upsert([...rows], { onConflict: 'external_order_id' });
              if (error) throw new Error(ORDER_ATTRIBUTION_PERSIST_FAILED);
            },
          });
        },
      },
    );
    return json({ ok: true, upserted });
  } catch (error) {
    const failure = orderReportFailure(error);
    console.warn(failure.logCode);
    return json({ error: failure.publicCode }, failure.status);
  }
});
