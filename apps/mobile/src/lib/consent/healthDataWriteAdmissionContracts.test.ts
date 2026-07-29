import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { HEALTH_PURPOSE_PRIVATE_DATA_KEYS } from './healthDataWriteAdmission';
import {
  CATALOG_HEALTH_EPOCH_FUNCTION_NAMES,
  HEALTH_PROCESSING_POSTGREST_RPC_NAMES,
  HEALTH_PROCESSING_POSTGREST_TABLES,
} from './healthProcessingEpoch';

const SRC = fileURLToPath(new URL('../../', import.meta.url));
const HEALTH_LIFECYCLE_MIGRATION = fileURLToPath(
  new URL(
    '../../../../../supabase/migrations/20260715000054_health_consent_withdrawal_lifecycle.sql',
    import.meta.url,
  ),
);
const CATALOG_SCAN_MINIMIZATION_MIGRATION = fileURLToPath(
  new URL(
    '../../../../../supabase/migrations/20260718000059_catalog_scan_minimization.sql',
    import.meta.url,
  ),
);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('health-purpose local write coverage', () => {
  it('keeps the canonical mobile PostgREST set aligned with every database read fence', () => {
    const migration = readFileSync(HEALTH_LIFECYCLE_MIGRATION, 'utf8');
    const minimizationMigration = readFileSync(CATALOG_SCAN_MINIMIZATION_MIGRATION, 'utf8');
    const retiredFences = new Set(
      [
        ...minimizationMigration.matchAll(
          /drop policy if exists "health_processing_read_fence" on public\.([a-z_]+)/gu,
        ),
      ].map((match) => match[1]!),
    );
    const migratedTables = [
      ...migration.matchAll(/create policy "health_processing_read_fence" on public\.([a-z_]+)/gu),
    ]
      .map((match) => match[1]!)
      .filter((table) => !retiredFences.has(table))
      .sort();
    const mobileTables = HEALTH_PROCESSING_POSTGREST_TABLES.filter(
      (table) => table !== 'profiles',
    ).sort();

    expect(mobileTables).toEqual(migratedTables);
    expect(HEALTH_PROCESSING_POSTGREST_TABLES).toContain('profiles');
  });

  it('routes every classified literal writer through privateKV, with only explicit cleanup bypasses', () => {
    const permittedDirectCleanupFiles = new Set([
      `${SRC}/features/healthConsent/selectiveCleanup.ts`.replaceAll('\\', '/'),
      `${SRC}/features/settings/localPrivateData.ts`.replaceAll('\\', '/'),
    ]);
    const directMutation =
      /AsyncStorage\.(?:setItem|multiSet|mergeItem|removeItem|multiRemove)\s*\(/;
    const bypasses: string[] = [];

    for (const path of walk(SRC)) {
      const source = readFileSync(path, 'utf8');
      if (!directMutation.test(source)) continue;
      for (const key of HEALTH_PURPOSE_PRIVATE_DATA_KEYS) {
        if (source.includes(`'${key}'`) || source.includes(`"${key}"`)) {
          const normalized = path.replaceAll('\\', '/');
          const centralPrivateKV = normalized.endsWith('/lib/storage/privateKV.ts');
          if (!centralPrivateKV && !permittedDirectCleanupFiles.has(normalized)) {
            bypasses.push(`${normalized}:${key}`);
          }
        }
      }
    }
    expect(bypasses).toEqual([]);

    const privateKV = readFileSync(`${SRC}/lib/storage/privateKV.ts`, 'utf8');
    expect(
      privateKV.match(/captureHealthPurposePrivateDataWriteLease\(key\)/g)?.length,
    ).toBeGreaterThan(0);
    expect(privateKV).toContain('assertHealthDataWriteLease(healthWriteLease)');
    expect(privateKV).not.toContain('assertHealthPurposePrivateDataWriteAllowed(key)');
  });

  it('enumerates every direct health remote operation and requires one entry-to-result lease', () => {
    expect(HEALTH_PROCESSING_POSTGREST_RPC_NAMES).toEqual([
      'record_routine_completion',
      'refresh_routine_adherence',
      'set_recommendation_preferences',
      'set_routine_adherence_timezone',
      'sync_shelf_product',
    ]);
    const admittedPostgrest = [
      'app/index.tsx:skin_profiles',
      'features/commerce/store.ts:commerce_click_events',
      'features/onboarding/OnboardingContext.tsx:skin_profiles',
      'features/photos/store.ts:photos',
      'features/routine/useProgress.ts:routine_completions',
      'features/scheduler/profile.ts:skin_profiles',
      'features/trend/useTrend.ts:skin_profiles',
    ].sort();
    const explicitExemptions: string[] = [];
    const classifiedTables = new Set<string>(HEALTH_PROCESSING_POSTGREST_TABLES);
    const observed: string[] = [];

    for (const path of walk(SRC)) {
      const source = readFileSync(path, 'utf8');
      const relative = path
        .replaceAll('\\', '/')
        .slice(`${SRC}`.replaceAll('\\', '/').replace(/\/$/u, '').length)
        .replace(/^\/+/, '');
      for (const match of source.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)/gu)) {
        const table = match[1]!;
        if (classifiedTables.has(table)) observed.push(`${relative}:${table}`);
      }
    }

    expect(observed.sort()).toEqual([...admittedPostgrest, ...explicitExemptions].sort());
    for (const entry of new Set(admittedPostgrest)) {
      const file = entry.slice(0, entry.lastIndexOf(':'));
      const source = readFileSync(`${SRC}/${file}`, 'utf8');
      if (file === 'features/commerce/store.ts') {
        expect(source, file).toContain("runHealthDependentConsentOperation('data_sharing'");
      } else {
        expect(source, file).toMatch(/runHealthData(?:Write)?Operation/u);
      }
      expect(source, file).toContain('lease.assertCurrent()');
    }

    const completionQueue = readFileSync(`${SRC}/lib/offline/completionQueue.ts`, 'utf8');
    expect(completionQueue).toContain("'record_routine_completion'");
    expect(completionQueue).toContain('runHealthDataOperation');
    expect(completionQueue.match(/lease\.assertCurrent\(\)/gu)?.length).toBeGreaterThanOrEqual(6);

    const shelfMirrorQueue = readFileSync(`${SRC}/lib/offline/shelfMirrorQueue.ts`, 'utf8');
    expect(shelfMirrorQueue).toContain("'sync_shelf_product'");
    expect(shelfMirrorQueue).toContain('runHealthDataOperation');
    expect(shelfMirrorQueue).not.toContain(".from('user_products')");
    expect(shelfMirrorQueue.match(/lease\.assertCurrent\(\)/gu)?.length).toBeGreaterThanOrEqual(6);

    const recommendationStore = readFileSync(`${SRC}/features/recommendations/store.ts`, 'utf8');
    expect(recommendationStore).toContain("'set_recommendation_preferences'");
    expect(recommendationStore).toContain('runHealthDataWriteOperation');
    expect(recommendationStore).not.toContain(".from('recommendation_preferences')");
    expect(recommendationStore.match(/lease\.assertCurrent\(\)/gu)?.length).toBeGreaterThanOrEqual(
      4,
    );

    const catalog = readFileSync(`${SRC}/features/catalog/client.ts`, 'utf8');
    const catalogFunctions = [...catalog.matchAll(/functions\.invoke\(\s*['"]([^'"]+)['"]/gu)]
      .map((match) => match[1])
      .filter((name) => name?.startsWith('catalog-'))
      .sort();
    expect(catalogFunctions).toEqual([...CATALOG_HEALTH_EPOCH_FUNCTION_NAMES].sort());
    expect(catalog).toContain('runHealthDataWriteOperation');
    expect(catalog.match(/lease\.assertCurrent\(\)/gu)?.length).toBeGreaterThanOrEqual(9);
  });

  it('leases every photo plaintext/live-data output while keeping deletion-only APIs open', () => {
    const photos = readFileSync(`${SRC}/features/photos/encryptedStorage.ts`, 'utf8');
    const leasedSections = [
      ['encryptCapturedPhoto', 'decryptPhotoToDataUri'],
      ['decryptPhotoToDataUri', 'createPhotoShareFile'],
      ['createPhotoShareFile', 'deletePhotoShareFile'],
      ['restoreQuarantinedPhoto', 'deleteQuarantinedPhoto'],
      ['reconcileEncryptedPhotoStorage', 'clearEncryptedPhotoStorage'],
      ['encryptPhotoNote', 'decryptPhotoNote'],
      ['decryptPhotoNote', 'isPhotoEncryptionReadError'],
    ] as const;
    for (const [start, end] of leasedSections) {
      const section = photos.slice(
        photos.indexOf(`export async function ${start}`),
        photos.indexOf(`export async function ${end}`),
      );
      expect(section, start).toContain('captureHealthDataWriteLease()');
      expect(section, start).toContain('assertHealthDataWriteLease(healthLease)');
    }

    for (const [start, end] of [
      ['deletePhotoShareFile', 'deleteEncryptedPhoto'],
      ['deleteEncryptedPhoto', 'deleteCapturedPhotoSource'],
      ['deleteCapturedPhotoSource', 'quarantineEncryptedPhoto'],
      ['quarantineEncryptedPhoto', 'restoreQuarantinedPhoto'],
      ['deleteQuarantinedPhoto', 'reconcileEncryptedPhotoStorage'],
      ['clearEncryptedPhotoStorage', 'encryptPhotoNote'],
    ] as const) {
      const section = photos.slice(
        photos.indexOf(`export async function ${start}`),
        photos.indexOf(`export async function ${end}`),
      );
      expect(section, start).not.toContain('captureHealthDataWriteLease()');
    }
  });

  it('keeps the consent-bypassing data-rights lane narrow and account-bound', () => {
    const privateKV = readFileSync(`${SRC}/lib/storage/privateKV.ts`, 'utf8');
    const localExport = readFileSync(`${SRC}/features/settings/localDeviceExport.ts`, 'utf8');
    const actions = readFileSync(`${SRC}/features/settings/actions.ts`, 'utf8');
    const photos = readFileSync(`${SRC}/features/photos/encryptedStorage.ts`, 'utf8');

    expect(localExport).toContain('getPrivateItemsForPurposeLimitedExport(');
    expect(localExport).toContain('decryptPhotoNoteForPurposeLimitedExport(');
    expect(localExport).not.toMatch(/\bgetPrivateItems\(/u);
    expect(localExport).not.toMatch(/\bdecryptPhotoNote\(/u);
    expect(localExport).toContain('accountLease.assertCurrent()');
    expect(actions).toContain('readLocalDataOwnership(expectedUserId)');
    expect(actions).toContain('collectLocalDeviceExportData(lease, expectedUserId)');

    const validation = privateKV.slice(
      privateKV.indexOf('async function validatePrivateItemsWithoutRetainingPlaintext'),
      privateKV.indexOf('export function assertPrivateKVReadable'),
    );
    expect(validation).toContain('validateEnvelopeAuthentication(envelope, contentKey)');
    expect(validation).toContain('contentKey.fill(0)');
    expect(validation).not.toContain('bytesToUtf8');
    expect(validation).not.toContain('new Map');

    const exportNote = photos.slice(
      photos.indexOf('export async function decryptPhotoNoteForPurposeLimitedExport'),
      photos.indexOf('export function isPhotoEncryptionReadError'),
    );
    expect(exportNote).toContain('accountLease.assertCurrent()');
    expect(exportNote).not.toContain('captureHealthDataWriteLease()');

    const privateExportConsumers: string[] = [];
    const noteExportConsumers: string[] = [];
    for (const path of walk(SRC)) {
      const source = readFileSync(path, 'utf8');
      const relative = path
        .replaceAll('\\', '/')
        .slice(SRC.replaceAll('\\', '/').replace(/\/$/u, '').length)
        .replace(/^\/+/, '');
      if (source.includes('getPrivateItemsForPurposeLimitedExport')) {
        privateExportConsumers.push(relative);
      }
      if (source.includes('decryptPhotoNoteForPurposeLimitedExport')) {
        noteExportConsumers.push(relative);
      }
    }
    expect(privateExportConsumers.sort()).toEqual(
      ['features/settings/localDeviceExport.ts', 'lib/storage/privateKV.ts'].sort(),
    );
    expect(noteExportConsumers.sort()).toEqual(
      ['features/photos/encryptedStorage.ts', 'features/settings/localDeviceExport.ts'].sort(),
    );
  });
});
