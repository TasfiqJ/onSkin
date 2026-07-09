const SAFE_STORAGE_PATH_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

function isSafeStoragePathSegment(segment: string): boolean {
  return SAFE_STORAGE_PATH_SEGMENT.test(segment) && segment !== '.' && segment !== '..';
}

export function photoPathBelongsToUser(userId: string, storagePath: string): boolean {
  if (!isSafeStoragePathSegment(userId)) return false;

  const segments = storagePath.split('/');
  const [prefix, ...objectSegments] = segments;
  if (prefix !== userId || objectSegments.length === 0) return false;

  return objectSegments.every(isSafeStoragePathSegment);
}
