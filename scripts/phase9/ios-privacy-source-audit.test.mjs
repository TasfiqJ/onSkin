import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  IOS_PRIVACY_AUDIT_JSON_PATH,
  IOS_PRIVACY_AUDIT_MARKDOWN_PATH,
  IOS_PRIVACY_BASELINE_PATH,
  IOS_PRIVACY_DEFAULT_BOUNDS,
  IOS_PRIVACY_MAPPING_PATH,
  IosPrivacyContractError,
  auditIosPrivacySource,
  canonicalAuditJson,
  renderIosPrivacySourceAuditMarkdown,
  validateIosPrivacyAuditClaims,
  validatePrivacyManifestBytes,
} from './ios-privacy-contract.mjs';
import { runIosPrivacySourceAudit } from './ios-privacy-source-audit.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT_PATH = fileURLToPath(new URL('./ios-privacy-source-audit.mjs', import.meta.url));
const BASELINE_SOURCE_PATH = join(REPO_ROOT, ...IOS_PRIVACY_BASELINE_PATH.split('/'));
const BASELINE_BYTES = readFileSync(BASELINE_SOURCE_PATH);
const BASELINE_SHA256 = 'fe04db2c5ce694c4f0269f9056aec49dd528e8421b54079a4fc2b97254c90921';
const BASELINE = JSON.parse(BASELINE_BYTES.toString('utf8'));
const REQUIRED_REASON_CATEGORIES = BASELINE.requiredReasonApiCategories;
const FILE_TIMESTAMP = 'NSPrivacyAccessedAPICategoryFileTimestamp';
const USER_DEFAULTS = 'NSPrivacyAccessedAPICategoryUserDefaults';
const VALID_DATA_TYPE = 'NSPrivacyCollectedDataTypeEmailAddress';
const VALID_PURPOSE = 'NSPrivacyCollectedDataTypePurposeAppFunctionality';
const FALSE_CLAIMS = Object.freeze({
  appStoreAcceptanceProven: false,
  appStorePrivacyLabelsVerified: false,
  archiveInspected: false,
  binarySignaturesVerified: false,
  mergedPrivacyReportVerified: false,
});
const XML_PREFIX = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
`;

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalLinesHash(values) {
  return sha256(Buffer.from(`${values.join('\n')}\n`, 'utf8'));
}

function xmlString(value) {
  return `<string>${value}</string>`;
}

function xmlArray(values) {
  return `<array>${values.join('')}</array>`;
}

function xmlKey(name, value) {
  return `<key>${name}</key>${value}`;
}

function plistDictionary(body = '') {
  return `${XML_PREFIX}<plist version="1.0"><dict>${body}</dict></plist>\n`;
}

function plistRoot(body) {
  return `${XML_PREFIX}<plist version="1.0">${body}</plist>\n`;
}

function accessedApiEntry(category, reasons) {
  return `<dict>${xmlKey('NSPrivacyAccessedAPIType', xmlString(category))}${xmlKey(
    'NSPrivacyAccessedAPITypeReasons',
    xmlArray(reasons.map(xmlString)),
  )}</dict>`;
}

function collectedDataEntry({
  dataType = VALID_DATA_TYPE,
  linked = false,
  purposes = [VALID_PURPOSE],
  tracking = false,
} = {}) {
  return `<dict>${xmlKey('NSPrivacyCollectedDataType', xmlString(dataType))}${xmlKey(
    'NSPrivacyCollectedDataTypeLinked',
    linked ? '<true/>' : '<false/>',
  )}${xmlKey('NSPrivacyCollectedDataTypePurposes', xmlArray(purposes.map(xmlString)))}${xmlKey(
    'NSPrivacyCollectedDataTypeTracking',
    tracking ? '<true/>' : '<false/>',
  )}</dict>`;
}

function validateManifest(contents, path = 'fixture/PrivacyInfo.xcprivacy') {
  return validatePrivacyManifestBytes({
    bytes: Buffer.isBuffer(contents) ? contents : Buffer.from(contents, 'utf8'),
    path,
    requiredReasonCategories: REQUIRED_REASON_CATEGORIES,
  });
}

function errorCodes(result) {
  return result.errors.map(({ code }) => code);
}

function assertHasCode(result, code) {
  assert.equal(result.status, 'source_invalid');
  assert.ok(
    errorCodes(result).includes(code),
    `Expected ${code}; received ${errorCodes(result).join(', ') || 'no errors'}`,
  );
  assert.equal(result.normalized, null);
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function safeCleanup(root) {
  const absolute = resolve(root);
  const temporaryRoot = resolve(tmpdir());
  const fromTemporaryRoot = relative(temporaryRoot, absolute);
  if (
    !fromTemporaryRoot.startsWith('layerwell-ios-privacy-audit-') ||
    fromTemporaryRoot.startsWith('..') ||
    fromTemporaryRoot.includes(sep)
  ) {
    throw new Error(`Refusing to clean unexpected fixture path: ${absolute}`);
  }
  rmSync(absolute, { force: true, recursive: true });
}

function packagePathFor(name) {
  return `node_modules/${name}`;
}

function createAuditFixture(t, packageSpecs = []) {
  const root = mkdtempSync(join(tmpdir(), 'layerwell-ios-privacy-audit-'));
  t.after(() => safeCleanup(root));

  const baselinePath = join(root, ...IOS_PRIVACY_BASELINE_PATH.split('/'));
  mkdirSync(dirname(baselinePath), { recursive: true });
  copyFileSync(BASELINE_SOURCE_PATH, baselinePath);
  writeJson(join(root, ...IOS_PRIVACY_MAPPING_PATH.split('/')), {
    schemaVersion: 1,
    generatedAgainst: {
      baselinePath: IOS_PRIVACY_BASELINE_PATH,
      baselineSchemaVersion: 1,
      sha256: BASELINE_SHA256,
    },
    mappings: [],
  });

  const lock = {
    name: 'ios-privacy-audit-fixture',
    version: '1.0.0',
    lockfileVersion: 3,
    requires: true,
    packages: {
      '': { name: 'ios-privacy-audit-fixture', version: '1.0.0' },
    },
  };
  for (const spec of packageSpecs) {
    const name = spec.name;
    const version = spec.version ?? '1.0.0';
    const packagePath = packagePathFor(name);
    const packageRoot = join(root, ...packagePath.split('/'));
    mkdirSync(packageRoot, { recursive: true });
    if (spec.packageJsonRaw !== undefined) {
      writeFileSync(join(packageRoot, 'package.json'), spec.packageJsonRaw, 'utf8');
    } else {
      writeJson(join(packageRoot, 'package.json'), {
        name,
        version,
        ...(spec.packageJson ?? {}),
      });
    }
    for (const directory of spec.directories ?? ['ios']) {
      mkdirSync(join(packageRoot, ...directory.split('/')), { recursive: true });
    }
    for (const [path, contents] of Object.entries(spec.files ?? {})) {
      const target = join(packageRoot, ...path.split('/'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
    }
    lock.packages[packagePath] = {
      version,
      resolved: `https://registry.npmjs.org/${name}/-/${name.replaceAll('/', '-')}-${version}.tgz`,
      integrity: 'sha512-YQ==',
    };
  }
  writeJson(join(root, 'package-lock.json'), lock);
  return root;
}

function issueCodes(report) {
  return report.errors.map(({ code }) => code);
}

function assertDeepFrozen(value, seen = new WeakSet()) {
  if (value === null || typeof value !== 'object' || seen.has(value)) return 0;
  seen.add(value);
  assert.equal(Object.isFrozen(value), true);
  return (
    1 + Object.values(value).reduce((count, child) => count + assertDeepFrozen(child, seen), 0)
  );
}

function captureIo() {
  const output = { errors: [], logs: [], warnings: [] };
  return {
    output,
    io: {
      error(value) {
        output.errors.push(String(value));
      },
      log(value) {
        output.logs.push(String(value));
      },
      warn(value) {
        output.warnings.push(String(value));
      },
    },
  };
}

function outputPath(root, relativePath) {
  return join(root, ...relativePath.split('/'));
}

test('pins and parses the installed react-native-view-shot privacy manifest', () => {
  assert.equal(sha256(BASELINE_BYTES), BASELINE_SHA256);
  const path = join(REPO_ROOT, 'node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy');
  const result = validateManifest(
    readFileSync(path),
    'node_modules/react-native-view-shot/ios/PrivacyInfo.xcprivacy',
  );
  assert.equal(result.status, 'source_valid');
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.normalized, {
    accessedApiTypes: [],
    collectedDataTypes: [],
    tracking: false,
    trackingDomains: [],
  });
});

test('accepts a minimal dictionary and deterministically normalizes a complete valid manifest', () => {
  const minimal = validateManifest(plistDictionary());
  assert.deepEqual(minimal, {
    status: 'source_valid',
    errors: [],
    normalized: {
      accessedApiTypes: [],
      collectedDataTypes: [],
      tracking: null,
      trackingDomains: [],
    },
  });

  const complete = validateManifest(
    plistDictionary(
      `${xmlKey('NSPrivacyTracking', '<true/>')}${xmlKey(
        'NSPrivacyTrackingDomains',
        xmlArray([xmlString('z.example.com'), xmlString('a.example.com')]),
      )}${xmlKey(
        'NSPrivacyAccessedAPITypes',
        xmlArray([accessedApiEntry(FILE_TIMESTAMP, ['C617.1', 'DDA9.1'])]),
      )}${xmlKey(
        'NSPrivacyCollectedDataTypes',
        xmlArray([
          collectedDataEntry({
            dataType: VALID_DATA_TYPE,
            linked: true,
            purposes: [VALID_PURPOSE],
            tracking: true,
          }),
        ]),
      )}`,
    ),
  );
  assert.equal(complete.status, 'source_valid');
  assert.deepEqual(complete.normalized, {
    accessedApiTypes: [{ category: FILE_TIMESTAMP, reasons: ['C617.1', 'DDA9.1'] }],
    collectedDataTypes: [
      {
        dataType: VALID_DATA_TYPE,
        linked: true,
        purposes: [VALID_PURPOSE],
        tracking: true,
      },
    ],
    tracking: true,
    trackingDomains: ['a.example.com', 'z.example.com'],
  });
});

test('rejects non-buffer, malformed, binary, non-dictionary, BOM, and invalid UTF-8 inputs', async (t) => {
  const cases = [
    [
      'non-buffer',
      () =>
        validatePrivacyManifestBytes({
          bytes: plistDictionary(),
          path: 'fixture/PrivacyInfo.xcprivacy',
          requiredReasonCategories: REQUIRED_REASON_CATEGORIES,
        }),
      'MANIFEST_BYTES',
    ],
    ['incomplete XML', () => validateManifest('<plist version="1.0"><dict>'), 'MANIFEST_XML'],
    [
      'malformed XML that passes the document boundary check',
      () =>
        validateManifest(
          `${XML_PREFIX}<plist version="1.0"><dict><key>NSPrivacyTracking</key><false></dict></plist>`,
        ),
      'MANIFEST_XML',
    ],
    [
      'non-XML junk before the plist root',
      () => validateManifest('junk<plist version="1.0"><dict/></plist>'),
      'MANIFEST_XML',
    ],
    [
      'binary plist',
      () => validateManifest(Buffer.concat([Buffer.from('bplist00'), Buffer.alloc(32)])),
      'MANIFEST_BINARY',
    ],
    ['non-dictionary root', () => validateManifest(plistRoot('<array/>')), 'MANIFEST_ROOT'],
    ['UTF-8 BOM', () => validateManifest(`\ufeff${plistDictionary()}`), 'UTF8_BOM'],
    ['invalid UTF-8', () => validateManifest(Buffer.from([0xff, 0xfe, 0xfd])), 'UTF8_INVALID'],
  ];
  for (const [name, run, code] of cases) {
    await t.test(name, () => assertHasCode(run(), code));
  }
});

test('rejects duplicate top-level dictionary keys before parser last-value recovery', () => {
  const result = validateManifest(
    plistDictionary(
      `${xmlKey('NSPrivacyTracking', '<false/>')}${xmlKey('NSPrivacyTracking', '<true/>')}${xmlKey(
        'NSPrivacyTrackingDomains',
        xmlArray([xmlString('tracker.example')]),
      )}`,
    ),
  );
  assertHasCode(result, 'MANIFEST_XML');
});

test('rejects unknown top-level keys and wrong top-level value types', async (t) => {
  const cases = [
    [
      'unknown key',
      plistDictionary(xmlKey('NSPrivacyInventedKey', xmlString('value'))),
      'MANIFEST_UNKNOWN_KEY',
    ],
    [
      'tracking string',
      plistDictionary(xmlKey('NSPrivacyTracking', xmlString('false'))),
      'MANIFEST_TRACKING_TYPE',
    ],
    [
      'domains string',
      plistDictionary(xmlKey('NSPrivacyTrackingDomains', xmlString('tracker.example.com'))),
      'MANIFEST_TRACKING_DOMAINS',
    ],
    [
      'accessed API dictionary',
      plistDictionary(xmlKey('NSPrivacyAccessedAPITypes', '<dict/>')),
      'MANIFEST_ACCESSED_API_EMPTY',
    ],
    [
      'collected data dictionary',
      plistDictionary(xmlKey('NSPrivacyCollectedDataTypes', '<dict/>')),
      'MANIFEST_COLLECTED_TYPE',
    ],
  ];
  for (const [name, contents, code] of cases) {
    await t.test(name, () => assertHasCode(validateManifest(contents), code));
  }
});

test('rejects an explicitly empty accessed-API array', () => {
  const result = validateManifest(plistDictionary(xmlKey('NSPrivacyAccessedAPITypes', '<array/>')));
  assert.deepEqual(errorCodes(result), ['MANIFEST_ACCESSED_API_EMPTY']);
  assert.equal(result.status, 'source_invalid');
});

test('rejects required-reason mismatches, duplicate reasons, and duplicate categories', async (t) => {
  const cases = [
    [
      'reason belongs to another category',
      [accessedApiEntry(FILE_TIMESTAMP, ['CA92.1'])],
      'MANIFEST_REASON_MISMATCH',
    ],
    [
      'duplicate reason',
      [accessedApiEntry(FILE_TIMESTAMP, ['DDA9.1', 'DDA9.1'])],
      'MANIFEST_REASON_DUPLICATE_OR_EMPTY',
    ],
    [
      'duplicate category',
      [accessedApiEntry(FILE_TIMESTAMP, ['DDA9.1']), accessedApiEntry(FILE_TIMESTAMP, ['C617.1'])],
      'MANIFEST_ACCESSED_API_DUPLICATE',
    ],
    [
      'unknown category',
      [accessedApiEntry('NSPrivacyAccessedAPICategoryInvented', ['DDA9.1'])],
      'MANIFEST_ACCESSED_API_CATEGORY',
    ],
    ['empty reasons', [accessedApiEntry(USER_DEFAULTS, [])], 'MANIFEST_REASON_DUPLICATE_OR_EMPTY'],
  ];
  for (const [name, entries, code] of cases) {
    await t.test(name, () => {
      const result = validateManifest(
        plistDictionary(xmlKey('NSPrivacyAccessedAPITypes', xmlArray(entries))),
      );
      assertHasCode(result, code);
    });
  }
});

test('rejects collected-data values outside Apple enums and invalid field values', async (t) => {
  const cases = [
    [
      'unknown collected data type',
      collectedDataEntry({ dataType: 'NSPrivacyCollectedDataTypeInvented' }),
      'MANIFEST_COLLECTED_NAME',
    ],
    [
      'unknown collected data purpose',
      collectedDataEntry({ purposes: ['NSPrivacyCollectedDataTypePurposeInvented'] }),
      'MANIFEST_COLLECTED_PURPOSE',
    ],
    ['empty purposes', collectedDataEntry({ purposes: [] }), 'MANIFEST_COLLECTED_PURPOSE'],
  ];
  for (const [name, entry, code] of cases) {
    await t.test(name, () => {
      const result = validateManifest(
        plistDictionary(xmlKey('NSPrivacyCollectedDataTypes', xmlArray([entry]))),
      );
      assertHasCode(result, code);
    });
  }

  const wrongBooleans = `<dict>${xmlKey(
    'NSPrivacyCollectedDataType',
    xmlString(VALID_DATA_TYPE),
  )}${xmlKey('NSPrivacyCollectedDataTypeLinked', xmlString('false'))}${xmlKey(
    'NSPrivacyCollectedDataTypePurposes',
    xmlArray([xmlString(VALID_PURPOSE)]),
  )}${xmlKey('NSPrivacyCollectedDataTypeTracking', '<false/>')}</dict>`;
  assertHasCode(
    validateManifest(
      plistDictionary(xmlKey('NSPrivacyCollectedDataTypes', xmlArray([wrongBooleans]))),
    ),
    'MANIFEST_COLLECTED_BOOLEAN',
  );
});

test('rejects duplicate collected types', () => {
  const entry = collectedDataEntry();
  assertHasCode(
    validateManifest(
      plistDictionary(xmlKey('NSPrivacyCollectedDataTypes', xmlArray([entry, entry]))),
    ),
    'MANIFEST_COLLECTED_DUPLICATE',
  );
});

test('rejects every tracking contradiction', async (t) => {
  const cases = [
    [
      'domains while tracking is false',
      `${xmlKey('NSPrivacyTracking', '<false/>')}${xmlKey(
        'NSPrivacyTrackingDomains',
        xmlArray([xmlString('tracker.example.com')]),
      )}`,
    ],
    [
      'tracking true without domains',
      `${xmlKey('NSPrivacyTracking', '<true/>')}${xmlKey('NSPrivacyTrackingDomains', '<array/>')}`,
    ],
    [
      'collected item tracks while top-level tracking is false',
      `${xmlKey('NSPrivacyTracking', '<false/>')}${xmlKey(
        'NSPrivacyCollectedDataTypes',
        xmlArray([collectedDataEntry({ tracking: true })]),
      )}`,
    ],
  ];
  for (const [name, body] of cases) {
    await t.test(name, () =>
      assertHasCode(validateManifest(plistDictionary(body)), 'MANIFEST_TRACKING_CONTRADICTION'),
    );
  }
});

test('accepts DNS-style tracking hosts and rejects unsafe, ambiguous, duplicate, and IP hosts', async (t) => {
  const valid = validateManifest(
    plistDictionary(
      `${xmlKey('NSPrivacyTracking', '<true/>')}${xmlKey(
        'NSPrivacyTrackingDomains',
        xmlArray([xmlString('tracker.example.com'), xmlString('a-b.example.co')]),
      )}`,
    ),
  );
  assert.equal(valid.status, 'source_valid');

  const invalidSets = [
    ['query', ['tracker.example.com?user=1']],
    ['wildcard', ['*.example.com']],
    ['leading hyphen', ['-tracker.example.com']],
    ['trailing hyphen', ['tracker-.example.com']],
    ['empty label', ['tracker..example.com']],
    ['IPv4', ['127.0.0.1']],
    ['IPv6', ['[2001:db8::1]']],
    ['localhost', ['localhost']],
    ['port', ['tracker.example.com:443']],
    ['scheme', ['https://tracker.example.com']],
    ['path', ['tracker.example.com/pixel']],
    ['unicode label', ['tr\u00e1cker.example.com']],
    ['case-insensitive duplicate', ['tracker.example.com', 'TRACKER.EXAMPLE.COM']],
    ['case-insensitive two-label duplicate', ['Tracker.Example', 'tracker.example']],
    ['overlong label', [`${'a'.repeat(64)}.example.com`]],
  ];
  for (const [name, domains] of invalidSets) {
    await t.test(name, () => {
      const result = validateManifest(
        plistDictionary(
          `${xmlKey('NSPrivacyTracking', '<true/>')}${xmlKey(
            'NSPrivacyTrackingDomains',
            xmlArray(domains.map(xmlString)),
          )}`,
        ),
      );
      assertHasCode(result, 'MANIFEST_TRACKING_DOMAINS');
    });
  }
});

test('rejects source-only reports that make archive, labels, signatures, review, or acceptance claims', () => {
  assert.equal(
    validateIosPrivacyAuditClaims({ status: 'source_valid', claims: { ...FALSE_CLAIMS } }),
    true,
  );
  for (const key of Object.keys(FALSE_CLAIMS)) {
    assert.throws(
      () =>
        validateIosPrivacyAuditClaims({
          status: 'archive_required',
          claims: { ...FALSE_CLAIMS, [key]: true },
        }),
      (error) => {
        assert.ok(error instanceof IosPrivacyContractError);
        assert.equal(error.code, 'AUDIT_FALSE_CLAIM');
        assert.match(error.message, new RegExp(key));
        return true;
      },
    );
  }
  assert.throws(
    () =>
      validateIosPrivacyAuditClaims({
        status: 'source_valid',
        claims: { ...FALSE_CLAIMS, inventedClaim: false },
      }),
    (error) => error instanceof IosPrivacyContractError && error.code === 'AUDIT_CLAIMS_SCHEMA',
  );
});

test('rejects nested archive-inclusion and signature claims anywhere in report arrays or records', () => {
  const cases = [
    {
      key: 'archiveInclusionProven',
      report: {
        status: 'archive_required',
        claims: { ...FALSE_CLAIMS },
        nativePackages: [{ evidence: { archiveInclusionProven: true } }],
      },
    },
    {
      key: 'signatureProven',
      report: {
        status: 'archive_required',
        claims: { ...FALSE_CLAIMS },
        xcframeworkSourceCandidates: [{ slices: [{ signatureProven: true }] }],
      },
    },
  ];
  for (const { key, report } of cases) {
    assert.throws(
      () => validateIosPrivacyAuditClaims(report),
      (error) => {
        assert.ok(error instanceof IosPrivacyContractError);
        assert.equal(error.code, 'AUDIT_FALSE_CLAIM');
        assert.match(error.message, new RegExp(key));
        return true;
      },
    );
  }
});

test('audits a minimal fixture deterministically and still requires archive follow-up', (t) => {
  const root = createAuditFixture(t);
  const first = auditIosPrivacySource({ root });
  const second = auditIosPrivacySource({ root });
  assert.equal(first.status, 'archive_required');
  assert.deepEqual(first.claims, FALSE_CLAIMS);
  assert.deepEqual(second, first);
  assert.equal(canonicalAuditJson(second), canonicalAuditJson(first));
  assert.equal(
    renderIosPrivacySourceAuditMarkdown(second),
    renderIosPrivacySourceAuditMarkdown(first),
  );
  assert.deepEqual(first.errors, []);
  assert.deepEqual(
    first.warnings.map(({ code }) => code),
    ['ARCHIVE_REQUIRED'],
  );
});

test('deeply freezes the audit report so mutation cannot alter deterministic serialization', (t) => {
  const root = createAuditFixture(t, [{ name: 'native-frozen' }]);
  const report = auditIosPrivacySource({ root });
  const before = canonicalAuditJson(report);
  const frozenObjectCount = assertDeepFrozen(report);
  assert.ok(
    frozenObjectCount > 20,
    `Expected a nested report; found ${frozenObjectCount} objects.`,
  );
  assert.equal(Object.isFrozen(report.nativePackages), true);
  assert.equal(Object.isFrozen(report.nativePackages[0]), true);
  assert.equal(Object.isFrozen(report.inputs.baseline), true);
  assert.equal(Object.isFrozen(report.warnings[0]), true);

  for (const mutate of [
    () => {
      report.status = 'source_invalid';
    },
    () => {
      report.claims.archiveInspected = true;
    },
    () => {
      report.nativePackages.push({ packageName: 'injected' });
    },
    () => {
      report.inputs.baseline.sha256 = '0'.repeat(64);
    },
  ]) {
    assert.throws(mutate, TypeError);
  }
  assert.equal(canonicalAuditJson(report), before);
});

test('rejects a mutated baseline even when its published and sorted digests are recomputed', (t) => {
  const root = createAuditFixture(t);
  const path = outputPath(root, IOS_PRIVACY_BASELINE_PATH);
  const baseline = JSON.parse(readFileSync(path, 'utf8'));
  baseline.requiredThirdPartySdks[0] = 'MutatedReviewedSdkName';
  baseline.provenance.publishedOrderSha256 = canonicalLinesHash(baseline.requiredThirdPartySdks);
  baseline.provenance.sortedSha256 = canonicalLinesHash(
    [...baseline.requiredThirdPartySdks].sort(),
  );
  writeJson(path, baseline);

  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(issueCodes(report).includes('BASELINE_HASH'));
  assert.equal(report.inputs.baseline.sha256, sha256(readFileSync(path)));
  assert.notEqual(report.inputs.baseline.sha256, BASELINE_SHA256);
  assert.deepEqual(report.claims, FALSE_CLAIMS);
});

test('binds exact podspec privacy resources and ignores Ruby comments as evidence', (t) => {
  const manifest = plistDictionary();
  const root = createAuditFixture(t, [
    {
      name: 'native-bound',
      files: {
        'NativeBound.podspec': `Pod::Spec.new do |s|\n  s.resources = ['ios/PrivacyInfo.xcprivacy']\nend\n`,
        'ios/PrivacyInfo.xcprivacy': manifest,
      },
    },
    {
      name: 'native-comments',
      files: {
        'NativeComments.podspec': `# s.dependency 'GoogleSignIn'\n=begin\ns.resources = ['ios/PrivacyInfo.xcprivacy']\n=end\nPod::Spec.new do |s|\nend\n`,
      },
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  const boundPodspec = report.podspecs.find(({ packageName }) => packageName === 'native-bound');
  assert.deepEqual(boundPodspec.privacyManifestResourceBindings, [
    {
      archiveInclusionProven: false,
      evidenceType: 'podspec_source_resource_assignment_token',
      reference: 'ios/PrivacyInfo.xcprivacy',
      resolvedPath: 'node_modules/native-bound/ios/PrivacyInfo.xcprivacy',
      status: 'source_reference_candidate',
    },
  ]);
  const commentsPodspec = report.podspecs.find(
    ({ packageName }) => packageName === 'native-comments',
  );
  assert.deepEqual(commentsPodspec.dependencies, []);
  assert.deepEqual(commentsPodspec.privacyManifestResourceReferences, []);
  assert.equal(
    report.appleSdkIntersections.some(({ packageName }) => packageName === 'native-comments'),
    false,
  );
});

test('retains unresolved standalone manifests as archive-required warnings', (t) => {
  const root = createAuditFixture(t, [
    {
      name: 'native-unreferenced',
      files: { 'ios/PrivacyInfo.xcprivacy': plistDictionary() },
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(
    report.warnings.some(
      ({ code, path }) =>
        code === 'MANIFEST_BINDING_ARCHIVE_REQUIRED' &&
        path === 'node_modules/native-unreferenced/ios/PrivacyInfo.xcprivacy',
    ),
  );
});

test('does not treat an arbitrary quoted podspec string as a resource binding', (t) => {
  const root = createAuditFixture(t, [
    {
      name: 'native-note-only',
      files: {
        'NativeNoteOnly.podspec': `note = 'ios/PrivacyInfo.xcprivacy'\n`,
        'ios/PrivacyInfo.xcprivacy': plistDictionary(),
      },
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(
    report.warnings.some(
      ({ code, path }) =>
        code === 'MANIFEST_BINDING_ARCHIVE_REQUIRED' &&
        path === 'node_modules/native-note-only/ios/PrivacyInfo.xcprivacy',
    ),
  );
  const podspec = report.podspecs.find(({ packageName }) => packageName === 'native-note-only');
  assert.deepEqual(podspec.privacyManifestResourceReferences, []);
  assert.deepEqual(podspec.privacyManifestResourceBindings, []);
});

test('does not parse a .resources assignment token embedded inside a Ruby string literal', (t) => {
  const root = createAuditFixture(t, [
    {
      name: 'native-string-token',
      files: {
        'NativeStringToken.podspec': `message = ".resources = ['ios/PrivacyInfo.xcprivacy']"\n`,
        'ios/PrivacyInfo.xcprivacy': plistDictionary(),
      },
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.ok(
    report.warnings.some(
      ({ code, path }) =>
        code === 'MANIFEST_BINDING_ARCHIVE_REQUIRED' &&
        path === 'node_modules/native-string-token/ios/PrivacyInfo.xcprivacy',
    ),
  );
  const podspec = report.podspecs.find(({ packageName }) => packageName === 'native-string-token');
  assert.deepEqual(podspec.privacyManifestResourceReferences, []);
  assert.deepEqual(podspec.privacyManifestResourceBindings, []);
});

test('treats an embedded XCFramework manifest as source-container bound', (t) => {
  const manifestPath = 'node_modules/native-xc/Native.xcframework/PrivacyInfo.xcprivacy';
  const root = createAuditFixture(t, [
    {
      name: 'native-xc',
      files: {
        'Native.xcframework/PrivacyInfo.xcprivacy': plistDictionary(),
        'Native.xcframework/Info.plist': plistDictionary(),
      },
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'archive_required');
  assert.deepEqual(report.errors, []);
  assert.equal(
    report.warnings.some(
      ({ code, path }) => code === 'MANIFEST_BINDING_ARCHIVE_REQUIRED' && path === manifestPath,
    ),
    false,
  );
  assert.equal(report.xcframeworkSourceCandidates.length, 1);
  assert.deepEqual(report.xcframeworkSourceCandidates[0].privacyManifestPaths, [manifestPath]);
});

test('rejects non-exact, escaping, and missing podspec privacy resources', async (t) => {
  const cases = [
    [
      'glob reference',
      {
        name: 'native-glob',
        files: {
          'NativeGlob.podspec': `s.resources = ['ios/**/PrivacyInfo.xcprivacy']\n`,
          'ios/PrivacyInfo.xcprivacy': plistDictionary(),
        },
      },
      'PODSPEC_PRIVACY_RESOURCE',
    ],
    [
      'package escape',
      {
        name: 'native-escape',
        files: {
          'NativeEscape.podspec': `s.resources = ['../outside/PrivacyInfo.xcprivacy']\n`,
          'ios/PrivacyInfo.xcprivacy': plistDictionary(),
        },
      },
      'PODSPEC_PRIVACY_RESOURCE_ESCAPE',
    ],
    [
      'missing exact target',
      {
        name: 'native-missing',
        files: {
          'NativeMissing.podspec': `s.resources = ['ios/missing/PrivacyInfo.xcprivacy']\n`,
        },
      },
      'PODSPEC_PRIVACY_RESOURCE_MISSING',
    ],
  ];
  for (const [name, spec, code] of cases) {
    await t.test(name, (child) => {
      const root = createAuditFixture(child, [spec]);
      const report = auditIosPrivacySource({ root });
      assert.equal(report.status, 'source_invalid');
      assert.ok(
        issueCodes(report).includes(code),
        `Expected ${code}; received ${issueCodes(report).join(', ')}`,
      );
    });
  }
});

test('does not silently skip a malformed native package.json', (t) => {
  const root = createAuditFixture(t, [
    { name: 'native-malformed', packageJsonRaw: '{', directories: ['ios'] },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(issueCodes(report).includes('JSON_INVALID'));
  assert.ok(issueCodes(report).includes('PACKAGE_VERSION_DRIFT'));
  const packageEntry = report.nativePackages.find(
    ({ packageName }) => packageName === 'native-malformed',
  );
  assert.equal(packageEntry.status, 'source_invalid');
  assert.equal(packageEntry.packageJsonSha256, null);
});

test('ledgers a malformed installed package.json even without another native root signal', (t) => {
  const root = createAuditFixture(t, [
    {
      name: 'malformed-no-native-signal',
      packageJsonRaw: '{',
      directories: [],
    },
  ]);
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(issueCodes(report).includes('JSON_INVALID'));
  assert.ok(issueCodes(report).includes('PACKAGE_VERSION_DRIFT'));
  const packageEntry = report.nativePackages.find(
    ({ packageName }) => packageName === 'malformed-no-native-signal',
  );
  assert.ok(packageEntry);
  assert.equal(packageEntry.status, 'source_invalid');
  assert.deepEqual(packageEntry.rootSignals, ['package-json-invalid']);
  assert.equal(packageEntry.packageJsonSha256, null);
});

test('applies the total native traversal bound globally across packages', (t) => {
  const root = createAuditFixture(t, [{ name: 'native-a' }, { name: 'native-b' }]);
  const report = auditIosPrivacySource({
    root,
    bounds: { maxTotalWalkEntries: 3 },
  });
  assert.equal(report.status, 'source_invalid');
  assert.ok(issueCodes(report).includes('WALK_COUNT'));
  assert.equal(report.nativePackages.length, 2);
  assert.equal(report.nativePackages.filter(({ status }) => status === 'source_invalid').length, 1);
});

test('rejects oversized manifests, excessive depth, and unreviewed bound overrides', (t) => {
  const oversizedRoot = createAuditFixture(t, [
    {
      name: 'native-oversized',
      files: {
        'ios/PrivacyInfo.xcprivacy': `${plistDictionary()}${'x'.repeat(128)}`,
      },
    },
  ]);
  const oversized = auditIosPrivacySource({
    root: oversizedRoot,
    bounds: { maxPrivacyManifestBytes: 64 },
  });
  assert.ok(issueCodes(oversized).includes('FILE_SIZE'));

  const deepRoot = createAuditFixture(t, [
    {
      name: 'native-deep',
      directories: ['ios/a/b'],
    },
  ]);
  const deep = auditIosPrivacySource({ root: deepRoot, bounds: { maxWalkDepth: 1 } });
  assert.ok(issueCodes(deep).includes('WALK_DEPTH'));

  for (const bounds of [
    { inventedBound: 1 },
    { maxWalkDepth: 0 },
    { maxWalkDepth: IOS_PRIVACY_DEFAULT_BOUNDS.maxWalkDepth + 1 },
  ]) {
    assert.throws(
      () => auditIosPrivacySource({ root: deepRoot, bounds }),
      (error) => error instanceof IosPrivacyContractError && error.code === 'AUDIT_BOUNDS',
    );
  }
});

test('rejects a symlink or junction inside native source traversal', (t) => {
  const root = createAuditFixture(t, [{ name: 'native-linked' }]);
  const packageRoot = outputPath(root, packagePathFor('native-linked'));
  const target = join(packageRoot, 'real-source');
  const link = join(packageRoot, 'linked-source');
  mkdirSync(target);
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Directory link creation is unavailable on this Windows host.');
      return;
    }
    throw error;
  }
  const report = auditIosPrivacySource({ root });
  assert.equal(report.status, 'source_invalid');
  assert.ok(issueCodes(report).includes('PATH_SYMLINK'));
});

test('CLI rejects unknown, duplicate, conflicting, unsafe, and colliding arguments', (t) => {
  const root = createAuditFixture(t);
  const directCases = [
    [['--unknown'], /Unknown argument/],
    [['--root', root, '--root', root], /Duplicate argument/],
    [['--root'], /Missing value/],
    [['--root', root, '--write', '--check'], /mutually exclusive/],
    [['--root', root, '--json', '../escape.json', '--check'], /unsafe segment|escapes/],
    [['--root', root, '--json', 'docs\\audit.json', '--check'], /normalized/],
    [
      [
        '--root',
        root,
        '--json',
        'docs/phase-9/generated/same.json',
        '--markdown',
        'docs/phase-9/generated/same.json',
        '--check',
      ],
      /different files/,
    ],
  ];
  for (const [args, expected] of directCases) {
    assert.throws(() => runIosPrivacySourceAudit(args), expected);
  }

  for (const args of [['--unknown'], ['--help', '--help']]) {
    const result = spawnSync(process.execPath, [SCRIPT_PATH, ...args], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Unknown argument|Duplicate argument/);
    assert.equal(result.stdout, '');
  }
});

test('CLI --write is deterministic and --check is read-only on success and drift', (t) => {
  const root = createAuditFixture(t);
  const writer = captureIo();
  assert.equal(runIosPrivacySourceAudit(['--root', root, '--write', '--strict'], writer.io), 0);
  assert.match(writer.output.logs[0], /Wrote deterministic/);

  const jsonPath = outputPath(root, IOS_PRIVACY_AUDIT_JSON_PATH);
  const markdownPath = outputPath(root, IOS_PRIVACY_AUDIT_MARKDOWN_PATH);
  const report = auditIosPrivacySource({ root });
  assert.equal(readFileSync(jsonPath, 'utf8'), canonicalAuditJson(report));
  assert.equal(readFileSync(markdownPath, 'utf8'), renderIosPrivacySourceAuditMarkdown(report));
  assert.deepEqual(
    readdirSync(dirname(jsonPath)).sort(),
    [basename(jsonPath), basename(markdownPath)].sort(),
  );

  const checker = captureIo();
  const jsonBeforeCheck = readFileSync(jsonPath);
  const markdownBeforeCheck = readFileSync(markdownPath);
  const jsonStatBeforeCheck = statSync(jsonPath);
  const markdownStatBeforeCheck = statSync(markdownPath);
  assert.equal(runIosPrivacySourceAudit(['--root', root, '--check', '--strict'], checker.io), 0);
  assert.deepEqual(readFileSync(jsonPath), jsonBeforeCheck);
  assert.deepEqual(readFileSync(markdownPath), markdownBeforeCheck);
  assert.equal(statSync(jsonPath).mtimeMs, jsonStatBeforeCheck.mtimeMs);
  assert.equal(statSync(markdownPath).mtimeMs, markdownStatBeforeCheck.mtimeMs);

  writeFileSync(jsonPath, Buffer.concat([jsonBeforeCheck, Buffer.from(' ')]));
  const driftedBytes = readFileSync(jsonPath);
  const driftedStat = statSync(jsonPath);
  assert.throws(
    () => runIosPrivacySourceAudit(['--root', root, '--check', '--strict'], captureIo().io),
    /deterministic drift/,
  );
  assert.deepEqual(readFileSync(jsonPath), driftedBytes);
  assert.equal(statSync(jsonPath).mtimeMs, driftedStat.mtimeMs);
  assert.deepEqual(
    readdirSync(dirname(jsonPath)).sort(),
    [basename(jsonPath), basename(markdownPath)].sort(),
  );
});

test('CLI strict mode fails closed before writing invalid source evidence', (t) => {
  const root = createAuditFixture(t);
  const baselinePath = outputPath(root, IOS_PRIVACY_BASELINE_PATH);
  writeFileSync(baselinePath, Buffer.concat([readFileSync(baselinePath), Buffer.from(' ')]));
  const captured = captureIo();
  assert.equal(runIosPrivacySourceAudit(['--root', root, '--write', '--strict'], captured.io), 1);
  assert.ok(captured.output.errors.some((value) => value.includes('BASELINE_HASH')));
  assert.equal(existsSync(outputPath(root, IOS_PRIVACY_AUDIT_JSON_PATH)), false);
  assert.equal(existsSync(outputPath(root, IOS_PRIVACY_AUDIT_MARKDOWN_PATH)), false);
});

test('CLI refuses a generated-output directory link without touching its target', (t) => {
  const root = createAuditFixture(t);
  const target = join(root, 'generated-target');
  const link = dirname(outputPath(root, IOS_PRIVACY_AUDIT_JSON_PATH));
  mkdirSync(target);
  try {
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('Directory link creation is unavailable on this Windows host.');
      return;
    }
    throw error;
  }
  assert.throws(
    () => runIosPrivacySourceAudit(['--root', root, '--write'], captureIo().io),
    /symlink/,
  );
  assert.deepEqual(readFileSync(BASELINE_SOURCE_PATH), BASELINE_BYTES);
  assert.deepEqual(existsSync(join(target, 'ios-privacy-source-audit.json')), false);
});

test('CLI refuses existing output paths that are distinct hardlinks to one inode', (t) => {
  const root = createAuditFixture(t);
  const jsonPath = outputPath(root, IOS_PRIVACY_AUDIT_JSON_PATH);
  const markdownPath = outputPath(root, IOS_PRIVACY_AUDIT_MARKDOWN_PATH);
  mkdirSync(dirname(jsonPath), { recursive: true });
  const seed = Buffer.from('hardlink-seed', 'utf8');
  writeFileSync(jsonPath, seed);
  try {
    linkSync(jsonPath, markdownPath);
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP', 'EOPNOTSUPP'].includes(error.code)) {
      t.skip('Hardlinks are unavailable on this filesystem.');
      return;
    }
    throw error;
  }
  assert.deepEqual(readFileSync(markdownPath), seed);
  assert.throws(
    () => runIosPrivacySourceAudit(['--root', root, '--write'], captureIo().io),
    /same|identity|hard.?link|collid|different/i,
  );
  assert.deepEqual(readFileSync(jsonPath), seed);
  assert.deepEqual(readFileSync(markdownPath), seed);
  assert.deepEqual(
    readdirSync(dirname(jsonPath)).sort(),
    [basename(jsonPath), basename(markdownPath)].sort(),
  );
});

test('CLI refuses output paths that collide by case on case-insensitive filesystems', (t) => {
  if (process.platform !== 'win32') {
    t.skip('This case-collision contract is specific to case-insensitive Windows paths.');
    return;
  }
  const root = createAuditFixture(t);
  const upper = 'docs/phase-9/generated/Privacy-Audit.json';
  const lower = 'docs/phase-9/generated/privacy-audit.json';
  assert.throws(
    () =>
      runIosPrivacySourceAudit(
        ['--root', root, '--json', upper, '--markdown', lower, '--write'],
        captureIo().io,
      ),
    /same|case|collid|different/i,
  );
  assert.equal(existsSync(outputPath(root, upper)), false);
  assert.equal(existsSync(outputPath(root, lower)), false);
});

test('CLI refuses an existing output-file symlink without mutating its target', (t) => {
  const root = createAuditFixture(t);
  const jsonPath = outputPath(root, IOS_PRIVACY_AUDIT_JSON_PATH);
  const target = join(root, 'output-symlink-target.json');
  const seed = Buffer.from('symlink-target-seed', 'utf8');
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(target, seed);
  try {
    symlinkSync(target, jsonPath, 'file');
  } catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES'].includes(error.code)) {
      t.skip('File symlink creation is unavailable on this Windows host.');
      return;
    }
    throw error;
  }
  assert.throws(
    () => runIosPrivacySourceAudit(['--root', root, '--write'], captureIo().io),
    /symlink|regular file/,
  );
  assert.deepEqual(readFileSync(target), seed);
  assert.equal(existsSync(outputPath(root, IOS_PRIVACY_AUDIT_MARKDOWN_PATH)), false);
});
