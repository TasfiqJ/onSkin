#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';

const root = process.cwd();
const strict = process.argv.includes('--strict');
const check = process.argv.includes('--check');

const outJson =
  process.env.DEVICE_SUPPORT_POLICY_AUDIT_JSON ?? 'docs/generated/device-support-policy-audit.json';
const outMd =
  process.env.DEVICE_SUPPORT_POLICY_AUDIT_MD ?? 'docs/generated/device-support-policy-audit.md';

const files = {
  appBase: 'apps/mobile/app.base.json',
  blockers: 'BLOCKERS.md',
  decisions: 'docs/DECISIONS.md',
  devicePolicy: 'docs/DEVICE_SUPPORT_POLICY.md',
  e2eGuide: 'docs/HUMAN_SIMULATED_E2E_TESTING.md',
  forTas: 'docs/FOR_TAS_TO_DO.md',
  humanManifest: 'docs/e2e/generated/human-e2e-manifest.json',
  launchReadiness: 'LAUNCH_READINESS.md',
  manifestScript: 'scripts/e2e/human-e2e-manifest.mjs',
  packageJson: 'package.json',
  testingStrategy: 'docs/TESTING_STRATEGY.md',
  userFlowTree: 'docs/USER_FLOW_TREE.md',
};

const docNeedles = [
  {
    path: files.devicePolicy,
    needles: [
      'iOS 17.0+',
      'Android 10 / API 29+',
      '360 x 640',
      '375 pt width or wider',
      '360 dp smallest width or wider',
      'Stress-Only Viewports',
      '320 x 480',
      'Sub-360 dp/px width',
      'reduce usable portrait height below 640 px/dp',
    ],
  },
  {
    path: files.decisions,
    needles: [
      'Launch Device Support Floor',
      'iOS 17.0+ and Android 10 / API 29+',
      'launch-blocking layout QA starts at 360 x 640',
      '320-wide browser viewports and sub-640 browser-only heights remain stress-only',
    ],
  },
  {
    path: files.forTas,
    needles: [
      'docs/DEVICE_SUPPORT_POLICY.md',
      'iOS 17.0+',
      'Android 10 / API 29+',
      '360 x 640 Expo web-compatible shortest-phone',
      'time on iOS 16, Android 9-or-older',
    ],
  },
  {
    path: files.launchReadiness,
    needles: [
      '360 x 640 launch-floor 200% text-pressure sweep',
      '320-wide stress Expo web route audit',
      'The support contract',
      'is defined in `docs/DEVICE_SUPPORT_POLICY.md`',
    ],
  },
  {
    path: files.blockers,
    needles: [
      '360 x 640 launch-floor 200% text-pressure sweep',
      'keeps 320-wide browser evidence as stress/resilience coverage',
      'docs/DEVICE_SUPPORT_POLICY.md',
    ],
  },
  {
    path: files.testingStrategy,
    needles: [
      'Device and viewport support floors are defined in',
      'supported small phone layout from `docs/DEVICE_SUPPORT_POLICY.md`',
      'stress-only 320 x 568 / 480 / 430 / 390 / 370 / 360 browser viewports',
    ],
  },
  {
    path: files.e2eGuide,
    needles: [
      'Device and layout support policy: `docs/DEVICE_SUPPORT_POLICY.md`',
      'checks the launch-blocking 360 x 640 support-floor route sweep',
      'Whether the viewport/device is inside the launch support floor or is a',
    ],
  },
  {
    path: files.userFlowTree,
    needles: [
      'Device/layout support policy: `docs/DEVICE_SUPPORT_POLICY.md`',
      'Launch-blocking Expo web floor: 360 x 640',
      '320-wide browser viewports and',
      'smaller 320-wide stress evidence when available',
    ],
  },
];

const requiredPackageScripts = [
  'docs:device-support-policy-audit',
  'docs:device-support-policy-audit:strict',
  'docs:device-support-policy-audit:check',
];

const requiredLaunchVerifyParts = [
  'docs:device-support-policy-audit:check',
  'phase5:check-native-config',
  'e2e:human:manifest:check',
];

const manifestScriptNeedles = [
  'support-floor-360-640-200-text-pressure',
  "title: '360 x 640 launch-floor 200% text-pressure route sweep'",
  'required: true',
  "supportClass: 'launch-blocking'",
  'text-pressure-200-supported-360-640-postfix',
  'android-360-740-200-text-pressure',
  'iphone-375-667-200-text-pressure',
  'modern-390-200-text-pressure',
  'modern-430-200-text-pressure',
  'skipped-routes-360-640-200-text-pressure',
  'function textPressureLegacyFloorGate',
  'required: false',
  "supportClass: 'resilience'",
  'Supported-phone 200% text-pressure gates listed in this manifest are launch-required',
];

const requiredSupportedPhoneGateIds = [
  'android-360-740-200-text-pressure',
  'iphone-375-667-200-text-pressure',
  'iphone-375-200-text-pressure',
  'modern-390-200-text-pressure',
  'android-412-640-200-text-pressure',
  'android-412-200-text-pressure',
  'boundary-414-896-200-text-pressure',
  'android-430-640-200-text-pressure',
  'modern-430-200-text-pressure',
  'skipped-routes-360-640-200-text-pressure',
  'skipped-routes-375-667-200-text-pressure',
  'skipped-routes-390-844-200-text-pressure',
  'skipped-routes-412-640-200-text-pressure',
  'skipped-routes-430-640-200-text-pressure',
  'skipped-routes-430-932-200-text-pressure',
];

function abs(path) {
  return resolve(root, path);
}

function rel(path) {
  return relative(root, path).replaceAll('\\', '/');
}

function exists(path) {
  return existsSync(abs(path));
}

function read(path) {
  return readFileSync(abs(path), 'utf8');
}

function readJson(path) {
  return JSON.parse(read(path));
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
    .trimEnd();
}

function normalizeGeneratedJson(text) {
  const parsed = JSON.parse(text);
  delete parsed.generatedAt;
  return JSON.stringify(parsed, null, 2);
}

function checkGeneratedFile(path, expectedContent, normalize) {
  if (!exists(path)) {
    console.error(`FAIL Missing ${path}. Run npm run docs:device-support-policy-audit:strict.`);
    return false;
  }
  const current = read(path);
  if (normalize(current) !== normalize(expectedContent)) {
    console.error(`FAIL ${path} is stale. Run npm run docs:device-support-policy-audit:strict.`);
    return false;
  }
  return true;
}

function buildPropertiesPlugin(expo) {
  return (expo.plugins ?? []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
}

const blockers = [];
const warnings = [];

for (const path of Object.values(files)) {
  if (!exists(path)) blockers.push(`Missing ${path}.`);
}

const appBase = exists(files.appBase) ? readJson(files.appBase) : { expo: {} };
const packageJson = exists(files.packageJson) ? readJson(files.packageJson) : { scripts: {} };
const humanManifest = exists(files.humanManifest) ? readJson(files.humanManifest) : {};
const manifestScript = exists(files.manifestScript) ? read(files.manifestScript) : '';

const plugin = buildPropertiesPlugin(appBase.expo ?? {});
const buildProperties = Array.isArray(plugin) ? (plugin[1] ?? {}) : {};
const androidBuildProperties = buildProperties.android ?? {};

const configContracts = [
  {
    actual: appBase.expo?.ios?.deploymentTarget,
    expected: '17.0',
    label: 'iOS deployment target',
    pass: appBase.expo?.ios?.deploymentTarget === '17.0',
  },
  {
    actual: appBase.expo?.ios?.supportsTablet,
    expected: false,
    label: 'iOS tablet launch scope',
    pass: appBase.expo?.ios?.supportsTablet === false,
  },
  {
    actual: androidBuildProperties.minSdkVersion,
    expected: 29,
    label: 'Android min SDK install floor',
    pass: androidBuildProperties.minSdkVersion === 29,
  },
  {
    actual: androidBuildProperties.compileSdkVersion,
    expected: 36,
    label: 'Android compile SDK',
    pass: androidBuildProperties.compileSdkVersion === 36,
  },
  {
    actual: androidBuildProperties.targetSdkVersion,
    expected: 36,
    label: 'Android target SDK',
    pass: androidBuildProperties.targetSdkVersion === 36,
  },
];

for (const contract of configContracts) {
  if (!contract.pass) {
    blockers.push(
      `${contract.label} expected ${String(contract.expected)}, got ${String(contract.actual)}.`,
    );
  }
}

if (!plugin) {
  blockers.push('apps/mobile/app.base.json is missing the expo-build-properties plugin.');
}

const docResults = docNeedles.map((doc) => {
  const text = exists(doc.path) ? read(doc.path) : '';
  const missingNeedles = doc.needles.filter((needle) => !text.includes(needle));
  for (const needle of missingNeedles) {
    blockers.push(`${doc.path} does not mention support policy detail: ${needle}`);
  }
  return {
    path: doc.path,
    missingNeedles,
    requiredNeedleCount: doc.needles.length,
  };
});

const missingManifestScriptNeedles = manifestScriptNeedles.filter(
  (needle) => !manifestScript.includes(needle),
);
for (const needle of missingManifestScriptNeedles) {
  blockers.push(`${files.manifestScript} does not contain expected launch-floor guard: ${needle}`);
}

const manifestGates = Array.isArray(humanManifest.gateResults)
  ? humanManifest.gateResults
  : Array.isArray(humanManifest.gates)
    ? humanManifest.gates
    : [];

const gateResults = manifestGates.map((gate) => ({
  id: gate.id,
  required: gate.required === true,
  status: gate.status,
  supportClass: gate.supportClass,
  title: gate.title,
}));

const launchGate = gateResults.find(
  (gate) => gate.id === 'support-floor-360-640-200-text-pressure',
);
if (!launchGate) {
  blockers.push(`${files.humanManifest} is missing the 360 x 640 launch-floor gate.`);
} else {
  if (!launchGate.required) blockers.push('360 x 640 launch-floor gate must be required.');
  if (launchGate.supportClass !== 'launch-blocking') {
    blockers.push('360 x 640 launch-floor gate must be launch-blocking.');
  }
  if (launchGate.status !== 'pass') blockers.push('360 x 640 launch-floor gate must pass.');
}

for (const gateId of requiredSupportedPhoneGateIds) {
  const gate = gateResults.find((candidate) => candidate.id === gateId);
  if (!gate) {
    blockers.push(`${files.humanManifest} is missing supported-phone gate ${gateId}.`);
    continue;
  }
  if (!gate.required) blockers.push(`${gateId} must be required supported-phone evidence.`);
  if (gate.supportClass !== 'supported-phone') {
    blockers.push(`${gateId} must be classified as supported-phone evidence.`);
  }
  if (gate.status !== 'pass') blockers.push(`${gateId} must pass.`);
}

const legacyGateProblems = gateResults
  .filter((gate) => /\b320 x 480\b/.test(String(gate.title ?? '')))
  .filter((gate) => gate.required || gate.supportClass !== 'resilience');
for (const gate of legacyGateProblems) {
  blockers.push(`${files.humanManifest} misclassifies ${gate.id} as launch-required.`);
}
if (gateResults.filter((gate) => /\b320 x 480\b/.test(String(gate.title ?? ''))).length === 0) {
  warnings.push(`${files.humanManifest} has no 320 x 480 stress evidence entry.`);
}

for (const command of requiredPackageScripts) {
  if (!Object.hasOwn(packageJson.scripts ?? {}, command)) {
    blockers.push(`${files.packageJson} is missing ${command}.`);
  }
}

const launchVerifyScript = String(packageJson.scripts?.['launch:verify'] ?? '');
for (const scriptPart of requiredLaunchVerifyParts) {
  if (!launchVerifyScript.includes(scriptPart)) {
    blockers.push(`${files.packageJson} launch:verify is missing ${scriptPart}.`);
  }
}

const audit = {
  generatedAt: new Date().toISOString(),
  status: blockers.length === 0 ? 'pass' : 'blocked',
  strict,
  purpose:
    'Audit the accepted device support policy so install floors, viewport launch gates, and 320-wide stress-only evidence cannot drift silently.',
  files,
  configContracts,
  docResults,
  manifestScript: {
    path: files.manifestScript,
    missingNeedles: missingManifestScriptNeedles,
  },
  humanManifest: {
    path: files.humanManifest,
    launchGate,
    requiredSupportedPhoneGateIds,
    legacyGateProblems,
    gateCount: gateResults.length,
  },
  requiredPackageScripts,
  requiredLaunchVerifyParts,
  summary: {
    blockerCount: blockers.length,
    warningCount: warnings.length,
    docCount: docResults.length,
    configContractCount: configContracts.length,
  },
  blockers,
  warnings,
};

const jsonContent = `${JSON.stringify(audit, null, 2)}\n`;

const mdContent = [
  '# Device Support Policy Audit',
  '',
  `Generated: ${audit.generatedAt}`,
  `Status: ${audit.status}`,
  `Strict mode: ${strict ? 'yes' : 'no'}`,
  '',
  'This generated audit keeps the V1 device cutoff explicit: iOS 17.0+,',
  'Android 10 / API 29+, Android compile/target API 36, 360 x 640 as the',
  'launch-blocking Expo web layout floor, and 320-wide browser sizes as',
  'stress/resilience evidence unless real device or review evidence elevates',
  'them.',
  '',
  '## Summary',
  '',
  `- Config contracts: ${audit.summary.configContractCount}`,
  `- Docs checked: ${audit.summary.docCount}`,
  `- Human-E2E manifest gates: ${audit.humanManifest.gateCount}`,
  `- Blockers: ${audit.summary.blockerCount}`,
  `- Warnings: ${audit.summary.warningCount}`,
  '',
  '## Native Config',
  '',
  markdownTable(
    ['Contract', 'Expected', 'Actual', 'Pass'],
    configContracts.map((contract) => [
      contract.label,
      String(contract.expected),
      String(contract.actual),
      contract.pass ? 'yes' : 'no',
    ]),
  ),
  '',
  '## Docs',
  '',
  markdownTable(
    ['Doc', 'Needles', 'Missing'],
    docResults.map((doc) => [
      doc.path,
      doc.requiredNeedleCount,
      doc.missingNeedles.length ? doc.missingNeedles.join('; ') : 'none',
    ]),
  ),
  '',
  '## Human-E2E Manifest',
  '',
  `- Launch gate: ${launchGate ? `${launchGate.id} / ${launchGate.status}` : 'missing'}`,
  `- 320 x 480 misclassified gates: ${legacyGateProblems.length}`,
  '',
  '## Blockers',
  '',
  ...(blockers.length > 0 ? blockers.map((blocker) => `- ${blocker}`) : ['- None.']),
  '',
  '## Warnings',
  '',
  ...(warnings.length > 0 ? warnings.map((warning) => `- ${warning}`) : ['- None.']),
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
  }
  console.log('Device support policy audit is current.');
  console.log('Device support policy audit passed.');
  process.exit(0);
}

mkdirSync(dirname(abs(outJson)), { recursive: true });
writeFileSync(abs(outJson), jsonContent);
writeFileSync(abs(outMd), mdContent);

console.log(`Wrote ${rel(abs(outJson))}`);
console.log(`Wrote ${rel(abs(outMd))}`);

if (blockers.length > 0) {
  for (const blocker of blockers) console.error(`FAIL ${blocker}`);
  process.exit(1);
}

if (strict && warnings.length > 0) {
  for (const warning of warnings) console.warn(`WARN ${warning}`);
}

console.log('Device support policy audit passed.');
