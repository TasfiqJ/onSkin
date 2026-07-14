// Durable in-app account deletion. JWT verification is intentionally handled
// inside this function because capability-only status and the scheduler lane
// are unauthenticated by Supabase Auth and use separate high-entropy secrets.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { readSupabaseSecretKey } from '../_shared/supabaseSecretKey.ts';
import { createDurableDeletionHttpHandler } from './durableDeletionHttpHandler.ts';
import {
  createDurableDeletionRuntime,
  type DurableDeletionRuntimeClient,
} from './durableDeletionRuntime.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
if (!/^https:\/\/[a-z0-9.-]+$/i.test(supabaseUrl)) {
  throw new Error('DELETION_RUNTIME_CONFIGURATION_INVALID');
}

const client = createClient(supabaseUrl, readSupabaseSecretKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
}) as unknown as DurableDeletionRuntimeClient;

function schedule(work: Promise<void>): void {
  const edgeRuntime = (
    globalThis as unknown as {
      EdgeRuntime?: { waitUntil?: (promise: Promise<void>) => void };
    }
  ).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === 'function') {
    edgeRuntime.waitUntil(work);
    return;
  }
  // Local emulation has no EdgeRuntime. The promise has already started and
  // has its rejection contained by the HTTP handler; the Cron lane remains
  // authoritative in production.
  void work;
}

const dependencies = await createDurableDeletionRuntime({ client, schedule });
Deno.serve(createDurableDeletionHttpHandler(dependencies));
