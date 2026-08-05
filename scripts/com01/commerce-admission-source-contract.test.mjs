#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';

import {
  auditCom01aCommerceSourceSnapshot,
  COM01A_SOURCE_PATHS,
  loadCom01aCommerceSourceSnapshot,
} from './commerce-admission-source-contract.mjs';

const root = resolve(import.meta.dirname, '../..');

function mutate(snapshot, path, change) {
  return Object.freeze({ ...snapshot, [path]: change(snapshot[path]) });
}

function replaceRequired(source, before, after) {
  assert.ok(source.includes(before), `fixture source is missing ${JSON.stringify(before)}`);
  return source.replace(before, after);
}

function assertRejected(snapshot, pattern) {
  const errors = auditCom01aCommerceSourceSnapshot(snapshot);
  assert.match(errors.join('\n'), pattern);
}

test('current COM-01A commerce source snapshot passes', () => {
  assert.deepEqual(auditCom01aCommerceSourceSnapshot(loadCom01aCommerceSourceSnapshot(root)), []);
});

test('missing authority files fail closed', () => {
  const snapshot = { ...loadCom01aCommerceSourceSnapshot(root) };
  delete snapshot[COM01A_SOURCE_PATHS.phase7];
  delete snapshot[COM01A_SOURCE_PATHS.migration];
  const errors = auditCom01aCommerceSourceSnapshot(Object.freeze(snapshot));
  assert.ok(errors.some((error) => /phase7\.ts: required COM-01A authority source is missing/u.test(error)));
  assert.ok(errors.some((error) => /commerce_zero_admission\.sql: required COM-01A authority source is missing/u.test(error)));
});

test('environment and literal capability bypasses are rejected', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.phase7, (source) =>
      replaceRequired(source, 'commerce: false', 'commerce: true'),
    ),
    /phase7Capabilities\.commerce must remain the literal false|phase7Flags\.commerce must remain the literal false/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.phase7,
      (source) => `${source}\nconst commerceBypass = process.env.EXPO_PUBLIC_PHASE7_COMMERCE_ENABLED;\n`,
    ),
    /commerce admission must not depend on an environment flag/u,
  );
});

test('machine admission cannot be opened or extended', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.launchContract, (source) =>
      replaceRequired(source, '"commerceAdmitted": false', '"commerceAdmitted": true'),
    ),
    /commerceAdmission must remain the exact literal-zero COM-01A machine contract/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.launchContract, (source) =>
      replaceRequired(
        source,
        '"analyticsAllowed": false,\n    "disabledPathSideEffectsAllowed": false\n  }',
        '"analyticsAllowed": false,\n    "disabledPathSideEffectsAllowed": false,\n    "fixtureOverride": true\n  }',
      ),
    ),
    /commerceAdmission must remain the exact literal-zero COM-01A machine contract/u,
  );
});

test('direct commerce routes cannot add consent, analytics, or state reads', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.commerceStacksRoute,
      (source) => `${source}\nfunction unsafe() { track('stack_viewed'); }\n`,
    ),
    /disabled direct route must not read state, collect consent, emit analytics/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.commerceConsentRoute,
      (source) => `${source}\nfunction unsafe() { grantCommerceConsent(); }\n`,
    ),
    /disabled direct route must not read state, collect consent/u,
  );
});

test('commerce layout must remain a transparent Slot without refusal or canonicalization', () => {
  const snapshot = mutate(
    loadCom01aCommerceSourceSnapshot(root),
    COM01A_SOURCE_PATHS.commerceLayout,
    () =>
      "import { Slot } from 'expo-router';\n\nexport default function CommerceLayout() {\n  return <Slot />;\n}\n",
  );
  assert.deepEqual(auditCom01aCommerceSourceSnapshot(snapshot), []);

  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.commerceLayout, (source) =>
      replaceRequired(source, 'return <Slot />;', 'return <CommerceDeferredSurface />;'),
    ),
    /commerce layout must be a transparent Slot|commerce layout must not add refusal duplication/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.commerceLayout, (source) =>
      replaceRequired(
        source,
        'return <Slot />;',
        "router.replace('/commerce/stacks');\n  return <Slot />;",
      ),
    ),
    /commerce layout must not add refusal duplication, state, analytics, or navigation/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.commerceLayout, (source) =>
      replaceRequired(
        source,
        "import { Slot } from 'expo-router';\n\nexport default function CommerceLayout() {\n  return <Slot />;",
        "import { Redirect, Slot } from 'expo-router';\n\nexport default function CommerceLayout() {\n  return <Redirect href=\"/commerce/stacks\" />;",
      ),
    ),
    /commerce layout must be a transparent Slot so each direct URL remains exact/u,
  );
});

test('shared commerce recovery cannot regain analytics, network, or unguarded telemetry', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.deferredSurface, (source) =>
      replaceRequired(source, 'if (!trackView) return;', ''),
    ),
    /shared DeferredSurface analytics must remain singly guarded by trackView/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.commerceDeferredSurface,
      (source) => `${source}\nfunction unsafeRecovery() { track('commerce_viewed'); fetch('https://partner.invalid'); }\n`,
    ),
    /shared commerce recovery must contain no analytics, network, state, or navigation side effect|side-effect authority/u,
  );
});

test('concrete commerce routes cannot redirect or canonicalize direct URLs', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.commerceConsentRoute, (source) =>
      replaceRequired(
        replaceRequired(
          source,
          "import { CommerceDeferredSurface } from '@/features/commerce/CommerceDeferredSurface';",
          "import { Redirect } from 'expo-router';\nimport { CommerceDeferredSurface } from '@/features/commerce/CommerceDeferredSurface';",
        ),
        'return <CommerceDeferredSurface />;',
        'return <Redirect href="/commerce/stacks" />;',
      ),
    ),
    /disabled direct route must return only the shared analytics-free unavailable surface|must not read state, collect consent, emit analytics, write clicks, redirect, or canonicalize/u,
  );
});

test('development retailer fixtures and reviewer bypasses are rejected', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.links,
      (source) => `${source}\nconst unsafeRetailer = __DEV__ ? 'https://example.com/buy' : '';\n`,
    ),
    /development, environment, E2E, fixture, or example-retailer bypass/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.stacks,
      (source) => `${source}\nconst unsafeStack = __DEV__ || Boolean('reviewed');\n`,
    ),
    /development, environment, E2E, fixture, or reviewer bypass/u,
  );
});

test('catalog reads and click writes are rejected', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.useCommerce,
      (source) => `${source}\nconst unsafeQuery = supabase.from('affiliate_links');\n`,
    ),
    /must not read consent, query a catalog, or resolve retailer rows|side-effect authority/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.store,
      (source) => `${source}\nasync function unsafeWrite() { await supabase.from('commerce_click_events').insert({}); }\n`,
    ),
    /must not generate tokens, acquire consent leases, read users, or query\/write Supabase/u,
  );
});

test('dormant consent, disclosure, and attribution helpers cannot issue a positive result', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.consentLogic, (source) =>
      replaceRequired(source, 'return false;', 'return true;'),
    ),
    /resolveCommerceConsent\(\) must ignore every status or receipt and return only false/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.disclosureOperation, (source) =>
      replaceRequired(
        source,
        "return 'consent_closed';",
        "await _params.refreshConsent();\n  await _params.finalAction();\n  return 'completed';",
      ),
    ),
    /runCommerceDisclosure\(\) must ignore callbacks and return consent_closed without calls/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.attribution, (source) =>
      replaceRequired(
        source,
        'export function buildOutboundUrl(_retailerUrl: string, _clickToken: string): null {\n  return null;\n}',
        'export function buildOutboundUrl(retailerUrl: string, clickToken: string): string {\n  return `${retailerUrl}?oref=${clickToken}`;\n}',
      ),
    ),
    /buildOutboundUrl\(\) must ignore retailer\/token input and return only null/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.attribution, (source) =>
      replaceRequired(
        source,
        'export function isHealthSafePayload(_payload: Record<string, unknown>): false {\n  return false;\n}',
        'export function isHealthSafePayload(payload: Record<string, unknown>): boolean {\n  return payload.consented === true;\n}',
      ),
    ),
    /isHealthSafePayload\(\) must ignore payload input and return only false/u,
  );
});

test('dormant presentation modules cannot gain a production consumer', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  const probe = 'apps/mobile/src/app/index.tsx';
  assertRejected(
    mutate(
      snapshot,
      probe,
      (source) =>
        `${source}\nimport { CommerceLinkNotice } from '@/features/commerce/CommerceLinkNotice';\nimport { COMMERCE_COPY } from '@/features/commerce/copy';\nimport { LockGlyph } from '@/features/commerce/LockGlyph';\n`,
    ),
    /production commerce consumers must remain the exact disabled-renderer allowlist/u,
  );
  assertRejected(
    mutate(
      snapshot,
      probe,
      (source) =>
        `${source}\nasync function unsafeCommerceImport() { return import('@/features/commerce/copy'); }\n`,
    ),
    /production commerce consumers must remain the exact disabled-renderer allowlist/u,
  );
});

test('computed commerce imports and retired environment consumers are rejected globally', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  const probe = 'apps/mobile/src/app/index.tsx';
  assertRejected(
    mutate(
      snapshot,
      probe,
      (source) =>
        `${source}\nconst commerceModule = '@/features/' + 'commerce/copy';\nasync function unsafeComputedImport() { return import(commerceModule); }\n`,
    ),
    /production commerce consumers must remain the exact disabled-renderer allowlist/u,
  );
  assertRejected(
    mutate(
      snapshot,
      probe,
      (source) => `${source}\nconst unsafeCommerceFlag = env.phase7CommerceEnabled;\n`,
    ),
    /mobile production source must expose no commerce environment flag or consumer/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.envExample,
      (source) => `${source}\nEXPO_PUBLIC_PHASE7_COMMERCE_ENABLED=false\n`,
    ),
    /retired commerce environment input must not remain in configuration or launch tooling/u,
  );
});

test('positive consent mutation is rejected while withdrawal cleanup remains required', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.consent, (source) =>
      replaceRequired(
        source,
        'export async function grantCommerceConsent(): Promise<never> {\n  throw new Error(COMMERCE_ADMISSION_CLOSED);\n}',
        "export async function grantCommerceConsent(): Promise<void> {\n  await grantHealthDependentConsent('data_sharing');\n}",
      ),
    ),
    /grantCommerceConsent\(\) must throw COMMERCE_ADMISSION_CLOSED before every call/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.consent, (source) =>
      source.replaceAll('withdrawHealthDependentConsent', 'removedWithdrawal'),
    ),
    /explicit withdrawal, refusal, and legacy local cleanup must remain available/u,
  );
});

test('Shelf replenishment and You cannot retain commerce entry points', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.replenishRoute,
      (source) => `${source}\nconst unsafe = 'See similar options at /commerce/consent';\n`,
    ),
    /Shelf replacement must contain no commerce import, consent read, similar CTA/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.youRoute,
      (source) => `${source}\nconst unsafe = isCommerceConsented();\n`,
    ),
    /You must not read commerce consent or retain commerce routes\/toggles/u,
  );
});

test('provider credentials cannot activate order polling', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.orderReportPoll,
      (source) =>
        `${source}\nconst unsafeKey = Deno.env.get('SHOPMY_BRAND_API_KEY');\nasync function unsafePoll() { return fetch('https://api.shopmy.us'); }\n`,
    ),
    /credentials, scheduler input, or environment state must not admit provider polling/u,
  );
});

test('dormant order-attribution core and alternate server consumers stay inventoried', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.orderAttributionCore,
      (source) => `${source}\nasync function unsafeProviderCall() { return fetch('https://partner.invalid'); }\n`,
    ),
    /dormant order-attribution core must contain no provider credential, network, or database authority|side-effect authority/u,
  );
  assertRejected(
    Object.freeze({
      ...snapshot,
      'supabase/functions/unsafe-commerce/index.ts':
        "const key = Deno.env.get('SHOPMY_KEY');\nexport async function run() { return fetch(key); }\n",
    }),
    /server commerce authority references must remain the exact reviewed export, cleanup, and dormant-core allowlist/u,
  );
  assertRejected(
    mutate(
      snapshot,
      'supabase/functions/data-export/exportRegistry.ts',
      (source) =>
        `${source}\nimport { pollOrderReportPages } from '../order-report-poll/orderAttributionCore.ts';\n`,
    ),
    /dormant order-attribution core must have no production server consumer/u,
  );
});

test('database publication reads and click inserts cannot be restored', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.migration,
      (source) =>
        `${source}\ngrant select on table public.affiliate_links to authenticated;\ngrant insert on table public.commerce_click_events to authenticated;\n`,
    ),
    /must not restore authenticated commerce publication reads or click inserts/u,
  );
});

test('legacy ambient commerce ACLs converge on the deterministic cleanup-only boundary', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.migration, (source) =>
      replaceRequired(
        source,
        'revoke all on table public.affiliate_links\n  from public, anon, authenticated, service_role;',
        'revoke all on table public.affiliate_links\n  from public, anon, authenticated;',
      ),
    ),
    /must revoke every ambient runtime ACL from commerce publication tables/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.migration, (source) =>
      replaceRequired(
        source,
        'grant select, delete on table public.commerce_click_events\n  to authenticated, service_role;',
        'grant select, delete on table public.commerce_click_events\n  to authenticated;',
      ),
    ),
    /click runtime ACL must converge old and new projects on owner\/service read-delete only/u,
  );
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.migration,
      (source) =>
        `${source}\ngrant update on table public.commerce_click_events to service_role;\n`,
    ),
    /click runtime ACL must converge old and new projects on owner\/service read-delete only/u,
  );
});

test('stale pollers cannot regain order-attribution publication authority', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(
      snapshot,
      COM01A_SOURCE_PATHS.migration,
      (source) =>
        `${source}\ngrant insert on table public.order_attributions to service_role;\n`,
    ),
    /order attribution runtime ACL must allow only service read\/delete and click-token detachment/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.migration, (source) =>
      replaceRequired(source, "old.click_token is not null", 'true'),
    ),
    /order attribution trigger must reject inserts and permit only exact non-null-to-null token detachment/u,
  );
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.databaseContract, (source) =>
      replaceRequired(
        source,
        'even a privileged stale poller cannot publish a new order attribution',
        'removed attribution insert proof',
      ),
    ),
    /database pgTAP must prove attribution publication rejection and exact legacy cleanup/u,
  );
});

test('WhereToBuy cannot inspect provenance or mount runtime effects', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    mutate(snapshot, COM01A_SOURCE_PATHS.whereToBuy, (source) =>
      source.replace(
        /return null;/u,
        "if (provenance) track('where_to_buy_visible');\n  return null;",
      ),
    ),
    /must ignore caller provenance and return only null without calls|side-effect authority/u,
  );
});

test('un-inventoried commerce source is rejected', () => {
  const snapshot = loadCom01aCommerceSourceSnapshot(root);
  assertRejected(
    Object.freeze({
      ...snapshot,
      'apps/mobile/src/features/commerce/unsafeBypass.ts':
        "export const enabled = true;\n",
    }),
    /complete commerce source inventory must include every app and feature source/u,
  );
});
