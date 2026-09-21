import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL('../../migrations/20260729000072_commerce_zero_admission.sql', import.meta.url),
  'utf8',
);
const databaseContract = readFileSync(
  new URL('../../tests/database/commerce_zero_admission.test.sql', import.meta.url),
  'utf8',
);
const upgradeContract = readFileSync(
  new URL('../../tests/upgrade/commerce_zero_admission_0072_upgrade.test.sql', import.meta.url),
  'utf8',
);

test('the deployed Order Report handler is literal source-inert', () => {
  assert.match(source, /COM-01A: commerce admission closed/u);
  assert.match(source, /req\.method !== ["']POST["']/u);
  assert.match(source, /method_not_allowed/u);

  for (const forbidden of [
    /Deno\.env\.get/u,
    /SHOPMY_/u,
    /ORDER_REPORT_POLL_SECRET/u,
    /createClient/u,
    /fetchWithTimeout/u,
    /pollOrderReportPages/u,
    /\.from\(['"]order_attributions['"]\)/u,
    /\.upsert\(/u,
    /Authorization:\s*`Bearer/u,
    /api\.shopmy\.us/u,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
});

test('the closed handler retains only traffic-freeze and method guards before refusal', () => {
  assert.match(
    source,
    /stagingTrafficFreezeResponse\(\)[\s\S]*req\.method !== ["']POST["'][\s\S]*COM-01A: commerce admission closed/u,
  );
  assert.doesNotMatch(source, /\belse\b/u);
});

test('migration 0072 revokes publication and stale-poller writes without revoking cleanup', () => {
  assert.match(migration, /^\s*--[\s\S]*\bbegin;\s*$/mu);
  assert.match(migration, /\bcommit;\s*$/u);
  assert.match(migration, /check \(admission_state = 'closed'\)/u);
  assert.match(migration, /check \(checkpoint = 'com01a_zero_admission'\)/u);
  assert.match(migration, /check \(reason_code = 'approved_rail_not_admitted'\)/u);

  for (const table of ['affiliate_links', 'creator_stacks', 'creator_stack_items']) {
    assert.match(
      migration,
      new RegExp(
        `revoke all on table public\\.${table}\\s+from public, anon, authenticated, service_role;`,
        'u',
      ),
    );
  }

  assert.match(migration, /drop policy if exists "commerce_click_events_insert_own"/u);
  assert.match(migration, /drop policy if exists "commerce_click_events_consent_insert"/u);
  assert.match(
    migration,
    /revoke all on table public\.commerce_click_events\s+from public, anon, authenticated, service_role;/u,
  );
  assert.match(
    migration,
    /grant select, delete on table public\.commerce_click_events\s+to authenticated, service_role;/u,
  );
  assert.match(migration, /before insert or update\s+on public\.commerce_click_events/u);
  assert.match(migration, /raise exception 'COMMERCE_ADMISSION_CLOSED'/u);
  assert.match(
    migration,
    /revoke all on table public\.order_attributions\s+from public, anon, authenticated, service_role;/u,
  );
  assert.match(
    migration,
    /grant select, delete on table public\.order_attributions\s+to service_role;/u,
  );
  assert.match(
    migration,
    /grant update \(click_token\) on table public\.order_attributions\s+to service_role;/u,
  );
  assert.match(migration, /before insert or update\s+on public\.order_attributions/u);
  assert.match(migration, /old\.click_token is not null/u);
  assert.match(migration, /new\.click_token is null/u);
  assert.match(migration, /pg_catalog\.to_jsonb\(new\) - 'click_token'/u);
  assert.match(migration, /pg_catalog\.to_jsonb\(old\) - 'click_token'/u);
  assert.match(migration, /raise exception 'COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED'/u);
});

test('pgTAP contracts bind exact head and forward-only 0071 to 0072 cutover', () => {
  assert.match(databaseContract, /select plan\(23\)/u);
  assert.match(databaseContract, /'20260921000075'::text/u);
  assert.match(databaseContract, /COMMERCE_ADMISSION_CONTROL_MIGRATION_OWNED/u);
  assert.match(databaseContract, /COMMERCE_ADMISSION_CLOSED/u);
  assert.match(databaseContract, /COMMERCE_ORDER_ATTRIBUTION_PUBLICATION_CLOSED/u);
  assert.match(databaseContract, /owner read\/delete policies remain/u);
  assert.match(databaseContract, /service data-rights deletion and attribution detachment/u);
  assert.match(databaseContract, /privileged stale poller cannot publish a new order attribution/u);
  assert.match(databaseContract, /token detachment cannot camouflage a business-field update/u);
  assert.match(databaseContract, /installed-base attribution deletion remains available/u);

  assert.match(upgradeContract, /select plan\(21\)/u);
  assert.match(upgradeContract, /Forward-only 0071 -> 0072 rehearsal/u);
  assert.match(upgradeContract, /@@INCLUDE_EXACT_0072_MIGRATION@@/u);
  assert.match(upgradeContract, /retains the legacy affiliate row without publishing it/u);
  assert.match(upgradeContract, /preserves deletion of an installed-base click/u);
  assert.match(upgradeContract, /post-upgrade attribution insert guard/u);
  assert.match(upgradeContract, /preserves exact installed-base attribution detachment/u);
  assert.match(upgradeContract, /preserves installed-base attribution deletion/u);
  assert.match(upgradeContract, /leaves no permissive commerce publication policy/u);
});
