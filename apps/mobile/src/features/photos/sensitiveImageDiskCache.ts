import { Image } from 'expo-image';
import { Platform } from 'react-native';

let migrationComplete = Platform.OS === 'web';
let migrationInFlight: Promise<boolean> | null = null;

/**
 * Older PhotoImage builds inherited expo-image's disk-cache default. Scrub that
 * global native cache once per process before any encrypted photo is allowed to
 * decrypt. A failed/false clear remains incomplete and the next startup/mount
 * retries; callers must fail closed while this returns false.
 */
export function prepareSensitiveImageDiskCacheMigration(): Promise<boolean> {
  if (migrationComplete) return Promise.resolve(true);
  if (migrationInFlight) return migrationInFlight;

  const attempt = Promise.resolve()
    .then(() => Image.clearDiskCache())
    .then((cleared) => {
      migrationComplete = cleared === true;
      return migrationComplete;
    })
    .catch(() => false)
    .finally(() => {
      if (migrationInFlight === attempt) migrationInFlight = null;
    });
  migrationInFlight = attempt;
  return attempt;
}

export function isSensitiveImageDiskCacheMigrationComplete(): boolean {
  return migrationComplete;
}
