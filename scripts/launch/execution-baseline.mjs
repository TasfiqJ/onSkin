import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

export const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));

export const baselinePaths = {
  plan: 'docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md',
  launchContract: 'docs/hugeToDo/launch-contract.json',
  featureInventory: 'docs/hugeToDo/feature-inventory.json',
  executionStatus: 'docs/hugeToDo/execution-status.json',
  taskGraph: 'docs/hugeToDo/task-graph.json',
  credentials: 'docs/hugeToDo/credential-inventory.json',
  evidenceGovernance: 'docs/hugeToDo/evidence-governance.json',
  worktreeBoundary: 'docs/hugeToDo/worktree-boundary.json',
};

export const readinessLabels = [
  'implemented',
  'stubbed',
  'simulated',
  'inert',
  'needs-device-verification',
  'launch-blocked',
];

export const features = [
  ['F-01', 1, 'brand_identity', 'Rebrand and identity migration', 'launch-blocked'],
  ['F-02', 2, 'onboarding_consent', 'Onboarding, age gate, and consent', 'implemented'],
  [
    'F-03',
    3,
    'shelf_intake',
    'Shelf intake through manual entry, search, barcode, and real OCR',
    'needs-device-verification',
  ],
  ['F-04', 4, 'catalog', 'Production product catalog import and quality', 'stubbed'],
  ['F-05', 5, 'conflict_engine', 'Reviewed conflict engine', 'launch-blocked'],
  ['F-06', 6, 'routine_builder', 'Routine builder', 'implemented'],
  ['F-07', 7, 'today_adherence', 'Today check-off and adherence', 'implemented'],
  ['F-08', 8, 'cycle_scheduler', 'Skin cycling and ramp scheduler', 'implemented'],
  ['F-09', 9, 'photo_progress', 'Private photo progress', 'needs-device-verification'],
  ['F-10', 10, 'reminders', 'Reminders', 'needs-device-verification'],
  ['F-11', 11, 'subscriptions', 'RevenueCat paywall and entitlements', 'stubbed'],
  ['F-12', 12, 'reverse_trial', 'Reverse trial', 'simulated'],
  ['F-13', 13, 'recommendations', 'Recommendations', 'launch-blocked'],
  ['F-14', 14, 'ask_advisor', 'Ask advisor, including the production cloud path', 'launch-blocked'],
  ['F-15', 15, 'conflict_share', 'Shareable conflict cards', 'launch-blocked'],
  ['F-16', 16, 'commerce', 'Commerce and replenishment', 'inert'],
  ['F-17', 17, 'community', 'Community and Skin Notes', 'stubbed'],
  ['F-18', 18, 'trend_insights', 'Trend insights', 'launch-blocked'],
  ['F-19', 19, 'widgets_live_activities', 'Widgets and Live Activities', 'inert'],
  ['F-20', 20, 'admin_tooling', 'Admin and operator review tooling', 'implemented'],
].map(([id, number, key, name, readiness]) => ({ id, number, key, name, readiness }));

export const gatedSurfaces = [
  ['P7-CLOUD-ASK', ['cloud_ask'], 'Cloud Ask', 'F-14'],
  ['P7-COMMERCE', ['commerce'], 'Commerce and order polling', 'F-16'],
  [
    'P7-COMMUNITY',
    ['community_posting', 'community_aggregates'],
    'Community posting and public aggregates',
    'F-17',
  ],
  ['P7-TRENDS', ['trend_insights'], 'Trend insights', 'F-18'],
  ['P7-WIDGETS', ['widgets', 'live_activities'], 'Widgets and Live Activities', 'F-19'],
  ['P7-SHARE-CARDS', ['share_cards'], 'Share cards', 'F-15'],
  ['P7-CONFLICT-SHARING', ['reviewed_conflict_sharing'], 'Reviewed conflict sharing', 'F-05'],
  [
    'P7-GOAL-RECOMMENDATIONS',
    ['goal_active_recommendations'],
    'Goal-active recommendations',
    'F-13',
  ],
  ['P8-PUBLIC-LINKS', ['public_links'], 'Public links', 'F-15'],
  ['P8-REVIEW-PROMPT', ['review_prompts'], 'Review prompts', 'F-01'],
  ['P8-CREATOR-LINKS', ['creator_links'], 'Creator links', 'F-16'],
  ['P8-PAID-MEASUREMENT', ['paid_measurement'], 'Paid measurement', 'F-20'],
].map(([id, surfaceKeys, name, featureId]) => ({ id, surfaceKeys, name, featureId }));

export function repoPath(path) {
  return path.replaceAll('\\', '/');
}

export function readRepo(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

export function readJson(path) {
  return JSON.parse(readRepo(path));
}

export function stableJson(value) {
  return format(JSON.stringify(value), { parser: 'json', printWidth: 100 });
}

export function exactSetProblems(label, expected, actual) {
  const problems = [];
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  if (missing.length) problems.push(`${label} is missing: ${missing.join(', ')}`);
  if (extra.length) problems.push(`${label} has unknown entries: ${extra.join(', ')}`);
  if (actual.length !== new Set(actual).size) problems.push(`${label} contains duplicate entries.`);
  return problems;
}

function walk(directory) {
  const absolute = resolve(root, directory);
  if (!existsSync(absolute)) return [];
  const files = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const path = join(absolute, entry.name);
    if (entry.isDirectory()) files.push(...walk(repoPath(relative(root, path))));
    else files.push(repoPath(relative(root, path)));
  }
  return files.sort();
}

export function parsePlanRows() {
  const rows = [];
  for (const line of readRepo(baselinePaths.plan).split(/\r?\n/)) {
    const match = line.match(/^\|\s*([A-Z]+-\d{2})\s*\|/);
    if (!match) continue;
    const cells = line
      .slice(1, -1)
      .split('|')
      .map((cell) => cell.trim());
    rows.push({
      id: match[1],
      owner: cells[1],
      deliverable: cells[2],
      acceptance: cells[3],
    });
  }
  return rows;
}

export function discoverRuntimeCredentialNames() {
  const files = [
    'apps/mobile/app.config.js',
    ...walk('apps/mobile/src'),
    ...walk('supabase/functions'),
  ].filter((path) => /\.(?:ts|tsx|js)$/.test(path) && !/\.(?:test|spec)\./.test(path));
  const names = new Set();
  for (const path of files) {
    const source = readRepo(path);
    for (const match of source.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) names.add(match[1]);
    for (const match of source.matchAll(/Deno\.env\.get\(['"]([A-Z][A-Z0-9_]+)['"]\)/g))
      names.add(match[1]);
  }
  return [...names]
    .filter(
      (name) =>
        /(?:KEY|KEY_ID|TOKEN|SECRET|PASSWORD|PRIVATE_KEY|DSN|CLIENT_ID|TEAM_ID|PROJECT_ID|ISSUER_ID|ORG)$/.test(
          name,
        ) || ['APPLE_SIWA_SERVICE_ID', 'POSTHOG_ENVIRONMENT_ID'].includes(name),
    )
    .sort();
}

function featureReadiness(featureIds) {
  const ranks = new Map(readinessLabels.map((label, index) => [label, index]));
  return featureIds
    .map((id) => features.find((feature) => feature.id === id)?.readiness)
    .filter(Boolean)
    .sort((left, right) => ranks.get(right) - ranks.get(left))[0];
}

function routeFeatures(path) {
  if (path === 'apps/mobile/src/app/index.tsx') return ['F-02'];
  if (path.includes('/(tabs)/today.')) return ['F-07', 'F-08'];
  if (path.includes('/(tabs)/shelf.')) return ['F-03', 'F-04'];
  if (path.includes('/(tabs)/progress.')) return ['F-09'];
  if (path.includes('/(tabs)/you.') || path.includes('/settings/')) {
    if (path.includes('subscription')) return ['F-11', 'F-12'];
    if (path.includes('notifications')) return ['F-10'];
    if (path.includes('skin-profile')) return ['F-02', 'F-05'];
    return ['F-02', 'F-20'];
  }
  if (path.includes('/onboarding/')) {
    if (path.includes('products')) return ['F-02', 'F-03'];
    if (path.includes('notifications')) return ['F-02', 'F-10'];
    if (path.includes('paywall')) return ['F-02', 'F-11', 'F-12'];
    return ['F-02'];
  }
  if (path.includes('/shelf/replenish')) return ['F-03', 'F-16'];
  if (path.includes('/shelf/')) return ['F-03', 'F-04'];
  if (path.includes('/conflict/')) return ['F-05'];
  if (path.includes('/routine/widgets')) return ['F-19'];
  if (path.includes('/routine/ramp')) return ['F-08'];
  if (path.includes('/routine/streak') || path.includes('/routine/welcome-back')) return ['F-07'];
  if (path.includes('/routine/')) return ['F-06', 'F-08'];
  if (path.includes('/cycle/')) return ['F-08'];
  if (path.includes('/photos/') || path.includes('/progress/')) return ['F-09'];
  if (path.includes('/paywall/')) return ['F-11', 'F-12'];
  if (path.includes('/recommendations/')) return ['F-13'];
  if (path.includes('/ask/')) return ['F-14'];
  if (path.includes('/share/') || path.includes('/s/')) return ['F-15'];
  if (path.includes('/commerce/')) return ['F-16'];
  if (path.includes('/community/ask')) return ['F-14', 'F-17'];
  if (path.includes('/community/')) return ['F-17'];
  if (path.includes('/trend/')) return ['F-18'];
  if (path.endsWith('/_layout.tsx')) return ['F-02'];
  return [];
}

function flagFeatures(name) {
  if (name.includes('NATIVE_CAMERA')) return ['F-03', 'F-09'];
  if (name.includes('NATIVE_OCR') || name.includes('OBF_API')) return ['F-03', 'F-04'];
  if (name.includes('OBF_CONTRIBUTION')) return ['F-04'];
  if (name.includes('CLOUD_ASK')) return ['F-14'];
  if (name.includes('COMMERCE') || name.includes('CREATOR_LINKS')) return ['F-16'];
  if (name.includes('COMMUNITY')) return ['F-17'];
  if (name.includes('TREND')) return ['F-18'];
  if (name.includes('WIDGETS')) return ['F-19'];
  if (
    name.includes('SHARE_CARD') ||
    name.includes('CONFLICT_SHARING') ||
    name.includes('PUBLIC_LINKS')
  )
    return ['F-15'];
  if (name.includes('RECOMMENDATIONS')) return ['F-13'];
  if (name.includes('REVIEW_PROMPT')) return ['F-01'];
  if (name.includes('PAID_MEASUREMENT')) return ['F-20'];
  if (name.includes('APP_LOCK')) return ['F-09'];
  return [];
}

function nativeFeatures(name) {
  if (/camera/i.test(name)) return ['F-03', 'F-09'];
  if (/face-detection|image|file-system|local-authentication|secure-store|crypto/i.test(name))
    return ['F-09'];
  if (/notification|device|application/i.test(name)) return ['F-10', 'F-19'];
  if (/purchases/i.test(name)) return ['F-11', 'F-12'];
  if (/sharing|view-shot/i.test(name)) return ['F-15'];
  if (/store-review/i.test(name)) return ['F-01'];
  if (/apple-authentication|google-signin|web-browser|linking/i.test(name)) return ['F-02'];
  if (/sentry/i.test(name)) return ['F-20'];
  return ['F-02', 'F-03', 'F-06', 'F-07'];
}

function dataFeatures(name) {
  const value = name.toLowerCase();
  if (value.includes('/trend/')) return ['F-18'];
  if (/photo/.test(value)) return ['F-09', ...(value.includes('trend') ? ['F-18'] : [])];
  if (/community|moderation|reaction|topic|question/.test(value)) return ['F-17'];
  if (/affiliate|commerce|order_attribution|creator_stack/.test(value)) return ['F-16'];
  if (/ask_/.test(value) || value.includes('/ask/')) return ['F-14'];
  if (/recommendation/.test(value)) return ['F-13'];
  if (/entitlement|subscription|reverse_trial/.test(value)) return ['F-11', 'F-12'];
  if (/notification/.test(value)) return ['F-10'];
  if (/streak|completion|\/today\//.test(value)) return ['F-07'];
  if (/cycle|ramp/.test(value)) return ['F-08'];
  if (/routine/.test(value)) return ['F-06'];
  if (/conflict|sequencing|ingredient_tag/.test(value)) return ['F-05'];
  if (/user_product|shelf|opened|pao/.test(value)) return ['F-03'];
  if (/product|catalog|brand|ingredient|obf/.test(value)) return ['F-04'];
  if (/consent|profile|agegate|skinprofile|applock|largesecure/.test(value)) return ['F-02'];
  if (/growth|waitlist|edge_rate/.test(value)) return ['F-20'];
  return [];
}

function edgeFeatures(name) {
  const map = {
    'account-deletion': ['F-02', 'F-20'],
    'catalog-lookup': ['F-03', 'F-04'],
    'catalog-report': ['F-04'],
    'catalog-search': ['F-03', 'F-04'],
    'consent-withdrawal': ['F-02'],
    'data-export': ['F-02'],
    'growth-event': ['F-15', 'F-20'],
    'order-report-poll': ['F-16'],
    'revenuecat-webhook': ['F-11', 'F-12'],
    'subscription-grants': ['F-11', 'F-12'],
    waitlist: ['F-01'],
  };
  return map[name] ?? [];
}

function packetFeatures(path) {
  if (path.includes('/phase3/')) return ['F-01', 'F-05', 'F-20'];
  if (path.includes('/phase4/')) return ['F-04'];
  if (path.includes('/phase5/')) return ['F-03', 'F-09', 'F-10', 'F-19'];
  if (path.includes('/phase6/')) return ['F-11', 'F-12'];
  if (path.includes('/phase7/')) return features.slice(1, 15).map(({ id }) => id);
  if (path.includes('/phase8/')) return ['F-15', 'F-16', 'F-17', 'F-18', 'F-19', 'F-20'];
  return ['F-20'];
}

function item(category, key, source, featureIds, readiness) {
  if (featureIds.length === 0)
    throw new Error(`No feature mapping for ${category}:${key} (${source}).`);
  return {
    id: `${category}:${key}`,
    category,
    source,
    featureIds,
    readiness: readiness ?? featureReadiness(featureIds),
  };
}

function discoverFlags() {
  const files = [...walk('apps/mobile/src'), ...walk('supabase/functions')].filter(
    (path) => /\.(?:ts|tsx|js|mjs)$/.test(path) && !/\.(?:test|spec)\./.test(path),
  );
  const found = new Map();
  for (const path of files) {
    const source = readRepo(path);
    for (const match of source.matchAll(
      /\b(?:EXPO_PUBLIC_[A-Z0-9_]*_ENABLED|OBF_(?:API|CONTRIBUTION)_ENABLED)\b/g,
    )) {
      if (!found.has(match[0])) found.set(match[0], path);
    }
  }
  return [...found].sort(([left], [right]) => left.localeCompare(right));
}

function discoverTables() {
  const tables = new Map();
  for (const path of walk('supabase/migrations').filter((entry) => entry.endsWith('.sql'))) {
    for (const match of readRepo(path).matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi,
    )) {
      if (!tables.has(match[1])) tables.set(match[1], path);
    }
  }
  return [...tables].sort(([left], [right]) => left.localeCompare(right));
}

function discoverGeneratedArtifacts() {
  const scripts = walk('scripts').filter((path) => {
    if (!path.endsWith('.mjs') || /smoke|\.test\./.test(path)) return false;
    const name = path.split('/').at(-1);
    return (
      (/packet|report|audit|worklist|operator-queue|support-handoff/.test(name) &&
        /writeFile|writeJson|writeText/.test(readRepo(path))) ||
      path.startsWith('scripts/docs/')
    );
  });
  return [...new Set([...walk('docs/generated'), ...scripts])].sort();
}

function discoverVendorOrigins() {
  const hostMap = {
    'api.revenuecat.com': ['revenuecat', ['F-11', 'F-12']],
    'api.shopmy.us': ['shopmy', ['F-16']],
    'appleid.apple.com': ['apple-identity', ['F-02']],
    'apps.apple.com': ['apple-app-store', ['F-11', 'F-12']],
    'challenges.cloudflare.com': ['cloudflare-turnstile', ['F-20']],
    'eu.i.posthog.com': ['posthog', ['F-20']],
    'eu.posthog.com': ['posthog', ['F-20']],
    'play.google.com': ['google-play-subscriptions-source-only', ['F-11', 'F-12']],
    'us.i.posthog.com': ['posthog', ['F-20']],
    'us.posthog.com': ['posthog', ['F-20']],
    'world.openbeautyfacts.org': ['open-beauty-facts', ['F-04']],
  };
  const origins = new Map();
  const files = [...walk('apps/mobile/src'), ...walk('supabase/functions')].filter(
    (path) => /\.(?:ts|tsx)$/.test(path) && !/\.(?:test|spec)\./.test(path),
  );
  for (const path of files) {
    for (const match of readRepo(path).matchAll(/https:\/\/([a-z0-9.-]+)/gi)) {
      const host = match[1].toLowerCase();
      if (host.endsWith('.invalid') || host === 'example.com' || host.startsWith('your-project'))
        continue;
      const mapping = hostMap[host];
      if (!mapping) throw new Error(`Unmapped external origin https://${host} in ${path}.`);
      if (!origins.has(host))
        origins.set(host, { host, source: path, vendor: mapping[0], featureIds: mapping[1] });
    }
  }
  return [...origins.values()].sort((left, right) => left.host.localeCompare(right.host));
}

export function buildFeatureInventory() {
  const routeItems = walk('apps/mobile/src/app')
    .filter((path) => /\.(?:ts|tsx)$/.test(path))
    .map((path) =>
      item('route', path.slice('apps/mobile/src/app/'.length), path, routeFeatures(path)),
    );

  const flagItems = discoverFlags().map(([name, path]) =>
    item('feature-flag', name, path, flagFeatures(name)),
  );

  const mobilePackage = readJson('apps/mobile/package.json');
  const nativeDependencies = Object.keys(mobilePackage.dependencies)
    .filter(
      (name) =>
        name === 'expo' ||
        name === 'react-native' ||
        name.startsWith('expo-') ||
        name.startsWith('react-native-') ||
        name.includes('react-native'),
    )
    .sort();
  const nativeItems = nativeDependencies.map((name) =>
    item('native-module', name, 'apps/mobile/package.json', nativeFeatures(name)),
  );

  const localStores = walk('apps/mobile/src').filter((path) =>
    /(?:store|storage|repository|database)\.(?:ts|tsx)$/i.test(path),
  );
  const storeItems = localStores.map((path) =>
    item('data-store', `local:${path}`, path, dataFeatures(path)),
  );
  const tableItems = discoverTables().map(([name, path]) =>
    item('data-store', `postgres:${name}`, path, dataFeatures(name), 'implemented'),
  );

  const edgeItems = readdirSync(resolve(root, 'supabase/functions'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== '_shared')
    .map((entry) => entry.name)
    .sort()
    .map((name) =>
      item('edge-function', name, `supabase/functions/${name}/index.ts`, edgeFeatures(name)),
    );

  const vendorOrigins = discoverVendorOrigins().map(({ host, source, featureIds }) =>
    item('vendor-call', `origin:${host}`, source, featureIds),
  );
  const sdkVendors = [
    ['google-sign-in', 'apps/mobile/package.json', ['F-02']],
    ['sentry', 'apps/mobile/src/lib/observability/sentry.ts', ['F-20']],
    ['supabase', 'apps/mobile/src/lib/supabase/client.ts', ['F-02', 'F-04', 'F-20']],
  ].map(([name, source, featureIds]) => item('vendor-call', `sdk:${name}`, source, featureIds));

  const packetItems = discoverGeneratedArtifacts().map((path) =>
    item('generated-packet', path, path, packetFeatures(path), 'implemented'),
  );

  const items = [
    ...routeItems,
    ...flagItems,
    ...nativeItems,
    ...storeItems,
    ...tableItems,
    ...edgeItems,
    ...vendorOrigins,
    ...sdkVendors,
    ...packetItems,
  ].sort((left, right) => left.id.localeCompare(right.id));

  const categoryCounts = Object.fromEntries(
    [...new Set(items.map(({ category }) => category))]
      .sort()
      .map((category) => [category, items.filter((entry) => entry.category === category).length]),
  );

  return {
    schemaVersion: 1,
    sourcePlan: baselinePaths.plan,
    readinessLabels,
    features,
    gatedSurfaces,
    categoryCounts,
    items,
  };
}

const groupPrerequisites = {
  BRAND: ['GOV-08', 'BASE-07'],
  ACCT: ['BRAND-01'],
  IOS: ['ACCT-01', 'BRAND-06'],
  DB: ['ACCT-08', 'BASE-07'],
  AUTH: ['DB-03', 'IOS-07'],
  CAT: ['DB-03', 'BRAND-06'],
  CORE: ['AUTH-06', 'CAT-09'],
  PHOTO: ['AUTH-06', 'CORE-07'],
  PAY: ['ACCT-09', 'AUTH-06', 'IOS-04'],
  ASK: ['CORE-07', 'DB-13', 'PAY-09'],
  COM: ['CAT-09', 'CORE-07', 'PAY-09'],
  UGC: ['AUTH-06', 'DB-13'],
  NATIVE: ['IOS-11', 'CORE-07'],
  SHARE: ['CORE-07', 'NATIVE-03'],
  LINK: ['BRAND-06', 'IOS-11', 'SHARE-01'],
  GROW: ['LINK-01', 'PAY-09'],
  ADMIN: ['DB-13', 'UGC-07'],
  REV: ['BRAND-10', 'BASE-07'],
  WEB: ['BRAND-06', 'REV-07'],
  OPS: ['ADMIN-05', 'ASK-07', 'COM-07', 'UGC-07'],
  QA: ['OPS-07', 'NATIVE-03', 'LINK-01'],
  BETA: ['QA-10'],
  STORE: ['BETA-08', 'REV-07', 'WEB-01'],
  LAUNCH: ['STORE-10', 'OPS-07'],
};

function prerequisitesFor(rows, row, index) {
  const [group] = row.id.split('-');
  if (group === 'H' || group === 'V') return [];
  if (row.id === 'GOV-01') return [];
  if (row.id === 'GOV-09') return ['GOV-03', 'BASE-01'];
  if (group === 'GOV') return [rows[index - 1].id];
  if (row.id === 'BASE-01') return ['GOV-03'];
  if (group === 'BASE') return ['BASE-01'];
  const groupRows = rows.filter(({ id }) => id.startsWith(`${group}-`));
  const groupIndex = groupRows.findIndex(({ id }) => id === row.id);
  if (groupIndex === 0) return groupPrerequisites[group] ?? ['BASE-07'];
  return [groupRows[groupIndex - 1].id];
}

export function buildTaskGraph() {
  const rows = parsePlanRows();
  return {
    schemaVersion: 1,
    sourcePlan: baselinePaths.plan,
    nodeCount: rows.length,
    nodes: rows.map((row, index) => ({
      id: row.id,
      owner: row.owner,
      prerequisites: prerequisitesFor(rows, row, index),
      nextAction:
        row.id.startsWith('H-') || row.id.startsWith('V-')
          ? `Codex prepares the surrounding work and records the external outcome: ${row.deliverable}`
          : `Complete and capture acceptance evidence: ${row.deliverable}`,
      acceptance: row.acceptance,
    })),
  };
}

const baselineComplete = new Set(['GOV-09', 'BASE-01', 'BASE-03', 'BASE-04', 'BASE-05', 'BASE-06']);

export function buildExecutionStatus() {
  const graph = buildTaskGraph();
  return {
    schemaVersion: 1,
    sourcePlan: baselinePaths.plan,
    expectedWorkItemCount: graph.nodeCount,
    allowedStatuses: ['not_started', 'in_progress', 'blocked', 'external_pending', 'complete'],
    items: graph.nodes.map((node) => {
      const external = node.id.startsWith('H-') || node.id.startsWith('V-');
      const complete = baselineComplete.has(node.id);
      return {
        id: node.id,
        status: complete ? 'complete' : external ? 'external_pending' : 'not_started',
        blockedBy: complete ? [] : node.prerequisites,
        nextAction: complete
          ? 'Keep the baseline artifact current and rerun launch:execution-baseline:check after relevant plan or repository changes.'
          : node.nextAction,
        evidenceRefs: complete
          ? [
              baselinePaths.featureInventory,
              baselinePaths.taskGraph,
              baselinePaths.credentials,
              baselinePaths.evidenceGovernance,
              baselinePaths.worktreeBoundary,
            ]
          : [],
      };
    }),
  };
}
