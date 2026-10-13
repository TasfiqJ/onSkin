#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLaunchContract } from '../launch/contract.mjs';

const registerPath = 'docs/FOR_TAS_TO_DO.md';
const executionPlanPath = 'docs/hugeToDo/IOS_LEAN_V1_EXECUTION_PLAN.md';
const historicalPlanPath = 'docs/hugeToDo/IOS_ALL_FEATURES_CODEX_EXECUTION_PLAN.md';
const contractPath = 'docs/hugeToDo/launch-contract.json';
const masterPlanPath = 'docs/MASTER_PLAN.md';
const scopeUpdatePath = 'docs/hugeToDo/LEAN_V1_SCOPE_UPDATE_2026-09-27.md';
const currentIds = [...Array.from({ length: 8 }, (_, i) => `H-${String(i + 1).padStart(2, '0')}`), 'V-01', 'V-02'];
const legacyIds = [...Array.from({ length: 12 }, (_, i) => `H-${String(i + 1).padStart(2, '0')}`), 'V-01', 'V-02'];

// Meaning-based dispositions, not numeric ID equivalence. All evidence remains outstanding.
export const legacyMapping = {
  'H-01': ['carried-forward', ['H-01', 'V-01'], 'Apple membership, Team ID, role and redacted receipt remain outstanding.'],
  'H-02': ['carried-forward', ['H-01', 'H-06'], 'Truthful individual/organization seller decision and consistent legal details remain outstanding.'],
  'H-03': ['carried-forward', ['H-01', 'H-04', 'H-06'], 'Accepted Apple/minimum-vendor agreements and banking/tax status remain outstanding; private values are never retained.'],
  'H-04': ['carried-forward; deferred', ['H-02', 'H-04', 'H-06'], 'Minimum domain/membership/reviewer/vendor budgets, redacted purchases and renewal owners remain outstanding. Optional AI/catalog/commerce/community spend is deferred.'],
  'H-05': ['carried-forward', ['H-01', 'H-04'], 'Private MFA/CAPTCHA/identity/phone/email/payment challenges remain external as encountered; only redacted provider status is retained.'],
  'H-06': ['carried-forward', ['H-02'], 'Written name selection, counsel conditions and authenticated reservation/filing records remain outstanding.'],
  'H-07': ['carried-forward; deferred; outstanding', ['H-02', 'H-03'], 'Trademark clearance and applicable V1 legal/privacy/clinical/chemistry/IP/export decisions require verified reviewer authority, exact hashes and retained signed references. Independent Security review remains OPEN. Deferred-feature reviews cannot admit those features.'],
  'H-08': ['carried-forward', ['H-05'], 'Real device/model/iOS/build/scenario evidence and named testers remain outstanding, including Face ID and purchase confirmations where used.'],
  'H-09': ['carried-forward; historical; deferred', ['H-08'], 'Genuine users and any required tester consent remain outstanding. Historical all-features cohort/retention evidence, including D1/D7/D14/D30 and sampling limits, is preserved as history; the 50–100-user mandatory beta and D14/D30 launch delay are deferred. Lean cohort guidance does not invent user feedback.'],
  'H-10': ['carried-forward; deferred; outstanding', ['H-06'], 'Minimum support owner, privacy response, incident escalation and applicable launch on-call coverage remain independent OPEN obligations, with named coverage, acknowledgements and test incidents. Community moderation and AI-safety staffing are deferred with their closed features; Codex prepares tools, SLAs, training and escalation evidence.'],
  'H-11': ['carried-forward', ['H-04', 'H-06'], 'Dated owner/scope/conditions for prices, launch countries, ceilings, contracts and material business risks remain outstanding.'],
  'H-12': ['carried-forward', ['H-07'], 'Separate App Review submission and later public-availability authorizations remain outstanding.'],
  'V-01': ['carried-forward', ['V-01'], 'Apple-issued membership/TestFlight/subscription/App Review/release state and exact approved build/product IDs remain outstanding.'],
  'V-02': ['carried-forward; deferred', ['H-04', 'V-02'], 'Minimum production account/contract/limit approvals, applicable DPA/licence references and privacy/security/deletion configuration remain outstanding. Optional AI/catalog/affiliate/analytics/community/moderation providers are deferred.'],
};

function section(text, heading) {
  const parts = text.split(`${heading}\n`);
  if (parts.length !== 2) throw new Error(`Expected exactly one ${heading}.`);
  return parts[1].split(/^## /m)[0];
}

function table(text, headers) {
  const rows = text.split('\n').filter((line) => line.startsWith('|')).map((line) => {
    if (!line.endsWith('|')) throw new Error('Malformed source table.');
    return line.slice(1, -1).split('|').map((cell) => cell.trim());
  });
  if (JSON.stringify(rows[0]) !== JSON.stringify(headers) || rows[1]?.length !== headers.length ||
      !rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) throw new Error('Invalid source table header.');
  if (rows.slice(2).some((row) => row.length !== headers.length || row.some((cell) => !cell))) throw new Error('Invalid source table row.');
  return rows.slice(2);
}

function exactIds(rows, ids) {
  return rows.length === ids.length && ids.every((id, i) => rows[i][0] === id);
}

function date(text) {
  const matches = [...text.matchAll(/^Date: (\d{4}-\d{2}-\d{2})$/gm)];
  if (matches.length !== 1) throw new Error('Expected exactly one source Date.');
  const value = matches[0][1];
  if (new Date(value).toISOString().slice(0, 10) !== value) throw new Error('Invalid calendar date.');
  return value;
}

function sources(root) {
  const read = (path) => readFileSync(resolve(root, path), 'utf8');
  const contract = loadLaunchContract(root);
  if (contract.programId !== 'ios-lean-v1-2026') throw new Error('Unexpected launch program.');
  const plan = read(executionPlanPath), historical = read(historicalPlanPath);
  const master = read(masterPlanPath), update = read(scopeUpdatePath);
  if (date(plan) !== contract.effectiveDate || date(historical) !== '2026-07-12' ||
      !master.startsWith(`# Master Plan\n\n> Active scope (${contract.effectiveDate}): iOS lean V1 supersedes`) ||
      !update.startsWith(`# Lean iOS V1 Scope Update — ${contract.effectiveDate}\n`)) throw new Error('Charter date/supersession mismatch.');
  const rows = table(section(plan, '## 3. Founder / external-only list'), ['ID', 'Owner', 'Unavoidable action', 'Acceptance']);
  const oldRows = table(section(historical, '## 5. Minimal Founder and External Touchpoint Register'), ['ID', 'Owner', 'Unavoidable action', 'What Codex still does']);
  if (!exactIds(rows, currentIds) || !exactIds(oldRows, legacyIds)) throw new Error('Missing, duplicated or substituted charter IDs.');
  const featureIds = [...section(plan, '## 2. Public V1 scope').matchAll(/`F-(\d{2})`/g)].map((m) => Number(m[1]));
  if (JSON.stringify(featureIds) !== JSON.stringify(contract.requiredFeatures.map((f) => f.id))) throw new Error('Lean plan/contract feature mismatch.');
  const updateIds = [...section(update, '## Required V1 product features').matchAll(/`F-(\d{2})`/g)].map((m) => Number(m[1]));
  if (JSON.stringify(updateIds) !== JSON.stringify(featureIds)) throw new Error('Scope update/contract feature mismatch.');
  return { contract, rows, oldRows };
}

function markdownTable(headers, rows) {
  return [headers, headers.map(() => '---'), ...rows].map((row) => `| ${row.join(' | ')} |`).join('\n');
}

export function renderFounderRegister(root = process.cwd()) {
  const { contract, rows, oldRows } = sources(root);
  const currentTable = (selected) => markdownTable(['ID', 'Owner', 'Status', 'Unavoidable action', 'Evidence required'],
    selected.map(([id, owner, action, acceptance]) => [id, owner, 'Pending external evidence', action, acceptance]));
  const legacyRows = oldRows.map(([id, owner, action, preparation]) => {
    const [disposition, targets, preservation] = legacyMapping[id];
    return [`legacy:2026-07-12:${id}`, owner, action, preparation, disposition,
      targets.map((target) => `lean:${contract.effectiveDate}:${target}`).join(', '), 'Outstanding; no approval supplied', preservation];
  });
  return [
    '# Founder And External Touchpoint Register', '',
    `Date: ${contract.effectiveDate}`, 'Status: Active lean V1 register; all external evidence pending', '',
    `Program: ${contract.programId}`, '',
    `Current charter: \`${executionPlanPath}\` and \`${contractPath}\`.`,
    `Required feature IDs: ${contract.requiredFeatures.map((f) => f.id).join(', ')}.`,
    `Deferred feature IDs: ${contract.deferredFeatures.map((f) => f.id).join(', ')}.`,
    'Deferred features remain closed and are not V1 prerequisites. Apple/email functionality is retained; Google entry, Android release, remote push and optional growth surfaces are deferred.', '',
    'This register is a source-checked projection of the active charter and the historical obligation mapping. Pending means no authenticated approval, payment, reviewer, device, beta, vendor or release proof is supplied here. A passing audit verifies the register; it never supplies those outcomes or authorizes release.', '',
    'All research, engineering, configuration, documentation, testing, evidence organization, vendor comparison, application preparation, store-packet work and launch operations remain Codex-owned. Only the decisive legal-person, private challenge, professional judgment, physical-device, genuine-user or external approval act belongs to H/V. Codex prepares exact-hash packets, operates authorized sessions around private challenges, verifies results, fixes defects and follows through.', '',
    'Never send passwords, MFA codes, private keys, API secrets, full payment-card details, banking data, tax identifiers, government ID, or unredacted user data through chat. Private challenge values and vendor secrets stay outside chat/repo. Evidence is redacted and does not contain user content.', '',
    'Android credentials, builds, device evidence, Play records, payments, links, performance, beta, and release approval are outside the current release and are not founder work. Pending external work never pauses safe Codex-owned work in another stream.', '',
    '## Founder Touchpoints', '', currentTable(rows.filter(([id]) => id.startsWith('H-') && id !== 'H-03')), '',
    '## External Professional And Staffed-Operation Touchpoints', '', currentTable(rows.filter(([id]) => id === 'H-03')), '',
    'Professional decisions require genuine qualified authority and exact-source/build binding. Minimum support ownership belongs to lean H-06. Independent security/privacy-response/incident/release safeguards remain OPEN; deferred community or AI staffing does not become a V1 requirement.', '',
    '## Vendor And Apple Outcomes', '', currentTable(rows.filter(([id]) => id.startsWith('V-'))), '',
    '## Current Critical Order', '',
    '1. Lean H-02 name clearance/selection and lean H-01 truthful seller/enrollment/agreements.',
    '2. Lean H-04 minimum production accounts and lean H-03 exact V1 professional decisions.',
    '3. Lean H-05 real iPhone evidence and lean H-08 genuine beta feedback/triage.',
    '4. Lean H-06 final territory/prices/budget/support/risk decisions.',
    '5. Lean H-07 separate submission and public-availability authorizations; lean V-01/V-02 control their external outcomes.', '',
    '## Historical Obligation Mapping', '',
    'Historical date: 2026-07-12. The all-features charter is historical evidence, superseded for public V1 on 2026-09-27. Its decisions did not occur on the new effective date. Numerical H/V equality across namespaces does not imply equal meaning.',
    'Historical authentication note: the July 12 register said “Google OAuth for iPhone remains in scope”. That statement is superseded for public V1 by September 27 C-04 and the scope update: Google entry and account-upgrade expansion are deferred. It is preserved here only as historical provenance; it does not authorize Google setup, admission, a vendor dependency or a founder launch task.',
    `Historical source: \`${historicalPlanPath}\`, section 5. Original founder register provenance: commit f3a9f3ca1cf45989ed0a304493c25b17f4896974, path \`${registerPath}\`, SHA-256 3ad780060f627f714e0b6b204be26987a8fd26676244669cc7772580f7cf779d. That immutable preimage retains the complete original facts and evidence requirements.`,
    'Carried-forward obligations stay pending in the indicated lean/independent scope. Deferred obligations retain their facts and future safeguards without admitting their features. Historical means provenance, not completion. Outstanding independent safeguards are not waived.', '',
    markdownTable(['Legacy ID', 'Historical owner', 'Historical unavoidable action', 'Codex-owned historical preparation', 'Disposition', 'Current namespace targets', 'Evidence state', 'Preserved facts and boundaries'], legacyRows), '',
  ].join('\n');
}

export function auditFounderTouchpoints(root = process.cwd()) {
  const blockers = [], identities = {};
  let source = null, expected = null;
  try { source = sources(root); expected = renderFounderRegister(root); }
  catch { blockers.push('Authoritative charter inputs are missing, malformed or inconsistent.'); }
  let register = '';
  try { register = readFileSync(resolve(root, registerPath), 'utf8'); }
  catch { blockers.push('Founder register is missing.'); }
  if (expected !== null && register !== expected) blockers.push('Founder register differs from the exact current charter and historical mapping; missing, duplicated, substituted, misclassified or unproved records are forbidden.');
  if (/\bPHASE(?:[2-9]|10|11)_[A-Z0-9_]+\b/.test(register) || /(?:npm\s+(?:run|exec|install)|npx\s|pnpm\s|yarn\s|docker\s+(?:run|pull|exec)|supabase\s+(?:db|start|link)|psql\s|git\s+(?:push|checkout)|wsl\s|curl\s|powershell\s|bash\s|node\s+\S|python\S*\s+\S)/i.test(register)) blockers.push('Founder register contains Codex-owned terminal/evidence tasks.');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk_live_|sb_secret_|ghp_)[A-Za-z0-9_]+|(?:password|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/i.test(register)) blockers.push('Founder register contains secret-like content; never emit private values.');
  for (const path of [registerPath, executionPlanPath, historicalPlanPath, contractPath, masterPlanPath, scopeUpdatePath, 'scripts/docs/tas-todo-audit.mjs']) {
    try { const bytes = readFileSync(resolve(root, path)); identities[path] = { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }; }
    catch { blockers.push(`Missing source ${path}.`); }
  }
  return {
    schemaVersion: 2, status: blockers.length ? 'blocked' : 'pass', strict: true,
    purpose: 'Validate the lean V1 founder/external boundary and preserve every historical obligation; this is not external approval or release evidence.',
    sourceFiles: { registerPath, executionPlanPath, historicalPlanPath, contractPath, masterPlanPath, scopeUpdatePath }, sourceIdentities: identities,
    launchContract: source ? { programId: source.contract.programId, effectiveDate: source.contract.effectiveDate, platforms: source.contract.release.platforms, androidRelease: source.contract.release.androidRelease, requiredFeatureIds: source.contract.requiredFeatures.map((f) => f.id), deferredFeatureIds: source.contract.deferredFeatures.map((f) => f.id) } : null,
    requiredHumanIds: source ? source.rows.filter(([id]) => id.startsWith('H-')).map(([id]) => id) : [],
    requiredVendorIds: source ? source.rows.filter(([id]) => id.startsWith('V-')).map(([id]) => id) : [],
    externalEvidenceStatus: 'pending', releaseAuthorized: false,
    legacyObligations: source ? source.oldRows.map(([id, owner, action, preparation]) => ({ id: `legacy:2026-07-12:${id}`, owner, action, codexOwnedPreparation: preparation, disposition: legacyMapping[id][0], currentTargets: legacyMapping[id][1].map((target) => `lean:${source.contract.effectiveDate}:${target}`), evidenceStatus: 'outstanding', preservation: legacyMapping[id][2] })) : [],
    summary: { humanTouchpointCount: source ? 8 : 0, vendorOutcomeCount: source ? 2 : 0, historicalObligationCount: source ? 14 : 0, blockerCount: blockers.length, warningCount: 0 }, blockers, warnings: [],
  };
}

function renderAudit(audit) {
  return ['# Founder Touchpoint Audit', '', `Status: ${audit.status}`, `Charter effective: ${audit.launchContract?.effectiveDate ?? 'invalid'}`, 'Strict source validation: yes', 'External evidence: pending. Release authorized: no.', '', audit.purpose, '',
    `- Human responsibilities: ${audit.requiredHumanIds.join(', ')}`, `- Vendor outcomes: ${audit.requiredVendorIds.join(', ')}`, `- Historical obligations preserved: ${audit.summary.historicalObligationCount}`, '',
    '## Historical Mapping', '', ...audit.legacyObligations.map((r) => `- ${r.id}: ${r.disposition}; ${r.currentTargets.join(', ')}; ${r.evidenceStatus}. ${r.preservation}`), '',
    '## Source Identities', '', ...Object.entries(audit.sourceIdentities).map(([path, r]) => `- \`${path}\`: ${r.bytes} bytes; SHA-256 \`${r.sha256}\`.`), '',
    '## Blockers', '', ...(audit.blockers.length ? audit.blockers.map((b) => `- ${b}`) : ['- None in this register audit. Independent release/security/database gates remain open.']), '',].join('\n');
}

function main() {
  const root = process.cwd(), check = process.argv.includes('--check');
  const audit = auditFounderTouchpoints(root);
  const outputs = [[process.env.TAS_TODO_AUDIT_JSON ?? 'docs/generated/tas-todo-audit.json', `${JSON.stringify(audit, null, 2)}\n`], [process.env.TAS_TODO_AUDIT_MD ?? 'docs/generated/tas-todo-audit.md', renderAudit(audit)]];
  let current = true;
  for (const [path, content] of outputs) {
    const target = resolve(root, path);
    if (check) {
      if (!existsSync(target) || readFileSync(target, 'utf8') !== content) { console.error('FAIL Founder audit generated output is missing or stale.'); current = false; }
    } else { mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content); }
  }
  if (audit.blockers.length || !current) { audit.blockers.forEach((b) => console.error(`FAIL ${b}`)); process.exitCode = 1; }
  else console.log(`Founder touchpoint audit ${check ? 'is current and ' : ''}passed. External evidence remains pending.`);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
