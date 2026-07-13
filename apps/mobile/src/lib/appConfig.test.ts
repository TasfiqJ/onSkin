import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const requireConfig = createRequire(import.meta.url);
const APP_CONFIG_PATH = requireConfig.resolve('../../app.config.js');
const REVIEW_EVIDENCE_PATH = requireConfig.resolve('../../phase3-review-evidence.js');

type ReviewSourceRecord = {
  path: string;
  exists: boolean;
  bytes?: number;
  sha256?: string;
};

type ReviewSignoffRecord = {
  schemaVersion: number;
  itemId: string;
  reviewSnapshotSha256: string;
  attestor: { name: string; credentialOrRole: string };
  reviewDate: string;
  decision: {
    disposition: string;
    conditions: string[];
    conditionsSatisfied: boolean;
  };
  evidenceReference: string;
  productionGate: null | { state: string; reason: string; owner: string };
};

type ReviewWorklist = {
  schemaVersion: number;
  gitStatus: string;
  reviewLogs: (ReviewSourceRecord & { domain: string })[];
  summary: {
    itemCount: number;
    domainCounts: Record<string, number>;
    statusCounts: Record<string, number>;
    signedItemCount: number;
    unsignedReleaseDispositionCount: number;
    missingSourcePathCount: number;
    blockerCount: number;
    warningCount?: number;
  };
  items: {
    id: string;
    domain: string;
    area?: string;
    requiredReviewer?: string;
    statusBucket: string;
    reviewer: string;
    date: string;
    currentBehavior?: string;
    notes?: string;
    sourceText?: string;
    sourcePaths: ReviewSourceRecord[];
    reviewSnapshotSha256: string;
    signoff: {
      file: ReviewSourceRecord;
      record: ReviewSignoffRecord;
    } | null;
  }[];
  blockers: string[];
  warnings: string[];
};

const reviewEvidence = requireConfig(REVIEW_EVIDENCE_PATH) as {
  computeReviewSnapshotSha256(item: ReviewWorklist['items'][number]): string;
  createReleaseReadyTestWorklist(): ReviewWorklist;
  validateReviewWorklist(
    worklist: ReviewWorklist,
    options?: {
      rootDir?: string;
      verifyHashes?: boolean;
      verifyLogRows?: boolean;
      verifySignoffFiles?: boolean;
    },
  ): string[];
};

const runtime = globalThis as typeof globalThis & {
  __ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__?: ReviewWorklist;
};

const APP_ENV_KEYS = [
  'APP_VARIANT',
  'EXPO_PUBLIC_APP_ENV',
  'BRAND_LEGAL_CLEARANCE',
  'PHASE3_RELEASE_CLEARANCE',
  'APP_DISPLAY_NAME',
  'EXPO_PUBLIC_APP_DISPLAY_NAME',
  'APP_SLUG',
  'APP_SCHEME',
  'EXPO_PUBLIC_APP_SCHEME',
  'APP_IOS_BUNDLE_IDENTIFIER',
  'APP_ANDROID_PACKAGE',
  'APP_CAMERA_USAGE_DESCRIPTION',
  'APP_FACE_ID_USAGE_DESCRIPTION',
  'APP_CAMERA_PERMISSION',
  'APP_FACE_ID_PERMISSION',
  'EXPO_PUBLIC_FINAL_BRAND_DOMAIN',
  'EXPO_PUBLIC_APP_STORE_URL',
  'EXPO_PUBLIC_PLAY_STORE_URL',
] as const;

function buildExpoConfig(
  env: Partial<Record<(typeof APP_ENV_KEYS)[number], string>>,
  options: { releaseReadyReviewEvidence?: boolean } = {},
) {
  const previous = new Map<string, string | undefined>();
  const previousTestWorklist = runtime.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__;
  for (const key of APP_ENV_KEYS) {
    previous.set(key, process.env[key]);
    delete process.env[key];
  }

  Object.assign(process.env, env);
  if (options.releaseReadyReviewEvidence) {
    runtime.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__ =
      reviewEvidence.createReleaseReadyTestWorklist();
  } else {
    delete runtime.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__;
  }
  delete requireConfig.cache[APP_CONFIG_PATH];

  try {
    return requireConfig(APP_CONFIG_PATH)().expo;
  } finally {
    delete requireConfig.cache[APP_CONFIG_PATH];
    if (previousTestWorklist === undefined) {
      delete runtime.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__;
    } else {
      runtime.__ROUTINEKIND_PHASE3_REVIEW_TEST_WORKLIST__ = previousTestWorklist;
    }
    for (const [key, value] of previous) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function intentFilterText(expo: ReturnType<typeof buildExpoConfig>): string {
  return JSON.stringify(expo.android?.intentFilters ?? []);
}

function pluginOptions(
  expo: ReturnType<typeof buildExpoConfig>,
  name: string,
): Record<string, unknown> {
  const plugin = (expo.plugins ?? []).find((candidate: unknown) =>
    Array.isArray(candidate) ? candidate[0] === name : candidate === name,
  );
  return Array.isArray(plugin) && typeof plugin[1] === 'object' && plugin[1] !== null
    ? (plugin[1] as Record<string, unknown>)
    : {};
}

describe('Expo app identity config', () => {
  it('defaults unset local config reads to the development install identity', () => {
    const expo = buildExpoConfig({});

    expect(expo.name).toBe('RoutineKind Dev');
    expect(expo.slug).toBe('routinekind');
    expect(expo.scheme).toBe('routinekind-development');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app.development');
    expect(expo.android.package).toBe('com.routinekind.app.development');
    expect(expo.extra.appVariant).toBe('development');
    expect(expo.extra.appEnvironment).toBe('development');
  });

  it('keeps the accepted launch support floor enforced in native config', () => {
    const expo = buildExpoConfig({});
    const buildProperties = pluginOptions(expo, 'expo-build-properties') as {
      android?: {
        compileSdkVersion?: number;
        minSdkVersion?: number;
        targetSdkVersion?: number;
      };
    };

    expect(expo.ios.supportsTablet).toBe(false);
    expect(expo.ios.deploymentTarget).toBe('17.0');
    expect(buildProperties.android?.minSdkVersion).toBe(29);
    expect(buildProperties.android?.compileSdkVersion).toBe(36);
    expect(buildProperties.android?.targetSdkVersion).toBe(36);
  });

  it('uses production identity only when the production variant is explicit', () => {
    const expo = buildExpoConfig(
      {
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      },
      { releaseReadyReviewEvidence: true },
    );

    expect(expo.name).toBe('RoutineKind');
    expect(expo.slug).toBe('routinekind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app');
    expect(expo.android.package).toBe('com.routinekind.app');
    expect(expo.extra.appVariant).toBe('production');
    expect(expo.extra.appEnvironment).toBe('production');
  });

  it('does not require Android production identity for the iOS-only launch contract', () => {
    const expo = buildExpoConfig(
      {
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
      },
      { releaseReadyReviewEvidence: true },
    );

    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app');
    expect(expo.android.package).toBe('com.routinekind.app');
  });

  it('normalizes supported app variant and environment values before resolving identity', () => {
    const expo = buildExpoConfig(
      {
        APP_VARIANT: ' Production ',
        EXPO_PUBLIC_APP_ENV: ' PRODUCTION ',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      },
      { releaseReadyReviewEvidence: true },
    );

    expect(expo.name).toBe('RoutineKind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.extra.appVariant).toBe('production');
    expect(expo.extra.appEnvironment).toBe('production');
  });

  it('rejects blank or unsupported app variants instead of falling back to base identity', () => {
    expect(() => buildExpoConfig({ APP_VARIANT: '' })).toThrow(
      /APP_VARIANT must be development, staging, or production/,
    );
    expect(() => buildExpoConfig({ APP_VARIANT: 'prod' })).toThrow(
      /APP_VARIANT must be development, staging, or production/,
    );
  });

  it('rejects unsupported public app environments in native config', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'staging',
        EXPO_PUBLIC_APP_ENV: 'preview',
      }),
    ).toThrow(/EXPO_PUBLIC_APP_ENV must be development, staging, or production/);
  });

  it('requires brand clearance before resolving production native config', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      }),
    ).toThrow(/requires BRAND_LEGAL_CLEARANCE=cleared/);
  });

  it('blocks cleared production builds that inherit base identity defaults', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
      }),
    ).toThrow(/APP_DISPLAY_NAME or EXPO_PUBLIC_APP_DISPLAY_NAME/);
  });

  it('blocks partial rebrand production builds that still inherit legacy package IDs', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
      }),
    ).toThrow(/APP_IOS_BUNDLE_IDENTIFIER/);
  });

  it('blocks production config until the Phase 3 review packet is cleared', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      }),
    ).toThrow(/requires PHASE3_RELEASE_CLEARANCE=cleared/);
  });

  it('does not accept an ambiguous Phase 3 production clearance value', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'pending',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      }),
    ).toThrow(/requires PHASE3_RELEASE_CLEARANCE=cleared/);
  });

  it('does not let the clearance flag bypass unresolved reviewer evidence', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'RoutineKind',
        APP_SLUG: 'routinekind',
        APP_SCHEME: 'routinekind',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.routinekind.app',
        APP_ANDROID_PACKAGE: 'com.routinekind.app',
      }),
    ).toThrow(/review evidence is not release-ready/);
  });

  it('blocks a production runtime environment even under an internal build variant', () => {
    expect(() =>
      buildExpoConfig({
        APP_VARIANT: 'staging',
        EXPO_PUBLIC_APP_ENV: 'production',
      }),
    ).toThrow(/requires PHASE3_RELEASE_CLEARANCE=cleared/);
  });

  it('allows counsel-cleared legacy identity only when explicitly supplied', () => {
    const expo = buildExpoConfig(
      {
        APP_VARIANT: 'production',
        EXPO_PUBLIC_APP_ENV: 'production',
        BRAND_LEGAL_CLEARANCE: 'cleared',
        PHASE3_RELEASE_CLEARANCE: 'cleared',
        APP_DISPLAY_NAME: 'OnSkin',
        APP_SLUG: 'onskin',
        APP_SCHEME: 'onskin',
        APP_IOS_BUNDLE_IDENTIFIER: 'com.onskin.app',
        APP_ANDROID_PACKAGE: 'com.onskin.app',
      },
      { releaseReadyReviewEvidence: true },
    );

    expect(expo.name).toBe('OnSkin');
    expect(expo.slug).toBe('onskin');
    expect(expo.scheme).toBe('onskin');
    expect(expo.ios.bundleIdentifier).toBe('com.onskin.app');
    expect(expo.android.package).toBe('com.onskin.app');
  });

  it('allows public runtime identity env to drive native display and scheme fallbacks', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_DISPLAY_NAME: 'RoutineKind',
      EXPO_PUBLIC_APP_SCHEME: 'routinekind',
    });

    expect(expo.name).toBe('RoutineKind');
    expect(expo.scheme).toBe('routinekind');
    expect(expo.ios.bundleIdentifier).toBe('com.routinekind.app.development');
    expect(expo.android.package).toBe('com.routinekind.app.development');
  });

  it('configures native app links only for normalized production domains', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_FINAL_BRAND_DOMAIN: ' https://RoutineKind.app/share ',
    });

    expect(expo.extra.publicLinkDomain).toBe('routinekind.app');
    expect(expo.ios.associatedDomains).toContain('applinks:routinekind.app');
    expect(intentFilterText(expo)).toContain('"host":"routinekind.app"');
  });

  it('keeps native app links inert for malformed, reserved, or placeholder domains', () => {
    const badDomains = [
      'https://example.com',
      'https://routinekind.local',
      'https://routinekind.localhost',
      'https://routinekind.test',
      'https://routinekind.invalid',
      'https://routinekind.example',
      'https://routinekind.app?redirect=https://evil.example',
      'https://routinekind.app:444',
      'https://user:pass@routinekind.app',
      'routinekind.app@evil.com',
      'javascript://routinekind.app',
      'routinekind',
    ];

    for (const badDomain of badDomains) {
      const expo = buildExpoConfig({ EXPO_PUBLIC_FINAL_BRAND_DOMAIN: badDomain });
      expect(expo.extra.publicLinkDomain).toBe('');
      expect(expo.ios.associatedDomains ?? []).toEqual([]);
      expect(intentFilterText(expo)).not.toContain('"host":');
    }
  });

  it('exposes only production HTTPS store URLs in native config and extra metadata', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: ' https://apps.apple.com/app/id123456789#token ',
      EXPO_PUBLIC_PLAY_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.routinekind.app#token',
    });

    expect(expo.ios.appStoreUrl).toBe('https://apps.apple.com/app/id123456789');
    expect(expo.android.playStoreUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.routinekind.app',
    );
    expect(expo.extra.appStoreUrl).toBe('https://apps.apple.com/app/id123456789');
    expect(expo.extra.playStoreUrl).toBe(
      'https://play.google.com/store/apps/details?id=com.routinekind.app',
    );
  });

  it('omits malformed, local, credentialed, or placeholder store URLs from native config', () => {
    const expo = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: 'http://apps.apple.com/app/id123456789',
      EXPO_PUBLIC_PLAY_STORE_URL:
        'https://user:pass@play.google.com/store/apps/details?id=com.routinekind.app',
    });

    expect(expo.ios.appStoreUrl).toBeUndefined();
    expect(expo.android.playStoreUrl).toBeUndefined();
    expect(expo.extra.appStoreUrl).toBe('');
    expect(expo.extra.playStoreUrl).toBe('');

    const placeholder = buildExpoConfig({
      EXPO_PUBLIC_APP_STORE_URL: 'https://example.com/app',
      EXPO_PUBLIC_PLAY_STORE_URL: 'https://routinekind.test/store',
    });
    expect(placeholder.ios.appStoreUrl).toBeUndefined();
    expect(placeholder.android.playStoreUrl).toBeUndefined();
    expect(placeholder.extra.appStoreUrl).toBe('');
    expect(placeholder.extra.playStoreUrl).toBe('');
  });
});

function releaseReadyWorklist(): ReviewWorklist {
  return JSON.parse(JSON.stringify(reviewEvidence.createReleaseReadyTestWorklist()));
}

function refreshReviewSnapshots(worklist: ReviewWorklist): void {
  for (const item of worklist.items) {
    const reviewSnapshotSha256 = reviewEvidence.computeReviewSnapshotSha256(item);
    item.reviewSnapshotSha256 = reviewSnapshotSha256;
    if (!item.signoff) continue;
    item.signoff.record.itemId = item.id;
    item.signoff.record.reviewSnapshotSha256 = reviewSnapshotSha256;
    item.signoff.record.attestor.name = item.reviewer;
    item.signoff.record.reviewDate = item.date;
  }
}

describe('Phase 3 review evidence contract', () => {
  it('accepts complete release dispositions in the isolated test fixture', () => {
    expect(
      reviewEvidence.validateReviewWorklist(releaseReadyWorklist(), { verifyHashes: false }),
    ).toEqual([]);
  });

  it('rejects unresolved review items even when every domain is represented', () => {
    const worklist = releaseReadyWorklist();
    worklist.items[0]!.statusBucket = 'notCleared';
    worklist.summary.statusCounts = { approved: 4, notCleared: 1 };

    expect(
      reviewEvidence.validateReviewWorklist(worklist, { verifyHashes: false }).join(' '),
    ).toContain('is unresolved (notCleared)');
  });

  it('rejects release dispositions without a named owner and valid date', () => {
    const worklist = releaseReadyWorklist();
    worklist.items[0]!.reviewer = 'TBD';
    worklist.items[0]!.date = '2026-02-30';

    const errors = reviewEvidence
      .validateReviewWorklist(worklist, { verifyHashes: false })
      .join(' ');
    expect(errors).toContain('has no named reviewer or decision owner');
    expect(errors).toContain('has no valid ISO review date');
  });

  it('rejects signoffs without credential, decision-condition, or retained evidence details', () => {
    const worklist = releaseReadyWorklist();
    const signoff = worklist.items[0]!.signoff!.record;
    signoff.attestor.name = 'REPLACE_WITH_REVIEWER_OR_DECISION_OWNER_NAME';
    signoff.attestor.credentialOrRole = 'REPLACE_WITH_PROFESSIONAL_CREDENTIAL_OR_OWNER_ROLE';
    signoff.decision.conditions = ['REPLACE_WITH_CONDITION_OR_REMOVE_THIS_ENTRY_IF_NONE'];
    signoff.evidenceReference = 'REPLACE_WITH_RETAINED_APPROVAL_REFERENCE';

    const errors = reviewEvidence
      .validateReviewWorklist(worklist, { verifyHashes: false })
      .join(' ');
    expect(errors).toContain('signoff has no named attestor');
    expect(errors).toContain('has no professional credential or decision-owner role');
    expect(errors).toContain('condition 1 is blank or a placeholder');
    expect(errors).toContain('has no retained approval evidence reference');
  });

  it('rejects stale snapshot digests and approvals with open conditions', () => {
    const worklist = releaseReadyWorklist();
    const signoff = worklist.items[0]!.signoff!.record;
    signoff.reviewSnapshotSha256 = '0'.repeat(64);
    signoff.decision.conditions = ['Publish only after final copy is accepted.'];
    signoff.decision.conditionsSatisfied = false;

    const errors = reviewEvidence
      .validateReviewWorklist(worklist, { verifyHashes: false })
      .join(' ');
    expect(errors).toContain('signoff is stale for the current review snapshot');
    expect(errors).toContain('cannot be approved with unsatisfied decision conditions');
  });

  it('requires a structured production gate for deferred release dispositions', () => {
    const worklist = releaseReadyWorklist();
    const item = worklist.items[0]!;
    item.statusBucket = 'deferred';
    item.notes = 'Deferred until the post-launch review is complete.';
    item.currentBehavior = 'Hidden and not exposed in production.';
    item.signoff!.record.decision.disposition = 'deferred';
    item.signoff!.record.decision.conditionsSatisfied = false;
    item.signoff!.record.productionGate = null;
    worklist.summary.statusCounts = { approved: 4, deferred: 1 };
    refreshReviewSnapshots(worklist);

    expect(
      reviewEvidence.validateReviewWorklist(worklist, { verifyHashes: false }).join(' '),
    ).toContain('deferred signoff has no production gate record');
  });

  it('rejects dirty worklists and inconsistent summary counts', () => {
    const worklist = releaseReadyWorklist();
    worklist.gitStatus = ' M docs/phase-3/clinical-review-log.md';
    worklist.summary.itemCount -= 1;

    const errors = reviewEvidence
      .validateReviewWorklist(worklist, { verifyHashes: false })
      .join(' ');
    expect(errors).toContain('generated from a dirty worktree');
    expect(errors).toContain('item count is inconsistent');
  });

  it('rejects deferred items without a reason and hidden-production posture', () => {
    const worklist = releaseReadyWorklist();
    worklist.items[0]!.statusBucket = 'deferred';
    worklist.items[0]!.notes = 'TBD';
    worklist.items[0]!.currentBehavior = 'Available in production';
    worklist.summary.statusCounts = { approved: 4, deferred: 1 };

    const errors = reviewEvidence
      .validateReviewWorklist(worklist, { verifyHashes: false })
      .join(' ');
    expect(errors).toContain('has no deferral reason');
    expect(errors).toContain('does not document a production exposure gate');
  });

  it('rejects source evidence whose recorded hash no longer matches', () => {
    const rootDir = resolve(process.cwd(), '../..');
    const bytes = readFileSync(resolve(rootDir, 'package.json'));
    const source = {
      path: 'package.json',
      exists: true,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    const worklist = releaseReadyWorklist();
    worklist.reviewLogs = worklist.reviewLogs.map((log) => ({
      ...source,
      domain: log.domain,
    }));
    worklist.items = worklist.items.map((item) => ({ ...item, sourcePaths: [{ ...source }] }));
    refreshReviewSnapshots(worklist);

    expect(
      reviewEvidence.validateReviewWorklist(worklist, {
        rootDir,
        verifyLogRows: false,
        verifySignoffFiles: false,
      }),
    ).toEqual([]);
    worklist.items[0]!.sourcePaths[0]!.sha256 = '0'.repeat(64);
    expect(
      reviewEvidence
        .validateReviewWorklist(worklist, {
          rootDir,
          verifyLogRows: false,
          verifySignoffFiles: false,
        })
        .join(' '),
    ).toContain('source hash is stale');
  });

  it('reparses review logs instead of trusting a tampered JSON disposition', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'routinekind-phase3-review-'));
    try {
      writeFileSync(resolve(rootDir, 'package.json'), '{}\n');
      const packageBytes = readFileSync(resolve(rootDir, 'package.json'));
      const packageSource = {
        path: 'package.json',
        exists: true,
        bytes: packageBytes.length,
        sha256: createHash('sha256').update(packageBytes).digest('hex'),
      };
      const headings: Record<string, string> = {
        legalRegulatory: '## Inventory',
        clinical: '## Content Inventory',
        cosmeticChemistry: '## Inventory',
        privacySecurity: '## Inventory',
        ipFto: '## Inventory',
      };
      const worklist = releaseReadyWorklist();
      worklist.reviewLogs = worklist.reviewLogs.map((log) => {
        const logPath = `docs/${log.domain}.md`;
        const absoluteLogPath = resolve(rootDir, logPath);
        mkdirSync(dirname(absoluteLogPath), { recursive: true });
        writeFileSync(
          absoluteLogPath,
          [
            headings[log.domain],
            '',
            '| Area | Source | Current behavior | Reviewer | Date | Status | Notes |',
            '| --- | --- | --- | --- | --- | --- | --- |',
            '| Release decision | `package.json` | Approved for production. | Dr. Avery Chen | 2020-01-01 | Approved | Complete isolated review decision fixture. |',
            '',
          ].join('\n'),
        );
        const logBytes = readFileSync(absoluteLogPath);
        return {
          domain: log.domain,
          path: logPath,
          exists: true,
          bytes: logBytes.length,
          sha256: createHash('sha256').update(logBytes).digest('hex'),
        };
      });
      worklist.items = worklist.items.map((item) => ({
        ...item,
        id: `${item.domain}:release-decision`,
        reviewer: 'Dr. Avery Chen',
        sourceText: '`package.json`',
        sourcePaths: [{ ...packageSource }],
      }));
      refreshReviewSnapshots(worklist);

      expect(
        reviewEvidence.validateReviewWorklist(worklist, {
          rootDir,
          verifySignoffFiles: false,
        }),
      ).toEqual([]);
      worklist.items[0]!.statusBucket = 'deferred';
      worklist.summary.statusCounts = { approved: 4, deferred: 1 };
      expect(
        reviewEvidence
          .validateReviewWorklist(worklist, { rootDir, verifySignoffFiles: false })
          .join(' '),
      ).toContain('disposition does not match its review log');

      worklist.items[0]!.statusBucket = 'approved';
      worklist.items[0]!.currentBehavior = 'Tampered generated behavior.';
      worklist.summary.statusCounts = { approved: 5 };
      refreshReviewSnapshots(worklist);
      expect(
        reviewEvidence
          .validateReviewWorklist(worklist, { rootDir, verifySignoffFiles: false })
          .join(' '),
      ).toContain('current behavior does not match its review log');
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });

  it('re-reads detached signoff files instead of trusting embedded JSON', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'routinekind-phase3-signoff-'));
    try {
      const worklist = releaseReadyWorklist();
      for (const item of worklist.items) {
        const path = `docs/phase-3/signoffs/${item.domain}--release-decision.json`;
        const absolutePath = resolve(rootDir, path);
        mkdirSync(dirname(absolutePath), { recursive: true });
        writeFileSync(absolutePath, `${JSON.stringify(item.signoff!.record, null, 2)}\n`);
        const bytes = readFileSync(absolutePath);
        item.signoff!.file = {
          path,
          exists: true,
          bytes: bytes.length,
          sha256: createHash('sha256').update(bytes).digest('hex'),
        };
      }

      expect(
        reviewEvidence.validateReviewWorklist(worklist, {
          rootDir,
          verifyHashes: false,
          verifySignoffFiles: true,
        }),
      ).toEqual([]);

      const firstSignoffPath = resolve(rootDir, worklist.items[0]!.signoff!.file.path);
      writeFileSync(firstSignoffPath, '{}\n');
      const errors = reviewEvidence
        .validateReviewWorklist(worklist, {
          rootDir,
          verifyHashes: false,
          verifySignoffFiles: true,
        })
        .join(' ');
      expect(errors).toContain('signoff source hash is stale');
      expect(errors).toContain('embedded signoff record does not match its current JSON file');
    } finally {
      rmSync(rootDir, { force: true, recursive: true });
    }
  });
});
