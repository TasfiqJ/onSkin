import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { REQUEST_ENDPOINTS } from './requestPolicy';

const SRC_DIR = fileURLToPath(new URL('../../', import.meta.url));

function productionSources(directory = SRC_DIR): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return productionSources(path);
    if (!/\.[cm]?[jt]sx?$/.test(name) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(name)) {
      return [];
    }
    return [path];
  });
}

function normalized(path: string): string {
  return relative(SRC_DIR, path).replaceAll('\\', '/');
}

function source(path: string): string {
  return readFileSync(path, 'utf8');
}

const READ_ONLY_ENDPOINTS_BY_FILE = {
  'features/commerce/useCommerce.ts': ['commerce_links'],
  'features/onboarding/onboardingStatusQuery.ts': ['onboarding_status'],
  'features/routine/useProgress.ts': ['progress_completions', 'progress_longest_streak'],
  'features/scheduler/profile.ts': ['profile_server'],
  'features/subscription/store.ts': ['entitlement_server'],
  'features/trend/consent.ts': ['trend_consent'],
  'features/trend/useTrend.ts': ['trend_monk_band'],
  'lib/consent/consent.ts': ['consent_ledger'],
} as const;

const POLICY_BOUND_IDEMPOTENT_MUTATIONS_BY_FILE = {
  'features/commerce/store.ts': ['commerce_click_event'],
  'features/photos/store.ts': ['photo_delete_mirror'],
  'lib/offline/completionQueue.ts': ['completion_sync'],
} as const;

/** These direct mutations already carry owner abort fencing, but at least one
 * operation in each file lacks the exact identity/order contract required for
 * a safe timeout race or retry. Freeze the list so a bypass cannot grow. */
const DEFERRED_MUTATION_POLICY_FILES = [
  'features/intelligence/conflictChoiceMirror.ts',
  'features/notifications/deliver.ts',
  'features/onboarding/OnboardingContext.tsx',
  'features/recommendations/store.ts',
  'features/shelf/scanLog.ts',
  'lib/consent/consent.ts',
] as const;

describe('production request-policy inventory', () => {
  const files = productionSources();

  it('routes every direct read-only PostgREST call through the bounded owner policy', () => {
    const directReadFiles = files
      .filter((path) => {
        const text = source(path);
        return text.includes('supabase') && text.includes('.from(') && text.includes('.select(');
      })
      .map(normalized)
      .sort();

    expect(directReadFiles).toEqual(Object.keys(READ_ONLY_ENDPOINTS_BY_FILE).sort());
    for (const [relativePath, endpoints] of Object.entries(READ_ONLY_ENDPOINTS_BY_FILE)) {
      const text = source(join(SRC_DIR, relativePath));
      expect(text.match(/\.select\(/g) ?? [], relativePath).toHaveLength(endpoints.length);
      for (const endpoint of endpoints) {
        expect(text, relativePath).toContain(`endpoint: '${endpoint}'`);
      }
      expect(text, relativePath).toContain('runRequestWithLease');
      expect(text, relativePath).toContain('supabaseRequestFailure');
      expect(text, relativePath).toContain('.abortSignal(signal)');
      expect(text, relativePath).toContain('deadlineMs:');
      expect(text, relativePath).toContain('maxAttempts:');
      expect(text, relativePath).toContain('maxResponseBytes:');
    }
  });

  it('contains Edge invocation and the one payload-free gateway probe', () => {
    const rawInvokeFiles = files
      .filter((path) => source(path).includes('supabase.functions.invoke'))
      .map(normalized);
    const rawFetchFiles = files.filter((path) => /\bfetch\(/.test(source(path))).map(normalized);
    const rawRpcFiles = files
      .filter((path) => source(path).includes('supabase') && source(path).includes('.rpc('))
      .map(normalized);
    const rawStorageFiles = files
      .filter((path) => source(path).includes('supabase.storage'))
      .map(normalized);

    expect(rawInvokeFiles).toEqual(['lib/network/edgeFunctions.ts']);
    expect(rawFetchFiles).toEqual(['lib/diagnostics/localDiagnosticsRuntime.ts']);
    expect(rawRpcFiles).toEqual(['lib/auth/accountDeletionCompletion.ts', 'lib/offline/outbox.ts']);
    expect(rawStorageFiles).toEqual([]);

    const deletionCompletion = source(join(SRC_DIR, rawRpcFiles[0]!));
    expect(deletionCompletion).toContain('runRequest(');
    expect(deletionCompletion).toContain("endpoint: 'account_deletion'");
    expect(deletionCompletion).toContain('ownerScoped: false');
    expect(deletionCompletion).toContain('.abortSignal(attemptSignal)');

    const outbox = source(join(SRC_DIR, 'lib/offline/outbox.ts'));
    expect(outbox).toContain('runRequestWithLease(');
    expect(outbox).toContain("endpoint: 'outbox_sync'");
    expect(outbox).toContain('idempotent: true');
    expect(outbox).toContain('maxAttempts: 2');
    expect(outbox).toContain('.abortSignal(signal)');

    const diagnostics = source(join(SRC_DIR, rawFetchFiles[0]!));
    expect(diagnostics).toContain("method: 'HEAD'");
    expect(diagnostics).toContain('new AbortController()');
    expect(diagnostics).toContain('CATALOG_GATEWAY_TIMEOUT_MS');
    expect(diagnostics).toContain('controller.abort()');
  });

  it('freezes direct mutation exceptions behind owner abort fencing', () => {
    const mutationFiles = files
      .filter((path) => {
        const text = source(path);
        return (
          text.includes('supabase') &&
          text.includes('.from(') &&
          /\.(?:delete|insert|update|upsert)\(/.test(text)
        );
      })
      .map(normalized)
      .sort();

    const expectedMutationFiles = new Set([
      ...Object.keys(POLICY_BOUND_IDEMPOTENT_MUTATIONS_BY_FILE),
      ...DEFERRED_MUTATION_POLICY_FILES,
    ]);
    expect(mutationFiles).toEqual([...expectedMutationFiles].sort());

    for (const [relativePath, endpoints] of Object.entries(
      POLICY_BOUND_IDEMPOTENT_MUTATIONS_BY_FILE,
    )) {
      const text = source(join(SRC_DIR, relativePath));
      expect(text, relativePath).toContain('runRequestWithLease');
      expect(text, relativePath).toContain('idempotent: true');
      expect(text, relativePath).toContain('maxAttempts: 2');
      expect(text, relativePath).toContain('maxResponseBytes:');
      for (const endpoint of endpoints) {
        expect(text, relativePath).toContain(`endpoint: '${endpoint}'`);
      }
    }

    for (const relativePath of DEFERRED_MUTATION_POLICY_FILES) {
      const text = source(join(SRC_DIR, relativePath));
      expect(text, relativePath).toMatch(/run(?:AccountGeneration|OwnerQuery)Operation/);
      expect(text, relativePath).toContain('.abortSignal(');
    }
  });

  it('keeps endpoint names fixed, unique, and content-free', () => {
    expect(new Set(REQUEST_ENDPOINTS).size).toBe(REQUEST_ENDPOINTS.length);
    expect(REQUEST_ENDPOINTS).toHaveLength(21);
    for (const endpoint of REQUEST_ENDPOINTS) {
      expect(endpoint).toMatch(/^[a-z][a-z0-9_]{2,63}$/);
      expect(endpoint).not.toMatch(
        /token|user|account_id|barcode|product|string|query|search_term/,
      );
    }
  });
});
