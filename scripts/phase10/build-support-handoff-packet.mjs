#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { command, gitStatusExcludingGeneratedEvidence } from '../phase9/lib.mjs';

const root = process.cwd();
const check = process.argv.includes('--check');
const strict = process.argv.includes('--strict');
const outJson =
  process.env.PHASE10_SUPPORT_HANDOFF_JSON ??
  'docs/phase-10/generated/support-handoff-packet.json';
const outMd =
  process.env.PHASE10_SUPPORT_HANDOFF_MD ??
  'docs/phase-10/generated/support-handoff-packet.md';
const outputPaths = [outJson, outMd].map((path) => normalizeRepoPath(path));

const routePath = 'apps/mobile/src/app/settings/beta-feedback.tsx';
const supportOpsPath = 'docs/phase-10/support-operations.md';
const sourceFiles = [
  'package.json',
  'scripts/phase10/build-support-handoff-packet.mjs',
  'scripts/phase10/lib.mjs',
  routePath,
  supportOpsPath,
];

const categoryRouting = {
  onboarding_confusion: {
    deskQueue: 'beta-onboarding',
    escalationOwner: 'Support ops + onboarding owner',
    publicTheme: 'activation confusion',
  },
  catalog_match: {
    deskQueue: 'beta-catalog',
    escalationOwner: 'Catalog owner',
    publicTheme: 'catalog miss or wrong match',
  },
  guidance_trust: {
    deskQueue: 'beta-guidance-review',
    escalationOwner: 'Clinical/claims reviewer + engineering',
    publicTheme: 'guidance trust',
  },
  routine_checkoff: {
    deskQueue: 'beta-routine',
    escalationOwner: 'Routine owner',
    publicTheme: 'routine activation',
  },
  visual_progress: {
    deskQueue: 'beta-photos',
    escalationOwner: 'Photo/privacy owner',
    publicTheme: 'progress photo friction',
  },
  notifications: {
    deskQueue: 'beta-reminders',
    escalationOwner: 'Notifications owner',
    publicTheme: 'reminder reliability',
  },
  paywall_comprehension: {
    deskQueue: 'beta-payments',
    escalationOwner: 'Payments + legal owner',
    publicTheme: 'pricing or trial comprehension',
  },
  privacy_rights: {
    deskQueue: 'beta-privacy',
    escalationOwner: 'Privacy/legal owner',
    publicTheme: 'privacy rights',
  },
  crash_performance: {
    deskQueue: 'beta-release',
    escalationOwner: 'Release/build owner',
    publicTheme: 'crash or performance',
  },
  account_auth: {
    deskQueue: 'beta-auth',
    escalationOwner: 'Auth/backend owner',
    publicTheme: 'account access',
  },
  app_install: {
    deskQueue: 'beta-install',
    escalationOwner: 'Release/build owner',
    publicTheme: 'install or update',
  },
  advice_boundary: {
    deskQueue: 'beta-claims',
    escalationOwner: 'Clinical/claims reviewer + legal',
    publicTheme: 'medical-advice boundary',
  },
  other: {
    deskQueue: 'beta-general',
    escalationOwner: 'Support ops owner',
    publicTheme: 'uncategorized feedback',
  },
};

const severityRouting = {
  p0: {
    responseTarget: 'same day',
    escalation: 'page owner immediately',
    definition: 'Crash, data-loss risk, unexpected charge, privacy failure, or harmful medical framing.',
  },
  p1: {
    responseTarget: '1 business day',
    escalation: 'feature owner',
    definition: 'Core activation, catalog, payment, auth, or routine flow is blocked.',
  },
  p2: {
    responseTarget: '2 business days',
    escalation: 'weekly beta triage unless repeated',
    definition: 'Tester can continue, but the issue is wrong, confusing, or unreliable.',
  },
  p3: {
    responseTarget: 'weekly triage',
    escalation: 'backlog review',
    definition: 'Suggestion, polish, wording, or non-launch request.',
  },
};

function abs(path) {
  return resolve(root, path);
}

function normalizeRepoPath(path) {
  return String(path ?? '').replaceAll('\\', '/').replace(/^\.\//, '');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function hashFile(path) {
  const bytes = readFileSync(abs(path));
  return {
    path: normalizeRepoPath(path),
    exists: true,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

function fileRecord(path) {
  const normalized = normalizeRepoPath(path);
  return exists(normalized) ? hashFile(normalized) : { path: normalized, exists: false };
}

function extractArray(source, constName, blockers) {
  const pattern = new RegExp(`const ${constName} = \\[([\\s\\S]*?)\\] as const;`);
  const match = source.match(pattern);
  if (!match) {
    blockers.push(`${routePath} is missing ${constName}.`);
    return [];
  }

  const rows = [];
  const body = match[1] ?? '';
  const itemPattern =
    /{\s*key:\s*'([^']+)',\s*label:\s*'([^']+)',\s*detail:\s*'([^']+)',\s*}/g;
  for (const itemMatch of body.matchAll(itemPattern)) {
    rows.push({
      key: itemMatch[1],
      label: itemMatch[2],
      detail: itemMatch[3],
    });
  }
  if (rows.length === 0) blockers.push(`${constName} has no parseable rows.`);
  return rows;
}

function markdownTable(headers, rows) {
  const allRows = [headers, ...rows];
  const widths = headers.map((_, index) =>
    Math.max(...allRows.map((row) => String(row[index] ?? '').length), 3),
  );
  const render = (row) =>
    `| ${row.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [
    render(headers),
    render(widths.map((width) => '-'.repeat(width))),
    ...rows.map(render),
  ].join('\n');
}

function normalizeGeneratedMarkdown(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^Generated: .+$/m, 'Generated: <ignored>')
    .replace(/^Git SHA: .+$/m, 'Git SHA: <ignored>')
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  delete parsed.gitSha;
  delete parsed.strict;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run phase10:support-handoff.`);
    return false;
  }
  if (normalize(read(path)) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run phase10:support-handoff.`);
    return false;
  }
  return true;
}

const blockers = [];
const warnings = [];
for (const file of sourceFiles) {
  if (!exists(file)) blockers.push(`${file} is missing from support handoff packet inputs.`);
}

const routeSource = exists(routePath) ? read(routePath) : '';
const supportOps = exists(supportOpsPath) ? read(supportOpsPath) : '';
const categories = extractArray(routeSource, 'SUPPORT_FEEDBACK_CATEGORIES', blockers).map(
  (category) => ({
    ...category,
    ...(categoryRouting[category.key] ?? {
      deskQueue: 'beta-general',
      escalationOwner: 'Support ops owner',
      publicTheme: 'uncategorized feedback',
    }),
  }),
);
const severities = extractArray(routeSource, 'SUPPORT_FEEDBACK_SEVERITIES', blockers).map(
  (severity) => ({
    ...severity,
    ...(severityRouting[severity.key] ?? {
      responseTarget: 'weekly triage',
      escalation: 'backlog review',
      definition: severity.detail,
    }),
  }),
);

for (const category of categories) {
  if (!Object.hasOwn(categoryRouting, category.key)) {
    blockers.push(`Missing support routing for category ${category.key}.`);
  }
  if (!supportOps.includes(`\`${category.key}\``)) {
    blockers.push(`${supportOpsPath} does not document beta category query value ${category.key}.`);
  }
}
for (const severity of severities) {
  if (!Object.hasOwn(severityRouting, severity.key)) {
    blockers.push(`Missing support routing for severity ${severity.key}.`);
  }
  if (!supportOps.includes(`\`${severity.key}\``)) {
    blockers.push(`${supportOpsPath} does not document beta severity query value ${severity.key}.`);
  }
}
for (const requiredSnippet of [
  "['source', 'beta_feedback']",
  "['category', category]",
  "['severity', severity]",
  "track('support_contact_opened', analyticsPayload)",
  "track('support_contact_failed', analyticsPayload)",
]) {
  if (!routeSource.includes(requiredSnippet)) {
    blockers.push(`${routePath} is missing support handoff contract snippet: ${requiredSnippet}`);
  }
}

let gitSha = 'unknown';
let gitStatus = 'unknown';
try {
  gitSha = command('git', ['rev-parse', 'HEAD']).trim();
  gitStatus = gitStatusExcludingGeneratedEvidence(outputPaths);
} catch {
  warnings.push('Git SHA/status could not be captured.');
}
if (gitStatus.length > 0) {
  warnings.push(
    'Phase 10 support handoff packet generated with a dirty Git worktree; do not use it as final support-desk evidence.',
  );
}

const packet = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  gitSha,
  gitStatus,
  purpose:
    'Support-desk setup packet for in-app beta feedback query parameters, category routing, severity SLA, and escalation owners.',
  handoffContract: {
    supportUrlEnv: 'EXPO_PUBLIC_SUPPORT_URL',
    requiredQueryParams: {
      source: 'beta_feedback',
      category: categories.map((category) => category.key),
      severity: severities.map((severity) => severity.key),
    },
    freeText: false,
    personalData: 'No free-text or health/photo detail is sent by this handoff.',
  },
  categories,
  severities,
  files: sourceFiles.map(fileRecord),
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(packet, null, 2)}\n`;
const mdContent = [
  '# Phase 10 Beta Support Handoff Packet',
  '',
  `Generated: ${packet.generatedAt}`,
  `Status: ${packet.status}`,
  `Git SHA: ${packet.gitSha}`,
  `Git status: ${packet.gitStatus ? 'DIRTY' : 'clean'}`,
  '',
  'This generated packet converts the in-app Beta feedback route into exact',
  'support-desk setup instructions. It does not prove the external desk exists;',
  'Tas must still configure the real support URL, queues, owners, macros, and',
  'SLA reports before `PHASE10_SUPPORT_DESK_PASS=true` can be set.',
  '',
  '## Handoff Contract',
  '',
  `- URL env: \`${packet.handoffContract.supportUrlEnv}\``,
  '- Required query params: `source=beta_feedback`, `category`, `severity`',
  '- Free text sent: no',
  '- Personal data sent: no free-text or health/photo detail is sent by this handoff',
  '',
  '## Categories',
  '',
  markdownTable(
    ['Query value', 'Label', 'Desk queue', 'Escalation owner', 'Theme'],
    categories.map((category) => [
      `\`${category.key}\``,
      category.label,
      category.deskQueue,
      category.escalationOwner,
      category.publicTheme,
    ]),
  ),
  '',
  '## Severities',
  '',
  markdownTable(
    ['Query value', 'Label', 'Response target', 'Escalation', 'Definition'],
    severities.map((severity) => [
      `\`${severity.key}\``,
      severity.label,
      severity.responseTarget,
      severity.escalation,
      severity.definition,
    ]),
  ),
  '',
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
  '',
  '## Source Hashes',
  '',
  ...packet.files.map((file) =>
    file.exists
      ? `- \`${file.path}\`: \`${file.sha256}\``
      : `- \`${file.path}\`: missing`,
  ),
  '',
].join('\n');

if (check) {
  const jsonCurrent = checkGeneratedFile(outJson, jsonContent, normalizeGeneratedJson);
  const mdCurrent = checkGeneratedFile(outMd, mdContent, normalizeGeneratedMarkdown);
  if (blockers.length > 0) {
    for (const blocker of blockers) console.error(`FAIL ${blocker}`);
    process.exit(1);
  }
  if (!jsonCurrent || !mdCurrent) process.exit(1);
  if (strict && warnings.length > 0) {
    for (const warning of warnings) console.warn(`WARN ${warning}`);
    process.exit(1);
  }
  console.log('Phase 10 support handoff packet is current.');
  console.log('Phase 10 support handoff packet passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);

console.log(`Wrote ${relative(root, abs(outJson)).replaceAll('\\', '/')}`);
console.log(`Wrote ${relative(root, abs(outMd)).replaceAll('\\', '/')}`);
if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}
if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
  process.exit(1);
}
console.log('Phase 10 support handoff packet passed.');
