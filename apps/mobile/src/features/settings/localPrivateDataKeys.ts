import { brandCachePrefix } from '@/lib/brand';

export {
  LOCAL_PRIVATE_CONTROL_KEYS,
  LOCAL_PRIVATE_DATA_KEYS,
  LOCAL_PRIVATE_METADATA_KEYS,
  LOCAL_PRIVATE_SECURE_STORE_KEYS,
} from './localPrivateDataRegistry';

export const LOCAL_PRIVATE_CACHE_FILENAMES = ['onskin-export.json'] as const;

export const CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES = [
  'routinekind-export-',
  'routinekind-share-',
] as const;

export const LEGACY_LOCAL_PRIVATE_CACHE_PREFIXES = ['onskin-export-', 'onskin-share-'] as const;

export const LOCAL_PRIVATE_CACHE_PREFIXES = [
  ...CURRENT_LOCAL_PRIVATE_CACHE_PREFIXES,
  ...LEGACY_LOCAL_PRIVATE_CACHE_PREFIXES,
] as const;

export function localPrivateCachePrefixes(): readonly string[] {
  return [
    ...new Set([
      ...LOCAL_PRIVATE_CACHE_PREFIXES,
      brandCachePrefix('export'),
      brandCachePrefix('share'),
    ]),
  ];
}
